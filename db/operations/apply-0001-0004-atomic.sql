\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('search_path', quote_ident(:'target_schema'), true);
SELECT set_config('yulalab.target_schema', :'target_schema', true);
SELECT set_config('yulalab.intake_role', :'intake_role', true);
SELECT set_config('yulalab.mail_role', :'mail_role', true);
SELECT set_config('yulalab.purge_role', :'purge_role', true);
SELECT pg_advisory_xact_lock(hashtextextended('yulalab:0001-0004:' || :'target_schema', 0));
SELECT set_config('yulalab.preflight_lock_held', 'true', true);
SELECT set_config('yulalab.apply_backend_pid', pg_backend_pid()::text, true);
SELECT set_config('yulalab.apply_transaction_id', txid_current()::text, true);

-- A schema tuple lock does not conflict with INSERTs into pg_class/pg_proc.
-- These short, transaction-scoped catalog relation locks are therefore the
-- maintenance boundary for non-cooperating DDL. SHARE ROW EXCLUSIVE conflicts
-- with the ROW EXCLUSIVE mode used by catalog INSERT/UPDATE while still
-- allowing ordinary reads. A managed migration credential that cannot take
-- these locks fails here, before reference creation, validation or migration
-- mutation; advisory locking alone is never presented as equivalent proof.
LOCK TABLE pg_catalog.pg_namespace IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_class IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_default_acl IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_auth_members IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pg_catalog.pg_authid IN SHARE ROW EXCLUSIVE MODE;

-- Target relation and existing catalog-row locks also precede validation.
DO $$
DECLARE
  target_relation text;
BEGIN
  PERFORM 1 FROM pg_catalog.pg_namespace
   WHERE oid = current_setting('yulalab.target_schema')::regnamespace FOR UPDATE;
  PERFORM 1 FROM pg_catalog.pg_proc
   WHERE pronamespace = current_setting('yulalab.target_schema')::regnamespace FOR UPDATE;
  PERFORM 1 FROM pg_catalog.pg_default_acl
   WHERE defaclnamespace IN (0, current_setting('yulalab.target_schema')::regnamespace) FOR UPDATE;
  PERFORM 1 FROM pg_catalog.pg_auth_members
   WHERE member = ANY(ARRAY[
     current_setting('yulalab.intake_role')::regrole,
     current_setting('yulalab.mail_role')::regrole,
     current_setting('yulalab.purge_role')::regrole
   ]) FOR UPDATE;
  FOR target_relation IN
    SELECT class.relname
      FROM pg_class class
     WHERE class.relnamespace = current_setting('yulalab.target_schema')::regnamespace
       AND class.relkind = 'r'
       AND class.relname = ANY(ARRAY[
         'attributions','leads','lead_consents','event_outbox','data_requests','yulalab_migration_ledger'
       ])
     ORDER BY class.relname
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE', current_setting('yulalab.target_schema'), target_relation);
  END LOOP;
END
$$;

-- Test-only observation point: production callers never set this psql
-- variable. It lets the concurrency regression hold the REAL apply runner
-- after every protective lock and before the first validation query.
\if :{?preflight_test_hold_seconds}
SELECT pg_sleep(:'preflight_test_hold_seconds'::double precision);
\endif

-- Build the canonical pre-0004 shape from the immutable migrations in this
-- session's private temporary schema. The preflight compares decompiled
-- catalog definitions, not only object names.
SELECT 'yulalab_reference_' || pg_backend_pid() AS reference_schema
\gset
SELECT format('CREATE SCHEMA %I', :'reference_schema')
\gexec
SELECT set_config('yulalab.reference_schema', :'reference_schema', true);
SELECT
  EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = :'target_schema'::regnamespace AND relname = 'attributions') AS reference_0001,
  EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = :'target_schema'::regnamespace AND relname = 'leads') AS reference_0002,
  EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = :'target_schema'::regnamespace AND relname = 'leads')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = :'target_schema' AND table_name = 'data_requests' AND column_name = 'verification_token_hash') AS reference_0003,
  EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = :'target_schema'::regnamespace AND relname = 'yulalab_migration_ledger') AS reference_0004
\gset
SELECT set_config('search_path', quote_ident(current_setting('yulalab.reference_schema')), true);
\if :reference_0001
  \ir ../migrations/0001_attribution.sql
\endif
\if :reference_0002
  \ir ../migrations/0002_leads_consents_outbox.sql
\endif
\if :reference_0003
  \ir ../migrations/0003_data_request_verification.sql
\endif
\if :reference_0004
  \ir ../migrations/0004_access_boundary.sql
\endif

SELECT set_config('search_path', quote_ident(:'target_schema'), true);
\ir preflight-0001-0004.sql

DO $$
BEGIN
  IF current_setting('yulalab.apply_backend_pid') <> pg_backend_pid()::text
     OR current_setting('yulalab.apply_transaction_id') <> txid_current()::text THEN
    RAISE EXCEPTION 'apply backend/transaction changed after preflight';
  END IF;
END
$$;
\if :{?preflight_test_hold_seconds}
SELECT 'YULA_APPLY_PROBE pid=' || pg_backend_pid() || ' txid=' || txid_current() AS apply_probe;
\endif

\ir ../migrations/0001_attribution.sql
\ir ../migrations/0002_leads_consents_outbox.sql
\ir ../migrations/0003_data_request_verification.sql
\ir ../migrations/0004_access_boundary.sql

-- A cooperating apply/rollback runner cannot cross this transaction lock.
-- Lock the actual relations as well, then let 0004's postflight verify the
-- final policy/effective-privilege state before the ledger commit.
LOCK TABLE attributions, leads, lead_consents, event_outbox, data_requests IN ACCESS EXCLUSIVE MODE;

SELECT format('DROP SCHEMA %I CASCADE', current_setting('yulalab.reference_schema'))
\gexec

INSERT INTO yulalab_migration_ledger (migration_id, prestate)
SELECT '0001-0004-access-boundary-v2', prestate
  FROM pg_temp.yulalab_prestate_snapshot
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
