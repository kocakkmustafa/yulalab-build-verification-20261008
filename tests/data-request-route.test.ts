import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { testDatabaseUrl } from "./helpers/attribution-db";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
} from "@/server/data-request-token";
import { APPROVED_MAIL_IDENTITY, MAIL_IDENTITY_ENV } from "@/server/mail-identity";

const SCHEMA = "t_dsr_route";
const ORIGIN = "https://yulalab.com";
const INTAKE_ROLE = "t_dsr_route_intake";
const MAIL_ROLE = "t_dsr_route_mail";
const PURGE_ROLE = "t_dsr_route_purge";
let pool: Pool;
const roleLoginUrl = (schema: string, username: string) => {
  const url = new URL(testDatabaseUrl(schema));
  url.username = username;
  return url.toString();
};

function configureMailIdentity() {
  process.env[MAIL_IDENTITY_ENV.fromEmail] = APPROVED_MAIL_IDENTITY.fromEmail;
  process.env[MAIL_IDENTITY_ENV.fromName] = APPROVED_MAIL_IDENTITY.fromName;
  process.env[MAIL_IDENTITY_ENV.replyToEmail] = APPROVED_MAIL_IDENTITY.replyToEmail;
}

beforeAll(async () => {
  pool = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 6 });
  const migrations = [
    "../db/migrations/0001_attribution.sql",
    "../db/migrations/0002_leads_consents_outbox.sql",
    "../db/migrations/0003_data_request_verification.sql",
  ].map((file) => readFileSync(path.resolve(import.meta.dirname, file), "utf8")).join("\n");
  const migration4 = readFileSync(
    path.resolve(import.meta.dirname, "../db/migrations/0004_access_boundary.sql"),
    "utf8",
  );
  await pool.query(`BEGIN;
    DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
    CREATE SCHEMA ${SCHEMA};
    SET LOCAL search_path = ${SCHEMA};
    ${migrations}
    DROP ROLE IF EXISTS ${INTAKE_ROLE};
    DROP ROLE IF EXISTS ${MAIL_ROLE};
    DROP ROLE IF EXISTS ${PURGE_ROLE};
    CREATE ROLE ${INTAKE_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ${MAIL_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ${PURGE_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    SELECT set_config('yulalab.runtime_role', '${INTAKE_ROLE}', false);
    SELECT set_config('yulalab.target_schema', '${SCHEMA}', false);
    SELECT set_config('yulalab.intake_role', '${INTAKE_ROLE}', false);
    SELECT set_config('yulalab.mail_role', '${MAIL_ROLE}', false);
    SELECT set_config('yulalab.purge_role', '${PURGE_ROLE}', false);
    ${migration4}
    COMMIT;
  `);
});

afterAll(async () => {
  await pool.query(`BEGIN;
    DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
    DROP ROLE IF EXISTS ${INTAKE_ROLE}, ${MAIL_ROLE}, ${PURGE_ROLE};
    COMMIT;`);
  await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE data_requests, event_outbox CASCADE");
  process.env.YULA_DATABASE_SCHEMA = SCHEMA;
  process.env.YULA_INTAKE_DATABASE_URL = roleLoginUrl(SCHEMA, INTAKE_ROLE);
  process.env.YULA_MAIL_DATABASE_URL = "postgres://mail-test@invalid.invalid/yula";
  process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  process.env.LEADS_ENABLED = "1";
  process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
  process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = "test-only-current-data-request-secret-32-bytes";
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV];
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV];
  process.env.SENDGRID_API_KEY = "SG.test";
  configureMailIdentity();
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
    "d-934e79bac8f841dfb7066e169d8f4ffc";
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
    "d-e9aeeaa9dc8949679777b61eed0f41dc";
  process.env.DATA_REQUEST_CHALLENGE_PROVIDER = "turnstile";
  process.env.DATA_REQUEST_CHALLENGE_SECRET = "server-only-test-secret";
  process.env.DATA_REQUEST_CHALLENGE_HOSTNAME = "yulalab.com";
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(
      JSON.stringify({ success: true, action: "data-request", hostname: "yulalab.com" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const { resetRateLimit } = await import("@/server/rate-limit");
  resetRateLimit();
});

afterEach(async () => {
  const { resetPool } = await import("@/server/db");
  await resetPool("intake");
  delete process.env.YULA_INTAKE_DATABASE_URL;
  delete process.env.YULA_MAIL_DATABASE_URL;
  delete process.env.YULA_PURGE_DATABASE_URL;
  delete process.env.YULA_DATABASE_SCHEMA;
  delete process.env.LEADS_ENABLED;
  delete process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV];
  delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV];
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV];
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV];
  delete process.env.SENDGRID_API_KEY;
  delete process.env.MAIL_FROM;
  delete process.env.LEADS_INTERNAL_ADDRESS;
  for (const key of Object.values(MAIL_IDENTITY_ENV)) delete process.env[key];
  delete process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR;
  delete process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN;
  delete process.env.DATA_REQUEST_CHALLENGE_PROVIDER;
  delete process.env.DATA_REQUEST_CHALLENGE_SECRET;
  delete process.env.DATA_REQUEST_CHALLENGE_HOSTNAME;
  vi.restoreAllMocks();
});

