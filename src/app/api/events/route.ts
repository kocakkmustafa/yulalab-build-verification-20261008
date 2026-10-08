import { NextResponse } from "next/server";
import { parseEventPayload } from "@/lib/analytics/events";
import { getPool, isDatabaseConfigured } from "@/server/db";
import { recordAttribution } from "@/server/attribution";
import { allowRequest } from "@/server/rate-limit";
import { readBounded } from "@/server/http";

// pg needs the Node.js runtime; the edge runtime has no TCP sockets.
export const runtime = "nodejs";
// Never statically optimised — this route exists to have side effects.
export const dynamic = "force-dynamic";

/** Well above any legitimate event, well below anything worth parsing. */
const MAX_BODY_BYTES = 2_048;


/**
 * Same-origin only. The site and the links hub are the two first-party
 * surfaces that emit events (roadmap: "main and links use the same event
 * contract"); anything else posting here is either a mistake or an attempt
 * to poison the funnel.
 */
const ALLOWED_ORIGINS = new Set([
  "https://yulalab.com",
  "https://www.yulalab.com",
  "https://links.yulalab.com",
]);

/**
 * Decides whether a request may write.
 *
 * The first version of this failed in two ways that a reviewer reproduced
 * against the real table:
 *
 * 1. A missing `Origin` returned true, so any script with curl could write.
 *    The intent was "same-origin browser requests do not always send
 *    Origin", but the correct signal for that is `Sec-Fetch-Site`, which a
 *    browser sets and a script cannot forge (it is a forbidden header).
 * 2. Any `*.vercel.app` host was trusted, so *any* Vercel user could name a
 *    project and get a passing Origin. Preview deployments are now matched
 *    against `VERCEL_URL` — the host Vercel assigns to THIS deployment —
 *    rather than a wildcard over everybody's.
 */
function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    // A cheap filter, NOT an authentication check. The forbidden-header rule
    // that stops page script from setting Sec-Fetch-Site binds browsers; it
    // binds nothing else, and `curl -H 'sec-fetch-site: none'` sails
    // straight through. An earlier comment here claimed this header "cannot
    // be forged", which was simply wrong.
    //
    // What this actually buys: a browser on a hostile page cannot reach the
    // endpoint, and a naive script has to know to add the header. Scripted
    // writes are held down by the rate limiter below, keyed on client IP —
    // that is the real defence, and it is a floor, not a wall. This endpoint
    // is anonymously writable by design; see src/server/rate-limit.ts.
    const site = request.headers.get("sec-fetch-site");
    return site === "same-origin" || site === "none";
  }

  if (ALLOWED_ORIGINS.has(origin)) return true;

  // The origin this deployment is actually serving. Without it the funnel
  // is unverifiable anywhere except production: a local `next start` sends
  // an Origin that no hardcoded list contains, so every browser event would
  // 403 and the chain could only ever be tested against the live site.
  // Attacker-controlled input cannot reach here — it is our own config.
  for (const candidate of [process.env.NEXT_PUBLIC_SITE_URL, vercelOrigin()]) {
    if (!candidate) continue;
    try {
      if (new URL(candidate).origin === origin) return true;
    } catch {
      /* a misconfigured env var must not widen the allowlist */
    }
  }
  return false;
}

function vercelOrigin(): string | undefined {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
}

/**
 * The rate-limit bucket key.
 *
 * First hop of x-forwarded-for is the client address on Vercel; later hops
 * are attacker-controllable, so only the first is read. Falls back to the
 * session token when no proxy header exists (local development), which is
 * weak but is the only identifier available there.
 */
function clientKey(request: Request, session: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return `ip:${first}`;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return `session:${session}`;
}

/**
 * Records one funnel event.
 *
 * Response contract, and why it is shaped this way:
 *
 * - 202 `{stored:true}`  — written to the attribution table.
 * - 400                  — payload violated the event contract.
 * - 403                  — foreign origin.
 * - 413                  — body too large to be a legitimate event.
 * - 503 `{stored:false}` — storage unconfigured or unavailable.
 *
 * The 503 matters more than it looks. Returning 202 when there is no
 * database would make every dropped event indistinguishable from a stored
 * one, and the "attribution completeness ≥99%" gate would then be measuring
 * a number the site cannot actually back. The visitor never notices either
 * way — the client fires this and forgets it, and navigation is never
 * blocked on the response — so the honest status code costs nothing and
 * keeps the metric truthful.
 */
export async function POST(request: Request): Promise<Response> {
  if (!allowedOrigin(request)) {
    return NextResponse.json({ stored: false, reason: "origin" }, { status: 403 });
  }

  const raw = await readBounded(request, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ stored: false, reason: "too_large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ stored: false, reason: "malformed_json" }, { status: 400 });
  }

  const parsed = parseEventPayload(json);
  if (!parsed.ok) {
    // parseEventPayload's reason names keys only, never values, so this is
    // safe to return and safe to log.
    return NextResponse.json({ stored: false, reason: parsed.reason }, { status: 400 });
  }

  // Keyed on the client IP, NOT on the session token. The session is a
  // field the caller chooses: a script that minted a fresh 32-hex value per
  // request was limited to exactly zero, which made the limiter decorative.
  if (!allowRequest(clientKey(request, parsed.value.session))) {
    return NextResponse.json({ stored: false, reason: "rate_limited" }, { status: 429 });
  }

  const secret = process.env.ATTRIBUTION_SECRET;
  if (!isDatabaseConfigured("intake") || !secret) {
    return NextResponse.json(
      { stored: false, reason: "storage_unavailable" },
      { status: 503 },
    );
  }

  try {
    await recordAttribution(getPool("intake"), parsed.value, { now: new Date(), secret });
  } catch (error) {
    // Deliberately does not log the payload — only the failure shape.
    console.error("attribution write failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ stored: false, reason: "write_failed" }, { status: 503 });
  }

  return NextResponse.json({ stored: true }, { status: 202 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

// No OPTIONS handler on purpose. The links hub posts with sendBeacon (and
// falls back to `mode: "no-cors"`), both of which are CORS-simple requests
// that never preflight; the main site's own fetch is same-origin. An
// earlier version shipped a preflight handler whose tests validated a code
// path production never takes — a green test proving nothing. If a genuine
// cross-origin fetch is ever needed, add it back together with the response
// CORS headers it would also require.
