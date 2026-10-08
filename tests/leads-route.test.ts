import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createIsolatedSchema, dropSchema, testDatabaseUrl } from "./helpers/attribution-db";

const SCHEMA = "t_leads_route";
const ORIGIN = "https://yulalab.com";
let pool: Pool;
const localLoginUrl = (schema: string) => {
  const url = new URL(testDatabaseUrl(schema));
  url.username = process.env.USER ?? "postgres";
  return url.toString();
};
let previousStudioEnabled: string | undefined;

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
  previousStudioEnabled = process.env.STUDIO_ENABLED;
  process.env.YULA_DATABASE_SCHEMA = SCHEMA;
  process.env.YULA_INTAKE_DATABASE_URL = localLoginUrl(SCHEMA);
  process.env.YULA_MAIL_DATABASE_URL = "postgres://mail-test@invalid.invalid/yula";
  process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  // The route refuses everything unless collection is explicitly enabled;
  // see the "closed by default" suite at the bottom for why.
  process.env.LEADS_ENABLED = "1";
  // This legacy route corpus submits Studio payloads by default. Publication
  // is therefore an explicit per-test precondition, not a process-wide flag.
  process.env.STUDIO_ENABLED = "true";
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
  if (previousStudioEnabled === undefined) delete process.env.STUDIO_ENABLED;
  else process.env.STUDIO_ENABLED = previousStudioEnabled;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function body(overrides: Record<string, unknown> = {}) {
  return {
    name: "Kaan",
    email: "someone@example.com",
    intent: "studio",
    message: "We would like to talk about a build.",
    locale: "tr",
    consent: true,
    website: "", // honeypot, must stay empty
    budgetBand: "150-400k",
    timing: "now",
    decisionRole: "founder",
    ...overrides,
  };
}

