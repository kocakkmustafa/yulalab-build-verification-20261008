import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GET } from "@/app/api/mail/route";
import { createIsolatedSchema, dropSchema, testDatabaseUrl } from "./helpers/attribution-db";
import { resetPool } from "@/server/db";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
} from "@/server/data-request-token";
import { APPROVED_MAIL_IDENTITY, MAIL_IDENTITY_ENV } from "@/server/mail-identity";

const original = { ...process.env };
const localLoginUrl = (schema: string) => {
  const url = new URL(testDatabaseUrl(schema));
  url.username = process.env.USER ?? "postgres";
  return url.toString();
};

function configureMailIdentity() {
  process.env[MAIL_IDENTITY_ENV.fromEmail] = APPROVED_MAIL_IDENTITY.fromEmail;
  process.env[MAIL_IDENTITY_ENV.fromName] = APPROVED_MAIL_IDENTITY.fromName;
  process.env[MAIL_IDENTITY_ENV.replyToEmail] = APPROVED_MAIL_IDENTITY.replyToEmail;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.CRON_SECRET;
  delete process.env.YULA_INTAKE_DATABASE_URL;
  delete process.env.YULA_MAIL_DATABASE_URL;
  delete process.env.YULA_PURGE_DATABASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...original };
});

function get(authorization?: string) {
  return new Request("https://yulalab.com/api/mail", {
    headers: authorization ? { authorization } : {},
  });
}

describe("who may drain the queue", () => {
  it("refuses an anonymous caller", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(get())).status).toBe(401);
  });

  it("refuses a wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(get("Bearer wrong!"))).status).toBe(401);
  });

  it("refuses everyone when no secret is configured, rather than running open", async () => {
    // A deployment that forgot CRON_SECRET must not expose a send endpoint,
    // and must answer identically to a wrong guess so nobody can tell which.
    const unset = await GET(get("Bearer anything"));
    expect(unset.status).toBe(401);
    expect(await unset.json()).toEqual({ drained: null, reason: "unauthorized" });
  });
});

describe("with no database", () => {
  it("says so instead of pretending the queue was empty", async () => {
    // {delivered: 0} would read as "nothing to send" on a monitor.
    process.env.CRON_SECRET = "s3cret";
    const response = await GET(get("Bearer s3cret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ drained: null, reason: "storage_unavailable" });
  });
});

describe("the schedule", () => {
  it("is registered in vercel.json, because an unrun consumer is the defect", () => {
    // The whole point of this route. purgeExpiredLeads shipped with no
    // caller once already; a drain with no schedule repeats it exactly.
    //
    // Only that an entry EXISTS. Asserting the daily shape would encode the
    // current cadence as the intended one, and it is not: the roadmap's
    // target is a receipt within 60 seconds, and daily is roughly four
    // orders of magnitude off that. Sub-daily cron needs a paid plan, which
    // is a founder gate — so this is an unmet acceptance criterion held
    // open, not a shape to lock in. Nothing published promises faster.
    const config = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, "../vercel.json"), "utf8"),
    ) as { crons: { path: string; schedule: string }[] };
    const entry = config.crons.find((c) => c.path === "/api/mail");
    expect(entry).toBeDefined();
    expect(entry!.schedule).toMatch(/^[\d*/ ,-]+$/);
  });
});

