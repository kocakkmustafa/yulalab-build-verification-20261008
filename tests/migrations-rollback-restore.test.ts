import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const rollback = readFileSync(
  path.resolve(import.meta.dirname, "../db/operations/rollback-0001-0004-empty.sql"),
  "utf8",
);
const migration0005 = readFileSync(
  path.resolve(import.meta.dirname, "../db/migrations/0005_studio_acceptance_metric.sql"),
  "utf8",
);
const DATABASE_URL = process.env.ATTRIBUTION_TEST_DATABASE_URL ?? "postgres://localhost:5432/yula_attribution_test";
const APPLY = path.resolve(import.meta.dirname, "../db/operations/apply-0001-0004-atomic.sql");
const ROLLBACK = path.resolve(import.meta.dirname, "../db/operations/rollback-0001-0004-empty.sql");
const suffix = `${process.pid}`;
const intakeRole = `yula_rollback_intake_${suffix}`;
const mailRole = `yula_rollback_mail_${suffix}`;
const purgeRole = `yula_rollback_purge_${suffix}`;
const schema = `t_migration_rollback_${suffix}`;
const admin = new Pool({ connectionString: DATABASE_URL, max: 1 });
let schemaAclBefore: Array<{ grantee: string; privilege_type: string }>;
let defaultAclBefore: Array<{ defaclobjtype: string; defaclacl: string }>;
let rawSchemaAclBefore: string | null;

