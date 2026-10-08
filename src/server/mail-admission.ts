import type { PoolClient } from "pg";

// The declared scheduler runs once a day. Count mail jobs, not requests:
// each lead creates two; a data request creates one.
export const MAIL_RUN_LIMIT = 100;
export const LEAD_MAIL_LIMIT = 40;
export const MAIL_ADMISSION_WINDOW_HOURS = 24;

export class MailAdmissionCapacityError extends Error {
  constructor() {
    super("mail admission capacity exhausted");
    this.name = "MailAdmissionCapacityError";
  }
}

type Queryable = Pick<PoolClient, "query">;

/** Acquire inside BEGIN, before duplicates or budgets, and hold to COMMIT. */
export async function lockMailAdmission(db: Queryable): Promise<void> {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    "yulalab:mail-admission:global",
  ]);
}

/** The caller holds the shared transaction lock and has ruled out a retry. */
export async function assertMailAdmission(
  db: Queryable,
  kind: "lead" | "data_request",
  now: Date,
): Promise<void> {
  const { rows } = await db.query<{
    lead_jobs: number;
    request_jobs: number;
    pending: number;
    pending_lead: number;
  }>(
    `SELECT
       (SELECT count(*) * 2 FROM leads
         WHERE created_at > $1::timestamptz - interval '1 hour' * $2)::int AS lead_jobs,
       (SELECT count(*) FROM data_requests
         WHERE created_at > $1::timestamptz - interval '1 hour' * $2)::int AS request_jobs,
       count(*)::int AS pending,
       count(*) FILTER (WHERE event_type IN ('lead_receipt', 'lead_internal_route'))::int AS pending_lead
     FROM event_outbox WHERE delivered_at IS NULL`,
    [now, MAIL_ADMISSION_WINDOW_HOURS],
  );
  const usage = rows[0];
  const cost = kind === "lead" ? 2 : 1;
  // Source rows survive delivery, verification and orphan-queue cleanup.
  // Normal retention exceeds 24h, so those operations cannot refund today's
  // admissions. Trusted manual early erasure is not a public application path.
  if (
    !usage ||
    usage.lead_jobs + usage.request_jobs + cost > MAIL_RUN_LIMIT ||
    usage.pending + cost > MAIL_RUN_LIMIT ||
    (kind === "lead" && (
      usage.lead_jobs + cost > LEAD_MAIL_LIMIT ||
      usage.pending_lead + cost > LEAD_MAIL_LIMIT
    ))
  ) {
    throw new MailAdmissionCapacityError();
  }
}