async function post(payload: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/data-request/route");
  const submitted =
    typeof payload === "object" && payload !== null && !Array.isArray(payload) && "email" in payload
      ? { challengeToken: "valid-provider-token", ...(payload as Record<string, unknown>) }
      : payload;
  return POST(
    new Request(`${ORIGIN}/api/data-request`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: typeof submitted === "string" ? submitted : JSON.stringify(submitted),
    }),
  );
}

describe("submitting", () => {
  it("accepts a well-formed request and stores it pending", async () => {
    const res = await post({ email: "someone@example.com", requestType: "delete", locale: "en" });
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ status: "submitted" });
    const { rows } = await pool.query("SELECT verification_state FROM data_requests");
    expect(rows[0].verification_state).toBe("pending");
    const outbox = await pool.query("SELECT payload_json FROM event_outbox");
    expect(outbox.rows[0].payload_json.locale).toBe("en");
  });

  it("answers identically for an address we have never seen", async () => {
    // The property that matters: this endpoint must not become an oracle for
    // who is in the database.
    const known = await post({ email: "someone@example.com", requestType: "access" });
    const unknown = await post({ email: "nobody-here@example.com", requestType: "access" });
    expect(unknown.status).toBe(known.status);
    await expect(unknown.json()).resolves.toEqual(await known.json());
  });

  it("fails honestly with one generic 503 and no row when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { resetPool } = await import("@/server/db");
    await resetPool("intake");
    process.env.YULA_DATABASE_SCHEMA = "public";
    process.env.YULA_INTAKE_DATABASE_URL = roleLoginUrl("public", INTAKE_ROLE); // rejected public schema

    const failed = await post({ email: "b@example.com", requestType: "delete" });
    expect(failed.status).toBe(503);
    await expect(failed.json()).resolves.toEqual({ error: "temporarily_unavailable" });
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
  });

  it("requires DB, keyring, exact base identity and both locale templates before writing", async () => {
    const cases: Array<[string, () => void]> = [
      ["database", () => { delete process.env.YULA_INTAKE_DATABASE_URL; }],
      ["key id", () => { delete process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV]; }],
      ["key secret", () => { delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV]; }],
      ["provider", () => { delete process.env.SENDGRID_API_KEY; }],
      ["sender", () => { delete process.env[MAIL_IDENTITY_ENV.fromEmail]; }],
      ["sender name", () => { delete process.env[MAIL_IDENTITY_ENV.fromName]; }],
      ["reply-to", () => { delete process.env[MAIL_IDENTITY_ENV.replyToEmail]; }],
      ["invalid sender", () => { process.env[MAIL_IDENTITY_ENV.fromEmail] = "other@yulalab.com"; }],
      ["invalid sender name", () => { process.env[MAIL_IDENTITY_ENV.fromName] = "Yula Lab"; }],
      ["invalid reply-to", () => { process.env[MAIL_IDENTITY_ENV.replyToEmail] = "other@yulalab.com"; }],
      ["TR template", () => { delete process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR; }],
      ["EN template", () => { delete process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN; }],
      ["invalid TR template", () => {
        process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR = "d-other";
      }],
      ["invalid EN template", () => {
        process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN = "d-other";
      }],
    ];

    for (const [, remove] of cases) {
      remove();
      const response = await post({ email: "blocked@example.com", requestType: "access", locale: "tr" });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "temporarily_unavailable" });
      expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);

      process.env.YULA_DATABASE_SCHEMA = SCHEMA;
      process.env.YULA_INTAKE_DATABASE_URL = roleLoginUrl(SCHEMA, INTAKE_ROLE);
      process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
      process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = "test-only-current-data-request-secret-32-bytes";
      process.env.SENDGRID_API_KEY = "SG.test";
      configureMailIdentity();
      process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
        "d-934e79bac8f841dfb7066e169d8f4ffc";
      process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
        "d-e9aeeaa9dc8949679777b61eed0f41dc";
      const { resetPool } = await import("@/server/db");
      await resetPool("intake");
    }
  });

  it("still reports shape problems, which are the caller's own mistake", async () => {
    expect((await post({ email: "not-an-email", requestType: "delete" })).status).toBe(400);
    expect((await post({ email: "a@b.co", requestType: "sell" })).status).toBe(400);
    expect((await post({ email: "a@b.co", requestType: "delete", locale: "fr" })).status).toBe(400);
    expect((await post({ email: "a@b.co", requestType: "delete", extra: 1 })).status).toBe(400);
  });

  it("requires a verified challenge before any durable admission", async () => {
    const missing = await post({
      email: "missing-challenge@example.com",
      requestType: "access",
      challengeToken: undefined,
    });
    expect(missing.status).toBe(403);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, action: "data-request", hostname: "yulalab.com" }),
        { status: 200 },
      ),
    );
    const invalid = await post({
      email: "invalid-challenge@example.com",
      requestType: "delete",
      challengeToken: "invalid-provider-token",
    });
    expect(invalid.status).toBe(403);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });

  it("fails closed before DB admission when challenge configuration/provider is unavailable", async () => {
    delete process.env.DATA_REQUEST_CHALLENGE_SECRET;
    const missingConfig = await post({ email: "config@example.com", requestType: "correct" });
    expect(missingConfig.status).toBe(503);
    process.env.DATA_REQUEST_CHALLENGE_SECRET = "server-only-test-secret";

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("provider offline"));
    const outage = await post({ email: "outage@example.com", requestType: "correct" });
    expect(outage.status).toBe(503);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });

  it("lets 100 distinct unverified recipients consume zero durable quota", async () => {
    for (let index = 0; index < 100; index += 1) {
      const response = await post(
        {
          email: `unverified-${index}@example.com`,
          requestType: "access",
          challengeToken: undefined,
        },
        { "x-forwarded-for": `198.51.100.${(index % 250) + 1}` },
      );
      expect(response.status).toBe(403);
    }
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });
});

