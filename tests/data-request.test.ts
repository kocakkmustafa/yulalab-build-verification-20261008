import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { testDatabaseUrl } from "./helpers/attribution-db";
import { createLead, type LeadInput } from "@/server/leads";
import { MailAdmissionCapacityError } from "@/server/mail-admission";
import {
  createDataRequest,
  verifyDataRequest,
  hashToken,
  purgeExpiredVerifications,
} from "@/server/data-requests";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
  dataRequestTokenKeyring,
  deriveDataRequestToken,
} from "@/server/data-request-token";

/**
 * A data request is a capability question, not a form question.
 *
 * Acting on an unverified "delete my data" is itself a way to delete
 * somebody else's, so a submission may only ever create a `pending` row, and
 * the token that proves ownership is treated as a secret: hashed at rest,
 * time-limited, and spent on use.
 */
const SCHEMA = "t_data_requests";
const CURRENT_KEY_ID = "2026-08-current";
const CURRENT_SECRET = "test-only-current-data-request-secret-32-bytes";
const PREVIOUS_KEY_ID = "2026-07-previous";
const PREVIOUS_SECRET = "test-only-previous-data-request-secret-32-bytes";
const INTAKE_ROLE = "t_data_requests_intake";
const MAIL_ROLE = "t_data_requests_mail";
const PURGE_ROLE = "t_data_requests_purge";
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 6 });
  const migrations = [
    "../db/migrations/0001_attribution.sql",
    "../db/migrations/0002_leads_consents_outbox.sql",
    "../db/migrations/0003_data_request_verification.sql",
  ].map((file) => readFileSync(path.resolve(import.meta.dirname, file), "utf8")).join("\n");
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
  await pool.query("TRUNCATE leads, lead_consents, data_requests, event_outbox CASCADE");
  process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = CURRENT_KEY_ID;
  process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = CURRENT_SECRET;
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV];
  delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV];
});

const NOW = new Date("2026-08-19T10:00:00Z");

