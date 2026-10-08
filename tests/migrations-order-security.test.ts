import { readFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const read = (relative: string) =>
  readFileSync(path.resolve(import.meta.dirname, relative), "utf8");
const DATABASE_URL = process.env.ATTRIBUTION_TEST_DATABASE_URL ?? "postgres://localhost:5432/yula_attribution_test";
const APPLY = path.resolve(import.meta.dirname, "../db/operations/apply-0001-0004-atomic.sql");
const PREFLIGHT = path.resolve(import.meta.dirname, "../db/operations/preflight-0001-0004.sql");
const suffix = `${process.pid}`;
const intakeRole = `yula_intake_${suffix}`;
const mailRole = `yula_mail_${suffix}`;
const purgeRole = `yula_purge_${suffix}`;
const attackerRole = `yula_attacker_${suffix}`;
const privilegedRole = `yula_privileged_${suffix}`;
const emptySchema = `t_migration_empty_${suffix}`;
const partialSchema = `t_migration_partial_${suffix}`;
const incompatibleSchema = `t_migration_bad_${suffix}`;
const aclSchema = `t_migration_acl_${suffix}`;
const shapeSchema = `t_migration_shape_${suffix}`;
const admin = new Pool({ connectionString: DATABASE_URL, max: 1 });

function roleDatabaseUrl(role: string, schema: string): string {
  const url = new URL(DATABASE_URL);
  url.username = role;
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}

function psql(file: string, schema: string) {
  return spawnSync(
    "psql",
    [
      DATABASE_URL,
      "--no-psqlrc",
      "--set=VERBOSITY=verbose",
      `--set=target_schema=${schema}`,
      `--set=runtime_role=${intakeRole}`,
      `--set=intake_role=${intakeRole}`,
      `--set=mail_role=${mailRole}`,
      `--set=purge_role=${purgeRole}`,
      "--file",
      file,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGOPTIONS: `-c search_path=${schema}` },
      timeout: 30_000,
    },
  );
}

async function waitForCatalogWritersToQuiesce(): Promise<void> {
  let quietSamples = 0;
  for (let attempt = 0; attempt < 150 && quietSamples < 5; attempt += 1) {
    const writers = await admin.query(
      `SELECT count(*)::int AS count
         FROM pg_locks
        WHERE pid <> pg_backend_pid()
          AND relation = ANY(ARRAY[
            'pg_catalog.pg_namespace'::regclass,
            'pg_catalog.pg_class'::regclass,
            'pg_catalog.pg_proc'::regclass,
            'pg_catalog.pg_default_acl'::regclass,
            'pg_catalog.pg_auth_members'::regclass,
            'pg_catalog.pg_authid'::regclass
          ])
          AND mode IN ('RowExclusiveLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')`,
    );
    quietSamples = writers.rows[0].count === 0 ? quietSamples + 1 : 0;
    if (quietSamples < 5) await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(quietSamples).toBe(5);
}

async function runApply(schema: string) {
  // Autovacuum can start after a quiet catalog sample. PostgreSQL aborts a
  // deadlocked transaction atomically; a fresh psql invocation repeats every
  // lock and preflight. Retry only that SQLSTATE, never a rejected pre-state,
  // lock timeout, process timeout, or failed concurrency assertion.
  for (let attempt = 1; ; attempt += 1) {
    await waitForCatalogWritersToQuiesce();
    const result = psql(APPLY, schema);
    if (attempt >= 3 || result.error || result.signal || result.status !== 3 || !/\bERROR:\s+40P01:/.test(result.stderr)) {
      return result;
    }
    console.warn(`Atomic migration test ${schema}: retrying rolled-back PostgreSQL 40P01 (attempt ${attempt}/3)\n${result.stderr}`);
    await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 100 : 250));
  }
}

beforeAll(async () => {
  for (const schema of [emptySchema, partialSchema, incompatibleSchema, aclSchema, shapeSchema]) {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
  }
  await admin.query(`DROP ROLE IF EXISTS ${privilegedRole}`);
  await admin.query(`DROP ROLE IF EXISTS ${attackerRole}`);
  await admin.query(`DROP ROLE IF EXISTS ${intakeRole}, ${mailRole}, ${purgeRole}`);
  for (const role of [intakeRole, mailRole, purgeRole]) {
    await admin.query(
      `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`,
    );
  }
  await admin.query(
    `CREATE ROLE ${attackerRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`,
  );
  await admin.query(`CREATE ROLE ${privilegedRole} NOLOGIN BYPASSRLS`);
  await waitForCatalogWritersToQuiesce();
});

afterAll(async () => {
  for (const schema of [emptySchema, partialSchema, incompatibleSchema, aclSchema, shapeSchema]) {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }
  await admin.query(`DROP ROLE IF EXISTS ${privilegedRole}`);
  await admin.query(`DROP ROLE IF EXISTS ${attackerRole}`);
  await admin.query(`DROP ROLE IF EXISTS ${intakeRole}, ${mailRole}, ${purgeRole}`);
  await admin.end();
});

