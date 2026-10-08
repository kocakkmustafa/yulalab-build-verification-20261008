import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createIsolatedSchema, dropSchema } from "./helpers/attribution-db";
import { drainOutbox, MAX_ATTEMPTS, unconfiguredTransport } from "@/server/mail";
import { createLead } from "@/server/leads";
import type { MailMessage, MailTransport } from "@/server/mail";
import {
  DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
  DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
} from "@/server/data-request-token";
import { APPROVED_MAIL_IDENTITY, MAIL_IDENTITY_ENV } from "@/server/mail-identity";

/**
 * The outbox consumer.
 *
 * The property everything else serves: a transport that is not configured, or
 * that fails, must NEVER mark a row delivered. A wrongly-delivered row is
 * never retried, so the receipt is lost permanently and nothing anywhere
 * records that it did not arrive — silent success, made worse by a queue.
 */
const SCHEMA = "t_mail";
let pool: Pool;

beforeAll(async () => {
  pool = await createIsolatedSchema(SCHEMA);
  for (const file of [
    "../db/migrations/0002_leads_consents_outbox.sql",
    "../db/migrations/0003_data_request_verification.sql",
  ]) {
    await pool.query(readFileSync(path.resolve(import.meta.dirname, file), "utf8"));
  }
});

afterAll(async () => {
  await dropSchema(pool, SCHEMA);
});

beforeEach(async () => {
  await pool.query("TRUNCATE leads, event_outbox, data_requests CASCADE");
  process.env[MAIL_IDENTITY_ENV.fromEmail] = APPROVED_MAIL_IDENTITY.fromEmail;
  process.env[MAIL_IDENTITY_ENV.fromName] = APPROVED_MAIL_IDENTITY.fromName;
  process.env[MAIL_IDENTITY_ENV.replyToEmail] = APPROVED_MAIL_IDENTITY.replyToEmail;
  process.env[MAIL_IDENTITY_ENV.internalAddress] = APPROVED_MAIL_IDENTITY.internalAddress;
  // A type is deliverable only once it has BOTH an address and its
  // templates, so the fixture has to supply them like a real deployment.
  process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = "d-cef2371a06014280857d0f17e3056305";
  process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN = "d-d42d50b22fda48e49cfbb6ab373f420e";
  process.env.SENDGRID_TEMPLATE_LEAD_INTERNAL_ROUTE_TR = "d-2ce67d70cec249aeab61577361a50572";
  process.env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV] = "2026-08-current";
  process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV] = "test-only-data-request-secret-at-least-32-bytes";
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_TR = "d-934e79bac8f841dfb7066e169d8f4ffc";
  process.env.SENDGRID_TEMPLATE_DATA_REQUEST_VERIFICATION_EN = "d-e9aeeaa9dc8949679777b61eed0f41dc";
});

