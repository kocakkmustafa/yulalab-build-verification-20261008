import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { testDatabaseUrl } from "./helpers/attribution-db";
import {
  createDataRequest,
  hashToken,
  purgeDataRequestResidue,
} from "@/server/data-requests";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
  deriveDataRequestToken,
} from "@/server/data-request-token";
import { drainOutbox, MAX_ATTEMPTS, type MailMessage, type MailTransport } from "@/server/mail";

const SCHEMA = "t_data_request_delivery";
const CURRENT_KEY_ID = "2026-08-current";
const CURRENT_SECRET = "test-only-current-secret-with-at-least-32-bytes";
const PREVIOUS_KEY_ID = "2026-07-previous";
const PREVIOUS_SECRET = "test-only-previous-secret-with-at-least-32-bytes";
const INTAKE_ROLE = "t_dsr_delivery_intake";
const MAIL_ROLE = "t_dsr_delivery_mail";
const PURGE_ROLE = "t_dsr_delivery_purge";
// Stay inside the real 30-day queue window while leaving room for DB clock skew.
const NOW = new Date(Date.now() - 60_000);
let pool: Pool;

function configuredTransport(sent: MailMessage[]): MailTransport {
  return {
    configured: true,
    async send(message) {
      sent.push(message);
    },
  };
}

beforeAll(async () => {
  pool = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 6 });
  const migrations = [1, 2, 3].map((number) => readFileSync(
    path.resolve(import.meta.dirname, `../db/migrations/000${number}_${[
      "attribution", "leads_consents_outbox", "data_request_verification"
    ][number - 1]}.sql`), "utf8",
  )).join("\n");
  const migration4 = readFileSync(
    path.resolve(import.meta.dirname, "../db/migrations/0004_access_boundary.sql"),
    "utf8",
  );
  await pool.query(`BEGIN;
    DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
    CREATE SCHEMA ${SCHEMA};
    SET LOCAL search_path = ${SCHEMA};
    ${migrations}
    DROP ROLE IF EXISTS ${INTAKE_ROLE};
    DROP ROLE IF EXISTS ${MAIL_ROLE};
    DROP ROLE IF EXISTS ${PURGE_ROLE};
    CREATE ROLE ${INTAKE_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ${MAIL_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    CREATE ROLE ${PURGE_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    SELECT set_config('yulalab.runtime_role', '${INTAKE_ROLE}', false);
    SELECT set_config('yulalab.target_schema', '${SCHEMA}', false);
    SELECT set_config('yulalab.intake_role', '${INTAKE_ROLE}', false);
    SELECT set_config('yulalab.mail_role', '${MAIL_ROLE}', false);
    SELECT set_config('yulalab.purge_role', '${PURGE_ROLE}', false);
    ${migration4}
    COMMIT;
  `);
});

afterAll(async () => {
  await pool.query(`BEGIN;
    DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
    DROP ROLE IF EXISTS ${INTAKE_ROLE}, ${MAIL_ROLE}, ${PURGE_ROLE};
    COMMIT;`);
  await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE data_requests, event_outbox CASCADE");
  process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = CURRENT_KEY_ID;
  process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = CURRENT_SECRET;
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV];
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV];
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR =
    "d-934e79bac8f841dfb7066e169d8f4ffc";
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN =
    "d-e9aeeaa9dc8949679777b61eed0f41dc";
  vi.restoreAllMocks();
});

