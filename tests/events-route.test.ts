import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { createIsolatedSchema, dropSchema, testDatabaseUrl } from "./helpers/attribution-db";

const SCHEMA = "t_events_route";
const ORIGIN = "https://yulalab.com";

let pool: Pool;
const localLoginUrl = (schema: string) => {
  const url = new URL(testDatabaseUrl(schema));
  url.username = process.env.USER ?? "postgres";
  return url.toString();
};

beforeAll(async () => {
  pool = await createIsolatedSchema(SCHEMA);
});

afterAll(async () => {
  await dropSchema(pool, SCHEMA);
});

beforeEach(async () => {
  await pool.query("TRUNCATE attributions");
  process.env.YULA_DATABASE_SCHEMA = SCHEMA;
  process.env.YULA_INTAKE_DATABASE_URL = localLoginUrl(SCHEMA);
  process.env.YULA_MAIL_DATABASE_URL = "postgres://mail-test@invalid.invalid/yula";
  process.env.YULA_PURGE_DATABASE_URL = "postgres://purge-test@invalid.invalid/yula";
  process.env.ATTRIBUTION_SECRET = "test-secret-not-a-real-one";
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
});

afterEach(async () => {
  const { resetPool } = await import("@/server/db");
  await resetPool("intake");
  delete process.env.YULA_INTAKE_DATABASE_URL;
  delete process.env.YULA_MAIL_DATABASE_URL;
  delete process.env.YULA_PURGE_DATABASE_URL;
  delete process.env.YULA_DATABASE_SCHEMA;
  delete process.env.ATTRIBUTION_SECRET;
});

function body(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    event: "store_outbound",
    locale: "tr",
    page: "/projects/lifeos",
    product: "lifeos",
    target: "https://apps.apple.com/tr/app/id123",
    targetCategory: "store",
    session: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    ...overrides,
  };
}

