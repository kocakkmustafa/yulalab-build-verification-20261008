import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { assertMailAdmission, lockMailAdmission, MailAdmissionCapacityError } from "@/server/mail-admission";
import {
  deriveDataRequestToken,
  dataRequestTokenKeyring,
  hashDataRequestToken,
  isDataRequestToken,
} from "@/server/data-request-token";

/**
 * Access, correction and deletion requests.
 *
 * The whole design turns on one point: acting on an unverified "delete my
 * data" is itself a way to delete somebody else's. A submission may only
 * create a `pending` row; the token that proves ownership of the address is
 * a capability, so it is hashed at rest, time-limited, and spent on use.
 */

export type DataRequestType = "access" | "delete" | "correct";

export type DataRequestInput = {
  email: string;
  requestType: DataRequestType;
  locale?: "tr" | "en";
};

/** How long a verification link stays usable. */
export const VERIFICATION_WINDOW_HOURS = 24;
export const VERIFICATION_QUEUE_RETENTION_DAYS = 30;
export const DATA_REQUEST_RETENTION_DAYS = 30;
/** One address/request-type pair can enqueue one message in this window. */
export const DATA_REQUEST_RECIPIENT_COOLDOWN_HOURS = 24;
/** A deployment-wide rolling window, enforced under one transaction lock. */
export const DATA_REQUEST_GLOBAL_WINDOW_MINUTES = 60;
export const DATA_REQUEST_GLOBAL_WINDOW_LIMIT = 100;

export class DataRequestCapacityError extends Error {
  constructor() {
    super("data request durable capacity exhausted");
    this.name = "DataRequestCapacityError";
  }
}

export function normalizeDataRequestEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * sha256 hex. Not a password hash — the token is 32 random bytes, so there
 * is no dictionary to stretch against; the point is only that a database
 * read cannot be turned into the ability to verify someone else's request.
 */
export function hashToken(token: string): string {
  return hashDataRequestToken(token);
}

type Queryable = Pick<PoolClient, "query">;
export type Connectable = { connect: () => Promise<PoolClient> };

export type CreateResult = {
  /** Returned once, to be mailed. Never stored, never logged. */
  token: string;
};

export async function createDataRequest(
  pool: Connectable,
  input: DataRequestInput,
  { now }: { now: Date },
): Promise<CreateResult> {
  const normalizedEmail = normalizeDataRequestEmail(input.email);
  const requestId = randomUUID();
  const keyring = dataRequestTokenKeyring();
  const key = keyring.current;
  const token = deriveDataRequestToken(requestId, key.secret);
  const queueExpiresAt = new Date(
    now.getTime() + VERIFICATION_QUEUE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const purgeAt = new Date(
    now.getTime() + DATA_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const db = await pool.connect();
  let poisoned = false;
  try {
    await db.query("BEGIN");

    // These locks are transaction-scoped and live in PostgreSQL, so separate
    // pools, processes and serverless instances share one decision. Always
    // take global before recipient: a stable order prevents cross-recipient
    // deadlocks while the global counter is checked.
    await lockMailAdmission(db);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `yulalab:data-request:recipient:${normalizedEmail}:${input.requestType}`,
    ]);

    const existing = await db.query<{
      id: string;
      verification_token_key_id: string | null;
    }>(
      `SELECT id, verification_token_key_id
         FROM data_requests
        WHERE lower(btrim(email)) = $1
          AND request_type = $2
          AND created_at >= $3::timestamptz - interval '1 hour' * $4
        ORDER BY created_at DESC
        LIMIT 1`,
      [normalizedEmail, input.requestType, now, DATA_REQUEST_RECIPIENT_COOLDOWN_HOURS],
    );
    if (existing.rows[0]) {
      // The HTTP route never exposes this token. Returning the deterministic
      // capability keeps the internal function contract stable for callers
      // while the durable effect remains exactly-once.
      const existingKey = existing.rows[0].verification_token_key_id
        ? keyring.byId.get(existing.rows[0].verification_token_key_id)
        : undefined;
      const duplicateToken = deriveDataRequestToken(
        existing.rows[0].id,
        existingKey?.secret ?? key.secret,
      );
      await db.query("COMMIT");
      return { token: duplicateToken };
    }

    await assertMailAdmission(db, "data_request", now);
    const capacity = await db.query<{ accepted: number }>(
      `SELECT count(*)::int AS accepted
         FROM data_requests
        WHERE created_at >= $1::timestamptz - interval '1 minute' * $2`,
      [now, DATA_REQUEST_GLOBAL_WINDOW_MINUTES],
    );
    if ((capacity.rows[0]?.accepted ?? 0) >= DATA_REQUEST_GLOBAL_WINDOW_LIMIT) {
      throw new DataRequestCapacityError();
    }

    const inserted = await db.query(
      `INSERT INTO data_requests (
         id, email, request_type, verification_state, verification_token_hash,
         verification_token_key_id, verification_queue_expires_at, purge_at, created_at
       )
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        requestId,
        normalizedEmail,
        input.requestType,
        hashToken(token),
        key.id,
        queueExpiresAt,
        purgeAt,
        now,
      ],
    );

    // The payload carries the request id, NOT the token. An outbox row with
    // the secret in it would be a second copy under a different retention
    // with nobody watching — the same reasoning that keeps the lead message
    // body out of the queue.
    await db.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, created_at)
       VALUES ('data_request_verification', $1, $2, $3)`,
      [
        inserted.rows[0].id,
        JSON.stringify({ locale: input.locale ?? "tr", tokenKeyId: key.id }),
        now,
      ],
    );
    await db.query("COMMIT");
    return { token };
  } catch (error) {
    let rollbackFailed = false;
    await db.query("ROLLBACK").catch(() => {
      rollbackFailed = true;
    });
    poisoned = rollbackFailed;
    if (rollbackFailed) {
      const transactionError = new Error("data request transaction rollback failed");
      transactionError.name = "DataRequestTransactionError";
      throw transactionError;
    }
    if (error instanceof MailAdmissionCapacityError) throw new DataRequestCapacityError();
    throw error;
  } finally {
    db.release(poisoned ? true : undefined);
  }
}

