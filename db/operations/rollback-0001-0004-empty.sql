\set ON_ERROR_STOP on
\if :{?target_schema}
\else
  \echo 'target_schema is required'
  \quit 3
\endif
\if :{?intake_role}
\else
  \echo 'intake_role is required'
  \quit 3
\endif
\if :{?mail_role}
\else
  \echo 'mail_role is required'
  \quit 3
\endif
\if :{?purge_role}
\else
  \echo 'purge_role is required'
  \quit 3
\endif

BEGIN;
SELECT set_config('search_path', quote_ident(:'target_schema'), true);
SELECT set_config('yulalab.target_schema', :'target_schema', true);
SELECT pg_advisory_xact_lock(hashtextextended('yulalab:0001-0004:' || :'target_schema', 0));
SELECT 1 FROM pg_namespace WHERE oid = :'target_schema'::regnamespace FOR UPDATE;
SELECT 1 FROM pg_proc WHERE pronamespace = :'target_schema'::regnamespace FOR UPDATE;
SELECT 1 FROM pg_default_acl WHERE defaclnamespace IN (0, :'target_schema'::regnamespace) FOR UPDATE;
LOCK TABLE attributions, leads, lead_consents, event_outbox, data_requests,
  yulalab_migration_ledger IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    protected_table text;
    row_count bigint;
    object_set text[];
    prestate jsonb;
    owner_name text;
    migration_level integer;
BEGIN
    -- This rollback knows only the 0001-0004 object graph. Refuse as soon as
    -- any uniquely 0005 control is present; destructive rollback must never
    -- erase a newer security boundary merely because its tables are empty.
    IF to_regprocedure(format('%I.enforce_studio_qualified_route()', current_schema())) IS NOT NULL
       OR to_regclass(format('%I.data_requests_recipient_cooldown_idx', current_schema())) IS NOT NULL
       OR to_regclass(format('%I.data_requests_global_window_idx', current_schema())) IS NOT NULL
       OR to_regclass(format('%I.event_outbox_studio_qualified_once', current_schema())) IS NOT NULL
       OR EXISTS (
           SELECT 1
             FROM pg_trigger trigger_row
             JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
            WHERE table_row.relnamespace = current_schema()::regnamespace
              AND trigger_row.tgname = 'event_outbox_bind_studio_qualified'
              AND NOT trigger_row.tgisinternal
       )
       OR EXISTS (
           SELECT 1
             FROM pg_constraint constraint_row
             JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
            WHERE table_row.relnamespace = current_schema()::regnamespace
              AND table_row.relname = 'attributions'
              AND constraint_row.conname = 'attributions_event_name_check'
              AND obj_description(constraint_row.oid, 'pg_constraint') =
                  'yulalab:migration=0005:studio-acceptance-metric'
       ) THEN
        RAISE EXCEPTION 'rollback refused: version mismatch; 0005 control exists';
    END IF;

    SELECT ledger.prestate INTO prestate
      FROM yulalab_migration_ledger ledger
     WHERE migration_id = '0001-0004-access-boundary-v2';
    IF prestate IS NULL
       OR prestate->>'target_schema' <> current_setting('yulalab.target_schema')
       OR prestate->'schema_acl' <> 'null'::jsonb
       OR prestate->'default_privileges' <> '[]'::jsonb THEN
        RAISE EXCEPTION 'rollback refused: missing or incompatible captured prestate';
    END IF;
    owner_name := prestate->>'schema_owner';
    migration_level := (prestate->>'migration_level')::integer;
    IF owner_name IS NULL OR to_regrole(owner_name) IS NULL THEN
        RAISE EXCEPTION 'rollback refused: captured owner unavailable';
    END IF;
    IF migration_level IS NULL OR migration_level NOT BETWEEN 0 AND 3 THEN
        RAISE EXCEPTION 'rollback refused: captured migration level unavailable';
    END IF;
    SELECT array_agg(c.relname ORDER BY c.relname) INTO object_set
      FROM pg_class c
     WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'r';
    IF object_set <> ARRAY[
        'attributions','data_requests','event_outbox','lead_consents','leads','yulalab_migration_ledger'
    ]::text[] THEN
        RAISE EXCEPTION 'rollback refused: unexpected table/object set %', object_set;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind IN ('v','m','S','f','p')) THEN
        RAISE EXCEPTION 'rollback refused: unexpected schema object';
    END IF;
    FOREACH protected_table IN ARRAY ARRAY[
        'attributions','leads','lead_consents','event_outbox','data_requests'
    ] LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I', current_schema(), protected_table) INTO row_count;
        IF row_count <> 0 THEN
            RAISE EXCEPTION 'rollback refused: % contains % rows', protected_table, row_count;
        END IF;
    END LOOP;
END
$$;

SELECT
  prestate->>'schema_owner' AS restore_owner,
  (prestate->>'migration_level')::integer AS restore_level,
  ((prestate->>'migration_level')::integer >= 1) AS restore_0001,
  ((prestate->>'migration_level')::integer >= 2) AS restore_0002,
  ((prestate->>'migration_level')::integer >= 3) AS restore_0003
FROM yulalab_migration_ledger
WHERE migration_id = '0001-0004-access-boundary-v2'
\gset

SELECT format('DROP SCHEMA %I CASCADE', :'target_schema')
\gexec
SELECT format('CREATE SCHEMA %I AUTHORIZATION %I', :'target_schema', :'restore_owner')
\gexec
SELECT set_config('search_path', quote_ident(:'target_schema'), true);

\if :restore_0001
  \ir ../migrations/0001_attribution.sql
\endif
\if :restore_0002
  \ir ../migrations/0002_leads_consents_outbox.sql
\endif
\if :restore_0003
  \ir ../migrations/0003_data_request_verification.sql
\endif

DO $$
BEGIN
  IF (SELECT nspacl IS NOT NULL FROM pg_namespace WHERE oid = current_schema()::regnamespace)
     OR EXISTS (
       SELECT 1 FROM pg_default_acl
        WHERE defaclnamespace = current_schema()::regnamespace
     )
     OR to_regclass(format('%I.yulalab_migration_ledger', current_schema())) IS NOT NULL THEN
    RAISE EXCEPTION 'rollback refused: restored canonical prestate has ACL/object residue';
  END IF;
END
$$;
COMMIT;
