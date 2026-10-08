-- Y-P1-004 security correction: durable data-request admission and a dormant
-- trusted Studio qualification boundary. Local candidate only; production
-- application remains a separate founder/manual gate.
BEGIN;

-- PostgreSQL implicitly searches pg_temp first for relations unless it is
-- positioned explicitly. Pin the already-selected migration target ahead of
-- pg_temp so a session-local shadow cannot absorb any unqualified DDL below.
DO $$
DECLARE
    target_schema text := current_schema();
BEGIN
    IF target_schema IS NULL
       OR target_schema IN ('pg_catalog', 'information_schema')
       OR target_schema LIKE 'pg_temp_%'
       OR target_schema LIKE 'pg_toast%' THEN
        RAISE EXCEPTION 'unsafe studio-metric target schema';
    END IF;
    PERFORM set_config(
        'search_path',
        format('%I, pg_catalog, pg_temp', target_schema),
        true
    );
END
$$;

-- Existing rows are the durable admission ledger. These indexes keep the
-- normalized-recipient cooldown and global rolling-window count bounded.
CREATE INDEX IF NOT EXISTS data_requests_recipient_cooldown_idx
    ON data_requests ((lower(btrim(email))), request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS data_requests_global_window_idx
    ON data_requests (created_at DESC);

-- Freeze both legacy sources while correcting them. 0004 FORCEs RLS; a
-- non-BYPASSRLS table owner is otherwise filtered by its own policies and a
-- plain UPDATE can silently touch zero rows. Temporarily remove FORCE only
-- inside this transaction, under ACCESS EXCLUSIVE locks, and restore the
-- exact pre-migration FORCE state before continuing.
LOCK TABLE attributions, event_outbox IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE
    target_schema text := current_schema();
    attributions_forced boolean;
    outbox_forced boolean;
    residual_attributions boolean;
    residual_routes boolean;
BEGIN
    SELECT table_class.relforcerowsecurity
      INTO attributions_forced
      FROM pg_class table_class
     WHERE table_class.oid = format('%I.attributions', target_schema)::regclass;
    SELECT table_class.relforcerowsecurity
      INTO outbox_forced
      FROM pg_class table_class
     WHERE table_class.oid = format('%I.event_outbox', target_schema)::regclass;

    IF attributions_forced THEN
        EXECUTE format('ALTER TABLE %I.attributions NO FORCE ROW LEVEL SECURITY', target_schema);
    END IF;
    IF outbox_forced THEN
        EXECUTE format('ALTER TABLE %I.event_outbox NO FORCE ROW LEVEL SECURITY', target_schema);
    END IF;

    -- Preserve the anonymous analytics row but demote its retired numerator
    -- meaning to the already-supported submitted event.
    EXECUTE format(
        'UPDATE %I.attributions SET event_name = ''studio_application_submitted'' '
        'WHERE event_name = ''studio_application_qualified''',
        target_schema
    );
    -- Preserve delivery/audit identity while removing the trusted-looking
    -- route from every pre-Design-A outbox row.
    EXECUTE format(
        'UPDATE %I.event_outbox '
        'SET payload_json = jsonb_set(payload_json, ''{route}'', ''"studio"''::jsonb, false) '
        'WHERE event_type = ''lead_internal_route'' '
        'AND payload_json->>''route'' = ''studio-qualified''',
        target_schema
    );

    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.attributions '
        'WHERE event_name = ''studio_application_qualified'')',
        target_schema
    ) INTO residual_attributions;
    IF residual_attributions THEN
        RAISE EXCEPTION 'residual anonymous studio-qualified attributions after demotion';
    END IF;
    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.event_outbox '
        'WHERE event_type = ''lead_internal_route'' '
        'AND payload_json->>''route'' = ''studio-qualified'')',
        target_schema
    ) INTO residual_routes;
    IF residual_routes THEN
        RAISE EXCEPTION 'residual anonymous studio-qualified routes after demotion';
    END IF;

    IF attributions_forced THEN
        EXECUTE format('ALTER TABLE %I.attributions FORCE ROW LEVEL SECURITY', target_schema);
    END IF;
    IF outbox_forced THEN
        EXECUTE format('ALTER TABLE %I.event_outbox FORCE ROW LEVEL SECURITY', target_schema);
    END IF;
END
$$;

-- Forward-correct a database that already applied the earlier 0004: the
-- qualified verdict is no longer accepted through anonymous attribution.
ALTER TABLE attributions DROP CONSTRAINT IF EXISTS attributions_event_name_check;
ALTER TABLE attributions ADD CONSTRAINT attributions_event_name_check CHECK (event_name IN
(
                     'home_primary_cta',
                     'products_filter_changed',
                     'product_view',
                     'product_primary_cta',
                     'store_outbound',
                     'demo_request_started',
                     'demo_request_submitted',
                     'case_study_view',
                     'case_study_cta',
                     'studio_view',
                     'studio_application_started',
                     'studio_application_submitted',
                     'support_outbound'));
COMMENT ON CONSTRAINT attributions_event_name_check ON attributions
    IS 'yulalab:migration=0005:studio-acceptance-metric';