export type VerifyResult = { verified: boolean };

/**
 * Verifies a token.
 *
 * Returns the SAME shape for an unknown token, a malformed one and an
 * expired one. Distinguishing them would turn this into an oracle for which
 * addresses have requests outstanding — which is precisely the information a
 * data-request endpoint must not hand out.
 */
export async function verifyDataRequest(
  db: Queryable,
  token: string,
  { now }: { now: Date },
): Promise<VerifyResult> {
  if (!isDataRequestToken(token)) return { verified: false };

  const hash = hashToken(token);
  const spent = await db.query(
    `UPDATE data_requests
        SET verification_state = 'verified', verification_token_hash = NULL
      WHERE verification_token_hash = $1
        AND verification_state = 'pending'
        AND verification_sent_at IS NOT NULL
        AND verification_expires_at > $2
      RETURNING id`,
    [hash, now],
  );
  return { verified: spent.rowCount === 1 };
}

/**
 * Marks pending requests whose window has closed as expired and clears their
 * tokens. Once retention has also elapsed, an outbox-free request is removed
 * in the same statement so verified, expired, and never-sent rows cannot leave
 * residual PII after the outbox purge. Returns the total affected count, so a
 * scheduled run is observable rather than assumed — the failure /api/purge
 * exists to prevent.
 */