function request(
  payload: unknown,
  init: { origin?: string | null; method?: string; secFetchSite?: string } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  if (init.secFetchSite) headers["sec-fetch-site"] = init.secFetchSite;
  return new Request(`${ORIGIN}/api/events`, {
    method: init.method ?? "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function post(
  payload: unknown,
  init?: { origin?: string | null; method?: string; secFetchSite?: string },
) {
  const { POST } = await import("@/app/api/events/route");
  return POST(request(payload, init));
}

describe("POST /api/events", () => {
  it("accepts a valid outbound event with 202 and reports it stored", async () => {
    const res = await post(body());
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({ stored: true });

    const { rows } = await pool.query("SELECT event_name, target_url FROM attributions");
    expect(rows).toHaveLength(1);
    expect(rows[0].event_name).toBe("store_outbound");
  });

  it("rejects an unknown event name with 400", async () => {
    const res = await post(body({ event: "not_an_event" }));
    expect(res.status).toBe(400);
    expect(await pool.query("SELECT * FROM attributions").then((r) => r.rowCount)).toBe(0);
  });

  it("security correction: rejects an anonymous Studio-qualified metric event", async () => {
    const res = await post(
      body({
        event: "studio_application_qualified",
        target: undefined,
        targetCategory: undefined,
        product: undefined,
        page: "/studio",
      }),
    );
    expect(res.status).toBe(400);
    expect(await pool.query("SELECT * FROM attributions").then((r) => r.rowCount)).toBe(0);
  });

  it("rejects an unknown field with 400 rather than dropping it", async () => {
    const res = await post(body({ email: "kaan@example.com" }));
    expect(res.status).toBe(400);
    const payload = await res.json();
    // The error may name the key; it must never echo the value back.
    expect(JSON.stringify(payload)).not.toContain("kaan@example.com");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("rejects an oversized body with 413", async () => {
    const res = await post(body({ campaign: "a".repeat(20_000) }));
    expect(res.status).toBe(413);
  });

  it("rejects a cross-origin post with 403", async () => {
    const res = await post(body(), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("accepts a same-origin post from the links hub", async () => {
    const res = await post(body(), { origin: "https://links.yulalab.com" });
    expect(res.status).toBe(202);
  });
});

describe("honest failure when storage is unavailable", () => {
  it("reports 503 and stored:false rather than a silent 202", async () => {
    // A 202 here would inflate the attribution-completeness metric with
    // events that were never written — the site's own funnel would then
    // report a number it cannot back. Fail open for the visitor (their
    // navigation is never blocked), fail closed for the claim.
    delete process.env.YULA_INTAKE_DATABASE_URL;
    const res = await post(body());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ stored: false });
  });

  it("refuses to store with a missing attribution secret", async () => {
    // Hashing with a constant fallback would create a permanently joinable
    // pseudonym; refusing is the safer failure.
    delete process.env.ATTRIBUTION_SECRET;
    const res = await post(body());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ stored: false });
    expect(await pool.query("SELECT * FROM attributions").then((r) => r.rowCount)).toBe(0);
  });
});

describe("method handling", () => {
  it("answers GET with 405", async () => {
    const { GET } = await import("@/app/api/events/route");
    const res = await GET();
    expect(res.status).toBe(405);
  });
});


describe("origin allowlist edges", () => {
  async function tryOrigin(origin: string) {
    const { POST } = await import("@/app/api/events/route");
    return POST(request(body(), { origin }));
  }

  it("does not fall for a lookalike of a first-party host", async () => {
    expect((await tryOrigin("https://evil-vercel.app")).status).toBe(403);
    expect((await tryOrigin("https://vercel.app.evil.example")).status).toBe(403);
    expect((await tryOrigin("https://notyulalab.com")).status).toBe(403);
  });

  it("refuses ANY vercel.app host that is not this deployment", async () => {
    // The earlier version trusted the whole *.vercel.app suffix, so any
    // Vercel user could name a project and get a passing Origin. Preview
    // deployments are identified by VERCEL_URL — the host Vercel assigns to
    // THIS deployment — not by a wildcard over everybody's.
    expect((await tryOrigin("https://attacker-project.vercel.app")).status).toBe(403);
    expect((await tryOrigin("https://vercel.app")).status).toBe(403);
  });

  it("accepts the preview host of this very deployment", async () => {
    process.env.VERCEL_URL = "yulalab-git-preview-abc123.vercel.app";
    expect((await tryOrigin("https://yulalab-git-preview-abc123.vercel.app")).status).toBe(202);
    expect((await tryOrigin("https://someone-else.vercel.app")).status).toBe(403);
    delete process.env.VERCEL_URL;
  });

  it("accepts the origin this deployment is configured to serve", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:4173";
    expect((await tryOrigin("http://127.0.0.1:4173")).status).toBe(202);
    process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  });

  it("still refuses a foreign origin when the configured one is set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:4173";
    expect((await tryOrigin("https://evil.example")).status).toBe(403);
    process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  });
});

describe("requests without an Origin header", () => {
  it("refuses a scripted post that sends no Origin and no Sec-Fetch-Site", async () => {
    // Previously this returned 202: any curl/script had unauthenticated
    // write access to a table holding KVKK-scope data.
    const res = await post(body(), { origin: null });
    expect(res.status).toBe(403);
  });

  it("accepts a same-origin browser request that omits Origin", async () => {
    // Sec-Fetch-Site is set by the browser and is a forbidden header, so
    // page script cannot forge it.
    expect((await post(body(), { origin: null, secFetchSite: "same-origin" })).status).toBe(202);
    expect((await post(body(), { origin: null, secFetchSite: "none" })).status).toBe(202);
  });

  it("refuses a cross-site request that omits Origin", async () => {
    expect((await post(body(), { origin: null, secFetchSite: "cross-site" })).status).toBe(403);
  });
});

describe("rate limiting", () => {
  async function flood(count: number, options: { ip?: string; rotateSession: boolean }) {
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const { POST } = await import("@/app/api/events/route");
    let limited = 0;
    for (let i = 0; i < count; i += 1) {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        origin: ORIGIN,
      };
      if (options.ip) headers["x-forwarded-for"] = options.ip;
      const session = options.rotateSession
        ? randomBytes(16).toString("hex")
        : "f".repeat(32);
      const res = await POST(
        new Request(`${ORIGIN}/api/events`, {
          method: "POST",
          headers,
          body: JSON.stringify(body({ session })),
        }),
      );
      if (res.status === 429) limited += 1;
    }
    return limited;
  }

  it("stops a flood even when the caller rotates the session token", async () => {
    // The bucket was originally keyed on `session`, which the caller
    // chooses: rotating it blocked exactly 0 of 200 requests, so the limiter
    // delivered none of what its own docstring promised. Keyed on client IP,
    // one machine cannot vary it.
    expect(await flood(60, { ip: "203.0.113.9", rotateSession: true })).toBeGreaterThan(0);
  });

  it("still limits when the session is held constant", async () => {
    expect(await flood(60, { ip: "203.0.113.9", rotateSession: false })).toBeGreaterThan(0);
  });

  it("gives a different client its own budget", async () => {
    await flood(60, { ip: "203.0.113.9", rotateSession: true });
    const { POST } = await import("@/app/api/events/route");
    const res = await POST(
      new Request(`${ORIGIN}/api/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          "x-forwarded-for": "198.51.100.4",
        },
        body: JSON.stringify(body()),
      }),
    );
    expect(res.status).toBe(202);
  });

  it("reads only the first x-forwarded-for hop", async () => {
    // Later hops are attacker-appendable; trusting them would restore the
    // rotate-to-bypass hole with a different field.
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const { POST } = await import("@/app/api/events/route");
    let limited = 0;
    for (let i = 0; i < 60; i += 1) {
      const res = await POST(
        new Request(`${ORIGIN}/api/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            "x-forwarded-for": `203.0.113.9, 10.0.0.${i}`,
          },
          body: JSON.stringify(body({ session: randomBytes(16).toString("hex") })),
        }),
      );
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("value-level PII rejection (not just unknown fields)", () => {
  // Rejecting unknown FIELDS is not the same as constraining the VALUES of
  // known ones. Every case below was ACCEPTED and STORED by the first
  // version, while the public privacy page claimed such data "technically
  // cannot" enter.
  it.each([
    ["an email address in the page path", "/kaan@example.com is my email"],
    ["a sentence with a name and an ID", "/my name is Mustafa Kaan, TCKN 12345678901"],
    ["an injected newline (log forgery)", "/log\n2026-01-01 FAKE LOG LINE"],
    ["a script tag", "/<script>alert(1)</script>"],
    ["a NUL byte", "/x\u0000y"],
    ["a protocol-relative prefix", "//evil.example"],
  ])("rejects %s", async (_label, page) => {
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const res = await post(body({ event: "product_view", page, target: undefined, targetCategory: undefined }));
    expect(res.status).toBe(400);
    expect(await pool.query("SELECT * FROM attributions").then((r) => r.rowCount)).toBe(0);
  });

  it("strips query and fragment from the stored outbound URL", async () => {
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const res = await post(
      body({ target: "https://apps.apple.com/tr/app/id123?ref=kaan@example.com#a@b.co" }),
    );
    expect(res.status).toBe(202);
    const { rows } = await pool.query("SELECT target_url FROM attributions");
    expect(rows[0].target_url).toBe("https://apps.apple.com/tr/app/id123");
  });

  it("decides the target category itself instead of trusting the sender", async () => {
    // A sender labelling a store click "internal" would silently corrupt
    // the outbound/store split this endpoint exists to report.
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const res = await post(body({ targetCategory: "internal" }));
    expect(res.status).toBe(202);
    const { rows } = await pool.query("SELECT target_category FROM attributions");
    expect(rows[0].target_category).toBe("store");
  });

  it("stops pulling an oversized body instead of buffering it whole", async () => {
    // The previous version of this test supplied an explicit content-length
    // — the one case the early return handled — so it passed even with that
    // check deleted, and said nothing about the general case. This one
    // counts the bytes the handler actually pulls from the stream, with NO
    // content-length header, which is exactly the path that used to buffer
    // 8 MB before refusing.
    const { resetRateLimit } = await import("@/server/rate-limit");
    resetRateLimit();
    const { POST } = await import("@/app/api/events/route");

    let pulled = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("a".repeat(64 * 1024));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= 8 * 1024 * 1024) {
          controller.close();
          return;
        }
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });

    const res = await POST(
      new Request(`${ORIGIN}/api/events`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: stream,
        // @ts-expect-error -- required by undici for a streaming body
        duplex: "half",
      }),
    );

    expect(res.status).toBe(413);
    expect(cancelled, "the handler must cancel the stream, not drain it").toBe(true);
    // One chunk over the 2 KB cap is enough to decide; anything near the
    // full 8 MB means it drained the body first.
    expect(pulled).toBeLessThan(1024 * 1024);
  });
});
