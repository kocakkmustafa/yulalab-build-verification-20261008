-- Y-P1-002-R1 — additive verification-retention and least-privilege boundary.
-- 0001/0002/0003 are immutable. The operations runner owns the transaction.

CREATE TABLE IF NOT EXISTS yulalab_migration_ledger (
    migration_id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    applied_by text NOT NULL DEFAULT current_user,
    prestate jsonb NOT NULL
);

DO $$
DECLARE
    role_name text;
    role_info record;
    target_owner text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY[
        current_setting('yulalab.intake_role'),
        current_setting('yulalab.mail_role'),
        current_setting('yulalab.purge_role')
    ] LOOP
        IF role_name !~ '^[a-z_][a-z0-9_]{0,62}$' THEN
            RAISE EXCEPTION 'unsafe application role name';
        END IF;
        SELECT rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
          INTO role_info FROM pg_roles WHERE rolname = role_name;
        IF NOT FOUND OR NOT role_info.rolcanlogin OR role_info.rolinherit
           OR role_info.rolsuper OR role_info.rolbypassrls
           OR role_info.rolcreaterole OR role_info.rolcreatedb THEN
            RAISE EXCEPTION 'role % is not an isolated NOINHERIT login', role_name;
        END IF;
        IF current_user = role_name THEN
            RAISE EXCEPTION 'application role % cannot own migrations', role_name;
        END IF;
        FOR target_owner IN
            SELECT tableowner FROM pg_tables
             WHERE schemaname = current_schema()
               AND tablename = ANY (ARRAY[
                   'attributions','leads','lead_consents','event_outbox','data_requests'
               ])
        LOOP
            IF target_owner = role_name THEN
                RAISE EXCEPTION 'application role % owns protected data', role_name;
            END IF;
        END LOOP;
    END LOOP;
END
$$;

ALTER TABLE data_requests
    ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS verification_token_key_id text,
    ADD COLUMN IF NOT EXISTS verification_queue_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS purge_at timestamptz;

ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS pending_requires_a_live_token;
ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS spent_token_is_cleared;
ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS verification_delivery_window;
ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS verification_key_id_is_safe;
ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS data_request_purge_after_creation;
ALTER TABLE data_requests
    ADD CONSTRAINT pending_requires_a_live_token CHECK (
        verification_state <> 'pending'
        OR (verification_token_hash IS NOT NULL
            AND verification_token_key_id IS NOT NULL
            AND verification_queue_expires_at IS NOT NULL
            AND purge_at IS NOT NULL)
    ),
    ADD CONSTRAINT spent_token_is_cleared CHECK (
        verification_state = 'pending' OR verification_token_hash IS NULL
    ),
    ADD CONSTRAINT verification_delivery_window CHECK (
        (verification_sent_at IS NULL AND verification_expires_at IS NULL)
        OR (verification_sent_at IS NOT NULL AND verification_expires_at IS NOT NULL
            AND verification_expires_at > verification_sent_at)
    ),
    ADD CONSTRAINT verification_key_id_is_safe CHECK (
        verification_token_key_id IS NULL
        OR verification_token_key_id ~ '^[A-Za-z0-9_.-]{1,64}$'
    ),
    ADD CONSTRAINT data_request_purge_after_creation CHECK (
        purge_at IS NULL OR purge_at > created_at
    );

CREATE INDEX IF NOT EXISTS data_requests_queue_expiry_idx
    ON data_requests (verification_queue_expires_at) WHERE verification_state = 'pending';
CREATE INDEX IF NOT EXISTS data_requests_purge_idx ON data_requests (purge_at);

REVOKE ALL ON TABLE attributions FROM PUBLIC;
REVOKE ALL ON TABLE leads FROM PUBLIC;
REVOKE ALL ON TABLE lead_consents FROM PUBLIC;
REVOKE ALL ON TABLE event_outbox FROM PUBLIC;
REVOKE ALL ON TABLE data_requests FROM PUBLIC;
REVOKE ALL ON FUNCTION set_lead_retention() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_outbox_purge() FROM PUBLIC;

ALTER TABLE attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributions FORCE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests FORCE ROW LEVEL SECURITY;

ALTER FUNCTION set_lead_retention() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION set_outbox_purge() SET search_path = pg_catalog, pg_temp;

