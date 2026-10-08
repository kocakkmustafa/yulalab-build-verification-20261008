import { timingSafeEqual } from "node:crypto";

/**
 * Bearer check for the scheduled endpoints, shared by /api/purge and
 * /api/mail.
 *
 * One copy rather than one per route. Both routes delete or send on behalf
 * of people, and a duplicated auth check is the kind that drifts: a later
 * hardening lands on the file someone happened to open.
 *
 * Returns false when CRON_SECRET is unset, so a deployment that forgot to
 * configure it refuses callers rather than running these jobs open to the
 * internet. Callers give the same answer for "unset" and "wrong" so an
 * anonymous caller cannot learn which it is.
 */
export function authorisedByCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const presented = request.headers.get("authorization") ?? "";
  // Length differences still leak through the early return, which is
  // unavoidable without padding and irrelevant against a random 32-byte
  // token; the byte comparison itself is constant-time.
  const a = Buffer.from(presented);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
