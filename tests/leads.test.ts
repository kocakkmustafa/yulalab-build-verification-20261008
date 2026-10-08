import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createIsolatedSchema, dropSchema, testDatabaseUrl } from "./helpers/attribution-db";
import { createLead, dedupeKey, receiptIdFor, purgeExpiredLeads } from "@/server/leads";

/**
 * Against a real PostgreSQL, like the attribution suite.
 *
 * This is the first table in the project holding personal data, so the
 * constraints that matter — a valid address, a bounded message, consent
 * recorded beside the record, a retention date on every row — are enforced
 * in the schema and asserted here by trying to violate them directly.
 */
const SCHEMA = "t_leads";
let pool: Pool;

const VALID = {
  name: "Kaan",
  email: "someone@example.com",
  intent: "studio" as const,
  message: "We would like to talk about a build.",
  locale: "tr" as const,
  noticeVersion: "2026-08-19",
};

beforeAll(async () => {
  pool = await createIsolatedSchema(SCHEMA);
  await pool.query(
    readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0002_leads_consents_outbox.sql"),
      "utf8",
    ),
  );
});

afterAll(async () => {
  await dropSchema(pool, SCHEMA);
});

beforeEach(async () => {
  await pool.query("TRUNCATE leads, lead_consents, event_outbox, data_requests CASCADE");
});


/**
 * A pool whose client fails on the first statement matching `failOn`.
 *
 * The patch is UNDONE on release. Patching a pooled client and leaving it
 * patched poisons the connection for every later test that happens to get it
 * back — which is what made these tests fail with timeouts that looked like a
 * connection leak in the implementation. The implementation was fine; the
 * test was mutating shared state.
 */
function poolFailingOn(pool: Pool, failOn: string) {
  return {
    connect: async () => {
      const client = await pool.connect();
      const realQuery = client.query.bind(client);
      const realRelease = client.release.bind(client);
      client.query = (async (sql: unknown, params?: unknown[]) => {
        if (typeof sql === "string" && sql.includes(failOn)) {
          throw new Error(`${failOn} unavailable`);
        }
        return realQuery(sql as string, params as never);
      }) as typeof client.query;
      client.release = ((err?: Error | boolean) => {
        client.query = realQuery;
        client.release = realRelease;
        return realRelease(err as never);
      }) as typeof client.release;
      return client;
    },
  };
}

describe("a valid lead", () => {
  it("stores the lead, its consent and its outbox rows in ONE transaction", async () => {
    const { receiptId } = await createLead(pool, VALID, { now: new Date("2026-08-19T10:00:00Z") });
    expect(receiptId).toMatch(/^YL-[0-9A-F]{8}$/);

    const leads = await pool.query("SELECT * FROM leads");
    const consents = await pool.query("SELECT * FROM lead_consents");
    const outbox = await pool.query("SELECT event_type FROM event_outbox ORDER BY event_type");
    expect(leads.rowCount).toBe(1);
    expect(consents.rowCount).toBe(1);
    // A receipt to the person AND a routing message to us.
    expect(outbox.rows.map((r) => r.event_type)).toEqual([
      "lead_internal_route",
      "lead_receipt",
    ]);
  });

  it("records what was consented to, not merely that consent happened", async () => {
    await createLead(pool, VALID, { now: new Date() });
    const { rows } = await pool.query("SELECT notice_version, lawful_basis FROM lead_consents");
    expect(rows[0].notice_version).toBe("2026-08-19");
    expect(rows[0].lawful_basis).toBe("consent");
  });

  it("writes a retention date on the row itself", async () => {
    await createLead(pool, VALID, { now: new Date() });
    const { rows } = await pool.query(
      "SELECT (retention_until::date - created_at::date) AS days FROM leads",
    );
    expect(rows[0].days).toBe(180);
  });

  it("gives a receipt id derived from the lead, so it can be looked up", async () => {
    const { receiptId } = await createLead(pool, VALID, { now: new Date() });
    const { rows } = await pool.query("SELECT id FROM leads");
    expect(receiptIdFor(rows[0].id)).toBe(receiptId);
  });
});