async function post(payload: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/leads/route");
  return POST(
    new Request(`${ORIGIN}/api/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );
}

describe("a valid submission", () => {
  it("preserves the receipt for an identical retry across UTC midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-06T23:59:59Z"));
    const first = await post(body());
    expect(first.status).toBe(201);
    const receipt = await first.json();
    vi.setSystemTime(new Date("2026-09-07T00:00:01Z"));
    const retry = await post(body());
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(receipt);
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM lead_consents")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(2);
  });

  it("does not reveal recent contact activity through address-only rejection", async () => {
    expect((await post(body())).status).toBe(201);
    const known = await post(body({ email: " SOMEONE@EXAMPLE.COM ", message: "An unrelated inquiry" }));
    const fresh = await post(body({ email: "fresh@example.com", message: "An unrelated inquiry" }));
    expect(known.status).toBe(201);
    expect(fresh.status).toBe(known.status);
    expect(Object.keys(await known.json())).toEqual(["receiptId"]);
    expect(Object.keys(await fresh.json())).toEqual(["receiptId"]);
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(3);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(6);
  });

  it("returns a truthful capacity error for changed content without losing retry receipts", async () => {
    const first = await post(body(), { "x-forwarded-for": "203.0.113.1" });
    expect(first.status).toBe(201);
    const receipt = await first.json();
    for (let i = 1; i < 20; i += 1) {
      expect((await post(body({ message: `Additional inquiry ${i}` }))).status).toBe(201);
    }
    const limited = await post(body({ email: " SOMEONE@EXAMPLE.COM ", message: "Another message" }), {
      "x-forwarded-for": "198.51.100.2",
    });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    const retry = await post(body());
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(receipt);
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(20);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(40);
  });

  it("accepts it and returns a quotable receipt", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    const json = (await res.json()) as { receiptId: string };
    expect(json.receiptId).toMatch(/^YL-[0-9A-F]{8}$/);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
    expect((await pool.query(
      `SELECT payload_json->>'route' AS route
         FROM event_outbox
        WHERE event_type = 'lead_internal_route'`,
    )).rows).toEqual([{ route: "studio" }]);
    expect((await pool.query(
      `SELECT 1 FROM event_outbox
        WHERE event_type = 'lead_internal_route'
          AND payload_json->>'route' = 'studio-qualified'`,
    )).rowCount).toBe(0);
  });

  it("returns the same receipt for a double submit and stores one lead", async () => {
    const first = (await (await post(body())).json()) as { receiptId: string };
    const second = (await (await post(body())).json()) as { receiptId: string };
    expect(second.receiptId).toBe(first.receiptId);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
    expect((await pool.query(
      `SELECT payload_json->>'route' AS route
         FROM event_outbox
        WHERE event_type = 'lead_internal_route'`,
    )).rows).toEqual([{ route: "studio" }]);
  });

  it("ignores forged qualification headers and keeps valid self-report ordinary", async () => {
    const res = await post(body(), {
      "x-studio-qualified": "true",
      "x-yula-reviewer": "founder",
      "x-forwarded-for": "203.0.113.77",
    });
    expect(res.status).toBe(201);
    expect((await pool.query(
      `SELECT payload_json->>'route' AS route
         FROM event_outbox
        WHERE event_type = 'lead_internal_route'`,
    )).rows).toEqual([{ route: "studio" }]);
  });
});

describe("rejections", () => {
  it.each([
    ["a malformed email", { email: "not-an-email" }],
    ["a missing name", { name: "  " }],
    ["an empty message", { message: "   " }],
    ["an oversized message", { message: "x".repeat(4001) }],
    ["an unknown intent", { intent: "spam" }],
    ["an unsupported locale", { locale: "de" }],
  ])("rejects %s with 400", async (_label, override) => {
    const res = await post(body(override));
    expect(res.status).toBe(400);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("refuses a submission without explicit consent", async () => {
    // Consent is the lawful basis recorded on the row; without it there is
    // nothing to record and no basis to store the person's data at all.
    const res = await post(body({ consent: false }));
    expect(res.status).toBe(400);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("silently accepts but does not store a honeypot submission", async () => {
    // Answering 400 tells a bot exactly which field betrayed it. A 201 with
    // no row costs nothing and teaches nothing.
    const res = await post(body({ website: "http://spam.example" }));
    expect(res.status).toBe(201);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("rejects a foreign origin", async () => {
    const res = await post(body(), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("rejects the retired public qualified boolean without storing a lead", async () => {
    const res = await post(body({ qualified: true }));
    expect(res.status).toBe(400);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it.each(["studioVerdict", "isQualified"])(
    "rejects the forged public verdict alias %s without storing a lead",
    async (field) => {
      const res = await post(body({ [field]: "qualified" }));
      expect(res.status).toBe(400);
      expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
      expect((await pool.query("SELECT * FROM event_outbox")).rowCount).toBe(0);
    },
  );

  it.each([
    ["budgetBand", "OVER-400K"],
    ["timing", " now "],
    ["decisionRole", "owner"],
    ["budgetBand", 150_000],
  ])("rejects a forged Studio qualifier %s without storing personal data", async (field, value) => {
    const res = await post(body({ [field]: value }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: field });
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("rejects Studio-only qualifiers on another intent", async () => {
    const res = await post(body({ intent: "press" }));
    expect(res.status).toBe(400);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("rate-limits a flood from one client", async () => {
    let limited = 0;
    for (let i = 0; i < 40; i += 1) {
      const res = await post(body({ message: `attempt ${i}` }), { "x-forwarded-for": "203.0.113.9" });
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("honest failure when storage is unavailable", () => {
  it("does not pretend to have captured the lead", async () => {
    delete process.env.YULA_INTAKE_DATABASE_URL;
    const res = await post(body());
    expect(res.status).toBe(503);
    const json = (await res.json()) as { receiptId?: string };
    expect(json.receiptId).toBeUndefined();
  });
});

describe("PII never reaches the logs", () => {
  it("redacts a CHECK violation, whose detail contains the whole failing row", async () => {
    // The previous version of this test pointed at a missing table. That
    // error (42P01) carries no personal data at all, so `console.error(…,
    // error)` survived as a mutant and the redaction was never exercised.
    //
    // A CHECK violation is the one that matters: pg puts the entire failing
    // row in `detail`, and util.inspect — what console.error(err) prints —
    // exposes it.
    const { redactWriteFailure } = await import("@/server/leads");
    let caught: unknown;
    try {
      await pool.query(
        `INSERT INTO leads (name, email, intent, message, locale, dedupe_key)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        ["Kaan", "kaan.kocak@example.com", "studio", "   ", "tr", "b".repeat(64)],
      );
    } catch (error) {
      caught = error;
    }

    // Guard the guard: this must really be the PII-carrying error class.
    const { inspect } = await import("node:util");
    expect((caught as { code?: string })?.code).toBe("23514");
    expect(inspect(caught)).toContain("kaan.kocak@example.com");

    const redacted = redactWriteFailure(caught);
    expect(redacted).not.toContain("kaan.kocak@example.com");
    expect(redacted).not.toContain("Kaan");
    expect(redacted).toMatch(/\(23514\)$/);
  });

  it("logs nothing but the redacted shape when the ROUTE hits a PII-carrying error", async () => {
    // Pointed at a schema whose leads table carries an extra CHECK the
    // route's own validation does not cover, so a perfectly route-valid
    // submission produces a 23514 — the error class whose `detail` contains
    // the whole failing row.
    //
    // Without this the test used a missing table (42P01, no PII in it) and
    // `console.error(…, error)` survived as a mutant: the redaction at the
    // log site was never exercised at all.
    const HOSTILE = "t_leads_hostile";
    await pool.query(`DROP SCHEMA IF EXISTS ${HOSTILE} CASCADE`);
    await pool.query(`CREATE SCHEMA ${HOSTILE}`);
    const hostilePool = (await import("pg")).default.Pool;
    const setup = new hostilePool({ connectionString: testDatabaseUrl(HOSTILE), max: 2 });
    await setup.query(
      readFileSync(
        path.resolve(import.meta.dirname, "../db/migrations/0002_leads_consents_outbox.sql"),
        "utf8",
      ),
    );
    // Route-valid, database-hostile.
    await setup.query("ALTER TABLE leads ADD CONSTRAINT no_secrets CHECK (message NOT LIKE '%secret%')");
    await setup.end();

    // Rendered the way console.error ACTUALLY renders. `String(err)` gives
    // only the message, and pg puts no PII there — only in `detail`, which
    // util.inspect prints and String() drops. A spy that stringifies more
    // weakly than the real logger cannot see the leak it exists to catch.
    const { inspect } = await import("node:util");
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((a) => (typeof a === "string" ? a : inspect(a))).join(" "));
    });
    const { resetPool } = await import("@/server/db");
    await resetPool("intake");
    process.env.YULA_DATABASE_SCHEMA = HOSTILE;
    process.env.YULA_INTAKE_DATABASE_URL = localLoginUrl(HOSTILE);

    const res = await post(body({ email: "kaan.kocak@example.com", message: "these are secret plans" }));
    expect(res.status).toBe(503);

    const logged = errors.join("\n");
    expect(logged, "something was logged").not.toBe("");
    expect(logged).not.toContain("kaan.kocak@example.com");
    expect(logged).not.toContain("these are secret plans");
    expect(logged).not.toContain("Kaan");

    await resetPool("intake");
    process.env.YULA_DATABASE_SCHEMA = SCHEMA;
    process.env.YULA_INTAKE_DATABASE_URL = localLoginUrl(SCHEMA);
    await pool.query(`DROP SCHEMA IF EXISTS ${HOSTILE} CASCADE`);
  });
});

describe("the collection surface is closed by default", () => {
  it("refuses submissions when LEADS_ENABLED is unset", async () => {
    // Not publishing the FORM does not unpublish the SINK: middleware
    // excludes /api, so this route answers on the public internet the moment
    // main deploys, and the origin check is satisfied by any client that
    // sets the header. Until the legal review lands and /privacy describes
    // lead data, the only correct answer is that we are not collecting.
    delete process.env.LEADS_ENABLED;
    const res = await post(body());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: "not_accepting_submissions" });
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("is not opened by any value other than an explicit 1", async () => {
    for (const value of ["true", "yes", "0", ""]) {
      process.env.LEADS_ENABLED = value;
      expect((await post(body())).status).toBe(503);
    }
    process.env.LEADS_ENABLED = "1";
  });
});

describe("the Studio API surface is closed by default", () => {
  it("refuses a direct Studio submission when STUDIO_ENABLED is unset", async () => {
    delete process.env.STUDIO_ENABLED;
    const res = await post(body());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "studio_not_accepting_submissions",
    });
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });
});

describe("the notice version is ours, not the caller's", () => {
  it("ignores a client-supplied version and records the server's", async () => {
    // A consent row exists to answer "to what did they agree". A version the
    // caller names proves nothing — any client could post 1970-01-01 and the
    // database would record consent to a notice that never existed.
    const { CURRENT_NOTICE_VERSION } = await import("@/server/leads");
    const res = await post({ ...body(), noticeVersion: "1970-01-01" } as Record<string, unknown>);
    // The field is not part of the contract at all, so it is refused outright.
    expect(res.status).toBe(400);

    await post(body());
    const { rows } = await pool.query("SELECT notice_version FROM lead_consents");
    expect(rows[0].notice_version).toBe(CURRENT_NOTICE_VERSION);
  });
});

describe("the honeypot cannot be sidestepped by type", () => {
  it.each([
    ["a number", 1],
    ["a boolean", true],
    ["an array", ["x"]],
    ["an object", { a: 1 }],
  ])("treats a non-string %s in the honeypot field as a trap", async (_label, value) => {
    // `typeof body.website === "string"` meant a bot sending a number skipped
    // the honeypot entirely — the field is in ALLOWED_FIELDS, so the lead
    // stored. Any presence at all is the signal; only an empty string is a
    // human leaving it alone.
    const res = await post(body({ website: value }));
    expect(res.status).toBe(201);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(0);
  });

  it("still accepts the empty string a real form submits", async () => {
    const res = await post(body({ website: "" }));
    expect(res.status).toBe(201);
    expect((await pool.query("SELECT * FROM leads")).rowCount).toBe(1);
  });
});

describe("the rate-limit key identifies a client, not everyone", () => {
  it("does not throttle a second client because a first one flooded", async () => {
    // Mutating clientKey to a constant made one IP throttle the whole world
    // and passed the existing flood test, which only asserted limited > 0.
    // Exact retries exercise the per-client limiter without spending the
    // separate shared mail budget on each request.
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    for (let i = 0; i < 40; i += 1) {
      await post(body({ message: "Repeated submission" }), { "x-forwarded-for": "203.0.113.9" });
    }
    const other = await post(body({ message: "a different person", email: "different@example.com" }), {
      "x-forwarded-for": "198.51.100.4",
    });
    expect(other.status).toBe(201);
    resetRateLimit();
  });
});