let seq = 0;
/** A real lead plus the receipt row createLead() would have queued beside it. */
async function queueReceipt(email = `person${(seq += 1)}@example.com`): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO leads (name, email, intent, message, locale, dedupe_key)
     VALUES ('Ada', $1, 'studio', 'hello', 'tr', $2) RETURNING id`,
    [email, String(seq).padStart(64, "0")],
  );
  const leadId = rows[0].id as string;
  await pool.query(
    `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
     VALUES ('lead_receipt', $1, $2::jsonb)`,
    [leadId, JSON.stringify({ receiptId: `YL-${seq}`, locale: "tr" })],
  );
  return leadId;
}

function transportThat(behaviour: "succeeds" | "fails"): MailTransport & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    configured: true,
    async send(message) {
      if (behaviour === "fails") throw new Error("provider unavailable");
      sent.push(message);
    },
  };
}

describe("an unconfigured transport", () => {
  it("delivers nothing and marks nothing delivered", async () => {
    await queueReceipt();
    await queueReceipt();
    const result = await drainOutbox(pool, unconfiguredTransport());
    expect(result.delivered).toBe(0);
    expect(result.skipped).toBe(2);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM event_outbox WHERE delivered_at IS NULL",
    );
    expect(rows[0].n).toBe(2);
  });

  it("does not burn retry attempts on rows it never tried to send", async () => {
    // Otherwise a month of cron runs against an unconfigured provider would
    // exhaust every row's budget, and the queue would be dead on the morning
    // mail is finally switched on.
    await queueReceipt();
    for (let i = 0; i < 5; i += 1) {
      await drainOutbox(pool, unconfiguredTransport());
    }
    const { rows } = await pool.query("SELECT max(attempts)::int AS a FROM event_outbox");
    expect(rows[0].a).toBe(0);
  });
});

describe("delivery", () => {
  it("sends undelivered rows and stamps them", async () => {
    await queueReceipt();
    await queueReceipt();
    const transport = transportThat("succeeds");
    const result = await drainOutbox(pool, transport);
    expect(result.delivered).toBe(2);
    expect(transport.sent).toHaveLength(2);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM event_outbox WHERE delivered_at IS NULL",
    );
    expect(rows[0].n).toBe(0);
  });

  it("takes no clock from its caller, and stamps after creation", async () => {
    // Named for what it can actually observe. "The database's clock, not
    // the caller's" is unobservable when both clocks agree — which they do
    // in a test — so the ordering assertion below passed just as happily
    // with `SET delivered_at = $2, [new Date()]`, the very thing it was
    // supposed to forbid.
    //
    // The first attempt at this asserted `drainOutbox.length === 2`, which
    // was theatre: a default parameter does not count toward `.length`, so
    // `options: { now?: Date } = {}` reintroduces the injected clock and
    // sails past. What follows is a source-shape guard and is honest about
    // being one — the stamp must come from now() in SQL, never from a bound
    // parameter. The ordering assertion below is real but weak: it fails
    // only when insert and delivery land in the same millisecond, which is
    // why it caught the caller-clock mutation nondeterministically.
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../src/server/mail.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(source).toMatch(/SET delivered_at = now\(\)/);
    expect(source).not.toMatch(/SET delivered_at = \$/);

    const before = new Date();
    await queueReceipt();
    await drainOutbox(pool, transportThat("succeeds"));
    const { rows } = await pool.query("SELECT delivered_at, created_at FROM event_outbox");
    expect(rows[0].delivered_at.getTime()).toBeGreaterThanOrEqual(rows[0].created_at.getTime());
    expect(rows[0].delivered_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("never sends a delivered row twice", async () => {
    await queueReceipt();
    const transport = transportThat("succeeds");
    await drainOutbox(pool, transport);
    await drainOutbox(pool, transport);
    expect(transport.sent).toHaveLength(1);
  });

  it("counts a failure, leaves the row undelivered, and stops hammering a down provider", async () => {
    await queueReceipt();
    await queueReceipt();
    const result = await drainOutbox(pool, transportThat("fails"));
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(2);

    const { rows } = await pool.query(
      "SELECT attempts, delivered_at FROM event_outbox ORDER BY created_at",
    );
    // One attempt each within a single run — a failing row must not be
    // re-claimed by the same drain, or one bad provider minute would spend
    // every retry a row will ever get.
    expect(rows.map((r) => r.attempts)).toEqual([1, 1]);
    expect(rows.every((r) => r.delivered_at === null)).toBe(true);
  });

  it("gives up after MAX_ATTEMPTS rather than retrying forever", async () => {
    await queueReceipt();
    for (let i = 0; i < MAX_ATTEMPTS + 2; i += 1) {
      await drainOutbox(pool, transportThat("fails"));
    }
    const { rows } = await pool.query("SELECT attempts FROM event_outbox");
    expect(rows[0].attempts).toBe(MAX_ATTEMPTS);

    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.delivered).toBe(0);
  });
});

describe("a lead that has been deleted", () => {
  it("drops its pending receipt instead of sending it", async () => {
    // The queue holds a pointer, not a copy. Purging the lead — retention or
    // an honoured deletion request — must take the unsent receipt with it.
    const leadId = await queueReceipt();
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);

    const transport = transportThat("succeeds");
    const result = await drainOutbox(pool, transport);
    expect(transport.sent).toHaveLength(0);
    expect(result.dropped).toBe(1);
    expect(result.delivered).toBe(0);
  });

  it("removes the row rather than leaving a pointer to an erased person", async () => {
    // Two reasons it is deleted instead of retired by spending its attempts.
    // The row carries a pointer to a lead we promised to forget, and leaving
    // it for purge_at keeps that pointer thirty more days. And a row retired
    // with attempts = MAX is indistinguishable from one the provider refused
    // five times, which would make every honoured deletion inflate the count
    // of genuinely-failed deliveries.
    const leadId = await queueReceipt();
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);
    await drainOutbox(pool, transportThat("succeeds"));

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM event_outbox");
    expect(rows[0].n).toBe(0);

    const again = await drainOutbox(pool, transportThat("succeeds"));
    expect(again.dropped).toBe(0);
    // Never recorded as delivered along the way, because it was not.
    expect(again.dead).toBe(0);
  });
});

describe("a verification row whose capability cannot be reconstructed", () => {
  it("blocks a corrupt hash rather than sending a broken link", async () => {
    const { rows } = await pool.query(
      `INSERT INTO data_requests (email, request_type, verification_token_hash, verification_expires_at)
       VALUES ('ada@example.com', 'access', repeat('a', 64), now() + interval '1 hour')
       RETURNING id`,
    );
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('data_request_verification', $1, '{"requestType":"access","locale":"tr"}'::jsonb)`,
      [rows[0].id],
    );
    const transport = transportThat("succeeds");
    const result = await drainOutbox(pool, transport);
    expect(transport.sent).toHaveLength(0);
    expect(result.blocked).toBe(1);

    const { rows: after } = await pool.query("SELECT attempts, delivered_at FROM event_outbox");
    expect(after[0].attempts).toBe(0);
    expect(after[0].delivered_at).toBeNull();
  });

  it("blocks an internal route with nowhere to route to", async () => {
    delete process.env[MAIL_IDENTITY_ENV.internalAddress];
    const leadId = await queueReceipt();
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('lead_internal_route', $1, '{"receiptId":"YL-1","route":"studio","intent":"studio"}'::jsonb)`,
      [leadId],
    );
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.blocked).toBe(1);
    expect(result.delivered).toBe(1); // the receipt still goes
  });
});

describe("an event whose template id is not the approved container", () => {
  it("never calls the provider or spends an attempt", async () => {
    await queueReceipt();
    process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_TR = "d-other";
    const transport = transportThat("succeeds");

    const result = await drainOutbox(pool, transport);

    expect(transport.sent).toHaveLength(0);
    expect(result.blocked).toBe(1);
    expect(result.missingConfig).toContain("INVALID_SENDGRID_TEMPLATE_LEAD_RECEIPT_TR");
    const { rows } = await pool.query("SELECT attempts, delivered_at FROM event_outbox");
    expect(rows[0].attempts).toBe(0);
    expect(rows[0].delivered_at).toBeNull();
  });
});

describe("two workers do not send the same message twice", () => {
  it("claims each row exactly once under concurrency", async () => {
    // More than one instance runs in production, and each row must be sent
    // once. This asserts exactly-once, which is the row lock's doing —
    // measured: it still passes with SKIP LOCKED removed, because Postgres
    // re-checks `delivered_at IS NULL` after granting the lock. SKIP LOCKED
    // earns its place on throughput (no worker queues behind another's
    // network call), which is a latency property this cannot assert without
    // becoming a flaky clock test.
    for (let i = 0; i < 6; i += 1) await queueReceipt();
    const a = transportThat("succeeds");
    const b = transportThat("succeeds");
    const [ra, rb] = await Promise.all([
      drainOutbox(pool, a),
      drainOutbox(pool, b),
    ]);
    expect(ra.delivered + rb.delivered).toBe(6);
    const ids = [...a.sent, ...b.sent].map((m) => m.outboxId);
    expect(new Set(ids).size).toBe(6);
  });
});

describe("what reaches the transport", () => {
  it("carries the address it is sent to and the receipt, and no message body", async () => {
    // Queued by the REAL createLead, not by this file's fixture.
    //
    // Asserting "the body is absent" against a payload the test wrote
    // itself proves only that the test did not write one. If createLead
    // started copying `message` into payload_json — the change this is
    // meant to catch — the fixture version stayed green.
    const secret = "please keep this between us";
    await createLead(
      pool,
      {
        name: "Ada",
        email: "ada@example.com",
        intent: "studio",
        message: secret,
        locale: "tr",
      },
      { now: new Date() },
    );

    process.env[MAIL_IDENTITY_ENV.internalAddress] = APPROVED_MAIL_IDENTITY.internalAddress;
    const transport = transportThat("succeeds");
    await drainOutbox(pool, transport);

    const receipt = transport.sent.find((m) => m.eventType === "lead_receipt");
    expect(receipt?.to).toBe("ada@example.com");
    expect(receipt?.locale).toBe("tr");
    // A receipt says "we have it". It does not quote it — not to the
    // person, and not to the provider.
    expect(JSON.stringify(transport.sent)).not.toContain(secret);
  });
});

describe("a backlog of rows that cannot be addressed", () => {
  it("does not starve the receipts behind it", async () => {
    // data_request_verification is permanently blocked and never retired, so
    // those rows sit at the front of `ORDER BY created_at` until they purge
    // 30 days later. If examining one costs a slot in the batch, a backlog
    // larger than the batch means real receipts are never reached — not this
    // run, and not any later run either, because the backlog does not move.
    const { rows } = await pool.query(
      `INSERT INTO data_requests (email, request_type, verification_token_hash, verification_expires_at)
       VALUES ('ada@example.com', 'access', repeat('a', 64), now() + interval '1 hour')
       RETURNING id`,
    );
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json, created_at)
       SELECT 'data_request_verification', $1, '{"requestType":"access"}'::jsonb,
              now() - interval '1 hour'
         FROM generate_series(1, 120)`,
      [rows[0].id],
    );
    await queueReceipt("ada@example.com");

    delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV];
    const transport = transportThat("succeeds");
    const result = await drainOutbox(pool, transport);
    expect(result.delivered).toBe(1);
    expect(transport.sent[0]?.to).toBe("ada@example.com");

    // And the backlog is reported whole. A count capped at the batch size
    // would sit at 100 while the queue grew past it — the number a monitor
    // watches would go flat exactly as the problem got worse.
    expect(result.blocked).toBe(120);
  });
});