describe("durable verification delivery", () => {
  it("durable abuse boundary: concurrent same-type intake yields one outbox row and at most one mail", async () => {
    const other = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 2 });
    try {
      await Promise.all([
        createDataRequest(
          pool,
          { email: "Mail.Target@Example.com", requestType: "access", locale: "tr" },
          { now: NOW },
        ),
        createDataRequest(
          other,
          { email: " mail.target@example.COM ", requestType: "access", locale: "en" },
          { now: NOW },
        ),
      ]);
    } finally {
      await other.end();
    }

    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(1);
    const sent: MailMessage[] = [];
    expect(await drainOutbox(pool, configuredTransport(sent))).toMatchObject({ delivered: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("mail.target@example.com");
  });

  it("delivers separate verification work for separate rights at the same address", async () => {
    await createDataRequest(
      pool,
      { email: "rights@example.com", requestType: "access", locale: "tr" },
      { now: NOW },
    );
    await createDataRequest(
      pool,
      { email: "RIGHTS@example.com", requestType: "correct", locale: "en" },
      { now: NOW },
    );

    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(2);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(2);
    const sent: MailMessage[] = [];
    expect(await drainOutbox(pool, configuredTransport(sent))).toMatchObject({ delivered: 2 });
    expect(sent).toHaveLength(2);
  });

  it("re-derives the capability from the aggregate pointer without persisting plaintext", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "ada@example.com", requestType: "delete", locale: "en" },
      { now: NOW },
    );
    const request = await pool.query(
      "SELECT id, verification_token_hash FROM data_requests",
    );
    const outbox = await pool.query("SELECT aggregate_id, payload_json FROM event_outbox");

    expect(token).toBe(deriveDataRequestToken(request.rows[0].id, CURRENT_SECRET));
    expect(request.rows[0].verification_token_hash).toBe(hashToken(token));
    expect(JSON.stringify(request.rows[0])).not.toContain(token);
    expect(JSON.stringify(outbox.rows[0])).not.toContain(token);
    expect(outbox.rows[0].aggregate_id).toBe(request.rows[0].id);

    const sent: MailMessage[] = [];
    const result = await drainOutbox(pool, configuredTransport(sent));
    expect(result).toMatchObject({ delivered: 1, failed: 0, blocked: 0, remaining: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ada@example.com");
    expect(sent[0].locale).toBe("en");
    expect(sent[0].data.verificationUrl).toBe(
      `https://yulalab.com/en/data-request/verify#token=${token}`,
    );
  });

  it("starts a full 24-hour window only when a five-day-old queue row is prepared", async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await createDataRequest(
      pool,
      { email: "ada@example.com", requestType: "access", locale: "tr" },
      { now: fiveDaysAgo },
    );
    const queued = await pool.query(
      "SELECT verification_sent_at, verification_expires_at FROM data_requests",
    );
    expect(queued.rows[0]).toEqual({ verification_sent_at: null, verification_expires_at: null });
    await pool.query("UPDATE data_requests SET purge_at = now() + interval '5 minutes'");
    await pool.query("UPDATE event_outbox SET purge_at = now() + interval '5 minutes'");

    await drainOutbox(pool, configuredTransport([]));
    const { rows } = await pool.query(
      `SELECT verification_sent_at IS NOT NULL AS sent,
              EXTRACT(EPOCH FROM (verification_expires_at - verification_sent_at))::int AS seconds,
              EXTRACT(EPOCH FROM (request.purge_at - verification_sent_at))::int AS request_purge_seconds,
              EXTRACT(EPOCH FROM (outbox.purge_at - outbox.delivered_at))::int AS outbox_purge_seconds
         FROM data_requests request
         JOIN event_outbox outbox ON outbox.aggregate_id = request.id`,
    );
    expect(rows[0]).toEqual({
      sent: true,
      seconds: 24 * 60 * 60,
      request_purge_seconds: 24 * 60 * 60,
      outbox_purge_seconds: 24 * 60 * 60,
    });
  });

  it("does not burn the window on provider failure and starts a full window on retry", async () => {
    await createDataRequest(
      pool,
      { email: "retry-window@example.com", requestType: "access", locale: "en" },
      { now: NOW },
    );
    const failing: MailTransport = {
      configured: true,
      async send() {
        throw new Error("provider non-2xx");
      },
    };

    expect(await drainOutbox(pool, failing)).toMatchObject({ failed: 1, delivered: 0 });
    const afterFailure = await pool.query(
      "SELECT verification_sent_at, verification_expires_at FROM data_requests",
    );
    expect(afterFailure.rows[0]).toEqual({
      verification_sent_at: null,
      verification_expires_at: null,
    });

    const sent: MailMessage[] = [];
    expect(await drainOutbox(pool, configuredTransport(sent))).toMatchObject({
      failed: 0,
      delivered: 1,
    });
    const afterRetry = await pool.query(
      `SELECT verification_sent_at IS NOT NULL AS sent,
              EXTRACT(EPOCH FROM (verification_expires_at - verification_sent_at))::int AS seconds
         FROM data_requests`,
    );
    expect(afterRetry.rows[0]).toEqual({ sent: true, seconds: 24 * 60 * 60 });
    expect(sent).toHaveLength(1);
  });

  it("delivers with the previous key after rotation and rejects an unknown retired key", async () => {
    const first = await createDataRequest(
      pool,
      { email: "rotation@example.com", requestType: "access", locale: "en" },
      { now: NOW },
    );
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV] = CURRENT_KEY_ID;
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV] = CURRENT_SECRET;
    process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = PREVIOUS_KEY_ID;
    process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = PREVIOUS_SECRET;

    const sent: MailMessage[] = [];
    expect(await drainOutbox(pool, configuredTransport(sent))).toMatchObject({ delivered: 1 });
    expect(sent[0].data.verificationUrl).toContain(first.token);

    await createDataRequest(
      pool,
      { email: "retired@example.com", requestType: "delete", locale: "tr" },
      { now: NOW },
    );
    await pool.query(
      "UPDATE data_requests SET verification_token_key_id = 'retired-unknown' WHERE email = $1",
      ["retired@example.com"],
    );
    const blocked = await drainOutbox(pool, configuredTransport([]));
    expect(blocked).toMatchObject({ delivered: 0, blocked: 1 });
    const row = await pool.query(
      `SELECT attempts, delivered_at FROM event_outbox
        WHERE aggregate_id = (SELECT id FROM data_requests WHERE email = $1)`,
      ["retired@example.com"],
    );
    expect(row.rows[0]).toEqual({ attempts: 0, delivered_at: null });
  });

  it("blocks without the token secret and spends no retry", async () => {
    await createDataRequest(
      pool,
      { email: "ada@example.com", requestType: "correct", locale: "tr" },
      { now: NOW },
    );
    delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV];

    const result = await drainOutbox(pool, configuredTransport([]));
    expect(result).toMatchObject({ delivered: 0, failed: 0, blocked: 1 });
    expect(result.missingConfig).toContain(DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV);
    const { rows } = await pool.query("SELECT attempts, delivered_at FROM event_outbox");
    expect(rows[0]).toMatchObject({ attempts: 0, delivered_at: null });
  });

  it("never writes a capability, address, or provider payload to an error log", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "private@example.com", requestType: "delete", locale: "tr" },
      { now: NOW },
    );
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
      errors.push(parts.map(String).join(" "));
    });
    const failing: MailTransport = {
      configured: true,
      async send() {
        throw new Error(`provider echoed private@example.com ${token}`);
      },
    };

    const result = await drainOutbox(pool, failing);
    expect(result.failed).toBe(1);
    expect(errors.join(" ")).not.toContain("private@example.com");
    expect(errors.join(" ")).not.toContain(token);
  });

  it("retries provider failures and exposes the permanently dead row", async () => {
    await createDataRequest(
      pool,
      { email: "retry@example.com", requestType: "access", locale: "tr" },
      { now: NOW },
    );
    const failing: MailTransport = {
      configured: true,
      async send() {
        throw new Error("provider non-2xx");
      },
    };
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const result = await drainOutbox(pool, failing);
      expect(result.failed).toBe(1);
    }
    const final = await drainOutbox(pool, configuredTransport([]));
    expect(final).toMatchObject({ delivered: 0, remaining: 0, dead: 1 });
    const { rows } = await pool.query("SELECT attempts, delivered_at FROM event_outbox");
    expect(rows[0]).toMatchObject({ attempts: MAX_ATTEMPTS, delivered_at: null });
  });

  it("drops the pointer when its data-request address has been erased", async () => {
    await createDataRequest(
      pool,
      { email: "erased@example.com", requestType: "delete", locale: "tr" },
      { now: NOW },
    );
    await pool.query("DELETE FROM data_requests");
    const result = await drainOutbox(pool, configuredTransport([]));
    expect(result).toMatchObject({ delivered: 0, dropped: 1, remaining: 0 });
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });

  it("does not let a purge race delete a request whose provider call holds the outbox lock", async () => {
    const queueDeadline = new Date(Date.now() + 60_000);
    const purgeAt = new Date(queueDeadline.getTime() + 60_000);
    await createDataRequest(
      pool,
      { email: "race@example.com", requestType: "delete", locale: "tr" },
      { now: NOW },
    );
    await pool.query(
      "UPDATE data_requests SET verification_queue_expires_at = $1, purge_at = $1",
      [queueDeadline],
    );

    let release!: () => void;
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    const providerRelease = new Promise<void>((resolve) => { release = resolve; });
    const slowTransport: MailTransport = {
      configured: true,
      async send() {
        started();
        await providerRelease;
      },
    };

    const drain = drainOutbox(pool, slowTransport);
    await providerStarted;
    const purged = await purgeDataRequestResidue(
      pool,
      purgeAt,
    );
    expect(purged).toEqual({ expired: 0, deleted: 0 });
    release();
    await drain;
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(1);
  });
});
