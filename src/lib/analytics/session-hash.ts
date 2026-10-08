import { createHmac } from "node:crypto";

/**
 * Raw attribution rows live 30 days (roadmap §7.2/§7.3); anything longer is
 * aggregated and non-identifying.
 */
export const RAW_RETENTION_DAYS = 30;

export function purgeAtFor(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Turns a client-generated session token into the pseudonym we actually
 * store.
 *
 * Two properties do the privacy work:
 *
 * 1. **It rotates daily.** The UTC date is mixed into the key, so the same
 *    visitor returning tomorrow is a different pseudonym. Within a day the
 *    hash is stable, which is all a funnel needs ("did this session that
 *    viewed the product also click through?"). Across days it is useless
 *    for building a profile — deliberately.
 *
 * 2. **It is keyed, not just hashed.** A bare sha256 of a 32-hex token is
 *    reversible by anyone who can enumerate tokens. HMAC with a server-only
 *    secret means the stored value cannot be linked back to a token that
 *    someone captured client-side.
 *
 * Missing secret THROWS. The tempting alternative — fall back to a constant
 * — would silently produce a stable, permanently joinable identifier, i.e.
 * exactly the tracking this design exists to avoid, and it would happen on
 * the day someone forgot an environment variable. Failing closed here is
 * why the API route reports storage as unavailable rather than writing a
 * weaker pseudonym.
 */
export function rotatingSessionHash(sessionToken: string, now: Date, secret: string): string {
  if (!secret) {
    throw new Error("ATTRIBUTION_SECRET is required; refusing to hash with a constant fallback");
  }
  const day = now.toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const dailyKey = createHmac("sha256", secret).update(`salt:${day}`).digest();
  return createHmac("sha256", dailyKey).update(sessionToken).digest("hex");
}