DO $$
DECLARE
    intake_role text := current_setting('yulalab.intake_role');
    mail_role text := current_setting('yulalab.mail_role');
    purge_role text := current_setting('yulalab.purge_role');
    api_role text;
    table_name text;
    schema_name text := current_schema();
    -- The atomic runner builds a reference schema before preflight. Its
    -- policies must point at the real target dependencies so pg_get_expr
    -- serializes the same OIDs for target and reference on an idempotent run.
    dependency_schema text := coalesce(
      nullif(current_setting('yulalab.target_schema', true), ''),
      current_schema()
    );
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF to_regrole(api_role) IS NOT NULL THEN
            EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM %I', schema_name, api_role);
            FOREACH table_name IN ARRAY ARRAY[
                'attributions','leads','lead_consents','event_outbox','data_requests'
            ] LOOP
                EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', schema_name, table_name, api_role);
            END LOOP;
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', schema_name, api_role);
        END IF;
    END LOOP;

    EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM PUBLIC', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM PUBLIC', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM PUBLIC', schema_name);

    FOREACH api_role IN ARRAY ARRAY[intake_role, mail_role, purge_role] LOOP
        EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM %I', schema_name, api_role);
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, api_role);
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', schema_name, api_role);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', schema_name, api_role);
    END LOOP;

    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I.attributions TO %I', schema_name, intake_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I.leads TO %I', schema_name, intake_role);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I.lead_consents TO %I', schema_name, intake_role);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I.event_outbox TO %I', schema_name, intake_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I.data_requests TO %I', schema_name, intake_role);

    EXECUTE format('GRANT SELECT ON TABLE %I.leads, %I.lead_consents TO %I', schema_name, schema_name, mail_role);
    -- Table-level REVOKE does not erase attacl column grants left by an older
    -- deployment. Clear the complete known column surface before granting the
    -- delivery allowlist, so a stale payload_json/id grant cannot survive.
    EXECUTE format('REVOKE UPDATE (id, event_type, aggregate_id, payload_json, attempts, delivered_at, created_at, purge_at) ON TABLE %I.event_outbox FROM %I', schema_name, mail_role);
    EXECUTE format('REVOKE UPDATE (id, email, request_type, verification_state, created_at, completed_at, verification_token_hash, verification_expires_at, verification_sent_at, verification_token_key_id, verification_queue_expires_at, purge_at) ON TABLE %I.data_requests FROM %I', schema_name, mail_role);
    EXECUTE format('GRANT SELECT, DELETE ON TABLE %I.event_outbox TO %I', schema_name, mail_role);
    EXECUTE format('GRANT UPDATE (attempts, delivered_at, purge_at) ON TABLE %I.event_outbox TO %I', schema_name, mail_role);
    EXECUTE format('GRANT SELECT ON TABLE %I.data_requests TO %I', schema_name, mail_role);
    EXECUTE format('GRANT UPDATE (verification_state, verification_token_hash, verification_sent_at, verification_expires_at, purge_at) ON TABLE %I.data_requests TO %I', schema_name, mail_role);

    EXECUTE format('GRANT SELECT, DELETE ON TABLE %I.attributions, %I.lead_consents, %I.leads, %I.event_outbox, %I.data_requests TO %I',
        schema_name, schema_name, schema_name, schema_name, schema_name, purge_role);
    EXECUTE format('GRANT UPDATE ON TABLE %I.data_requests TO %I', schema_name, purge_role);

    FOREACH table_name IN ARRAY ARRAY[
        'attributions','leads','lead_consents','event_outbox','data_requests'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS yulalab_intake_access ON %I.%I', schema_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS yulalab_mail_access ON %I.%I', schema_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS yulalab_mail_select ON %I.%I', schema_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS yulalab_mail_update ON %I.%I', schema_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS yulalab_mail_delete ON %I.%I', schema_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS yulalab_purge_access ON %I.%I', schema_name, table_name);
    END LOOP;

    EXECUTE format('CREATE POLICY yulalab_intake_access ON %I.attributions FOR ALL TO %I USING (true) WITH CHECK (true)', schema_name, intake_role);
    EXECUTE format('CREATE POLICY yulalab_intake_access ON %I.leads FOR ALL TO %I USING (true) WITH CHECK (true)', schema_name, intake_role);
    EXECUTE format('CREATE POLICY yulalab_intake_access ON %I.lead_consents FOR ALL TO %I USING (true) WITH CHECK (true)', schema_name, intake_role);
    EXECUTE format('CREATE POLICY yulalab_intake_access ON %I.event_outbox FOR ALL TO %I USING (true) WITH CHECK (true)', schema_name, intake_role);
    EXECUTE format('CREATE POLICY yulalab_intake_access ON %I.data_requests FOR ALL TO %I USING (true) WITH CHECK (true)', schema_name, intake_role);
    EXECUTE format('CREATE POLICY yulalab_mail_access ON %I.leads FOR SELECT TO %I USING (true)', schema_name, mail_role);
    EXECUTE format('CREATE POLICY yulalab_mail_access ON %I.lead_consents FOR SELECT TO %I USING (true)', schema_name, mail_role);
    EXECUTE format('CREATE POLICY yulalab_mail_select ON %I.event_outbox FOR SELECT TO %I USING (true)', schema_name, mail_role);
    EXECUTE format('CREATE POLICY yulalab_mail_update ON %I.event_outbox FOR UPDATE TO %I USING (true) WITH CHECK (true)', schema_name, mail_role);
    EXECUTE format($policy$
      CREATE POLICY yulalab_mail_delete ON %I.event_outbox FOR DELETE TO %I USING (
        (event_type IN ('lead_receipt', 'lead_internal_route')
          AND NOT EXISTS (SELECT 1 FROM %I.leads WHERE id = aggregate_id))
        OR (event_type = 'data_request_verification'
          AND NOT EXISTS (
            SELECT 1 FROM %I.data_requests
             WHERE id = aggregate_id AND verification_state = 'pending'
          ))
      )
    $policy$, schema_name, mail_role, dependency_schema, dependency_schema);
    EXECUTE format('CREATE POLICY yulalab_mail_select ON %I.data_requests FOR SELECT TO %I USING (true)', schema_name, mail_role);
    EXECUTE format($policy$
      CREATE POLICY yulalab_mail_update ON %I.data_requests FOR UPDATE TO %I
        USING (verification_state = 'pending')
        WITH CHECK (verification_state IN ('pending', 'expired'))
    $policy$, schema_name, mail_role);
    EXECUTE format('CREATE POLICY yulalab_purge_access ON %I.attributions FOR ALL TO %I USING (true)', schema_name, purge_role);
    EXECUTE format('CREATE POLICY yulalab_purge_access ON %I.leads FOR ALL TO %I USING (true)', schema_name, purge_role);
    EXECUTE format('CREATE POLICY yulalab_purge_access ON %I.lead_consents FOR ALL TO %I USING (true)', schema_name, purge_role);
    EXECUTE format('CREATE POLICY yulalab_purge_access ON %I.event_outbox FOR ALL TO %I USING (true)', schema_name, purge_role);
    EXECUTE format('CREATE POLICY yulalab_purge_access ON %I.data_requests FOR ALL TO %I USING (true)', schema_name, purge_role);