describe("shared durable mail admission", () => {
  const lead = (id: number): LeadInput => ({
    name: "Admission test", email: `lead-${id}@example.com`, message: "Please contact me.",
    intent: "partnership", locale: "en",
  });
  const request = (id: number) => ({ email: `request-${id}@example.com`, requestType: "access" as const });
  const later = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
  async function fillRequests(count: number) {
    for (let i = 0; i < count; i += 1) await createDataRequest(pool, request(i), { now: NOW });
  }
  async function fillLeads() {
    for (let i = 0; i < 20; i += 1) await createLead(pool, lead(i), { now: NOW });
  }
  function intakePool() {
    const url = new URL(testDatabaseUrl(SCHEMA));
    url.username = INTAKE_ROLE;
    return new Pool({ connectionString: url.href, max: 3 });
  }

  it("bounds varying-content recipient floods across real restricted-role pools", async () => {
    const first = intakePool();
    const second = intakePool();
    try {
      expect((await first.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")).rows)
        .toEqual([{ rolsuper: false, rolbypassrls: false }]);
      const outcomes = await Promise.allSettled(Array.from({ length: 28 }, (_, i) =>
        createLead(i % 2 ? first : second, {
          ...lead(0), email: i % 2 ? " LEAD-0@Example.COM " : "lead-0@example.com",
          message: `Different message ${i}`, intent: i % 2 ? "press" : "partnership",
          locale: i % 2 ? "tr" : "en",
        }, { now: NOW }),
      ));
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(20);
      expect(outcomes.filter((o) => o.status === "rejected" && o.reason instanceof MailAdmissionCapacityError)).toHaveLength(8);
      expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(20);
      expect((await pool.query("SELECT 1 FROM lead_consents")).rowCount).toBe(20);
      expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(40);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  });

  it("preserves an exact retry at capacity and keeps 60 places available for data requests", async () => {
    const original = await createLead(pool, lead(0), { now: NOW });
    for (let i = 1; i < 20; i += 1) await createLead(pool, lead(i), { now: NOW });
    await expect(createLead(pool, lead(20), { now: NOW })).rejects.toBeInstanceOf(MailAdmissionCapacityError);
    expect(await createLead(pool, lead(0), { now: NOW })).toEqual(original);
    await fillRequests(60);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(100);
    await expect(createDataRequest(pool, request(60), { now: NOW })).rejects.toMatchObject({ name: "DataRequestCapacityError" });
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(20);
  });

  it("does not let two-job leads consume the final single slot under a restricted-role race", async () => {
    await fillRequests(99);
    const first = intakePool();
    const second = intakePool();
    try {
      const outcomes = await Promise.allSettled([
        createLead(first, lead(0), { now: NOW }),
        createDataRequest(second, request(99), { now: NOW }),
      ]);
      expect(outcomes.map((o) => o.status)).toEqual(["rejected", "fulfilled"]);
      expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(100);
      expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(0);
      expect((await pool.query("SELECT 1 FROM lead_consents")).rowCount).toBe(0);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  });

  it("reserves pending capacity during a multi-day delivery outage, including failed jobs", async () => {
    await fillLeads();
    await pool.query("UPDATE event_outbox SET attempts = 5");
    await expect(createLead(pool, lead(20), { now: later(25) })).rejects.toBeInstanceOf(MailAdmissionCapacityError);
    await expect(createLead(pool, lead(21), { now: later(49) })).rejects.toBeInstanceOf(MailAdmissionCapacityError);
    await createDataRequest(pool, request(0), { now: later(49) });
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(41);
  });

  it("counts recent source records after delivery or orphan-queue deletion", async () => {
    await fillRequests(100);
    await markPendingVerificationsDelivered();
    await pool.query("UPDATE data_requests SET verification_state = 'verified', verification_token_hash = NULL");
    // The worker can remove non-pending request jobs; their accepted source
    // records must still spend today's budget.
    await pool.query("DELETE FROM event_outbox");
    await expect(createDataRequest(pool, request(101), { now: later(2) })).rejects.toMatchObject({ name: "DataRequestCapacityError" });
    await expect(createLead(pool, lead(0), { now: later(2) })).rejects.toBeInstanceOf(MailAdmissionCapacityError);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(0);
  });

  it("keeps an old undelivered backlog bounded when the admission window expires", async () => {
    await fillRequests(100);
    await expect(createDataRequest(pool, request(101), { now: later(25) })).rejects.toMatchObject({ name: "DataRequestCapacityError" });
    await expect(createLead(pool, lead(0), { now: later(25) })).rejects.toBeInstanceOf(MailAdmissionCapacityError);
    await pool.query("DELETE FROM event_outbox");
    await expect(createLead(pool, lead(0), { now: later(25) })).resolves.toHaveProperty("receiptId");
  });

  it("deduplicates rolling 24-hour retries and accepts a new submission at expiry", async () => {
    const first = await createLead(pool, lead(0), { now: NOW });
    expect(await createLead(pool, lead(0), { now: new Date(later(24).getTime() - 1) })).toEqual(first);
    expect(await createLead(pool, lead(0), { now: later(24) })).not.toEqual(first);
    expect((await pool.query("SELECT 1 FROM leads")).rowCount).toBe(2);
  });
});

async function markPendingVerificationsDelivered() {
  await pool.query(
    `UPDATE data_requests
        SET verification_sent_at = $1,
            verification_expires_at = $1::timestamptz + interval '24 hours'
      WHERE verification_state = 'pending'`,
    [NOW],
  );
}

describe("submitting a request", () => {
  it("creates a pending row and queues a verification message", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "someone@example.com", requestType: "delete" },
      { now: NOW },
    );
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const { rows } = await pool.query("SELECT * FROM data_requests");
    expect(rows).toHaveLength(1);
    expect(rows[0].verification_state).toBe("pending");
    expect(rows[0].completed_at).toBeNull();
    expect(rows[0].verification_token_key_id).toBe(CURRENT_KEY_ID);
    expect(rows[0].verification_sent_at).toBeNull();
    expect(rows[0].verification_expires_at).toBeNull();

    const outbox = await pool.query("SELECT event_type, payload_json FROM event_outbox");
    expect(outbox.rows.map((r) => r.event_type)).toEqual(["data_request_verification"]);
    expect(outbox.rows[0].payload_json).toEqual({
      locale: "tr",
      tokenKeyId: CURRENT_KEY_ID,
    });
  });

  it("never stores the token itself", async () => {
    // The token is a capability: whoever holds it can prove ownership of that
    // address. A database read must not become the ability to verify other
    // people's requests.
    const { token } = await createDataRequest(
      pool,
      { email: "someone@example.com", requestType: "access" },
      { now: NOW },
    );
    const { rows } = await pool.query("SELECT * FROM data_requests");
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(rows[0].verification_token_hash).toBe(hashToken(token));
    expect(token).toBe(deriveDataRequestToken(rows[0].id, CURRENT_SECRET));
  });

  it("keeps the token out of the queued payload too", async () => {
    // The outbox row would otherwise be a second copy of the secret, with a
    // different retention and nobody watching it.
    const { token } = await createDataRequest(
      pool,
      { email: "someone@example.com", requestType: "delete" },
      { now: NOW },
    );
    const { rows } = await pool.query("SELECT payload_json FROM event_outbox");
    expect(JSON.stringify(rows[0].payload_json)).not.toContain(token);
  });

  it("does not spend the 24-hour deadline while the request is only queued", async () => {
    await createDataRequest(pool, { email: "a@b.co", requestType: "delete" }, { now: NOW });
    const { rows } = await pool.query(
      "SELECT verification_sent_at, verification_expires_at FROM data_requests",
    );
    expect(rows[0]).toEqual({ verification_sent_at: null, verification_expires_at: null });
  });

  it("parses a bounded current+previous keyring without accepting a retired key", () => {
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV] = PREVIOUS_KEY_ID;
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV] = PREVIOUS_SECRET;
    const keyring = dataRequestTokenKeyring();
    expect(keyring.current).toEqual({ id: CURRENT_KEY_ID, secret: CURRENT_SECRET });
    expect(keyring.previous).toEqual({ id: PREVIOUS_KEY_ID, secret: PREVIOUS_SECRET });
    expect(keyring.byId.get("retired-2026-06")).toBeUndefined();
  });

  it("rejects a half-configured or duplicate-id keyring", () => {
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV] = PREVIOUS_KEY_ID;
    delete process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV];
    expect(() => dataRequestTokenKeyring()).toThrow(/keyring/i);

    process.env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV] = CURRENT_KEY_ID;
    process.env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV] = PREVIOUS_SECRET;
    expect(() => dataRequestTokenKeyring()).toThrow(/keyring/i);
  });

  it("durable abuse boundary: deduplicates one normalized recipient and request type across pools", async () => {
    const other = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 2 });
    try {
      await Promise.all([
        createDataRequest(
          pool,
          { email: "  Same.Person@Example.COM ", requestType: "access", locale: "tr" },
          { now: NOW },
        ),
        createDataRequest(
          other,
          { email: "same.person@example.com", requestType: "access", locale: "en" },
          { now: NOW },
        ),
      ]);
    } finally {
      await other.end();
    }

    const requests = await pool.query("SELECT email FROM data_requests");
    const outbox = await pool.query(
      "SELECT event_type FROM event_outbox WHERE event_type = 'data_request_verification'",
    );
    expect(requests.rows).toEqual([{ email: "same.person@example.com" }]);
    expect(outbox.rowCount).toBe(1);
  });

  it("does not let an earlier request type suppress another right for the same recipient", async () => {
    await createDataRequest(
      pool,
      { email: "Rights.Holder@Example.com", requestType: "access", locale: "tr" },
      { now: NOW },
    );
    await createDataRequest(
      pool,
      { email: " rights.holder@example.COM ", requestType: "delete", locale: "en" },
      { now: NOW },
    );

    const requests = await pool.query(
      "SELECT email, request_type FROM data_requests ORDER BY request_type",
    );
    expect(requests.rows).toEqual([
      { email: "rights.holder@example.com", request_type: "access" },
      { email: "rights.holder@example.com", request_type: "delete" },
    ]);
    expect((await pool.query("SELECT 1 FROM event_outbox")).rowCount).toBe(2);
  });

  it("durable abuse boundary: enforces one atomic global rolling-window quota across pools", async () => {
    for (let index = 0; index < 99; index += 1) {
      await createDataRequest(
        pool,
        { email: `quota-${index}@example.com`, requestType: "access", locale: "tr" },
        { now: NOW },
      );
    }

    const other = new Pool({ connectionString: testDatabaseUrl(SCHEMA), max: 2 });
    try {
      const settled = await Promise.allSettled([
        createDataRequest(
          pool,
          { email: "quota-last-a@example.com", requestType: "access", locale: "tr" },
          { now: NOW },
        ),
        createDataRequest(
          other,
          { email: "quota-last-b@example.com", requestType: "access", locale: "tr" },
          { now: NOW },
        ),
      ]);
      expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
    } finally {
      await other.end();
    }

    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(100);
    expect(
      (await pool.query("SELECT 1 FROM event_outbox WHERE event_type = 'data_request_verification'"))
        .rowCount,
    ).toBe(100);
  });
});