describe("deletion is honoured for every row a lead wrote, not just the receipt", () => {
  it("drops the internal notification too when the lead is gone", async () => {
    // createLead writes TWO outbox rows. Honouring "delete my data" on one
    // and not the other means the studio inbox still receives a
    // notification about a person whose record we promised to erase.
    const leadId = await queueReceipt();
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('lead_internal_route', $1, '{"receiptId":"YL-1","route":"studio","intent":"studio"}'::jsonb)`,
      [leadId],
    );
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);

    const transport = transportThat("succeeds");
    const result = await drainOutbox(pool, transport);
    expect(transport.sent).toHaveLength(0);
    expect(result.dropped).toBe(2);
  });
});

describe("what is left over after a run", () => {
  it("reports the backlog the batch could not reach", async () => {
    // Otherwise 150 queued receipts return {delivered: 100, failed: 0} —
    // the healthiest-looking response body possible while 50 people wait,
    // and purge_at deletes them undelivered at 30 days.
    for (let i = 0; i < 105; i += 1) await queueReceipt();
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.delivered).toBe(100);
    expect(result.remaining).toBe(5);
  });

  it("is zero when the queue is genuinely empty", async () => {
    await queueReceipt();
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.remaining).toBe(0);
  });
});

describe("the unconfigured count", () => {
  it("does not inflate 'waiting on credentials' with rows credentials cannot help", async () => {
    const { rows } = await pool.query(
      `INSERT INTO data_requests (email, request_type, verification_token_hash, verification_expires_at)
       VALUES ('ada@example.com', 'access', repeat('a', 64), now() + interval '1 hour')
       RETURNING id`,
    );
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       SELECT 'data_request_verification', $1, '{"requestType":"access"}'::jsonb
         FROM generate_series(1, 2)`,
      [rows[0].id],
    );
    await queueReceipt();

    delete process.env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV];
    const result = await drainOutbox(pool, unconfiguredTransport());
    expect(result.skipped).toBe(1);
    expect(result.blocked).toBe(2);
  });
});