-- No authenticated reviewer transition exists yet. Reject every attempt to
-- mint the trusted route until a later migration introduces that actor,
-- authorization, provenance and idempotency contract explicitly.
CREATE OR REPLACE FUNCTION enforce_studio_qualified_route() RETURNS trigger AS $$
BEGIN
    IF NEW.event_type = 'lead_internal_route'
       AND NEW.payload_json->>'route' = 'studio-qualified' THEN
        RAISE EXCEPTION 'trusted studio-qualified route is dormant pending authenticated review'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'studio_qualified_route_requires_authenticated_review';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = pg_catalog, pg_temp;

-- Trigger invocation does not require callers to hold direct EXECUTE on the
-- function. Remove the PostgreSQL default PUBLIC grant so API roles cannot
-- call this enforcement helper as an ordinary function.
REVOKE ALL ON FUNCTION enforce_studio_qualified_route() FROM PUBLIC;
DO $$
DECLARE
    target_schema text := current_schema();
    grantee_name text;
BEGIN
    FOR grantee_name IN
        SELECT role.rolname
          FROM pg_proc proc
          JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
          CROSS JOIN LATERAL aclexplode(
              coalesce(proc.proacl, acldefault('f', proc.proowner))
          ) acl
          JOIN pg_roles role ON role.oid = acl.grantee
         WHERE namespace.nspname = target_schema
           AND proc.proname = 'enforce_studio_qualified_route'
           AND proc.pronargs = 0
           AND proc.prorettype = 'trigger'::regtype
           AND acl.grantee <> proc.proowner
           AND acl.privilege_type = 'EXECUTE'
    LOOP
        EXECUTE format(
            'REVOKE ALL ON FUNCTION %I.enforce_studio_qualified_route() FROM %I',
            target_schema,
            grantee_name
        );
    END LOOP;
END
$$;

DROP TRIGGER IF EXISTS event_outbox_bind_studio_qualified ON event_outbox;
CREATE TRIGGER event_outbox_bind_studio_qualified
    BEFORE INSERT OR UPDATE OF event_type, aggregate_id, payload_json ON event_outbox
    FOR EACH ROW EXECUTE FUNCTION enforce_studio_qualified_route();

-- Dormant uniqueness guard retained for a future authenticated transition;
-- the trigger above means this index has zero trusted rows today.
CREATE UNIQUE INDEX IF NOT EXISTS event_outbox_studio_qualified_once
    ON event_outbox (aggregate_id)
    WHERE event_type = 'lead_internal_route'
      AND payload_json->>'route' = 'studio-qualified';

-- Fail the migration before commit if later edits weaken the function
-- boundary or detach/disable its trigger.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_proc proc
         WHERE proc.pronamespace = current_schema()::regnamespace
           AND proc.proname = 'enforce_studio_qualified_route'
           AND proc.pronargs = 0
           AND proc.prorettype = 'trigger'::regtype
           AND (
               proc.prosecdef
               OR proc.proconfig IS DISTINCT FROM
                  ARRAY['search_path=pg_catalog, pg_temp']::text[]
               OR position(
                   'trusted studio-qualified route is dormant pending authenticated review'
                   IN pg_get_functiondef(proc.oid)
               ) = 0
               OR EXISTS (
                   SELECT 1
                     FROM aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
                    WHERE acl.grantee <> proc.proowner
                      AND acl.privilege_type = 'EXECUTE'
               )
           )
    ) THEN
        RAISE EXCEPTION 'incompatible studio-qualified function security/search_path/ACL';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint constraint_row
          JOIN pg_class table_class ON table_class.oid = constraint_row.conrelid
         WHERE table_class.relnamespace = current_schema()::regnamespace
           AND table_class.relname = 'attributions'
           AND constraint_row.conname = 'attributions_event_name_check'
           AND pg_get_constraintdef(constraint_row.oid) NOT LIKE
               '%studio_application_qualified%'
    ) THEN
        RAISE EXCEPTION 'studio-qualified attribution constraint postflight failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_class index_class
          JOIN pg_index index_row ON index_row.indexrelid = index_class.oid
          JOIN pg_class table_class ON table_class.oid = index_row.indrelid
         WHERE index_class.relnamespace = current_schema()::regnamespace
           AND index_class.relname = 'data_requests_recipient_cooldown_idx'
           AND table_class.relname = 'data_requests'
    ) OR NOT EXISTS (
        SELECT 1
          FROM pg_class index_class
          JOIN pg_index index_row ON index_row.indexrelid = index_class.oid
          JOIN pg_class table_class ON table_class.oid = index_row.indrelid
         WHERE index_class.relnamespace = current_schema()::regnamespace
           AND index_class.relname = 'data_requests_global_window_idx'
           AND table_class.relname = 'data_requests'
    ) THEN
        RAISE EXCEPTION 'data-request admission index postflight failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger trigger
          JOIN pg_class table_class ON table_class.oid = trigger.tgrelid
          JOIN pg_proc proc ON proc.oid = trigger.tgfoid
         WHERE table_class.relnamespace = current_schema()::regnamespace
           AND table_class.relname = 'event_outbox'
           AND trigger.tgname = 'event_outbox_bind_studio_qualified'
           AND trigger.tgenabled = 'O'
           AND proc.pronamespace = current_schema()::regnamespace
           AND proc.proname = 'enforce_studio_qualified_route'
    ) THEN
        RAISE EXCEPTION 'studio-qualified trigger postflight failed';
    END IF;
END
$$;

COMMIT;