describe("verifying", () => {
  it("verifies with the token that was issued", async () => {
    const { createDataRequest } = await import("@/server/data-requests");
    const { token } = await createDataRequest(
      pool,
      { email: "a@b.co", requestType: "delete" },
      { now: new Date() },
    );
    await pool.query(
      `UPDATE data_requests
          SET verification_sent_at = now(),
              verification_expires_at = now() + interval '24 hours'
        WHERE verification_state = 'pending'`,
    );
    const res = await post({ token });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ verified: true });
  });

  it("answers 200 with verified:false for an unknown token, not 404", async () => {
    // A 404 would tell a caller which links are live.
    const res = await post({ token: "f".repeat(64) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ verified: false });
  });

  it("gives the same answer for a malformed token", async () => {
    const res = await post({ token: "nonsense" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ verified: false });
  });

  it("keeps an already-issued verification link valid after intake closes", async () => {
    const { createDataRequest } = await import("@/server/data-requests");
    const { token } = await createDataRequest(
      pool,
      { email: "accepted-before-close@example.com", requestType: "delete" },
      { now: new Date() },
    );
    await pool.query(
      `UPDATE data_requests
          SET verification_sent_at = now(),
              verification_expires_at = now() + interval '24 hours'
        WHERE verification_state = 'pending'`,
    );
    delete process.env.LEADS_ENABLED;

    const res = await post({ token });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ verified: true });
  });
});

describe("the surface is closed by default", () => {
  it("refuses new submissions unless collection is enabled", async () => {
    delete process.env.LEADS_ENABLED;
    const res = await post({ email: "a@b.co", requestType: "delete" });
    expect(res.status).toBe(503);
    expect((await pool.query("SELECT * FROM data_requests")).rowCount).toBe(0);
  });
});