END
$$;

-- Postflight: validate the exact policy vocabulary and effective cross-role
-- matrix before the outer runner can write its ledger row and commit.
DO $$
DECLARE
    intake_role text := current_setting('yulalab.intake_role');
    mail_role text := current_setting('yulalab.mail_role');
    purge_role text := current_setting('yulalab.purge_role');
    dependency_schema text := coalesce(
      nullif(current_setting('yulalab.target_schema', true), ''),
      current_schema()
    );
    actual_policies text[];
    expected_policies text[];
BEGIN
    SELECT coalesce(array_agg(
      table_class.relname || ':' || policy.polname || ':' || policy.polcmd::text || ':' ||
      role_name.rolname || ':' || replace(coalesce(pg_get_expr(policy.polqual, policy.polrelid, true), ''), dependency_schema || '.', '') || ':' ||
      coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid, true), '')
      ORDER BY table_class.relname, policy.polname
    ), ARRAY[]::text[]) INTO actual_policies
      FROM pg_policy policy
      JOIN pg_class table_class ON table_class.oid = policy.polrelid
      CROSS JOIN LATERAL unnest(policy.polroles) role_oid
      JOIN pg_roles role_name ON role_name.oid = role_oid
     WHERE table_class.relnamespace = current_schema()::regnamespace;

    SELECT array_agg(value ORDER BY value) INTO expected_policies
      FROM unnest(ARRAY[
        'attributions:yulalab_intake_access:*:' || intake_role || ':true:true',
        'attributions:yulalab_purge_access:*:' || purge_role || ':true:',
        'leads:yulalab_intake_access:*:' || intake_role || ':true:true',
        'leads:yulalab_mail_access:r:' || mail_role || ':true:',
        'leads:yulalab_purge_access:*:' || purge_role || ':true:',
        'lead_consents:yulalab_intake_access:*:' || intake_role || ':true:true',
        'lead_consents:yulalab_mail_access:r:' || mail_role || ':true:',
        'lead_consents:yulalab_purge_access:*:' || purge_role || ':true:',
        'event_outbox:yulalab_intake_access:*:' || intake_role || ':true:true',
        'event_outbox:yulalab_mail_delete:d:' || mail_role || ':(event_type = ANY (ARRAY[''lead_receipt''::text, ''lead_internal_route''::text])) AND NOT (EXISTS ( SELECT 1' || E'\n' || '   FROM leads' || E'\n' || '  WHERE leads.id = event_outbox.aggregate_id)) OR event_type = ''data_request_verification''::text AND NOT (EXISTS ( SELECT 1' || E'\n' || '   FROM data_requests' || E'\n' || '  WHERE data_requests.id = event_outbox.aggregate_id AND data_requests.verification_state = ''pending''::text)):',
        'event_outbox:yulalab_mail_select:r:' || mail_role || ':true:',
        'event_outbox:yulalab_mail_update:w:' || mail_role || ':true:true',
        'event_outbox:yulalab_purge_access:*:' || purge_role || ':true:',
        'data_requests:yulalab_intake_access:*:' || intake_role || ':true:true',
        'data_requests:yulalab_mail_select:r:' || mail_role || ':true:',
        'data_requests:yulalab_mail_update:w:' || mail_role || ':verification_state = ''pending''::text:verification_state = ANY (ARRAY[''pending''::text, ''expired''::text])',
        'data_requests:yulalab_purge_access:*:' || purge_role || ':true:'
      ]) value;
    IF actual_policies <> expected_policies THEN
      RAISE EXCEPTION 'incompatible policy role/cmd/qual/withcheck definition';
    END IF;

    IF EXISTS (
         SELECT 1 FROM pg_namespace namespace
         CROSS JOIN LATERAL aclexplode(coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))) acl
          WHERE namespace.oid = current_schema()::regnamespace
            AND acl.grantee = 0 AND acl.privilege_type = 'CREATE'
       )
       OR NOT has_schema_privilege(intake_role, current_schema(), 'USAGE')
       OR NOT has_schema_privilege(mail_role, current_schema(), 'USAGE')
       OR NOT has_schema_privilege(purge_role, current_schema(), 'USAGE') THEN
      RAISE EXCEPTION 'incompatible effective schema privilege';
    END IF;

    IF NOT has_table_privilege(intake_role, format('%I.attributions', current_schema()), 'SELECT,INSERT')
       OR has_table_privilege(intake_role, format('%I.attributions', current_schema()), 'UPDATE,DELETE')
       OR NOT has_table_privilege(mail_role, format('%I.event_outbox', current_schema()), 'SELECT,DELETE')
       OR has_table_privilege(mail_role, format('%I.event_outbox', current_schema()), 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'attempts', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'delivered_at', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'purge_at', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'event_type', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'aggregate_id', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'payload_json', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'created_at', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.event_outbox', current_schema()), 'id', 'UPDATE')
       OR NOT has_table_privilege(mail_role, format('%I.data_requests', current_schema()), 'SELECT')
       OR has_table_privilege(mail_role, format('%I.data_requests', current_schema()), 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_state', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_token_hash', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_sent_at', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_expires_at', 'UPDATE')
       OR NOT has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'purge_at', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'email', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'request_type', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'id', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'created_at', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'completed_at', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_token_key_id', 'UPDATE')
       OR has_column_privilege(mail_role, format('%I.data_requests', current_schema()), 'verification_queue_expires_at', 'UPDATE')
       OR has_table_privilege(mail_role, format('%I.event_outbox', current_schema()), 'INSERT')
       OR NOT has_table_privilege(purge_role, format('%I.data_requests', current_schema()), 'SELECT,UPDATE,DELETE')
       OR has_table_privilege(purge_role, format('%I.data_requests', current_schema()), 'INSERT') THEN
      RAISE EXCEPTION 'incompatible effective cross-role table privilege';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_proc proc
       WHERE proc.pronamespace = current_schema()::regnamespace
         AND (
           EXISTS (
             SELECT 1 FROM aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
              WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
           )
           OR proc.prosecdef
           OR proc.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
         )
    ) THEN
      RAISE EXCEPTION 'incompatible function security/search_path/ACL';
    END IF;
END
$$;