describe("verifying", () => {
  it("never lets one request capability verify a different request", async () => {
    const first = await createDataRequest(
      pool,
      { email: "first@example.com", requestType: "access" },
      { now: NOW },
    );
    await createDataRequest(
      pool,
      { email: "second@example.com", requestType: "delete" },
      { now: NOW },
    );
    await markPendingVerificationsDelivered();
    expect((await verifyDataRequest(pool, first.token, { now: NOW })).verified).toBe(true);
    const { rows } = await pool.query(
      "SELECT email, verification_state FROM data_requests ORDER BY email",
    );
    expect(rows).toEqual([
      { email: "first@example.com", verification_state: "verified" },
      { email: "second@example.com", verification_state: "pending" },
    ]);
  });

  it("moves a pending request to verified with the right token", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "a@b.co", requestType: "delete" },
      { now: NOW },
    );
    await markPendingVerificationsDelivered();
    const result = await verifyDataRequest(pool, token, { now: NOW });
    expect(result.verified).toBe(true);

    const { rows } = await pool.query("SELECT verification_state FROM data_requests");
    expect(rows[0].verification_state).toBe("verified");
  });

  it("spends the token, so the same link cannot be replayed", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "a@b.co", requestType: "delete" },
      { now: NOW },
    );
    await markPendingVerificationsDelivered();
    await verifyDataRequest(pool, token, { now: NOW });
    const { rows } = await pool.query("SELECT verification_token_hash FROM data_requests");
    expect(rows[0].verification_token_hash).toBeNull();

    const second = await verifyDataRequest(pool, token, { now: NOW });
    expect(second.verified).toBe(false);
  });

  it("lets exactly one concurrent verifier spend the capability", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "race@example.com", requestType: "correct" },
      { now: NOW },
    );
    await markPendingVerificationsDelivered();
    const [first, second] = await Promise.all([
      verifyDataRequest(pool, token, { now: NOW }),
      verifyDataRequest(pool, token, { now: NOW }),
    ]);
    expect([first.verified, second.verified].sort()).toEqual([false, true]);
  });

  it("consumes with one conditional UPDATE RETURNING rather than SELECT then UPDATE", async () => {
    const token = "d".repeat(64);
    const query = vi.fn(async (sql: string) => {
      expect(sql).toMatch(/^\s*UPDATE data_requests/i);
      expect(sql).toMatch(/verification_state\s*=\s*'pending'/i);
      expect(sql).toMatch(/verification_token_hash\s*=\s*\$1/i);
      expect(sql).toMatch(/verification_expires_at\s*>\s*\$2/i);
      expect(sql).toMatch(/RETURNING\s+id/i);
      return { rowCount: 1, rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
    });

    await expect(
      verifyDataRequest({ query } as never, token, { now: NOW }),
    ).resolves.toEqual({ verified: true });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("creates no row when the server-only token secret is absent", async () => {
    delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV];
    await expect(
      createDataRequest(
        pool,
        { email: "no-secret@example.com", requestType: "delete" },
        { now: NOW },
      ),
    ).rejects.toThrow(/keyring/i);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
  });

  it("refuses a token past its deadline", async () => {
    const { token } = await createDataRequest(
      pool,
      { email: "a@b.co", requestType: "delete" },
      { now: NOW },
    );
    await pool.query(
      "UPDATE data_requests SET verification_sent_at = $1, verification_expires_at = $2",
      [NOW, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    );
    const late = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    expect((await verifyDataRequest(pool, token, { now: late })).verified).toBe(false);
    const { rows } = await pool.query("SELECT verification_state FROM data_requests");
    expect(rows[0].verification_state).toBe("pending");
  });

  it("refuses an unknown token", async () => {
    await createDataRequest(pool, { email: "a@b.co", requestType: "delete" }, { now: NOW });
    expect((await verifyDataRequest(pool, "f".repeat(64), { now: NOW })).verified).toBe(false);
  });

  it("says the same thing for an unknown token as for a wrong one", async () => {
    // Distinguishing them would turn this endpoint into an oracle for which
    // addresses have requests outstanding.
    const unknown = await verifyDataRequest(pool, "a".repeat(64), { now: NOW });
    const malformed = await verifyDataRequest(pool, "nonsense", { now: NOW });
    expect(unknown).toEqual(malformed);
  });
});

describe("the database refuses impossible states", () => {
  it("will not let a pending request exist without a live token", async () => {
    await expect(
      pool.query(
        `INSERT INTO data_requests (email, request_type, verification_state, verification_token_key_id)
         VALUES ($1,$2,'pending',$3)`,
        ["a@b.co", "delete", CURRENT_KEY_ID],
      ),
    ).rejects.toThrow();
  });

  it("will not keep a token on a request that is no longer pending", async () => {
    await expect(
      pool.query(
        `INSERT INTO data_requests (email, request_type, verification_state, verification_token_hash, verification_token_key_id)
         VALUES ($1,$2,'verified',$3,$4)`,
        ["a@b.co", "delete", "b".repeat(64), CURRENT_KEY_ID],
      ),
    ).rejects.toThrow();
  });

  it("will not complete a request that was never verified", async () => {
    await expect(
      pool.query(
        `INSERT INTO data_requests (
           email, request_type, verification_state, verification_sent_at,
           verification_expires_at, verification_token_hash, verification_token_key_id, completed_at
         ) VALUES ($1,$2,'pending',now(),now()+interval '1 day',$3,$4,now())`,
        ["a@b.co", "delete", "c".repeat(64), CURRENT_KEY_ID],
      ),
    ).rejects.toThrow();
  });

  it("will not store a raw token in the hash column", async () => {
    await expect(
      pool.query(
        `INSERT INTO data_requests (
           email, request_type, verification_state, verification_sent_at,
           verification_expires_at, verification_token_hash, verification_token_key_id
         ) VALUES ($1,$2,'pending',now(),now()+interval '1 day','not-a-hash',$3)`,
        ["a@b.co", "delete", CURRENT_KEY_ID],
      ),
    ).rejects.toThrow();
  });
});

describe("unverified requests do not linger", () => {
  it("expires a pending request whose window has closed and clears its token", async () => {
    await createDataRequest(pool, { email: "a@b.co", requestType: "delete" }, { now: NOW });
    await pool.query(
      "UPDATE data_requests SET verification_sent_at = $1, verification_expires_at = $2",
      [NOW, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    );
    const expired = await purgeExpiredVerifications(
      pool,
      new Date(NOW.getTime() + 25 * 60 * 60 * 1000),
    );
    expect(expired).toBe(1);
    const { rows } = await pool.query(
      "SELECT verification_state, verification_token_hash FROM data_requests",
    );
    expect(rows[0].verification_state).toBe("expired");
    expect(rows[0].verification_token_hash).toBeNull();
  });

  it("leaves a request still inside its window alone", async () => {
    await createDataRequest(pool, { email: "a@b.co", requestType: "delete" }, { now: NOW });
    await pool.query(
      "UPDATE data_requests SET verification_sent_at = $1, verification_expires_at = $2",
      [NOW, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    );
    expect(await purgeExpiredVerifications(pool, NOW)).toBe(0);
  });

  it.each([
    ["verified", "verified"],
    ["expired", "expired"],
    ["never-sent", "pending"],
  ])("removes an outbox-free %s request after retention", async (_label, state) => {
    const purgeAt = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const purgeRun = new Date(purgeAt.getTime() + 1);
    await createDataRequest(
      pool,
      { email: `${_label}@example.com`, requestType: "delete" },
      { now: NOW },
    );
    await pool.query("DELETE FROM event_outbox");
    await pool.query(
      `UPDATE data_requests
          SET verification_state = $1,
              verification_token_hash = CASE WHEN $1 = 'pending' THEN verification_token_hash ELSE NULL END,
              purge_at = $2`,
      [state, purgeAt],
    );

    expect(await purgeExpiredVerifications(pool, purgeRun)).toBe(1);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(0);
  });

  it("does not remove a retained request while its verification outbox still exists", async () => {
    const purgeAt = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const purgeRun = new Date(purgeAt.getTime() + 1);
    await createDataRequest(
      pool,
      { email: "retained@example.com", requestType: "delete" },
      { now: NOW },
    );
    await pool.query("UPDATE data_requests SET purge_at = $1", [purgeAt]);

    expect(await purgeExpiredVerifications(pool, purgeRun)).toBe(0);
    expect((await pool.query("SELECT 1 FROM data_requests")).rowCount).toBe(1);
  });
});
