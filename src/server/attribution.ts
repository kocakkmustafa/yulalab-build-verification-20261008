import type { Pool } from "pg";
import type { EventPayload } from "@/lib/analytics/events";
import { rotatingSessionHash, purgeAtFor } from "@/lib/analytics/session-hash";

export type RecordOptions = {
  /** Injected so tests can pin a day boundary instead of racing midnight. */
  now: Date;
  secret: string;
};

/**
 * Writes one validated event.
 *
 * The payload is already validated by parseEventPayload() before it gets
 * here, and the schema validates it again. That duplication is deliberate:
 * the application check gives the caller a useful 400, the database check
 * makes the rule true for every writer, including ones that do not exist
 * yet.
 *
 * Note what is NOT written: no IP address, no user agent, no raw session
 * token. The roadmap forbids retaining the first two, and the third only
 * ever exists in memory long enough to be hashed.
 */
export async function recordAttribution(
  pool: Pool,
  payload: EventPayload,
  { now, secret }: RecordOptions,
): Promise<void> {
  const sessionHash = rotatingSessionHash(payload.session, now, secret);

  await pool.query(
    `INSERT INTO attributions (
       event_version, session_id_hash, event_name, product_slug, locale,
       source, medium, campaign, content,
       page_path, target_url, target_category,
       created_at, purge_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      payload.v,
      sessionHash,
      payload.event,
      payload.product ?? null,
      payload.locale,
      payload.source ?? null,
      payload.medium ?? null,
      payload.campaign ?? null,
      payload.content ?? null,
      payload.page,
      payload.target ?? null,
      payload.targetCategory ?? null,
      now,
      purgeAtFor(now),
    ],
  );
}

/**
 * Deletes raw rows past their 30-day retention. Returns the number removed
 * so a scheduled run can be observed rather than assumed — a purge job that
 * silently does nothing looks identical to one that works.
 */
export async function purgeExpiredAttributions(pool: Pool, now: Date): Promise<number> {
  const result = await pool.query("DELETE FROM attributions WHERE purge_at <= $1", [now]);
  return result.rowCount ?? 0;
}
