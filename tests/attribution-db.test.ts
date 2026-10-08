import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createIsolatedSchema, dropSchema } from "./helpers/attribution-db";
import { recordAttribution, purgeExpiredAttributions } from "@/server/attribution";
import { rotatingSessionHash } from "@/lib/analytics/session-hash";
import type { EventPayload } from "@/lib/analytics/events";

/**
 * These tests run against a REAL PostgreSQL, never a fake.
 *
 * A stub store would happily accept a raw session token, a campaign
 * containing an email address, or a page path with a query string — the
 * exact inputs the schema exists to refuse. A green suite against a fake
 * would therefore prove nothing about the constraint that actually
 * protects the data. If Postgres is unreachable these tests FAIL rather
 * than skip, because "the DB layer is unverified" must never read as green.
 */
const SCHEMA = "t_attribution_db";
const SECRET = "test-secret-not-a-real-one";
const RAW_TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

let pool: Pool;

function payload(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    v: 1,
    event: "store_outbound",
    locale: "tr",
    page: "/projects/lifeos",
    product: "lifeos",
    target: "https://apps.apple.com/tr/app/id123",
    targetCategory: "store",
    session: RAW_TOKEN,
    source: "links",
    medium: "referral",
    campaign: "launch-2026",
    ...overrides,
  };
}

beforeAll(async () => {
  pool = await createIsolatedSchema(SCHEMA);
});

afterAll(async () => {
  await dropSchema(pool, SCHEMA);
});

beforeEach(async () => {
  await pool.query("TRUNCATE attributions");
});

describe("recording an event", () => {
  it("stores the rotating hash and never the raw session token", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await recordAttribution(pool, payload(), { now, secret: SECRET });

    const { rows } = await pool.query("SELECT * FROM attributions");
    expect(rows).toHaveLength(1);
    expect(rows[0].session_id_hash).toBe(rotatingSessionHash(RAW_TOKEN, now, SECRET));

    // Belt and braces: the raw token must not survive anywhere in the row.
    expect(JSON.stringify(rows[0])).not.toContain(RAW_TOKEN);
  });

  it("writes purge_at exactly 30 days after created_at", async () => {
    await recordAttribution(pool, payload(), { now: new Date("2026-08-19T10:00:00Z"), secret: SECRET });
    const { rows } = await pool.query(
      "SELECT purge_at - created_at AS delta FROM attributions",
    );
    expect(rows[0].delta.days).toBe(30);
  });

  it("keeps one session's events groupable within a day", async () => {
    const morning = new Date("2026-08-19T08:00:00Z");
    const evening = new Date("2026-08-19T20:00:00Z");
    await recordAttribution(pool, payload({ event: "product_view", target: undefined, targetCategory: undefined }), { now: morning, secret: SECRET });
    await recordAttribution(pool, payload(), { now: evening, secret: SECRET });

    const { rows } = await pool.query(
      "SELECT count(DISTINCT session_id_hash)::int AS sessions, count(*)::int AS events FROM attributions",
    );
    expect(rows[0].events).toBe(2);
    expect(rows[0].sessions).toBe(1);
  });

  it("separates the same visitor across days", async () => {
    await recordAttribution(pool, payload(), { now: new Date("2026-08-19T23:00:00Z"), secret: SECRET });
    await recordAttribution(pool, payload(), { now: new Date("2026-08-20T01:00:00Z"), secret: SECRET });
    const { rows } = await pool.query(
      "SELECT count(DISTINCT session_id_hash)::int AS sessions FROM attributions",
    );
    expect(rows[0].sessions).toBe(2);
  });
});

describe("the database refuses bad rows even when the application does not", () => {
  // Every test here bypasses recordAttribution() on purpose and INSERTs
  // directly. That is the point: it proves the constraint lives in the
  // schema, so a future second writer, a migration script or a psql session
  // cannot put data in this table that the funnel rules forbid.
  const base = {
    event_version: 1,
    session_id_hash: "b".repeat(64),
    event_name: "store_outbound",
    product_slug: "lifeos",
    locale: "tr",
    page_path: "/projects/lifeos",
    target_url: "https://apps.apple.com/x",
    target_category: "store",
  };

  async function insert(overrides: Record<string, unknown> = {}) {
    const row = { ...base, ...overrides };
    const keys = Object.keys(row);
    const values = keys.map((k) => (row as Record<string, unknown>)[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    return pool.query(
      `INSERT INTO attributions (${keys.join(", ")}) VALUES (${placeholders})`,
      values,
    );
  }

  it("rejects a raw session token in the hash column", async () => {
    await expect(insert({ session_id_hash: RAW_TOKEN })).rejects.toThrow();
  });

  it("rejects a campaign containing free text or an email address", async () => {
    await expect(insert({ campaign: "hi my email is a@b.co" })).rejects.toThrow();
  });

  it("rejects a page path carrying a query string", async () => {
    await expect(insert({ page_path: "/contact?email=a@b.co" })).rejects.toThrow();
  });

  it("rejects an unknown event name", async () => {
    await expect(insert({ event_name: "made_up_event" })).rejects.toThrow();
  });

  it("rejects an unsupported locale", async () => {
    await expect(insert({ locale: "de" })).rejects.toThrow();
  });

  it("rejects a target without a category and a category without a target", async () => {
    await expect(insert({ target_category: null })).rejects.toThrow();
    await expect(insert({ target_url: null })).rejects.toThrow();
  });

  it("rejects a non-https target", async () => {
    await expect(insert({ target_url: "http://apps.apple.com/x" })).rejects.toThrow();
  });

  it("rejects a row that is born already expired", async () => {
    await expect(insert({ purge_at: new Date("2000-01-01T00:00:00Z") })).rejects.toThrow();
  });
});

describe("30-day purge", () => {
  it("deletes rows past purge_at and keeps fresh ones", async () => {
    // 40 days ago -> already past its 30-day purge date.
    await recordAttribution(pool, payload(), {
      now: new Date("2026-07-10T10:00:00Z"),
      secret: SECRET,
    });
    // Today -> must survive.
    await recordAttribution(pool, payload({ session: "f".repeat(32) }), {
      now: new Date("2026-08-19T10:00:00Z"),
      secret: SECRET,
    });

    const deleted = await purgeExpiredAttributions(pool, new Date("2026-08-19T10:00:00Z"));
    expect(deleted).toBe(1);

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM attributions");
    expect(rows[0].n).toBe(1);
  });

  it("is a no-op when nothing has expired", async () => {
    await recordAttribution(pool, payload(), { now: new Date("2026-08-19T10:00:00Z"), secret: SECRET });
    expect(await purgeExpiredAttributions(pool, new Date("2026-08-19T10:00:00Z"))).toBe(0);
  });
});
