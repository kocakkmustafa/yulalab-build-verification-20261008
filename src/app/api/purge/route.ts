import { NextResponse } from "next/server";
import { getPool, isDatabaseConfigured } from "@/server/db";
import { purgeExpiredAttributions } from "@/server/attribution";
import { purgeExpiredLeads, purgeExpiredOutbox } from "@/server/leads";
import { purgeDataRequestResidue } from "@/server/data-requests";
import { authorisedByCronSecret } from "@/server/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes attribution rows past their 30-day retention.
 *
 * This route exists because the retention promise was, for one review
 * cycle, a lie: `purgeExpiredAttributions()` was written, indexed and
 * covered by a passing test — and called from nowhere in production. The
 * public privacy page stated "raw records are deleted after 30 days" in the
 * unconditional present tense while nothing deleted anything. A green test
 * for a job that never runs is the most convincing kind of nothing.
 *
 * Scheduled by `vercel.json` (daily, 04:00) and authenticated with
 * CRON_SECRET, which Vercel Cron sends as a bearer token. That schedule is
 * what makes the "raw records are deleted after 30 days" sentence on
 * /privacy true; `tests/purge-route.test.ts` asserts the cron entry exists
 * and is daily, because the failure this route was written for was a purge
 * function nothing called.
 *
 * The rationale lives here rather than in vercel.json because JSON has no
 * comments AND Vercel's deploy-time validator rejects unknown keys inside a
 * cron entry — a `"comment"` field failed the build with `crons[0] should
 * NOT have additional property comment`, even though the published
 * openapi.vercel.sh schema leaves additionalProperties undefined there. The
 * published schema is not the validator. Without the secret set the route
 * refuses rather than running unauthenticated — a public endpoint that
 * deletes rows is not something to leave open, even when the deletion is
 * one we want.
 */
export async function GET(request: Request): Promise<Response> {
  // One answer for "no secret configured" and "wrong secret", so an
  // anonymous caller cannot learn which it is.
  if (!authorisedByCronSecret(request)) {
    return NextResponse.json({ purged: null, reason: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured("purge")) {
    return NextResponse.json({ purged: null, reason: "storage_unavailable" }, { status: 503 });
  }

  try {
    // Returned rather than logged-and-forgotten: a purge that silently does
    // nothing looks exactly like one that works.
    // Both retentions run here. purgeExpiredLeads shipped with NO caller —
    // the exact defect this route was created to atone for, one file away,
    // while its own docstring said the count existed "so a scheduled run can
    // be observed rather than assumed". There was no scheduled run.
    //
    // Independently, because chaining them created a new coupling: if 0002
    // has not been applied to a database, a missing `leads` table would take
    // the ATTRIBUTION purge down with it — and that one enforces a retention
    // promise already published on /privacy. Each runs; a failure in one is
    // reported loudly rather than silently swallowed, and never cancels the
    // other.
    const now = new Date();
    const pool = getPool("purge");
    const failures: string[] = [];

    let purged: number | null = null;
    try {
      purged = await purgeExpiredAttributions(pool, now);
    } catch (error) {
      failures.push("attributions");
      console.error("attribution purge failed", error instanceof Error ? error.name : "unknown");
    }

    let purgedLeads: number | null = null;
    try {
      purgedLeads = await purgeExpiredLeads(pool, now);
    } catch (error) {
      failures.push("leads");
      console.error("lead purge failed", error instanceof Error ? error.name : "unknown");
    }

    let expiredVerifications: number | null = null;
    let purgedDataRequests: number | null = null;
    try {
      const residue = await purgeDataRequestResidue(pool, now);
      expiredVerifications = residue.expired;
      purgedDataRequests = residue.deleted;
    } catch (error) {
      failures.push("verifications");
      console.error("verification residue purge failed", error instanceof Error ? error.name : "unknown");
    }

    let purgedOutbox: number | null = null;
    try {
      purgedOutbox = await purgeExpiredOutbox(pool, now);
    } catch (error) {
      failures.push("outbox");
      console.error("outbox purge failed", error instanceof Error ? error.name : "unknown");
    }

    if (failures.length > 0) {
      // 503 so a monitor sees it, with the counts that DID run — a retention
      // job that half-worked must not report success.
      return NextResponse.json({ purged, purgedLeads, purgedOutbox, expiredVerifications, purgedDataRequests, failed: failures }, { status: 503 });
    }
    return NextResponse.json({ purged, purgedLeads, purgedOutbox, expiredVerifications, purgedDataRequests }, { status: 200 });
  } catch (error) {
    console.error("purge failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ purged: null, reason: "purge_failed" }, { status: 503 });
  }
}
