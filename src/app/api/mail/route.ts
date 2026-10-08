import { NextResponse } from "next/server";
import { getPool, isDatabaseConfigured } from "@/server/db";
import { authorisedByCronSecret } from "@/server/cron-auth";
import { drainOutbox, mailTransport } from "@/server/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drains `event_outbox`.
 *
 * The counterpart to /api/purge, and written for the same failure: a queue
 * that nothing consumes is indistinguishable from one that works, right up
 * until somebody asks why no receipt arrived. `createLead()` has been
 * writing outbox rows since it shipped; until this route existed, nothing
 * read them.
 *
 * Returns the counts rather than logging them. `skipped` and `blocked` are
 * the ones worth watching: a run reporting skipped > 0 forever means the
 * mail credentials were never configured, and a queue quietly filling up
 * looks identical to a healthy one from the outside.
 */
export async function GET(request: Request): Promise<Response> {
  if (!authorisedByCronSecret(request)) {
    return NextResponse.json({ drained: null, reason: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured("mail")) {
    return NextResponse.json({ drained: null, reason: "storage_unavailable" }, { status: 503 });
  }

  try {
    const result = await drainOutbox(getPool("mail"), mailTransport());
    if (result.aborted || (result.dead ?? 0) > 0) {
      /* A non-zero `dead` count means rows exhausted every retry: people who
         will never receive a receipt, and nothing will ever try again. That
         is the precise failure this feature exists to avoid, so it is worth
         a status a monitor notices, not a line in a 200 body.

         It stays red until those rows purge, up to thirty days. Accepted
         deliberately: reaching it takes five provider refusals of the same
         message, and the remedy is to look at why, not to wait it out. */
      // 503 so a monitor sees it, WITH the counts that did happen. The
      // sibling purge route makes the same argument: a job that half-worked
      // must not report success — and must not report zero either, which is
      // what discarding the counts on the way out would do.
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Name only: a driver error can quote the row it was working on, and
    // that row points at a person.
    console.error("outbox drain failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ drained: null, reason: "drain_failed" }, { status: 503 });
  }
}