describe("the immutable 0001 -> 0004 deployment boundary", () => {
  it("runs all four migrations under one ON_ERROR_STOP transaction", () => {
    const sql = read("../db/operations/apply-0001-0004-atomic.sql");
    expect(sql).toMatch(/\\set\s+ON_ERROR_STOP\s+on/i);
    expect(sql).toMatch(/BEGIN\s*;/i);
    expect(sql).toMatch(/COMMIT\s*;/i);
    const includes = [...sql.matchAll(/\\ir\s+[^\n]*?(000[1-4]_[^\s]+)/g)].map((m) => m[1]);
    expect(includes).toEqual([
      "0001_attribution.sql",
      "0002_leads_consents_outbox.sql",
      "0003_data_request_verification.sql",
      "0004_access_boundary.sql",
      "0001_attribution.sql",
      "0002_leads_consents_outbox.sql",
      "0003_data_request_verification.sql",
      "0004_access_boundary.sql",
    ]);
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("0001_attribution.sql"));
    expect(sql.indexOf("0004_access_boundary.sql")).toBeLessThan(sql.indexOf("COMMIT;"));
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/migration_ledger/i);
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("preflight-0001-0004.sql"));
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      sql.indexOf("preflight-0001-0004.sql"),
    );
    expect(sql.indexOf("IN ACCESS EXCLUSIVE MODE")).toBeLessThan(
      sql.indexOf("preflight-0001-0004.sql"),
    );
    expect(sql.indexOf("pg_catalog.pg_proc")).toBeLessThan(
      sql.indexOf("preflight-0001-0004.sql"),
    );
    expect(sql).toMatch(/apply_backend_pid/i);
    expect(sql).toMatch(/apply_transaction_id/i);
  });

  it("makes the public boundary RLS-and-grant complete rather than one-sided", () => {
    const sql = read("../db/migrations/0004_access_boundary.sql");
    for (const table of [
      "attributions",
      "leads",
      "lead_consents",
      "event_outbox",
      "data_requests",
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"));
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`, "i"));
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`, "i"));
    }
    expect(sql).toMatch(/rolsuper/i);
    expect(sql).toMatch(/rolbypassrls/i);
    expect(sql).toMatch(/owner/i);
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES[\s\S]*REVOKE ALL ON TABLES FROM PUBLIC/i);
    expect(sql).toMatch(/REVOKE\s+CREATE\s+ON\s+SCHEMA/i);
    expect(sql).toMatch(/intake_role/i);
    expect(sql).toMatch(/mail_role/i);
    expect(sql).toMatch(/purge_role/i);
    expect(sql).toMatch(/verification_sent_at/i);
    expect(sql).toMatch(/verification_queue_expires_at/i);
    expect(sql).toMatch(/verification_token_key_id/i);
    expect(sql).toMatch(/SET search_path/i);
  });

  it("preflights the runtime role and partial schema before any migration include", () => {
    const sql = read("../db/operations/preflight-0001-0004.sql");
    expect(sql).toMatch(/target_schema/i);
    expect(sql).toMatch(/intake_role/i);
    expect(sql).toMatch(/mail_role/i);
    expect(sql).toMatch(/purge_role/i);
    expect(sql).toMatch(/rolsuper/i);
    expect(sql).toMatch(/rolbypassrls/i);
    expect(sql).toMatch(/pg_auth_members/i);
    expect(sql).toMatch(/relacl|acl/i);
    expect(sql).toMatch(/trigger/i);
    expect(sql).toMatch(/pg_get_constraintdef/i);
    expect(sql).toMatch(/pg_get_indexdef/i);
    expect(sql).toMatch(/pg_get_triggerdef/i);
    expect(sql).toMatch(/pg_get_functiondef/i);
    expect(sql).toMatch(/pg_get_expr/i);
    expect(sql).toMatch(/column_default/i);
    expect(sql).toMatch(/data_type|udt_name/i);
    expect(sql).toMatch(/incompatible/i);
    expect(sql).not.toMatch(/\\ir\s+.*000[1-4]_/i);
  });

  it("rejects a same-name but weakened CHECK definition", async () => {
    const schema = `t_migration_weak_check_${suffix}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    try {
      const migration1 = spawnSync(
        "psql",
        [DATABASE_URL, "--no-psqlrc", "--file", path.resolve(import.meta.dirname, "../db/migrations/0001_attribution.sql")],
        {
          encoding: "utf8",
          env: { ...process.env, PGOPTIONS: `-c search_path=${schema}` },
          timeout: 30_000,
        },
      );
      expect(migration1.status, `${migration1.stdout}\n${migration1.stderr}`).toBe(0);
      await admin.query(
        `ALTER TABLE ${schema}.attributions DROP CONSTRAINT attributions_event_version_check,
         ADD CONSTRAINT attributions_event_version_check CHECK (true)`,
      );
      const result = await runApply(schema);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/constraint.*definition|incompatible.*definition/i);
      expect((await admin.query(
        `SELECT pg_get_constraintdef(oid, true) AS definition
           FROM pg_constraint
          WHERE conrelid = $1::regclass AND conname = 'attributions_event_version_check'`,
        [`${schema}.attributions`],
      )).rows[0].definition).toBe("CHECK (true)");
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  });

  it("rejects same-name FK, index, trigger and function semantic drift", async () => {
    const cases: Array<{
      name: string;
      migrations: string[];
      mutate: (schema: string) => Promise<void>;
      reason: RegExp;
    }> = [
      {
        name: "index",
        migrations: ["0001_attribution.sql"],
        mutate: async (schema) => {
          await admin.query(`DROP INDEX ${schema}.attributions_product_idx`);
          await admin.query(`CREATE INDEX attributions_product_idx ON ${schema}.attributions (created_at)`);
        },
        reason: /index definition/i,
      },
      {
        name: "foreign_key",
        migrations: ["0001_attribution.sql", "0002_leads_consents_outbox.sql"],
        mutate: async (schema) => {
          await admin.query(`ALTER TABLE ${schema}.lead_consents DROP CONSTRAINT lead_consents_lead_id_fkey`);
          await admin.query(`ALTER TABLE ${schema}.lead_consents ADD CONSTRAINT lead_consents_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES ${schema}.attributions(id) ON DELETE CASCADE`);
        },
        reason: /constraint definition/i,
      },
      {
        name: "trigger",
        migrations: ["0001_attribution.sql", "0002_leads_consents_outbox.sql"],
        mutate: async (schema) => {
          await admin.query(`DROP TRIGGER leads_set_retention ON ${schema}.leads`);
          await admin.query(`CREATE TRIGGER leads_set_retention AFTER INSERT ON ${schema}.leads FOR EACH ROW EXECUTE FUNCTION ${schema}.set_lead_retention()`);
        },
        reason: /trigger definition/i,
      },
      {
        name: "function",
        migrations: ["0001_attribution.sql", "0002_leads_consents_outbox.sql"],
        mutate: async (schema) => {
          await admin.query(`CREATE OR REPLACE FUNCTION ${schema}.set_lead_retention() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN NEW.retention_until := NEW.created_at + interval ''1 day''; RETURN NEW; END'`);
        },
        reason: /function definition/i,
      },
    ];

    for (const [index, fixture] of cases.entries()) {
      const schema = `t_migration_semantic_${index}_${suffix}`;
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`CREATE SCHEMA ${schema}`);
      try {
        for (const migration of fixture.migrations) {
          const seeded = spawnSync(
            "psql",
            [DATABASE_URL, "--no-psqlrc", "--file", path.resolve(import.meta.dirname, `../db/migrations/${migration}`)],
            { encoding: "utf8", env: { ...process.env, PGOPTIONS: `-c search_path=${schema}` }, timeout: 30_000 },
          );
          expect(seeded.status, `${fixture.name}: ${seeded.stdout}\n${seeded.stderr}`).toBe(0);
        }
        await fixture.mutate(schema);
        const rejected = await runApply(schema);
        expect(rejected.status, fixture.name).not.toBe(0);
        expect(rejected.stderr).toMatch(fixture.reason);
      } finally {
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      }
    }
  });

  it("is idempotent only for an exact final state and rejects weakened policy before repair", async () => {
    const schema = `t_migration_final_${suffix}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    try {
      const first = await runApply(schema);
      expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
      const second = await runApply(schema);
      expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);

      await admin.query(
        `ALTER POLICY yulalab_intake_access ON ${schema}.data_requests USING (false) WITH CHECK (false)`,
      );
      const rejected = await runApply(schema);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toMatch(/policy definition/i);
      const definition = await admin.query(
        `SELECT pg_get_expr(polqual, polrelid, true) AS using_expression
           FROM pg_policy
          WHERE polrelid = $1::regclass AND polname = 'yulalab_intake_access'`,
        [`${schema}.data_requests`],
      );
      expect(definition.rows[0].using_expression).toBe("false");

      await admin.query(
        `ALTER POLICY yulalab_intake_access ON ${schema}.data_requests USING (true) WITH CHECK (true)`,
      );
      const repaired = await runApply(schema);
      expect(repaired.status, `${repaired.stdout}\n${repaired.stderr}`).toBe(0);

      await admin.query(`GRANT CREATE ON SCHEMA ${schema} TO ${attackerRole}`);
      const schemaAcl = await runApply(schema);
      expect(schemaAcl.status).not.toBe(0);
      expect(schemaAcl.stderr).toMatch(/schema.*ACL.*final state/i);
      await admin.query(`REVOKE CREATE ON SCHEMA ${schema} FROM ${attackerRole}`);

      await admin.query(`GRANT SELECT (email) ON ${schema}.data_requests TO ${attackerRole}`);
      const columnAcl = await runApply(schema);
      expect(columnAcl.status).not.toBe(0);
      expect(columnAcl.stderr).toMatch(/column ACL definition/i);
      await admin.query(`REVOKE SELECT (email) ON ${schema}.data_requests FROM ${attackerRole}`);

      await admin.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${attackerRole}`,
      );
      const defaultAcl = await runApply(schema);
      expect(defaultAcl.status).not.toBe(0);
      expect(defaultAcl.stderr).toMatch(/default privilege final state/i);
      await admin.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE SELECT ON TABLES FROM ${attackerRole}`,
      );

      await admin.query(
        `INSERT INTO ${schema}.yulalab_migration_ledger (migration_id, prestate)
         VALUES ('unexpected', '{}'::jsonb)`,
      );
      const ledger = await runApply(schema);
      expect(ledger.status).not.toBe(0);
      expect(ledger.stderr).toMatch(/migration ledger state/i);
      await admin.query(
        `DELETE FROM ${schema}.yulalab_migration_ledger WHERE migration_id = 'unexpected'`,
      );
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  });

  it("rejects migration-ledger definition, access-boundary, and immutable-prestate drift", async () => {
    const schema = `t_migration_ledger_${suffix}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    try {
      const seeded = await runApply(schema);
      expect(seeded.status, `${seeded.stdout}\n${seeded.stderr}`).toBe(0);

      const cases = [
        {
          name: "shape",
          mutate: `ALTER TABLE ${schema}.yulalab_migration_ledger ADD COLUMN injected text`,
          restore: `ALTER TABLE ${schema}.yulalab_migration_ledger DROP COLUMN injected`,
          reason: /migration ledger definition/i,
        },
        {
          name: "ACL",
          mutate: `GRANT SELECT ON ${schema}.yulalab_migration_ledger TO ${attackerRole}`,
          restore: `REVOKE SELECT ON ${schema}.yulalab_migration_ledger FROM ${attackerRole}`,
          reason: /migration ledger.*ACL/i,
        },
        {
          name: "RLS",
          mutate: `ALTER TABLE ${schema}.yulalab_migration_ledger ENABLE ROW LEVEL SECURITY`,
          restore: `ALTER TABLE ${schema}.yulalab_migration_ledger DISABLE ROW LEVEL SECURITY`,
          reason: /migration ledger.*RLS/i,
        },
        {
          name: "prestate",
          mutate: `UPDATE ${schema}.yulalab_migration_ledger
                     SET prestate = jsonb_set(prestate, '{migration_level}', '3'::jsonb)`,
          restore: `UPDATE ${schema}.yulalab_migration_ledger
                      SET prestate = jsonb_set(prestate, '{migration_level}', '0'::jsonb)`,
          reason: /migration ledger.*prestate/i,
        },
      ];

      for (const fixture of cases) {
        await admin.query(fixture.mutate);
        const rejected = await runApply(schema);
        expect(rejected.status, `${fixture.name}: ${rejected.stdout}\n${rejected.stderr}`).not.toBe(0);
        expect(rejected.stderr).toMatch(fixture.reason);
        await admin.query(fixture.restore);
      }
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  });

  it("applies the ordered chain to an empty schema and enforces runtime-vs-attacker RLS", async () => {
    const publicAclBefore = (await admin.query(
      "SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname = 'public'",
    )).rows[0].acl;
    const result = await runApply(emptySchema);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const hardened = await admin.query<{ relname: string; rls: boolean; forced: boolean }>(
      `SELECT relname, relrowsecurity AS rls, relforcerowsecurity AS forced
         FROM pg_class
        WHERE relnamespace = $1::regnamespace
          AND relname = ANY($2::text[])
        ORDER BY relname`,
      [emptySchema, ["attributions", "data_requests", "event_outbox", "lead_consents", "leads"]],
    );
    expect(hardened.rows).toHaveLength(5);
    expect(hardened.rows.every((row) => row.rls && row.forced)).toBe(true);
    expect((await admin.query(
      "SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname = 'public'",
    )).rows[0].acl).toBe(publicAclBefore);

    await admin.query(`GRANT USAGE ON SCHEMA ${emptySchema} TO ${attackerRole}`);
    const roleClient = await admin.connect();
    try {
      await roleClient.query(`SET search_path TO ${emptySchema}`);
      await roleClient.query(`SET ROLE ${intakeRole}`);
      await roleClient.query(
      `INSERT INTO ${emptySchema}.data_requests
         (email, request_type, verification_token_hash, verification_token_key_id, verification_queue_expires_at, purge_at)
       VALUES ('intake@example.com', 'delete', repeat('a', 64), 'current', now()+interval '30 days', now()+interval '30 days')`,
      );
      expect((await roleClient.query(`SELECT count(*)::int AS n FROM ${emptySchema}.leads`)).rows[0].n).toBe(0);
      await expect(roleClient.query(`DELETE FROM ${emptySchema}.leads`)).rejects.toThrow();
      await roleClient.query("RESET ROLE");

      await roleClient.query(`SET ROLE ${mailRole}`);
      expect((await roleClient.query(`SELECT count(*)::int AS n FROM ${emptySchema}.data_requests`)).rows[0].n).toBe(1);
      await expect(
      roleClient.query(
        `INSERT INTO ${emptySchema}.data_requests
           (email, request_type, verification_token_hash, verification_token_key_id, verification_queue_expires_at, purge_at)
         VALUES ('mail@example.com', 'delete', repeat('b', 64), 'current', now()+interval '30 days', now()+interval '30 days')`,
      ),
    ).rejects.toThrow();
      await roleClient.query("RESET ROLE");

      await roleClient.query(`SET ROLE ${purgeRole}`);
      expect((await roleClient.query(`DELETE FROM ${emptySchema}.data_requests RETURNING id`)).rowCount).toBe(1);
      await expect(
      roleClient.query(
        `INSERT INTO ${emptySchema}.data_requests
           (email, request_type, verification_token_hash, verification_token_key_id, verification_queue_expires_at, purge_at)
         VALUES ('purge@example.com', 'delete', repeat('c', 64), 'current', now()+interval '30 days', now()+interval '30 days')`,
      ),
    ).rejects.toThrow();
      await roleClient.query("RESET ROLE");

      await roleClient.query(`SET ROLE ${attackerRole}`);
      await expect(roleClient.query(`SELECT count(*)::int AS n FROM ${emptySchema}.data_requests`)).rejects.toThrow();
      await expect(roleClient.query(`CREATE TABLE ${emptySchema}.injected(id int)`)).rejects.toThrow();
      await roleClient.query("RESET ROLE");
    } finally {
      await roleClient.query("RESET ROLE").catch(() => undefined);
      roleClient.release();
    }

    const expectedPrivileges: Record<string, Record<string, string[]>> = {
      [intakeRole]: {
        attributions: ["SELECT", "INSERT"], leads: ["SELECT", "INSERT", "UPDATE"],
        lead_consents: ["SELECT", "INSERT"], event_outbox: ["SELECT", "INSERT"],
        data_requests: ["SELECT", "INSERT", "UPDATE"],
      },
      [mailRole]: {
        attributions: [], leads: ["SELECT"], lead_consents: ["SELECT"],
        event_outbox: ["SELECT", "DELETE"], data_requests: ["SELECT"],
      },
      [purgeRole]: {
        attributions: ["SELECT", "DELETE"], leads: ["SELECT", "DELETE"],
        lead_consents: ["SELECT", "DELETE"], event_outbox: ["SELECT", "DELETE"],
        data_requests: ["SELECT", "UPDATE", "DELETE"],
      },
    };
    for (const role of [intakeRole, mailRole, purgeRole]) {
      const login = new Pool({ connectionString: roleDatabaseUrl(role, emptySchema), max: 1 });
      try {
        const identity = await login.query("SELECT current_user, current_schema() AS current_schema");
        expect(identity.rows[0]).toEqual({ current_user: role, current_schema: emptySchema });
        for (const table of ["attributions", "leads", "lead_consents", "event_outbox", "data_requests"]) {
          for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
            const result = await login.query(
              "SELECT has_table_privilege(current_user, $1, $2) AS allowed",
              [`${emptySchema}.${table}`, privilege],
            );
            expect(result.rows[0].allowed, `${role} ${table} ${privilege}`).toBe(
              expectedPrivileges[role][table].includes(privilege),
            );
          }
        }
      } finally {
        await login.end();
      }
    }

    const mailLogin = new Pool({ connectionString: roleDatabaseUrl(mailRole, emptySchema), max: 1 });
    try {
      for (const column of ["attempts", "delivered_at", "purge_at"]) {
        expect((await mailLogin.query(
          "SELECT has_column_privilege(current_user, $1, $2, 'UPDATE') AS allowed",
          [`${emptySchema}.event_outbox`, column],
        )).rows[0].allowed, `mail event_outbox.${column} UPDATE`).toBe(true);
      }
      for (const column of ["verification_state", "verification_token_hash", "verification_sent_at", "verification_expires_at", "purge_at"]) {
        expect((await mailLogin.query(
          "SELECT has_column_privilege(current_user, $1, $2, 'UPDATE') AS allowed",
          [`${emptySchema}.data_requests`, column],
        )).rows[0].allowed, `mail data_requests.${column} UPDATE`).toBe(true);
      }
      for (const column of ["id", "event_type", "aggregate_id", "payload_json", "created_at"]) {
        expect((await mailLogin.query(
          "SELECT has_column_privilege(current_user, $1, $2, 'UPDATE') AS allowed",
          [`${emptySchema}.event_outbox`, column],
        )).rows[0].allowed, `mail event_outbox.${column} UPDATE`).toBe(false);
      }
      for (const column of ["id", "email", "request_type", "created_at", "completed_at", "verification_token_key_id", "verification_queue_expires_at"]) {
        expect((await mailLogin.query(
          "SELECT has_column_privilege(current_user, $1, $2, 'UPDATE') AS allowed",
          [`${emptySchema}.data_requests`, column],
        )).rows[0].allowed, `mail data_requests.${column} UPDATE`).toBe(false);
      }

      const pendingRequest = (await admin.query(
        `INSERT INTO ${emptySchema}.data_requests
           (email, request_type, verification_token_hash, verification_token_key_id,
            verification_queue_expires_at, purge_at)
         VALUES ('mail-boundary@example.com', 'access', repeat('e', 64), 'current',
                 now() + interval '30 days', now() + interval '30 days')
         RETURNING id`,
      )).rows[0].id;
      await expect(mailLogin.query(
        `UPDATE ${emptySchema}.data_requests
            SET verification_state = 'verified', verification_token_hash = NULL
          WHERE id = $1`,
        [pendingRequest],
      )).rejects.toMatchObject({ code: "42501" });
      expect((await admin.query(
        `SELECT verification_state, verification_token_hash
           FROM ${emptySchema}.data_requests WHERE id = $1`,
        [pendingRequest],
      )).rows[0]).toEqual({ verification_state: "pending", verification_token_hash: "e".repeat(64) });
      const pendingOutbox = (await admin.query(
        `INSERT INTO ${emptySchema}.event_outbox (event_type, aggregate_id, payload_json)
         VALUES ('data_request_verification', $1, '{"requestType":"access"}'::jsonb)
         RETURNING id`,
        [pendingRequest],
      )).rows[0].id;
      expect((await mailLogin.query(
        `DELETE FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [pendingOutbox],
      )).rowCount).toBe(0);

      const acceptedLead = (await admin.query(
        `INSERT INTO ${emptySchema}.leads
           (name, email, intent, message, locale, dedupe_key)
         VALUES ('Accepted Studio', 'accepted-studio@example.com', 'studio',
                 'Qualified by the server', 'en', repeat('d', 64))
         RETURNING id`,
      )).rows[0].id;
      const metric = (await admin.query(
        `INSERT INTO ${emptySchema}.event_outbox (event_type, aggregate_id, payload_json)
         VALUES ('lead_internal_route', $1, '{"route":"studio-qualified","intent":"studio"}'::jsonb)
         RETURNING id, event_type, aggregate_id, payload_json, created_at`,
        [acceptedLead],
      )).rows[0];

      const forbiddenMutations = [
        ["event_type", "'lead_receipt'"],
        ["aggregate_id", "gen_random_uuid()"],
        ["payload_json", "'{\"route\":\"studio-unqualified\"}'::jsonb"],
        ["created_at", "created_at + interval '1 second'"],
      ] as const;
      for (const [column, expression] of forbiddenMutations) {
        await expect(
          mailLogin.query(
            `UPDATE ${emptySchema}.event_outbox SET ${column} = ${expression} WHERE id = $1`,
            [metric.id],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      }
      expect((await mailLogin.query(
        `DELETE FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [metric.id],
      )).rowCount).toBe(0);
      expect((await admin.query(
        `SELECT event_type, aggregate_id, payload_json, created_at
           FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [metric.id],
      )).rows[0]).toEqual({
        event_type: metric.event_type,
        aggregate_id: metric.aggregate_id,
        payload_json: metric.payload_json,
        created_at: metric.created_at,
      });

      const orphanLead = (await admin.query(
        `INSERT INTO ${emptySchema}.leads
           (name, email, intent, message, locale, dedupe_key)
         VALUES ('Deleted Lead', 'deleted-lead@example.com', 'press',
                 'Delete me', 'en', repeat('c', 64))
         RETURNING id`,
      )).rows[0].id;
      const orphanOutbox = (await admin.query(
        `INSERT INTO ${emptySchema}.event_outbox (event_type, aggregate_id, payload_json)
         VALUES ('lead_internal_route', $1, '{"route":"studio","intent":"press"}'::jsonb)
         RETURNING id`,
        [orphanLead],
      )).rows[0].id;
      expect((await mailLogin.query(
        `DELETE FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [orphanOutbox],
      )).rowCount).toBe(0);
      await admin.query(`DELETE FROM ${emptySchema}.leads WHERE id = $1`, [orphanLead]);
      expect((await mailLogin.query(
        `DELETE FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [orphanOutbox],
      )).rowCount).toBe(1);

      const expiredRequest = (await admin.query(
        `INSERT INTO ${emptySchema}.data_requests
           (email, request_type, verification_state, verification_token_hash,
            verification_token_key_id, verification_queue_expires_at, purge_at)
         VALUES ('expired-request@example.com', 'delete', 'expired', NULL,
                 NULL, NULL, now() + interval '30 days')
         RETURNING id`,
      )).rows[0].id;
      const expiredOutbox = (await admin.query(
        `INSERT INTO ${emptySchema}.event_outbox (event_type, aggregate_id, payload_json)
         VALUES ('data_request_verification', $1, '{"requestType":"delete"}'::jsonb)
         RETURNING id`,
        [expiredRequest],
      )).rows[0].id;
      expect((await mailLogin.query(
        `DELETE FROM ${emptySchema}.event_outbox WHERE id = $1`,
        [expiredOutbox],
      )).rowCount).toBe(1);
    } finally {
      await mailLogin.end();
    }
  });

  it("blocks every relevant non-cooperating DDL surface in the real apply runner", async () => {
    const schema = `t_migration_lock_${suffix}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const seeded = await runApply(schema);
    expect(seeded.status, `${seeded.stdout}\n${seeded.stderr}`).toBe(0);

    const definitions = async () => (await admin.query(
      `SELECT jsonb_build_object(
         'constraints', (SELECT jsonb_agg(pg_get_constraintdef(oid, true) ORDER BY conname)
           FROM pg_constraint WHERE connamespace = $1::regnamespace),
         'indexes', (SELECT jsonb_agg(pg_get_indexdef(indexrelid, 0, true) ORDER BY indexrelid::regclass::text)
           FROM pg_index JOIN pg_class ON pg_class.oid = indrelid WHERE relnamespace = $1::regnamespace),
         'triggers', (SELECT jsonb_agg(pg_get_triggerdef(trigger.oid, true) ORDER BY tgname)
           FROM pg_trigger trigger JOIN pg_class ON pg_class.oid = tgrelid
          WHERE relnamespace = $1::regnamespace AND NOT tgisinternal),
         'functions', (SELECT jsonb_agg(pg_get_functiondef(oid) ORDER BY oid::regprocedure::text)
           FROM pg_proc WHERE pronamespace = $1::regnamespace),
         'policies', (SELECT jsonb_agg(
             row(policy_namespace.nspname, policy_table.relname, policy.polname, policy.polcmd,
                 policy.polroles, pg_get_expr(policy.polqual, policy.polrelid, true),
                 pg_get_expr(policy.polwithcheck, policy.polrelid, true))
             ORDER BY policy_namespace.nspname, policy_table.relname, policy.polname,
                      policy.polcmd, policy.polroles::text)
           FROM pg_policy policy
           JOIN pg_class policy_table ON policy_table.oid = policy.polrelid
           JOIN pg_namespace policy_namespace ON policy_namespace.oid = policy_table.relnamespace
          WHERE policy_table.relnamespace = $1::regnamespace)
       ) AS definitions`,
      [schema],
    )).rows[0].definitions;
    const before = await definitions();

    // Vitest starts the real-DB suites in parallel. Wait for their setup DDL
    // to finish before this test deliberately takes the cluster-wide catalog
    // maintenance locks; otherwise two unrelated setup transactions can hold
    // opposite catalog locks and manufacture a harness deadlock. Five quiet
    // samples reserve no product behavior and change no worker/timeout setting.
    await waitForCatalogWritersToQuiesce();

    const appName = `yula_apply_lock_${suffix}`;
    const args = [
      DATABASE_URL,
      "--no-psqlrc",
      `--set=target_schema=${schema}`,
      `--set=runtime_role=${intakeRole}`,
      `--set=intake_role=${intakeRole}`,
      `--set=mail_role=${mailRole}`,
      `--set=purge_role=${purgeRole}`,
      "--set=preflight_test_hold_seconds=1",
      "--file",
      APPLY,
    ];
    const child = spawn("psql", args, {
      env: { ...process.env, PGAPPNAME: appName, PGOPTIONS: `-c search_path=${schema}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    const completed = new Promise<number | null>((resolve) => child.once("close", resolve));
    const contenders = new Pool({ connectionString: DATABASE_URL, max: 10 });
    try {
      let paused: { pid: number; txid: string } | undefined;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await admin.query(
          `SELECT pid, backend_xid::text AS txid FROM pg_stat_activity
            WHERE application_name = $1 AND state = 'active' AND query LIKE 'SELECT pg_sleep%'`,
          [appName],
        );
        if (activity.rowCount) {
          paused = { pid: activity.rows[0].pid, txid: activity.rows[0].txid };
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(paused, `apply never reached locked preflight pause\n${stdout}\n${stderr}`).toBeDefined();

      const ddl = [
        `CREATE TABLE ${schema}.injected(id int)`,
        `CREATE FUNCTION ${schema}.injected_function() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${attackerRole}`,
        `GRANT ${attackerRole} TO ${intakeRole}`,
        `GRANT ${intakeRole} TO ${attackerRole}`,
        `ALTER ROLE ${intakeRole} BYPASSRLS`,
        `ALTER ROLE ${mailRole} SUPERUSER`,
        `ALTER ROLE ${purgeRole} INHERIT`,
        `ALTER TABLE ${schema}.attributions DROP CONSTRAINT attributions_event_version_check`,
        `DROP INDEX ${schema}.attributions_product_idx`,
        `DROP TRIGGER leads_set_retention ON ${schema}.leads`,
        `CREATE OR REPLACE FUNCTION ${schema}.set_lead_retention() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'`,
        `ALTER POLICY yulalab_intake_access ON ${schema}.data_requests USING (false)`,
      ];
      const attempts = await Promise.all(ddl.map(async (statement) => {
        try {
          await contenders.query(`SET lock_timeout = '150ms'; ${statement}`);
          return { blocked: false, code: undefined };
        } catch (error) {
          return { blocked: true, code: (error as { code?: string }).code };
        }
      }));
      expect(attempts).toEqual(ddl.map(() => ({ blocked: true, code: "55P03" })));

      expect(await completed, `${stdout}\n${stderr}`).toBe(0);
      const probe = stdout.match(/YULA_APPLY_PROBE pid=(\d+) txid=(\d+)/);
      expect(probe).not.toBeNull();
      expect({ pid: Number(probe?.[1]), txid: probe?.[2] }).toEqual(paused);
      expect((await admin.query(
        `SELECT to_regclass($1) AS injected,
                to_regprocedure($2) AS injected_function,
                pg_has_role($3, $4, 'MEMBER') AS inherited,
                pg_has_role($4, $3, 'MEMBER') AS external_member,
                (SELECT row(rolsuper, rolbypassrls, rolinherit)::text FROM pg_roles WHERE rolname = $3) AS intake_flags,
                (SELECT row(rolsuper, rolbypassrls, rolinherit)::text FROM pg_roles WHERE rolname = $5) AS mail_flags,
                (SELECT row(rolsuper, rolbypassrls, rolinherit)::text FROM pg_roles WHERE rolname = $6) AS purge_flags`,
        [`${schema}.injected`, `${schema}.injected_function()`, intakeRole, attackerRole, mailRole, purgeRole],
      )).rows[0]).toEqual({
        injected: null,
        injected_function: null,
        inherited: false,
        external_member: false,
        intake_flags: "(f,f,f)",
        mail_flags: "(f,f,f)",
        purge_flags: "(f,f,f)",
      });
      expect(await definitions()).toEqual(before);

      await admin.query(`CREATE TABLE ${schema}.injected(id int)`);
      await admin.query(`DROP TABLE ${schema}.injected`);
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await completed.catch(() => undefined);
      await contenders.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  });

  it("rejects a runtime role with any reachable BYPASSRLS membership", async () => {
    await admin.query(`GRANT ${privilegedRole} TO ${intakeRole}`);
    const rejected = await runApply(incompatibleSchema);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toMatch(/membership|bypassrls|privileged/i);
    await admin.query(`REVOKE ${privilegedRole} FROM ${intakeRole}`);
  });

  it("rejects granting an application role to an external member", async () => {
    const schema = `t_migration_inbound_membership_${suffix}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`GRANT ${intakeRole} TO ${attackerRole}`);
    try {
      const rejected = await runApply(schema);
      expect(rejected.status, `${rejected.stdout}\n${rejected.stderr}`).not.toBe(0);
      expect(rejected.stderr).toMatch(/membership|external member|role edge/i);
    } finally {
      await admin.query(`REVOKE ${intakeRole} FROM ${attackerRole}`);
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  });

  it("accepts a compatible 0001+0002 partial state and completes 0003+0004", async () => {
    for (const migration of ["0001_attribution.sql", "0002_leads_consents_outbox.sql"]) {
      const result = spawnSync(
        "psql",
        [DATABASE_URL, "--no-psqlrc", "--file", path.resolve(import.meta.dirname, `../db/migrations/${migration}`)],
        { encoding: "utf8", env: { ...process.env, PGOPTIONS: `-c search_path=${partialSchema}` } },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
    const completed = await runApply(partialSchema);
    expect(completed.status, `${completed.stdout}\n${completed.stderr}`).toBe(0);
  });

  it("rejects an incompatible partial verification shape before applying", async () => {
    await admin.query(
      `CREATE TABLE ${incompatibleSchema}.data_requests (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         verification_token_hash text
       )`,
    );
    const result = await runApply(incompatibleSchema);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/incompatible data_requests pre-state/i);
    const columns = await admin.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'data_requests'
        ORDER BY column_name`,
      [incompatibleSchema],
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(["id", "verification_token_hash"]);
  });

  it("rejects unexpected default privileges and shape drift before mutation", async () => {
    await admin.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${aclSchema} GRANT SELECT ON TABLES TO ${attackerRole}`,
    );
    const aclResult = await runApply(aclSchema);
    expect(aclResult.status).not.toBe(0);
    expect(aclResult.stderr).toMatch(/default privilege pre-state/i);

    const migration1 = spawnSync(
      "psql",
      [DATABASE_URL, "--no-psqlrc", "--file", path.resolve(import.meta.dirname, "../db/migrations/0001_attribution.sql")],
      { encoding: "utf8", env: { ...process.env, PGOPTIONS: `-c search_path=${shapeSchema}` } },
    );
    expect(migration1.status, `${migration1.stdout}\n${migration1.stderr}`).toBe(0);
    await admin.query(`ALTER TABLE ${shapeSchema}.attributions ADD COLUMN unexpected text`);
    const shapeResult = await runApply(shapeSchema);
    expect(shapeResult.status).not.toBe(0);
    expect(shapeResult.stderr).toMatch(/columns\/types\/nullability\/column_default/i);
  });
});
