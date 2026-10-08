import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createIsolatedSchema, dropSchema, testDatabaseUrl } from "./helpers/attribution-db";
import { recordAttribution } from "@/server/attribution";

const SCHEMA = "t_purge_route";
const SECRET = "test-secret-not-a-real-one";
let pool: Pool;
const localLoginUrl = (schema: string) => {
  const url = new URL(testDatabaseUrl(schema));
  url.username = process.env.USER ?? "postgres";
  return url.toString();
};

beforeAll(async () => {
  pool = await createIsolatedSchema(SCHEMA);
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  await pool.query(
    readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0002_leads_consents_outbox.sql"),
      "utf8",
    ),
  );
  await pool.query(
    readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0003_data_request_verification.sql"),
      "utf8",
    ),
  );
  await pool.query(`ALTER TABLE data_requests
    ADD COLUMN verification_sent_at timestamptz,
    ADD COLUMN verification_token_key_id text,
    ADD COLUMN verification_queue_expires_at timestamptz,
    ADD COLUMN purge_at timestamptz`);
});

afterAll(async () => {
  await dropSchema(pool, SCHEMA);
});

beforeEach(async () => {
  await pool.query("TRUNCATE attributions, leads, lead_consents, event_outbox, data_requests CASCADE");
  process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake-test@invalid.invalid/yula";
  process.env.YULA_MAIL_DATABASE_URL = "postgres://mail-test@invalid.invalid/yula";
  process.env.YULA_DATABASE_SCHEMA = SCHEMA;
  process.env.YULA_PURGE_DATABASE_URL = localLoginUrl(SCHEMA);
  process.env.CRON_SECRET = "cron-secret-for-tests";
});

afterEach(async () => {
  const { resetPool } = await import("@/server/db");
  await resetPool("purge");
  delete process.env.YULA_INTAKE_DATABASE_URL;
  delete process.env.YULA_MAIL_DATABASE_URL;
  delete process.env.YULA_PURGE_DATABASE_URL;
  delete process.env.YULA_DATABASE_SCHEMA;
  delete process.env.CRON_SECRET;
});

function call(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new Request("https://yulalab.com/api/purge", { headers });
}

async function get(auth?: string) {
  const { GET } = await import("@/app/api/purge/route");
  return GET(call(auth));
}

describe("GET /api/purge", () => {
  it("actually deletes expired rows when the scheduler calls it", async () => {
    await recordAttribution(
      pool,
      {
        v: 1,
        event: "product_view",
        locale: "tr",
        page: "/projects/lifeos",
        product: "lifeos",
        session: "a".repeat(32),
      },
      { now: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), secret: SECRET },
    );
    await recordAttribution(
      pool,
      {
        v: 1,
        event: "product_view",
        locale: "tr",
        page: "/projects/lifeos",
        product: "lifeos",
        session: "b".repeat(32),
      },
      { now: new Date(), secret: SECRET },
    );

    const res = await get("Bearer cron-secret-for-tests");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      purged: 1,
      purgedLeads: 0,
      purgedOutbox: 0,
      expiredVerifications: 0,
      purgedDataRequests: 0,
    });

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM attributions");
    expect(rows[0].n).toBe(1);
  });

  it("refuses an unauthenticated call", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong")).status).toBe(401);
  });

  it("refuses to run at all when CRON_SECRET is unset", async () => {
    // A public endpoint that deletes rows must not be reachable just
    // because someone forgot to configure it — and it answers exactly as it
    // does for a wrong secret, so a caller cannot probe whether the deploy
    // is configured.
    delete process.env.CRON_SECRET;
    const res = await get("Bearer anything");
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ purged: null, reason: "unauthorized" });
  });
});

describe("both retentions run, not just the first one", () => {
  it("the purge route calls the lead purge too", async () => {
    // purgeExpiredLeads shipped with NO production caller — the exact defect
    // this route was created to atone for, one file away, while its own
    // docstring claimed the count existed "so a scheduled run can be observed
    // rather than assumed".
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const route = readFileSync(
      path.resolve(import.meta.dirname, "../src/app/api/purge/route.ts"),
      "utf8",
    );
    expect(route).toContain("purgeExpiredLeads");
    expect(route).toContain("purgeExpiredAttributions");
    expect(route).toContain("purgeExpiredOutbox");
    expect(route).toContain("purgeDataRequestResidue");
  });

  it("reports both counts so a silent no-op is visible", async () => {
    const { createLead } = await import("@/server/leads");
    await createLead(pool, {
      name: "Kaan",
      email: "a@b.co",
      intent: "studio",
      message: "old lead",
      locale: "tr",
    }, { now: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) });

    const res = await get("Bearer cron-secret-for-tests");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ purgedLeads: 1 });
  });
});

describe("the schedule is actually wired", () => {
  it("vercel.json schedules the purge route", async () => {
    // The defect this guards against was not a broken function — the
    // function passed its own test. It was a function nothing ever called.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const config = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, "../vercel.json"), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };
    const cron = config.crons?.find((c) => c.path === "/api/purge");
    expect(cron, "no cron entry points at /api/purge").toBeTruthy();
    // Daily, not merely "five fields": a schedule of "0 4 1 1 *" would pass
    // a shape check and run once a year while the page promises 30 days.
    const [minute, hour, dom, month, dow] = (cron?.schedule ?? "").split(" ");
    expect([dom, month, dow]).toEqual(["*", "*", "*"]);
    expect(minute).toMatch(/^\d{1,2}$/);
    expect(hour).toMatch(/^\d{1,2}$/);
  });
});

describe("outbox rows do not outlive their retention", () => {
  it("routes verification residue through the race-safe transactional purge", async () => {
    const request = await pool.query<{ id: string }>(
      `INSERT INTO data_requests (
         email, request_type, verification_state, verification_token_hash,
         verification_expires_at, verification_token_key_id,
         verification_queue_expires_at, purge_at
       ) VALUES (
         'residue@example.com', 'delete', 'pending', repeat('a', 64),
         now() + interval '1 day', 'test-key',
         now() - interval '2 days', now() - interval '1 day'
       ) RETURNING id`,
    );
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, purge_at)
       VALUES ('data_request_verification', $1, '{"locale":"tr","tokenKeyId":"test-key"}', now() - interval '1 day')`,
      [request.rows[0].id],
    );

    const res = await get("Bearer cron-secret-for-tests");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      expiredVerifications: 1,
      purgedDataRequests: 1,
    });
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });

  it("purges an aged outbox row even though no lead owns it", async () => {
    // aggregate_id points at leads AND at data requests, so there is no
    // single foreign key to cascade from. Before this, purging a lead left
    // its queue rows behind indefinitely — the "second home with its own
    // retention story" the payload design exists to avoid.
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, created_at)
       VALUES ('lead_receipt', gen_random_uuid(), '{}'::jsonb, now() - interval '40 days')`,
    );
    const res = await get("Bearer cron-secret-for-tests");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ purgedOutbox: 1 });
    expect((await pool.query("SELECT * FROM event_outbox")).rowCount).toBe(0);
  });

  it("leaves a fresh outbox row alone", async () => {
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('lead_receipt', gen_random_uuid(), '{}'::jsonb)`,
    );
    const res = await get("Bearer cron-secret-for-tests");
    await expect(res.json()).resolves.toMatchObject({ purgedOutbox: 0 });
    expect((await pool.query("SELECT * FROM event_outbox")).rowCount).toBe(1);
  });
});