describe("when the scheduler actually calls it", () => {
  const SCHEMA = "t_mail_route";

  it("sends what is queued and stamps it, against a real database", async () => {
    // The three tests above stop at 401 and 503. With only those, replacing
    // the drainOutbox call with a hardcoded {delivered: 0, ...} left the
    // whole suite green — this route would have shipped consuming nothing,
    // which is precisely the defect its own docstring atones for.
    const pool = await createIsolatedSchema(SCHEMA);
    try {
      for (const file of [
        "../db/migrations/0002_leads_consents_outbox.sql",
        "../db/migrations/0003_data_request_verification.sql",
      ]) {
        await pool.query(readFileSync(path.resolve(import.meta.dirname, file), "utf8"));
      }
      const { rows } = await pool.query(
        `INSERT INTO leads (name, email, intent, message, locale, dedupe_key)
         VALUES ('Ada', 'ada@example.com', 'studio', 'hello', 'tr', repeat('b', 64))
         RETURNING id`,
      );
      await pool.query(
        `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
         VALUES ('lead_receipt', $1, '{"receiptId":"YL-1","locale":"tr"}'::jsonb)`,
        [rows[0].id],
      );

      process.env.CRON_SECRET = "s3cret";
      process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake-test@invalid.invalid/yula";
      process.env.YULA_DATABASE_SCHEMA = SCHEMA;
      process.env.YULA_MAIL_DATABASE_URL = localLoginUrl(SCHEMA);
      process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
      process.env.LEADS_ENABLED = "1";
      process.env.SENDGRID_API_KEY = "SG.key";
      configureMailIdentity();
      process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = "d-cef2371a06014280857d0f17e3056305";
      process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = "d-d42d50b22fda48e49cfbb6ab373f420e";
      const fetchMock = vi.fn(async () => new Response("", { status: 202 }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await GET(get("Bearer s3cret"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ delivered: 1, remaining: 0 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const after = await pool.query("SELECT delivered_at FROM event_outbox");
      expect(after.rows[0].delivered_at).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
      await resetPool("mail");
      await dropSchema(pool, SCHEMA);
    }
  });

  it("drains accepted data-request verification work after intake closes", async () => {
    const pool = await createIsolatedSchema(`${SCHEMA}_data_request`);
    try {
      for (const file of [
        "../db/migrations/0002_leads_consents_outbox.sql",
        "../db/migrations/0003_data_request_verification.sql",
      ]) {
        await pool.query(readFileSync(path.resolve(import.meta.dirname, file), "utf8"));
      }
      await pool.query(`ALTER TABLE data_requests
        ADD COLUMN verification_sent_at timestamptz,
        ADD COLUMN verification_token_key_id text,
        ADD COLUMN verification_queue_expires_at timestamptz,
        ADD COLUMN purge_at timestamptz;
        ALTER TABLE data_requests DROP CONSTRAINT pending_requires_a_live_token;
        ALTER TABLE data_requests ADD CONSTRAINT pending_requires_a_live_token CHECK (
          verification_state <> 'pending'
          OR (verification_token_hash IS NOT NULL
              AND verification_token_key_id IS NOT NULL
              AND verification_queue_expires_at IS NOT NULL
              AND purge_at IS NOT NULL)
        )`);

      process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
      process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] =
        "test-only-current-data-request-secret-32-bytes";
      const { createDataRequest } = await import("@/server/data-requests");
      await createDataRequest(
        pool,
        { email: "accepted-before-close@example.com", requestType: "access", locale: "en" },
        { now: new Date() },
      );

      process.env.CRON_SECRET = "s3cret";
      process.env.YULA_DATABASE_SCHEMA = `${SCHEMA}_data_request`;
      process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake-test@invalid.invalid/yula";
      process.env.YULA_MAIL_DATABASE_URL = localLoginUrl(`${SCHEMA}_data_request`);
      process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
      delete process.env.LEADS_ENABLED;
      process.env.SENDGRID_API_KEY = "SG.key";
      configureMailIdentity();
      process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
        "d-934e79bac8f841dfb7066e169d8f4ffc";
      process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
        "d-e9aeeaa9dc8949679777b61eed0f41dc";
      const fetchMock = vi.fn(async () => new Response("", { status: 202 }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await GET(get("Bearer s3cret"));
      const body = await response.json();
      expect({ status: response.status, body }).toEqual({
        status: 200,
        body: expect.objectContaining({ delivered: 1, remaining: 0 }),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const after = await pool.query("SELECT delivered_at FROM event_outbox");
      expect(after.rows[0].delivered_at).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
      await resetPool("mail");
      await dropSchema(pool, `${SCHEMA}_data_request`);
    }
  });
});

describe("a queue with rows nothing will ever retry", () => {
  const SCHEMA = "t_mail_route_dead";

  it("answers 503 with the counts, not 200 with a clean-looking body", async () => {
    // A row past MAX_ATTEMPTS is a person who will never receive a receipt
    // and nothing will try again. `remaining` carries the same attempts
    // filter as the claim query, so it reads 0 exactly when that becomes
    // permanent — the body looks like an empty, healthy queue.
    const pool = await createIsolatedSchema(SCHEMA);
    try {
      for (const file of [
        "../db/migrations/0002_leads_consents_outbox.sql",
        "../db/migrations/0003_data_request_verification.sql",
      ]) {
        await pool.query(readFileSync(path.resolve(import.meta.dirname, file), "utf8"));
      }
      const { rows } = await pool.query(
        `INSERT INTO leads (name, email, intent, message, locale, dedupe_key)
         VALUES ('Ada', 'ada@example.com', 'studio', 'hello', 'tr', repeat('c', 64))
         RETURNING id`,
      );
      await pool.query(
        `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, attempts)
         VALUES ('lead_receipt', $1, '{"receiptId":"YL-1","locale":"tr"}'::jsonb, 5)`,
        [rows[0].id],
      );

      process.env.CRON_SECRET = "s3cret";
      process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake-test@invalid.invalid/yula";
      process.env.YULA_DATABASE_SCHEMA = SCHEMA;
      process.env.YULA_MAIL_DATABASE_URL = localLoginUrl(SCHEMA);
      process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
      process.env.LEADS_ENABLED = "1";
      process.env.SENDGRID_API_KEY = "SG.key";
      configureMailIdentity();
      process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = "d-cef2371a06014280857d0f17e3056305";
      process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = "d-d42d50b22fda48e49cfbb6ab373f420e";
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 202 })));

      const response = await GET(get("Bearer s3cret"));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ dead: 1, remaining: 0, delivered: 0 });
    } finally {
      vi.unstubAllGlobals();
      await resetPool("mail");
      await dropSchema(pool, SCHEMA);
    }
  });
});
