import { NextResponse } from "next/server";
import { getPool, isDatabaseConfigured } from "@/server/db";
import { allowRequest } from "@/server/rate-limit";
import { readBounded } from "@/server/http";
import {
  createDataRequest,
  DataRequestCapacityError,
  verifyDataRequest,
  type DataRequestType,
} from "@/server/data-requests";
import { dataRequestDeliveryMissingConfig } from "@/server/mail";
import { verifyDataRequestChallenge } from "@/server/data-request-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;
const TYPES: readonly DataRequestType[] = ["access", "delete", "correct"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ALLOWED_FIELDS = new Set(["email", "requestType", "locale", "token", "challengeToken"]);

const ALLOWED_ORIGINS = new Set(["https://yulalab.com", "https://www.yulalab.com"]);

/**
 * Closed unless collection is on, for the same reason /api/leads is: without
 * a database this cannot store the request, and without mail delivery it
 * cannot send the verification link — so accepting one would promise
 * something the system cannot do. Until then /privacy points people at the
 * email address, which works today.
 */
function enabled(): boolean {
  return process.env.LEADS_ENABLED === "1";
}

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return site === "same-origin" || site === "none";
  }
  if (ALLOWED_ORIGINS.has(origin)) return true;
  for (const candidate of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]) {
    if (!candidate) continue;
    try {
      if (new URL(candidate).origin === origin) return true;
    } catch {
      /* a misconfigured env var must not widen the allowlist */
    }
  }
  return false;
}

function clientKey(request: Request): string {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return `dsr:${first}`;
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp ? `dsr:${realIp}` : "dsr:unknown";
}

/**
 * The SAME body for every submission outcome.
 *
 * Whether an address has data with us, whether a request already exists, and
 * whether the write succeeded are all invisible from here. Any difference
 * would make this endpoint an oracle for who is in the database — exactly
 * the information a data-request surface must not hand out.
 */
const SUBMITTED = { status: "submitted" } as const;
const TEMPORARILY_UNAVAILABLE = { error: "temporarily_unavailable" } as const;

export async function POST(request: Request): Promise<Response> {
  if (!allowedOrigin(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const raw = await readBounded(request, MAX_BODY_BYTES);
  if (raw === null) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ error: "malformed_json" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "malformed_json" }, { status: 400 });
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return NextResponse.json({ error: `unknown field "${key}"` }, { status: 400 });
    }
  }

  if (!allowRequest(clientKey(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Verification arm.
  if (typeof body.token === "string") {
    if (!isDatabaseConfigured("intake")) {
      return NextResponse.json(TEMPORARILY_UNAVAILABLE, { status: 503 });
    }
    try {
      const { verified } = await verifyDataRequest(getPool("intake"), body.token, { now: new Date() });
      // 200 either way, with the outcome in the body: a 404 for an unknown
      // token would leak which links are live.
      return NextResponse.json({ verified }, { status: 200 });
    } catch (error) {
      console.error("data request verify failed", error instanceof Error ? error.name : "unknown");
      return NextResponse.json(TEMPORARILY_UNAVAILABLE, { status: 503 });
    }
  }

  if (!enabled()) {
    return NextResponse.json({ error: "not_accepting_submissions" }, { status: 503 });
  }

  // Submission arm. Shape errors are still 400 — a caller that sent the wrong
  // thing needs to know — but nothing beyond shape is ever revealed.
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "email" }, { status: 400 });
  }
  if (!TYPES.includes(body.requestType as DataRequestType)) {
    return NextResponse.json({ error: "requestType" }, { status: 400 });
  }
  const locale = body.locale ?? "tr";
  if (locale !== "tr" && locale !== "en") {
    return NextResponse.json({ error: "locale" }, { status: 400 });
  }

  // This gate is intentionally before database/config admission. An invalid,
  // missing, or unverifiable proof consumes zero durable quota and creates no
  // request/outbox row.
  const challenge = await verifyDataRequestChallenge(body.challengeToken);
  if (!challenge.ok) {
    return challenge.reason === "invalid"
      ? NextResponse.json({ error: "challenge" }, { status: 403 })
      : NextResponse.json(TEMPORARILY_UNAVAILABLE, { status: 503 });
  }

  if (!isDatabaseConfigured("intake") || dataRequestDeliveryMissingConfig().length > 0) {
    return NextResponse.json(TEMPORARILY_UNAVAILABLE, { status: 503 });
  }

  try {
    await createDataRequest(
      getPool("intake"),
      { email, requestType: body.requestType as DataRequestType, locale },
      { now: new Date() },
    );
  } catch (error) {
    if (error instanceof DataRequestCapacityError) {
      // Capacity is observable internally without revealing which recipient
      // already owns a recent durable row. Keep this log deliberately free of
      // request fields and return the same envelope as every accepted intake.
      console.warn("data request durable capacity exhausted", error.name);
      return NextResponse.json(SUBMITTED, { status: 202 });
    }
    // Not surfaced to the caller: whether the write succeeded is itself a
    // signal about that address. Logged as a shape only.
    console.error("data request write failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(TEMPORARILY_UNAVAILABLE, { status: 503 });
  }
  return NextResponse.json(SUBMITTED, { status: 202 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