function psql(file: string, targetSchema: string = schema) {
  return spawnSync(
    "psql",
    [
      DATABASE_URL,
      "--no-psqlrc",
      `--set=target_schema=${targetSchema}`,
      `--set=runtime_role=${intakeRole}`,
      `--set=intake_role=${intakeRole}`,
      `--set=mail_role=${mailRole}`,
      `--set=purge_role=${purgeRole}`,
      "--file",
      file,
    ],
    { encoding: "utf8", env: { ...process.env, PGOPTIONS: `-c search_path=${targetSchema}` } },
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

async function runApply(targetSchema: string = schema) {
  await waitForCatalogWritersToQuiesce();
  return psql(APPLY, targetSchema);
}

async function canonicalFingerprint(targetSchema: string): Promise<unknown> {
  return (await admin.query(
    `SELECT jsonb_build_object(
      'schema_acl', namespace.nspacl,
      'tables', (SELECT jsonb_agg(row(class.relname, class.relacl, class.relrowsecurity,
                                      class.relforcerowsecurity) ORDER BY class.relname)
        FROM pg_class class WHERE class.relnamespace = namespace.oid AND class.relkind = 'r'),
      'columns', (SELECT jsonb_agg(row(table_name, column_name, udt_name, is_nullable, column_default)
                                   ORDER BY table_name, ordinal_position)
        FROM information_schema.columns WHERE table_schema = namespace.nspname),
      'constraints', (SELECT jsonb_agg(row(class.relname, constraint_meta.conname,
                                            pg_get_constraintdef(constraint_meta.oid, true))
                                       ORDER BY class.relname, constraint_meta.conname)
        FROM pg_constraint constraint_meta JOIN pg_class class ON class.oid = constraint_meta.conrelid
       WHERE constraint_meta.connamespace = namespace.oid),
      'indexes', (SELECT jsonb_agg(pg_get_indexdef(index_meta.indexrelid, 0, true)
                                   ORDER BY index_meta.indexrelid::regclass::text)
        FROM pg_index index_meta JOIN pg_class class ON class.oid = index_meta.indrelid
       WHERE class.relnamespace = namespace.oid),
      'triggers', (SELECT jsonb_agg(pg_get_triggerdef(trigger_meta.oid, true) ORDER BY trigger_meta.tgname)
        FROM pg_trigger trigger_meta JOIN pg_class class ON class.oid = trigger_meta.tgrelid
       WHERE class.relnamespace = namespace.oid AND NOT trigger_meta.tgisinternal),
      'functions', (SELECT jsonb_agg(pg_get_functiondef(proc.oid) ORDER BY proc.oid::regprocedure::text)
        FROM pg_proc proc WHERE proc.pronamespace = namespace.oid),
      'policies', (SELECT jsonb_agg(row(class.relname, policy.polname, policy.polcmd,
                                         policy.polroles, pg_get_expr(policy.polqual, policy.polrelid, true),
                                         pg_get_expr(policy.polwithcheck, policy.polrelid, true))
                                      ORDER BY class.relname, policy.polname, policy.polcmd,
                                               policy.polroles::text)
        FROM pg_policy policy JOIN pg_class class ON class.oid = policy.polrelid
       WHERE class.relnamespace = namespace.oid),
      'default_acl', (SELECT jsonb_agg(to_jsonb(defaults) ORDER BY defaults.defaclobjtype)
        FROM pg_default_acl defaults WHERE defaults.defaclnamespace = namespace.oid)
    ) AS fingerprint
    FROM pg_namespace namespace WHERE namespace.nspname = $1`,
    [targetSchema],
  )).rows[0].fingerprint;
}

beforeAll(async () => {
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.query(`DROP ROLE IF EXISTS ${intakeRole}, ${mailRole}, ${purgeRole}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const role of [intakeRole, mailRole, purgeRole]) {
    await admin.query(
      `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`,
    );
  }
  schemaAclBefore = (await admin.query(
    `SELECT COALESCE(role_name.rolname, 'PUBLIC') AS grantee, acl.privilege_type
       FROM pg_namespace AS namespace
       CROSS JOIN LATERAL aclexplode(
         COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
       ) AS acl
       LEFT JOIN pg_roles AS role_name ON role_name.oid = acl.grantee
      WHERE namespace.nspname = $1
      ORDER BY grantee, acl.privilege_type`,
    [schema],
  )).rows;
  rawSchemaAclBefore = (await admin.query(
    `SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname = $1`,
    [schema],
  )).rows[0].acl;
  defaultAclBefore = (await admin.query(
    `SELECT defaclobjtype, defaclacl::text
       FROM pg_default_acl
      WHERE defaclnamespace = $1::regnamespace
      ORDER BY defaclobjtype`,
    [schema],
  )).rows;
  const applied = await runApply();
  if (applied.status !== 0) throw new Error(`${applied.stdout}\n${applied.stderr}`);
});

afterAll(async () => {
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.query(`DROP ROLE IF EXISTS ${intakeRole}, ${mailRole}, ${purgeRole}`);
  await admin.end();
});

describe("empty-only rollback", () => {
  it("fails before destructive DDL when any protected row or outbox evidence exists", () => {
    const protectedTables = [
      "attributions",
      "leads",
      "lead_consents",
      "event_outbox",
      "data_requests",
    ];
    for (const table of protectedTables) expect(rollback).toContain(`'${table}'`);
    expect(rollback).toMatch(/SELECT count\(\*\)[\s\S]*row_count/i);
    expect(rollback).toMatch(/RAISE EXCEPTION/i);
    const guard = rollback.search(/RAISE EXCEPTION/i);
    const firstDrop = rollback.search(/DROP (SCHEMA|TABLE|FUNCTION|POLICY)/i);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstDrop).toBeGreaterThan(guard);
  });

  it("is transaction-bounded and never drops any runtime role", () => {
    expect(rollback).toMatch(/\\set\s+ON_ERROR_STOP\s+on/i);
    expect(rollback).toMatch(/BEGIN\s*;/i);
    expect(rollback).toMatch(/COMMIT\s*;/i);
    expect(rollback).not.toMatch(/DROP ROLE/i);
  });

  it("refuses a 0005 deployment before destructive DDL and preserves every object", async () => {
    const newerSchema = `${schema}_v5`;
    await admin.query(`DROP SCHEMA IF EXISTS ${newerSchema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${newerSchema}`);
    try {
      const applied = await runApply(newerSchema);
      expect(applied.status, `${applied.stdout}\n${applied.stderr}`).toBe(0);
      await admin.query(`SET search_path TO ${newerSchema}`);
      await admin.query(migration0005);
      const before = await canonicalFingerprint(newerSchema);

      const rejected = psql(ROLLBACK, newerSchema);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toMatch(/version mismatch.*0005/i);
      expect(await canonicalFingerprint(newerSchema)).toEqual(before);
      expect((await admin.query(
        `SELECT count(*)::int AS n FROM pg_proc
          WHERE pronamespace = $1::regnamespace
            AND proname = 'enforce_studio_qualified_route'`,
        [newerSchema],
      )).rows[0].n).toBe(1);
      expect((await admin.query(
        `SELECT count(*)::int AS n FROM pg_trigger trigger_meta
          JOIN pg_class table_meta ON table_meta.oid = trigger_meta.tgrelid
         WHERE table_meta.relnamespace = $1::regnamespace
           AND trigger_meta.tgname = 'event_outbox_bind_studio_qualified'
           AND NOT trigger_meta.tgisinternal`,
        [newerSchema],
      )).rows[0].n).toBe(1);
    } finally {
      await admin.query(`SET search_path TO public`);
      await admin.query(`DROP SCHEMA IF EXISTS ${newerSchema} CASCADE`);
    }
  });

  it.each([
    {
      name: "recipient cooldown index",
      install: (target: string) =>
        `CREATE INDEX data_requests_recipient_cooldown_idx
           ON ${target}.data_requests ((lower(btrim(email))), request_type, created_at DESC)`,
    },
    {
      name: "global window index",
      install: (target: string) =>
        `CREATE INDEX data_requests_global_window_idx ON ${target}.data_requests (created_at DESC)`,
    },
    {
      name: "qualified metric index",
      install: (target: string) =>
        `CREATE UNIQUE INDEX event_outbox_studio_qualified_once
           ON ${target}.event_outbox (aggregate_id)
         WHERE event_type = 'lead_internal_route'
           AND payload_json->>'route' = 'studio-qualified'`,
    },
    {
      name: "qualified-route function",
      install: (target: string) =>
        `CREATE FUNCTION ${target}.enforce_studio_qualified_route() RETURNS trigger
         LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
         AS 'BEGIN RETURN NEW; END'`,
    },
    {
      name: "qualified-route trigger",
      install: (target: string) =>
        `CREATE TRIGGER event_outbox_bind_studio_qualified
         BEFORE INSERT ON ${target}.event_outbox
         FOR EACH ROW EXECUTE FUNCTION ${target}.set_outbox_purge()`,
    },
    {
      name: "Studio attribution constraint",
      install: (target: string) =>
        `ALTER TABLE ${target}.attributions DROP CONSTRAINT attributions_event_name_check;
         ALTER TABLE ${target}.attributions ADD CONSTRAINT attributions_event_name_check
         CHECK (event_name IN (
           'home_primary_cta', 'studio_view', 'studio_application_started',
           'studio_application_submitted', 'support_outbound'
         ));
         COMMENT ON CONSTRAINT attributions_event_name_check ON ${target}.attributions
           IS 'yulalab:migration=0005:studio-acceptance-metric'`,
    },
  ])("refuses a lone 0005 $name marker without changing schema state", async ({ name, install }) => {
    const markerSchema = `${schema}_marker_${name.replace(/[^a-z]+/gi, "_").toLowerCase()}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${markerSchema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${markerSchema}`);
    try {
      const applied = await runApply(markerSchema);
      expect(applied.status, `${applied.stdout}\n${applied.stderr}`).toBe(0);
      await admin.query(install(markerSchema));
      const before = await canonicalFingerprint(markerSchema);

      const rejected = psql(ROLLBACK, markerSchema);
      expect(rejected.status, `${name}: ${rejected.stdout}\n${rejected.stderr}`).not.toBe(0);
      expect(rejected.stderr).toMatch(/version mismatch.*0005/i);
      expect(await canonicalFingerprint(markerSchema)).toEqual(before);
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${markerSchema} CASCADE`);
    }
  });

  it("refuses rollback while an outbox row exists and preserves it", async () => {
    await admin.query(`SET search_path TO ${schema}`);
    await admin.query(
      `INSERT INTO event_outbox (event_type, aggregate_id, payload_json)
       VALUES ('lead_receipt', gen_random_uuid(), '{"receiptId":"test"}'::jsonb)`,
    );
    const rejected = psql(ROLLBACK);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toMatch(/rollback refused: event_outbox/i);
    expect((await admin.query("SELECT 1 FROM event_outbox")).rowCount).toBe(1);
  });

  it("returns an empty disposable deployment to its exact pre-table state", async () => {
    await admin.query(`SET search_path TO ${schema}`);
    await admin.query("DELETE FROM event_outbox");
    const restored = psql(ROLLBACK);
    expect(restored.status, `${restored.stdout}\n${restored.stderr}`).toBe(0);
    const tables = await admin.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = $1
          AND tablename = ANY($2::text[])`,
      [schema, ["attributions", "leads", "lead_consents", "event_outbox", "data_requests"]],
    );
    expect(tables.rowCount).toBe(0);
    const schemaAclAfter = (await admin.query(
      `SELECT COALESCE(role_name.rolname, 'PUBLIC') AS grantee, acl.privilege_type
         FROM pg_namespace AS namespace
         CROSS JOIN LATERAL aclexplode(
           COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
         ) AS acl
         LEFT JOIN pg_roles AS role_name ON role_name.oid = acl.grantee
        WHERE namespace.nspname = $1
        ORDER BY grantee, acl.privilege_type`,
      [schema],
    )).rows;
    const defaultAclAfter = (await admin.query(
      `SELECT defaclobjtype, defaclacl::text
         FROM pg_default_acl
        WHERE defaclnamespace = $1::regnamespace
        ORDER BY defaclobjtype`,
      [schema],
    )).rows;
    expect(schemaAclAfter).toEqual(schemaAclBefore);
    expect((await admin.query(
      `SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname = $1`,
      [schema],
    )).rows[0].acl).toBe(rawSchemaAclBefore);
    expect(defaultAclAfter).toEqual(defaultAclBefore);
    expect((await admin.query(
      `SELECT count(*)::int AS n FROM pg_class
        WHERE relnamespace = $1::regnamespace
          AND relname LIKE 'yulalab_%'`,
      [schema],
    )).rows[0].n).toBe(0);
  });

  it("restores an accepted 0001+0002+0003 partial state without object loss", async () => {
    const partialSchema = `${schema}_partial`;
    await admin.query(`DROP SCHEMA IF EXISTS ${partialSchema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${partialSchema}`);
    try {
      for (const migration of [
        "0001_attribution.sql",
        "0002_leads_consents_outbox.sql",
        "0003_data_request_verification.sql",
      ]) {
        const seeded = spawnSync(
          "psql",
          [DATABASE_URL, "--no-psqlrc", "--file", path.resolve(import.meta.dirname, `../db/migrations/${migration}`)],
          { encoding: "utf8", env: { ...process.env, PGOPTIONS: `-c search_path=${partialSchema}` }, timeout: 30_000 },
        );
        expect(seeded.status, `${seeded.stdout}\n${seeded.stderr}`).toBe(0);
      }
      const before = await canonicalFingerprint(partialSchema);
      const applied = await runApply(partialSchema);
      expect(applied.status, `${applied.stdout}\n${applied.stderr}`).toBe(0);
      const restored = psql(ROLLBACK, partialSchema);
      expect(restored.status, `${restored.stdout}\n${restored.stderr}`).toBe(0);
      expect(await canonicalFingerprint(partialSchema)).toEqual(before);
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${partialSchema} CASCADE`);
    }
  });
});