describe("abuse controls", () => {
  it("durable abuse boundary: spoofable headers cannot bypass same-type recipient dedupe", async () => {
    const first = await post(
      { email: "Victim@Example.com", requestType: "delete", locale: "tr" },
      { "x-forwarded-for": "203.0.113.10" },
    );
    const second = await post(
      { email: " victim@example.COM ", requestType: "delete", locale: "en" },
      {
        origin: "",
        "sec-fetch-site": "none",
        "x-forwarded-for": "198.51.100.77",
        "x-real-ip": "192.0.2.44",
      },
    );

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    await expect(first.json()).resolves.toEqual({ status: "submitted" });
    await expect(second.json()).resolves.toEqual({ status: "submitted" });
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(1);
  });

  it("does not let access suppress a later delete for the same normalized recipient", async () => {
    const access = await post({ email: "Victim@Example.com", requestType: "access", locale: "tr" });
    const deletion = await post({
      email: " victim@example.COM ",
      requestType: "delete",
      locale: "en",
    });
    expect(access.status).toBe(202);
    expect(deletion.status).toBe(202);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(2);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(2);
  });

  it("durable abuse boundary: duplicate and new-address responses remain indistinguishable", async () => {
    await post({ email: "same@example.com", requestType: "access", locale: "tr" });
    const duplicate = await post({ email: " SAME@example.com ", requestType: "access", locale: "en" });
    const fresh = await post({ email: "fresh@example.com", requestType: "delete", locale: "en" });

    expect(duplicate.status).toBe(fresh.status);
    await expect(duplicate.json()).resolves.toEqual(await fresh.json());
  });

  it("security hardening: capacity cannot reveal whether a recent recipient exists", async () => {
    const {
      createDataRequest,
      DATA_REQUEST_GLOBAL_WINDOW_LIMIT,
    } = await import("@/server/data-requests");
    const now = new Date();
    await createDataRequest(
      pool,
      { email: "recent-at-capacity@example.com", requestType: "access", locale: "tr" },
      { now },
    );
    for (let index = 1; index < DATA_REQUEST_GLOBAL_WINDOW_LIMIT; index += 1) {
      await createDataRequest(
        pool,
        { email: `capacity-${index}@example.com`, requestType: "access", locale: "tr" },
        { now },
      );
    }

    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const recent = await post(
      { email: " RECENT-at-capacity@example.com ", requestType: "access", locale: "en" },
      {
        origin: "",
        "sec-fetch-site": "none",
        "x-forwarded-for": "203.0.113.100",
        "x-real-ip": "192.0.2.100",
      },
    );
    const fresh = await post(
      { email: "fresh-at-capacity@example.com", requestType: "access", locale: "en" },
      {
        origin: "",
        "sec-fetch-site": "none",
        "x-forwarded-for": "198.51.100.200",
        "x-real-ip": "192.0.2.200",
      },
    );

    expect(recent.status).toBe(202);
    expect(fresh.status).toBe(recent.status);
    await expect(fresh.json()).resolves.toEqual(await recent.json());
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(100);
    expect(
      (await pool.query("SELECT 1 FROM event_outbox WHERE event_type = 'data_request_verification'"))
        .rowCount,
    ).toBe(100);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("capacity");
    expect(warnings.join(" ")).not.toContain("recent-at-capacity@example.com");
    expect(warnings.join(" ")).not.toContain("fresh-at-capacity@example.com");
  });

  it("security hardening: a rollback failure at capacity remains a generic 503", async () => {
    const dbModule = await import("@/server/db");
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("rollback unavailable");
      if (sql.includes("SELECT count(*)::int AS accepted")) {
        return { rows: [{ accepted: 100 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    vi.spyOn(dbModule, "getPool").mockReturnValue({
      connect: async () => ({ query, release }),
    } as never);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });

    const response = await post({
      email: "rollback-capacity@example.com",
      requestType: "access",
      locale: "tr",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "temporarily_unavailable" });
    expect(release).toHaveBeenCalledWith(true);
    expect(errors.join(" ")).not.toContain("rollback-capacity@example.com");
  });

  it("rate-limits a flood without throttling a second client", async () => {
    let limited = 0;
    for (let i = 0; i < 40; i += 1) {
      const res = await post({ email: `x${i}@example.com`, requestType: "access" }, {
        "x-forwarded-for": "203.0.113.9",
      });
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
    const other = await post({ email: "other@example.com", requestType: "access" }, {
      "x-forwarded-for": "198.51.100.4",
    });
    expect(other.status).toBe(202);
  });

  it("rejects a foreign origin", async () => {
    expect((await post({ email: "a@b.co", requestType: "delete" }, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("PII stays out of the logs", () => {
  it("logs only a shape when the write fails", async () => {
    const errors: string[] = [];
    const { inspect } = await import("node:util");
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((a) => (typeof a === "string" ? a : inspect(a))).join(" "));
    });
    const { resetPool } = await import("@/server/db");
    await resetPool("intake");
    process.env.YULA_DATABASE_SCHEMA = "public";
    process.env.YULA_INTAKE_DATABASE_URL = roleLoginUrl("public", INTAKE_ROLE);

    await post({ email: "kaan.kocak@example.com", requestType: "delete" });
    const logged = errors.join("\n");
    expect(logged).not.toContain("kaan.kocak@example.com");
  });
});