export async function purgeExpiredVerifications(db: Queryable, now: Date): Promise<number> {
  try {
    const result = await db.query<{ affected: number }>(
      `WITH expired AS (
         UPDATE data_requests
            SET verification_state = 'expired', verification_token_hash = NULL
          WHERE verification_state = 'pending'
            AND (purge_at IS NULL OR purge_at > $1)
            AND (
              (verification_sent_at IS NOT NULL AND verification_expires_at <= $1)
              OR (verification_sent_at IS NULL AND verification_queue_expires_at <= $1)
            )
          RETURNING id
       ), deleted AS (
         DELETE FROM data_requests AS request
          WHERE request.purge_at <= $1
            AND NOT EXISTS (
              SELECT 1 FROM event_outbox AS outbox
               WHERE outbox.event_type = 'data_request_verification'
                 AND outbox.aggregate_id = request.id
            )
          RETURNING id
       )
       SELECT (
         (SELECT count(*) FROM expired) + (SELECT count(*) FROM deleted)
       )::int AS affected`,
      [now],
    );
    return result.rows[0]?.affected ?? 0;
  } catch (error) {
    // During the fail-closed 0003 -> 0004 rollout the purge cron may run
    // before the additive queue columns exist. Keep the already-accepted
    // 0003 expiry path functional; intake remains unavailable because its
    // INSERT requires the 0004 columns. Any error except undefined_column is
    // a real DB failure and must still abort the purge route.
    if (!(error && typeof error === "object" && "code" in error && error.code === "42703")) {
      throw error;
    }
    const legacy = await db.query(
      `UPDATE data_requests
          SET verification_state = 'expired', verification_token_hash = NULL
        WHERE verification_state = 'pending'
          AND verification_expires_at <= $1`,
      [now],
    );
    return legacy.rowCount ?? 0;
  }
}

export type DataRequestPurgeResult = { expired: number; deleted: number };

export async function purgeDataRequestResidue(
  pool: Connectable,
  now: Date,
): Promise<DataRequestPurgeResult> {
  const db = await pool.connect();
  let poisoned = false;
  try {
    await db.query("BEGIN");
    const locked = await db.query<{ request_id: string; outbox_id: string }>(
      `SELECT request.id AS request_id, outbox.id AS outbox_id
         FROM event_outbox AS outbox
         JOIN data_requests AS request ON request.id = outbox.aggregate_id
        WHERE outbox.event_type = 'data_request_verification'
          AND (
            request.purge_at <= $1
            OR (request.verification_state = 'pending' AND request.verification_sent_at IS NULL
                AND request.verification_queue_expires_at <= $1)
            OR (request.verification_state = 'pending' AND request.verification_sent_at IS NOT NULL
                AND request.verification_expires_at <= $1)
          )
        FOR UPDATE OF outbox SKIP LOCKED`,
      [now],
    );
    const requestIds = locked.rows.map((row) => row.request_id);
    const outboxIds = locked.rows.map((row) => row.outbox_id);

    let expired = 0;
    let deleted = 0;
    if (requestIds.length > 0) {
      const expiredRows = await db.query(
        `UPDATE data_requests
            SET verification_state = 'expired', verification_token_hash = NULL
          WHERE id = ANY($1::uuid[])
            AND verification_state = 'pending'
          RETURNING id`,
        [requestIds],
      );
      expired += expiredRows.rowCount ?? 0;
      const deletable = await db.query<{ id: string }>(
        "SELECT id FROM data_requests WHERE id = ANY($1::uuid[]) AND purge_at <= $2 FOR UPDATE",
        [requestIds, now],
      );
      const deletableIds = deletable.rows.map((row) => row.id);
      if (deletableIds.length > 0) {
        await db.query("DELETE FROM event_outbox WHERE id = ANY($1::uuid[])", [outboxIds]);
        const removed = await db.query(
          "DELETE FROM data_requests WHERE id = ANY($1::uuid[]) RETURNING id",
          [deletableIds],
        );
        deleted += removed.rowCount ?? 0;
      }
    }

    const orphaned = await db.query<{ id: string }>(
      `SELECT request.id
         FROM data_requests AS request
        WHERE request.purge_at <= $1
          AND NOT EXISTS (
            SELECT 1 FROM event_outbox AS outbox
             WHERE outbox.event_type = 'data_request_verification'
               AND outbox.aggregate_id = request.id
          )
        FOR UPDATE SKIP LOCKED`,
      [now],
    );
    if (orphaned.rows.length > 0) {
      const removed = await db.query(
        "DELETE FROM data_requests WHERE id = ANY($1::uuid[]) RETURNING id",
        [orphaned.rows.map((row) => row.id)],
      );
      deleted += removed.rowCount ?? 0;
    }
    await db.query("COMMIT");
    return { expired, deleted };
  } catch (error) {
    let rollbackFailed = false;
    await db.query("ROLLBACK").catch(() => { rollbackFailed = true; });
    poisoned = rollbackFailed;
    throw error;
  } finally {
    db.release(poisoned ? true : undefined);
  }
}