describe("the transaction is real", () => {
  it("treats a failed rollback after capacity rejection as storage failure", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    for (let i = 0; i < 20; i += 1) {
      await createLead(pool, { ...VALID, message: `Message ${i}` }, { now });
    }
    await expect(createLead(poolFailingOn(pool, "ROLLBACK"), {
      ...VALID, message: "Another message",
    }, { now })).rejects.toMatchObject({ name: "LeadTransactionError" });
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(20);
    expect(pool.waitingCount).toBe(0);
  });

  it("writes NOTHING when the outbox insert fails", async () => {
    // A mail provider outage must not lose the lead, and a failed write must
    // not leave a lead with no receipt queued. Both go together or neither.

    await expect(
      createLead(poolFailingOn(pool, "event_outbox"), VALID, { now: new Date() }),
    ).rejects.toThrow();
    // The real pool sees nothing, because the whole thing rolled back.
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM lead_consents")).rowCount).toBe(0);
  });
});

describe("duplicate submission", () => {
  it("returns the SAME receipt instead of creating a second lead", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const first = await createLead(pool, VALID, { now });
    const second = await createLead(pool, VALID, { now });
    expect(second.receiptId).toBe(first.receiptId);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });

  it("treats the same person writing again the next day as a new lead", async () => {
    const first = await createLead(pool, VALID, { now: new Date("2026-08-19T10:00:00Z") });
    const second = await createLead(pool, VALID, { now: new Date("2026-08-20T10:00:00Z") });
    expect(second.receiptId).not.toBe(first.receiptId);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(2);
  });

  it("keys the dedupe on content, not on timing alone", () => {
    const day = new Date("2026-08-19T10:00:00Z");
    const a = dedupeKey({ ...VALID }, day);
    const b = dedupeKey({ ...VALID, message: "different message" }, day);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the database refuses bad leads even when the application does not", () => {
  async function insert(overrides: Record<string, unknown> = {}) {
    const row = {
      name: "Kaan",
      email: "a@b.co",
      intent: "studio",
      message: "hello",
      locale: "tr",
      dedupe_key: "a".repeat(64),
      ...overrides,
    };
    const keys = Object.keys(row);
    return pool.query(
      `INSERT INTO leads (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
      keys.map((k) => (row as Record<string, unknown>)[k]),
    );
  }

  it("rejects a malformed email", async () => {
    await expect(insert({ email: "not-an-email" })).rejects.toThrow();
    await expect(insert({ email: "a b@c.co" })).rejects.toThrow();
  });

  it("rejects an empty or oversized message", async () => {
    await expect(insert({ message: "   " })).rejects.toThrow();
    await expect(insert({ message: "x".repeat(4001) })).rejects.toThrow();
  });

  it("rejects an unknown intent", async () => {
    await expect(insert({ intent: "spam" })).rejects.toThrow();
  });

  it("refuses a product slug on a non-product intent", async () => {
    // Otherwise a routing rule can read a product that was never asked about.
    await expect(insert({ intent: "press", product_slug: "lifeos" })).rejects.toThrow();
    await expect(insert({ intent: "product", product_slug: "lifeos" })).resolves.toBeTruthy();
  });

  it("cannot be given a wrong retention date at all", async () => {
    // Stronger than rejecting one: the trigger derives it from created_at,
    // so a supplied value is overwritten rather than trusted. A row with an
    // expiry in the past — which would be invisible to the funnel yet still
    // present — is unrepresentable.
    await insert({ retention_until: new Date("2000-01-01") });
    const { rows } = await pool.query(
      "SELECT (retention_until::date - created_at::date) AS days FROM leads",
    );
    expect(rows[0].days).toBe(180);
  });

  it("derives retention from created_at, not from insert time", async () => {
    // A DEFAULT cannot see created_at, so a backdated row used to get an
    // expiry 180 days from the INSERT rather than from when the lead arrived
    // — which silently extended retention for exactly the oldest records.
    await pool.query(
      `INSERT INTO leads (name, email, intent, message, locale, dedupe_key, created_at)
       VALUES ('K','a@b.co','studio','old','tr',$1, now() - interval '100 days')`,
      ["c".repeat(64)],
    );
    const { rows } = await pool.query(
      "SELECT (retention_until::date - created_at::date) AS days FROM leads WHERE message = 'old'",
    );
    expect(rows[0].days).toBe(180);
  });

  it("rejects consent whose notice version is not a date", async () => {
    await insert();
    const { rows } = await pool.query("SELECT id FROM leads");
    await expect(
      pool.query(
        "INSERT INTO lead_consents (lead_id, notice_version, lawful_basis) VALUES ($1,$2,$3)",
        [rows[0].id, "latest", "consent"],
      ),
    ).rejects.toThrow();
  });
});

describe("retention", () => {
  it("purges leads past their retention date and keeps the rest", async () => {
    await createLead(pool, VALID, { now: new Date("2026-01-01T10:00:00Z") });
    await createLead(pool, { ...VALID, message: "second" }, { now: new Date("2026-08-19T10:00:00Z") });

    const deleted = await purgeExpiredLeads(pool, new Date("2026-08-19T10:00:00Z"));
    expect(deleted).toBe(1);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });

  it("takes the consent rows with it", async () => {
    await createLead(pool, VALID, { now: new Date("2026-01-01T10:00:00Z") });
    await purgeExpiredLeads(pool, new Date("2026-08-19T10:00:00Z"));
    expect((await pool.query("SELECT * FROM lead_consents")).rowCount).toBe(0);
  });
});

describe("the transaction is real under concurrency, not just when idle", () => {
  it("rolls back even while other connections are busy", async () => {
    // The defect this pins: pool.query() takes a connection per statement,
    // so BEGIN and the INSERT can land on different ones and the INSERT
    // autocommits. Measured before the fix — a row inserted between BEGIN
    // and ROLLBACK survived the rollback. Sequential queries on an idle pool
    // reuse one connection, which is exactly why the earlier rollback test
    // passed against broken code.
    const busy = [
      pool.query("SELECT pg_sleep(0.25)"),
      pool.query("SELECT pg_sleep(0.25)"),
    ];


    await expect(
      createLead(poolFailingOn(pool, "lead_consents"), VALID, { now: new Date() }),
    ).rejects.toThrow();
    await Promise.all(busy);

    // No orphaned lead: a person's details must never be stored without the
    // consent row that gives us a basis to store them.
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("returns the connection to the pool even when the write fails", () => {
    // A leaked client exhausts the pool after a handful of failures and the
    // next legitimate submission hangs. Asserted on the pool's own counters
    // rather than by timing, so a slow machine cannot make it flake.
    expect(pool.idleCount).toBeGreaterThan(0);
    expect(pool.waitingCount).toBe(0);
  });
});

describe("the pool survives repeated failures", () => {
  it("neither leaks nor stays busy after several failed writes", async () => {
    for (let i = 0; i < 4; i += 1) {
      await expect(
        createLead(poolFailingOn(pool, "event_outbox"), { ...VALID, message: `try ${i}` }, { now: new Date() }),
      ).rejects.toThrow();
    }
    expect(pool.waitingCount).toBe(0);
    // And it still works.
    const { receiptId } = await createLead(pool, VALID, { now: new Date() });
    expect(receiptId).toMatch(/^YL-[0-9A-F]{8}$/);
  });
});

describe("the whole transaction runs on ONE dedicated connection", () => {
  it("issues every statement, BEGIN through COMMIT, on the client it acquired", async () => {
    // This is the test that can actually tell the fix from the bug.
    //
    // "Roll back while other connections are busy" CANNOT: createLead's
    // statements are sequential and awaited, so pg hands back the same idle
    // connection either way and a pool.query() implementation passes. Proven
    // by mutating the code back to pool.query — all 19 tests stayed green.
    //
    // What distinguishes them is WHERE the statements land. With pool.query
    // the acquired client never sees them at all.
    const seen: string[] = [];
    const recording = {
      connect: async () => {
        const client = await pool.connect();
        const realQuery = client.query.bind(client);
        const realRelease = client.release.bind(client);
        client.query = (async (sql: unknown, params?: unknown[]) => {
          if (typeof sql === "string") seen.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
          return realQuery(sql as string, params as never);
        }) as typeof client.query;
        client.release = ((err?: Error | boolean) => {
          client.query = realQuery;
          client.release = realRelease;
          return realRelease(err as never);
        }) as typeof client.release;
        return client;
      },
    };

    await createLead(recording, VALID, { now: new Date() });

    expect(seen[0]).toBe("BEGIN");
    expect(seen[seen.length - 1]).toBe("COMMIT");
    // Every write in between arrived on the same acquired client.
    expect(seen.some((q) => q.startsWith("INSERT INTO leads"))).toBe(true);
    expect(seen.some((q) => q.startsWith("INSERT INTO lead_consents"))).toBe(true);
    expect(seen.filter((q) => q.startsWith("INSERT INTO event_outbox"))).toHaveLength(2);
  });

  it("acquires exactly one connection per call", async () => {
    let connects = 0;
    const counting = {
      connect: async () => {
        connects += 1;
        return pool.connect();
      },
    };
    await createLead(counting, { ...VALID, message: "counted" }, { now: new Date() });
    expect(connects).toBe(1);
  });
});

describe("concurrent identical submissions", () => {
  it("gives BOTH callers the same receipt, not one of them a 503", async () => {
    // The defect: SELECT-then-INSERT is only atomic when something happens
    // to serialise it. Measured before the fix — with a pool wide enough for
    // real concurrency, or across two serverless instances, one submitter got
    // a unique-violation 503 for a lead that HAD been stored.
    const now = new Date("2026-08-19T10:00:00Z");
    const [a, b] = await Promise.all([
      createLead(pool, VALID, { now }),
      createLead(pool, VALID, { now }),
    ]);
    expect(a.receiptId).toBe(b.receiptId);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });

  it("survives a wider burst of the same submission", async () => {
    const now = new Date("2026-08-19T11:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createLead(pool, { ...VALID, message: "burst" }, { now })),
    );
    expect(new Set(results.map((r) => r.receiptId)).size).toBe(1);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });
});

describe("atomicity, not merely statement order", () => {
  it("leaves no outbox row when the lead itself never lands", async () => {
    // A transaction-free implementation that mints the id in the app and
    // writes the outbox FIRST passes an order-based test while being wrong.
    // This asserts the invariant instead: an outbox row may never reference
    // a lead that does not exist.
    await expect(
      createLead(poolFailingOn(pool, "INSERT INTO leads"), VALID, { now: new Date() }),
    ).rejects.toThrow();
    expect((await pool.query("SELECT * FROM event_outbox")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("never leaves an outbox row pointing at a missing lead", async () => {
    await createLead(pool, VALID, { now: new Date() });
    const { rows } = await pool.query(
      `SELECT count(*)::int AS orphans FROM event_outbox o
       LEFT JOIN leads l ON l.id = o.aggregate_id
       WHERE l.id IS NULL`,
    );
    expect(rows[0].orphans).toBe(0);
  });
});

describe("studio qualification at the API boundary", () => {
  const origin = "https://yulalab.com";

  async function postQualified(
    overrides: Record<string, unknown>,
    options: { studioEnabled?: string } = {},
  ) {
    const previous = {
      databaseSchema: process.env.YULA_DATABASE_SCHEMA,
      intakeDatabaseUrl: process.env.YULA_INTAKE_DATABASE_URL,
      mailDatabaseUrl: process.env.YULA_MAIL_DATABASE_URL,
      purgeDatabaseUrl: process.env.YULA_PURGE_DATABASE_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      leadsEnabled: process.env.LEADS_ENABLED,
      studioEnabled: process.env.STUDIO_ENABLED,
    };
    const intakeDatabaseUrl = new URL(testDatabaseUrl(SCHEMA));
    intakeDatabaseUrl.username = process.env.USER ?? "postgres";
    process.env.YULA_DATABASE_SCHEMA = SCHEMA;
    process.env.YULA_INTAKE_DATABASE_URL = intakeDatabaseUrl.toString();
    process.env.YULA_MAIL_DATABASE_URL = "postgres://mail-test@invalid.invalid/yula";
    process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
    process.env.NEXT_PUBLIC_SITE_URL = origin;
    process.env.LEADS_ENABLED = "1";
    process.env.STUDIO_ENABLED = options.studioEnabled ?? "true";

    const { resetPool } = await import("@/server/db");
    const { resetRateLimit } = await import("@/server/rate-limit");
    await resetPool("intake");
    resetRateLimit();

    try {
      const { POST } = await import("@/app/api/leads/route");
      return await POST(
        new Request(`${origin}/api/leads`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            "x-forwarded-for": "203.0.113.71",
          },
          body: JSON.stringify({
            name: "Ada",
            email: "ada@example.com",
            intent: "studio",
            message: "A qualified Studio application.",
            locale: "en",
            consent: true,
            website: "",
            budgetBand: "150-400k",
            timing: "now",
            decisionRole: "founder",
            ...overrides,
          }),
        }),
      );
    } finally {
      await resetPool("intake");
      if (previous.databaseSchema === undefined) delete process.env.YULA_DATABASE_SCHEMA;
      else process.env.YULA_DATABASE_SCHEMA = previous.databaseSchema;
      if (previous.intakeDatabaseUrl === undefined) delete process.env.YULA_INTAKE_DATABASE_URL;
      else process.env.YULA_INTAKE_DATABASE_URL = previous.intakeDatabaseUrl;
      if (previous.mailDatabaseUrl === undefined) delete process.env.YULA_MAIL_DATABASE_URL;
      else process.env.YULA_MAIL_DATABASE_URL = previous.mailDatabaseUrl;
      if (previous.purgeDatabaseUrl === undefined) delete process.env.YULA_PURGE_DATABASE_URL;
      else process.env.YULA_PURGE_DATABASE_URL = previous.purgeDatabaseUrl;
      if (previous.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
      if (previous.leadsEnabled === undefined) delete process.env.LEADS_ENABLED;
      else process.env.LEADS_ENABLED = previous.leadsEnabled;
      if (previous.studioEnabled === undefined) delete process.env.STUDIO_ENABLED;
      else process.env.STUDIO_ENABLED = previous.studioEnabled;
    }
  }

  it("stores valid anonymous Studio enums as an ordinary lead with no trusted numerator", async () => {
    const response = await postQualified({});
    expect(response.status).toBe(201);
    const { rows } = await pool.query(
      "SELECT payload_json->>'route' AS route FROM event_outbox WHERE event_type = 'lead_internal_route'",
    );
    expect(rows).toEqual([{ route: "studio" }]);
  });

  it("security correction: ignores a direct caller-supplied verdict and keeps retries ordinary", async () => {
    await pool.query(
      readFileSync(
        path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
        "utf8",
      ),
    );
    const forged = { ...VALID, studioVerdict: "qualified" } as typeof VALID;
    const first = await createLead(pool, forged, { now: new Date("2026-08-25T10:00:00Z") });
    const retry = await createLead(pool, forged, { now: new Date("2026-08-25T10:00:01Z") });
    expect(retry.receiptId).toBe(first.receiptId);

    const { rows } = await pool.query(
      `SELECT outbox.aggregate_id, outbox.payload_json->>'route' AS route, lead.intent
         FROM event_outbox AS outbox
         JOIN leads AS lead ON lead.id = outbox.aggregate_id
        WHERE outbox.event_type = 'lead_internal_route'
          AND outbox.payload_json->>'route' = 'studio-qualified'`,
    );
    expect(rows).toHaveLength(0);
    expect((await pool.query(
      `SELECT payload_json->>'route' AS route FROM event_outbox
        WHERE event_type = 'lead_internal_route'`,
    )).rows).toEqual([{ route: "studio" }]);
  });

  it("security correction: database keeps the trusted qualified route dormant", async () => {
    await pool.query(
      readFileSync(
        path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
        "utf8",
      ),
    );
    const { rows } = await pool.query(
      `INSERT INTO leads (name,email,intent,message,locale,dedupe_key,created_at)
       VALUES ('Ada','ada@example.com','studio','Studio request','tr',$1,$2)
       RETURNING id`,
      ["a".repeat(64), new Date("2026-08-25T11:00:00Z")],
    );
    await expect(
      pool.query(
        `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, created_at)
         VALUES ('lead_internal_route',$1,$2,$3)`,
        [
          rows[0].id,
          JSON.stringify({ route: "studio-qualified", intent: "studio", receiptId: "YL-TEST0000" }),
          new Date("2026-08-25T11:00:00Z"),
        ],
      ),
    ).rejects.toThrow(/studio-qualified/i);
  });

  it("security correction: demotes pre-existing anonymous qualified rows without deleting audit history", async () => {
    // Model a database that has rows from the pre-Design-A migration before
    // the new dormant trigger is installed. Earlier tests may already have
    // applied 0005 to this isolated schema, so remove only that test trigger.
    await pool.query("DROP TRIGGER IF EXISTS event_outbox_bind_studio_qualified ON event_outbox");
    const lead = (await pool.query(
      `INSERT INTO leads (name,email,intent,message,locale,dedupe_key,created_at)
       VALUES ('Ada','old@example.com','studio','Old anonymous Studio request','tr',$1,$2)
       RETURNING id`,
      ["b".repeat(64), new Date("2026-08-25T11:05:00Z")],
    )).rows[0];
    const before = (await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, created_at)
       VALUES ('lead_internal_route',$1,$2,$3) RETURNING id`,
      [
        lead.id,
        JSON.stringify({ route: "studio-qualified", intent: "studio", receiptId: "YL-OLD0000" }),
        new Date("2026-08-25T11:05:00Z"),
      ],
    )).rows[0];

    await pool.query(readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
      "utf8",
    ));

    expect((await pool.query(
      `SELECT id, payload_json->>'route' AS route FROM event_outbox WHERE id = $1`,
      [before.id],
    )).rows).toEqual([{ id: before.id, route: "studio" }]);
  });

  it("security correction: makes legacy demotion atomic and visible through FORCE RLS", () => {
    const migration = readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
      "utf8",
    );
    expect(migration).toMatch(/LOCK TABLE attributions, event_outbox IN ACCESS EXCLUSIVE MODE/i);
    expect(migration).toMatch(/ALTER TABLE %I\.event_outbox NO FORCE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/ALTER TABLE %I\.event_outbox FORCE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/residual anonymous studio-qualified routes after demotion/i);
    expect(migration).toMatch(/studio_application_qualified[^]*studio_application_submitted/i);
    expect(migration).toMatch(/residual anonymous studio-qualified attributions after demotion/i);
  });

  it("security hardening: a pg_temp leads shadow cannot satisfy the qualified-route trigger", async () => {
    const client = await pool.connect();
    try {
      await client.query(
        readFileSync(
          path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
          "utf8",
        ),
      );
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path = pg_temp, ${SCHEMA}`);
      await client.query("CREATE TEMP TABLE leads (id uuid PRIMARY KEY, intent text NOT NULL) ON COMMIT DROP");
      const shadowId = "00000000-0000-4000-8000-000000000005";
      await client.query("INSERT INTO pg_temp.leads (id, intent) VALUES ($1, 'studio')", [shadowId]);

      await expect(
        client.query(
          `INSERT INTO ${SCHEMA}.event_outbox (event_type, aggregate_id, payload_json, created_at)
           VALUES ('lead_internal_route',$1,$2,$3)`,
          [
            shadowId,
            JSON.stringify({ route: "studio-qualified", intent: "studio", receiptId: "YL-SHADOW0" }),
            new Date("2026-08-25T11:10:00Z"),
          ],
        ),
      ).rejects.toThrow(/studio-qualified/i);
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("security hardening: the trigger function has fixed search_path and no unintended EXECUTE", async () => {
    await pool.query(
      readFileSync(
        path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
        "utf8",
      ),
    );
    const { rows } = await pool.query(
      `SELECT proc.proconfig,
              proc.prosecdef,
              EXISTS (
                SELECT 1
                  FROM aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
                 WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
              ) AS public_execute,
              EXISTS (
                SELECT 1
                  FROM aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
                 WHERE acl.grantee <> 0
                   AND acl.grantee <> proc.proowner
                   AND acl.privilege_type = 'EXECUTE'
              ) AS unintended_execute,
              trigger.tgenabled
         FROM pg_proc proc
         JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
         JOIN pg_trigger trigger ON trigger.tgfoid = proc.oid
        WHERE namespace.nspname = $1
          AND proc.proname = 'enforce_studio_qualified_route'
          AND trigger.tgname = 'event_outbox_bind_studio_qualified'`,
      [SCHEMA],
    );
    expect(rows).toEqual([
      {
        proconfig: ["search_path=pg_catalog, pg_temp"],
        prosecdef: false,
        public_execute: false,
        unintended_execute: false,
        tgenabled: "O",
      },
    ]);

    await createLead(pool, { ...VALID, email: "trigger-postflight@example.com" }, {
      now: new Date("2026-08-25T11:20:00Z"),
    });
    expect(
      (await pool.query(
        `SELECT 1 FROM event_outbox
          WHERE event_type = 'lead_internal_route'
            AND payload_json->>'route' = 'studio-qualified'`,
      )).rowCount,
    ).toBe(0);
  });

  it("security hardening: pg_temp cannot divert the target attribution correction", async () => {
    const migration = readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
      "utf8",
    );
    const client = await pool.connect();
    let targetConstraint = "";
    try {
      await client.query(`ALTER TABLE ${SCHEMA}.attributions
        DROP CONSTRAINT IF EXISTS attributions_event_name_check`);
      await client.query(`ALTER TABLE ${SCHEMA}.attributions
        ADD CONSTRAINT attributions_event_name_check CHECK (
          event_name IN ('home_primary_cta', 'studio_application_qualified')
        )`);
      await client.query("CREATE TEMP TABLE attributions (event_name text)");
      await client.query(`ALTER TABLE pg_temp.attributions
        ADD CONSTRAINT attributions_event_name_check CHECK (
          event_name IN ('home_primary_cta', 'studio_application_qualified')
        )`);

      await client.query(migration);
      const { rows } = await client.query(
        `SELECT pg_get_constraintdef(constraint_row.oid) AS definition
           FROM pg_constraint constraint_row
           JOIN pg_class table_class ON table_class.oid = constraint_row.conrelid
           JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
          WHERE namespace.nspname = $1
            AND table_class.relname = 'attributions'
            AND constraint_row.conname = 'attributions_event_name_check'`,
        [SCHEMA],
      );
      targetConstraint = rows[0]?.definition ?? "";
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.query("DROP TABLE IF EXISTS pg_temp.attributions").catch(() => {});
      await client.query(`SET search_path = ${SCHEMA}`);
      await client.query(migration);
      client.release();
    }

    expect(targetConstraint).not.toContain("studio_application_qualified");
  });

  it("security hardening: rerun revokes a pre-existing unintended function grant", async () => {
    const migration = readFileSync(
      path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
      "utf8",
    );
    const role = "t_leads_unintended_exec";
    const client = await pool.connect();
    let rerunError: unknown;
    let retainsExecute = true;
    try {
      await client.query(migration);
      await client.query(`DROP ROLE IF EXISTS ${role}`);
      await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT`);
      await client.query(
        `GRANT EXECUTE ON FUNCTION ${SCHEMA}.enforce_studio_qualified_route() TO ${role}`,
      );
      try {
        await client.query(migration);
      } catch (error) {
        rerunError = error;
      }
      await client.query("ROLLBACK").catch(() => {});
      const { rows } = await client.query(
        `SELECT has_function_privilege($1, $2, 'EXECUTE') AS retains_execute`,
        [role, `${SCHEMA}.enforce_studio_qualified_route()`],
      );
      retainsExecute = rows[0]?.retains_execute ?? true;
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.query(
        `REVOKE ALL ON FUNCTION ${SCHEMA}.enforce_studio_qualified_route() FROM ${role}`,
      ).catch(() => {});
      await client.query(`DROP ROLE IF EXISTS ${role}`).catch(() => {});
      client.release();
    }

    expect(rerunError).toBeUndefined();
    expect(retainsExecute).toBe(false);
  });

  it("keeps an explicitly unqualified studio application on the ordinary studio route", async () => {
    const response = await postQualified({
      budgetBand: "under-50k",
      timing: "exploring",
      decisionRole: "advisor",
      message: "An ordinary Studio application.",
    });
    expect(response.status).toBe(201);
    const { rows } = await pool.query(
      "SELECT payload_json->>'route' AS route FROM event_outbox WHERE event_type = 'lead_internal_route'",
    );
    expect(rows).toEqual([{ route: "studio" }]);
  });

  it("keeps a general Studio lead with no qualifier set on the ordinary route", async () => {
    const response = await postQualified({
      budgetBand: undefined,
      timing: undefined,
      decisionRole: undefined,
      message: "A general Studio enquiry.",
    });
    expect(response.status).toBe(201);
    const { rows } = await pool.query(
      "SELECT payload_json->>'route' AS route FROM event_outbox WHERE event_type = 'lead_internal_route'",
    );
    expect(rows).toEqual([{ route: "studio" }]);
  });

  it("rejects the retired public qualified field without storing personal data", async () => {
    const response = await postQualified({ qualified: true });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'unknown field "qualified"' });
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("rejects Studio qualifiers on a non-studio intent without storing personal data", async () => {
    const response = await postQualified({ intent: "press" });
    expect(response.status).toBe(400);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it.each(["qualified", "unqualified", "general"] as const)(
    "keeps the %s Studio API sink closed while Studio is disabled",
    async (kind) => {
      const overrides = kind === "qualified"
        ? {}
        : kind === "unqualified"
          ? { budgetBand: "under-50k", timing: "exploring", decisionRole: "advisor" }
          : { budgetBand: undefined, timing: undefined, decisionRole: undefined };
      const response = await postQualified(overrides, { studioEnabled: "false" });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "studio_not_accepting_submissions",
      });
      expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
    },
  );
});