describe("where an internal notification actually goes", () => {
  it("is sent to the configured studio address", async () => {
    // Asserting only that it is 'blocked without an address' leaves the
    // destination itself unanchored: pointing every lead notification at
    // the wrong inbox would not have failed a single test.
    const leadId = await queueReceipt();
    await pool.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('lead_internal_route', $1, '{"receiptId":"YL-1","route":"studio","intent":"studio"}'::jsonb)`,
      [leadId],
    );
    process.env[MAIL_IDENTITY_ENV.internalAddress] = APPROVED_MAIL_IDENTITY.internalAddress;

    const transport = transportThat("succeeds");
    await drainOutbox(pool, transport);
    const internal = transport.sent.find((m) => m.eventType === "lead_internal_route");
    expect(internal?.to).toBe("yula@yulalab.com");
  });
});

describe("a queue that has permanently failed", () => {
  it("does not report perfect health once every retry is spent", async () => {
    // `remaining` carries the claim query's `attempts < MAX_ATTEMPTS` filter,
    // so it falls to zero at the exact moment failure becomes permanent.
    // Without a separate count, two people who will never get a receipt look
    // identical to an empty queue: {delivered:0, failed:0, remaining:0}.
    await queueReceipt();
    await queueReceipt();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await drainOutbox(pool, transportThat("fails"));
    }
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.remaining).toBe(0);
    expect(result.dead).toBe(2);
  });

  it("counts an honoured deletion as dropped, never as a failed delivery", async () => {
    // The two used to be the same row state. If a deletion registered as a
    // dead delivery, every erasure request would raise a false alarm about
    // receipts nobody was owed.
    const leadId = await queueReceipt();
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.dropped).toBe(1);
    expect(result.dead).toBe(0);
    // Measured, not arithmetic. Deriving it as `before - delivered` leaves a
    // permanent non-zero floor equal to the number of rows ever dropped.
    expect(result.remaining).toBe(0);
  });

  it("says which env var is holding a blocked type back", async () => {
    // A queue reporting `blocked: N` with no way to learn why is how an
    // operator concludes the consumer is broken.
    delete process.env.SENDGRID_TEMPLATE_LEAD_RECEIPT_EN;
    await queueReceipt();
    const result = await drainOutbox(pool, transportThat("succeeds"));
    expect(result.delivered).toBe(0);
    expect(result.blocked).toBe(1);
    expect(result.missingConfig).toContain("SENDGRID_TEMPLATE_LEAD_RECEIPT_EN");
  });
});

describe("when the database goes away mid-run", () => {
  it("reports the work that did happen instead of discarding it", async () => {
    // The likeliest reason a drain aborts is the database — which is also
    // when the final count fails. Throwing there meant a run that delivered
    // 99 and then lost the connection reported nothing at all.
    await queueReceipt();
    await queueReceipt();
    await queueReceipt();

    // A pool that hands out one connection and then refuses, rather than
    // DROPping the table: the drain holds a row lock on event_outbox, so a
    // DROP waits on ACCESS EXCLUSIVE and the test hangs instead of failing.
    //
    // Only connect() fails. Breaking query() too would let the CLOSING
    // measurement's own catch set `aborted`, and this test would pass with
    // the connect guard deleted.
    let delivered = 0;
    const failing = {
      connect: async () => {
        if (delivered >= 1) throw new Error("connection terminated");
        return pool.connect();
      },
      query: pool.query.bind(pool),
    } as unknown as typeof pool;

    const transport = transportThat("succeeds");
    const result = await drainOutbox(failing, {
      configured: true,
      async send(message) {
        await transport.send(message);
        delivered += 1;
      },
    });

    expect(result.aborted).toBe(true);
    expect(result.delivered).toBe(1);
    // The database still answers, so the counts are real: two rows queued,
    // one delivered, one still waiting.
    expect(result.remaining).toBe(2);
  });
});

describe("an error inside the transaction, not just at connect time", () => {
  it("marks the run aborted and keeps the deliveries it already made", async () => {
    // The earlier abort test fails at pool.connect(), which is a different
    // branch. Nothing exercised the catch around the transaction itself, so
    // `result.aborted = true` there could be deleted with the suite green.
    await queueReceipt();
    await queueReceipt();
    let stamps = 0;
    const brittle = {
      query: pool.query.bind(pool),
      connect: async () => {
        const client = await pool.connect();
        const original = client.query.bind(client);
        // Restored on release. A patched client goes back into the POOL, and
        // the next test to borrow it inherits the fault — the failure looks
        // exactly like a leak and is nothing of the sort.
        const originalRelease = client.release.bind(client);
        client.release = ((...args: unknown[]) => {
          client.query = original as typeof client.query;
          client.release = originalRelease;
          return (originalRelease as (...a: unknown[]) => unknown)(...args);
        }) as typeof client.release;
        client.query = ((...args: unknown[]) => {
          const sql = typeof args[0] === "string" ? args[0] : "";
          if (sql.includes("UPDATE event_outbox") && sql.includes("delivered_at = now()")) {
            stamps += 1;
            // The first row goes through; the connection dies on the second.
            if (stamps > 1) throw new Error("connection terminated mid-transaction");
          }
          return original(...(args as Parameters<typeof original>));
        }) as typeof client.query;
        return client;
      },
    } as unknown as typeof pool;

    const result = await drainOutbox(brittle, transportThat("succeeds"));

    expect(result.aborted).toBe(true);
    expect(result.delivered).toBe(1);
  });

  it("says so when only the closing measurement fails", async () => {
    // Everything delivered fine; the count at the end did not. Reporting
    // remaining: 0 here would claim an empty queue on no evidence.
    await queueReceipt();
    let counts = 0;
    const realQuery = pool.query.bind(pool);
    const brittle = {
      connect: pool.connect.bind(pool),
      query: (...args: unknown[]) => {
        const sql = typeof args[0] === "string" ? args[0] : "";
        if (sql.includes("count(*)")) {
          counts += 1;
          // 1st = the opening measurement; 2nd = the closing one.
          if (counts > 1) throw new Error("connection terminated");
        }
        return realQuery(...(args as Parameters<typeof realQuery>));
      },
    } as unknown as typeof pool;

    const result = await drainOutbox(brittle, transportThat("succeeds"));
    expect(result.delivered).toBe(1);
    expect(result.aborted).toBe(true);
    expect(result.remaining).toBeNull();
    expect(result.dead).toBeNull();
  });
});
