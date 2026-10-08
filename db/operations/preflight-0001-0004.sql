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

SELECT set_config('search_path', quote_ident(:'target_schema'), false);
SELECT set_config('yulalab.target_schema', :'target_schema', false);
SELECT set_config('yulalab.intake_role', :'intake_role', false);
SELECT set_config('yulalab.mail_role', :'mail_role', false);
SELECT set_config('yulalab.purge_role', :'purge_role', false);

DO $$
BEGIN
    IF current_setting('yulalab.preflight_lock_held', true) IS DISTINCT FROM 'true'
       OR current_setting('yulalab.reference_schema', true) IS NULL THEN
        RAISE EXCEPTION 'preflight must run inside the atomic apply transaction after advisory lock';
    END IF;
END
$$;

DO $$
DECLARE
    role_name text;
    role_info record;
    privileged_membership text;
    protected_table text;
    object_set text[];
    actual_columns text[];
    expected_columns text[];
    actual_names text[];
    expected_names text[];
    actual_definitions text[];
    expected_definitions text[];
    reference_schema text := current_setting('yulalab.reference_schema');
    final_state boolean;
    row_count bigint;
    ledger_prestate jsonb;
    ledger_applied_by text;
    ledger_applied_at timestamptz;
    ledger_definition jsonb;
    reference_ledger_definition jsonb;
    expected_prestate jsonb;
    expected_prestate_tables jsonb;
    expected_prestate_functions jsonb;
    captured_schema_owner text;
    captured_migration_level integer;
BEGIN
    IF current_schema() IS NULL
       OR current_schema() <> current_setting('yulalab.target_schema')
       OR current_schema() IN ('public','pg_catalog','information_schema') THEN
        RAISE EXCEPTION 'incompatible target_schema: use a dedicated non-public schema';
    END IF;

    FOREACH role_name IN ARRAY ARRAY[
        current_setting('yulalab.intake_role'),
        current_setting('yulalab.mail_role'),
        current_setting('yulalab.purge_role')
    ] LOOP
        IF role_name !~ '^[a-z_][a-z0-9_]{0,62}$' THEN
            RAISE EXCEPTION 'incompatible application role name';
        END IF;
        SELECT rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
          INTO role_info FROM pg_roles WHERE rolname = role_name;
        IF NOT FOUND OR NOT role_info.rolcanlogin OR role_info.rolinherit
           OR role_info.rolsuper OR role_info.rolbypassrls
           OR role_info.rolcreaterole OR role_info.rolcreatedb THEN
            RAISE EXCEPTION 'incompatible application role privileges for %', role_name;
        END IF;
        IF role_name = current_user THEN
            RAISE EXCEPTION 'incompatible owner collision for %', role_name;
        END IF;
        privileged_membership := NULL;
        SELECT member_role.rolname || ' -> ' || granted_role.rolname
          INTO privileged_membership
          FROM pg_auth_members edge
          JOIN pg_roles member_role ON member_role.oid = edge.member
          JOIN pg_roles granted_role ON granted_role.oid = edge.roleid
         WHERE edge.member = to_regrole(role_name)
            OR edge.roleid = to_regrole(role_name)
         LIMIT 1;
        IF privileged_membership IS NOT NULL THEN
            RAISE EXCEPTION 'incompatible application role membership edge for %: %', role_name, privileged_membership;
        END IF;
    END LOOP;
    IF (SELECT count(DISTINCT candidate_role) FROM unnest(ARRAY[
        current_setting('yulalab.intake_role'), current_setting('yulalab.mail_role'),
        current_setting('yulalab.purge_role')
    ]) candidate_role) <> 3 THEN
        RAISE EXCEPTION 'incompatible role collision';
    END IF;

    -- Only three canonical ordered states are accepted: empty, 0001 only,
    -- or complete 0001+0002 with optional complete 0003. Anything else needs
    -- an explicit reconciliation rather than an idempotence guess.
    final_state := to_regclass(format('%I.yulalab_migration_ledger', current_schema())) IS NOT NULL;
    IF final_state THEN
      SELECT count(*) INTO row_count FROM yulalab_migration_ledger;
      IF row_count <> 1 THEN
        RAISE EXCEPTION 'incompatible migration ledger state';
      END IF;

      SELECT prestate, applied_by, applied_at
        INTO ledger_prestate, ledger_applied_by, ledger_applied_at
        FROM yulalab_migration_ledger
       WHERE migration_id = '0001-0004-access-boundary-v2';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'incompatible migration ledger state';
      END IF;

      SELECT jsonb_build_object(
        'owner', owner_role.rolname,
        'acl', table_class.relacl,
        'rls', table_class.relrowsecurity,
        'force_rls', table_class.relforcerowsecurity
      ) INTO ledger_definition
        FROM pg_class table_class
        JOIN pg_roles owner_role ON owner_role.oid = table_class.relowner
       WHERE table_class.oid = format('%I.yulalab_migration_ledger', current_schema())::regclass;
      SELECT jsonb_build_object(
        'owner', owner_role.rolname,
        'acl', table_class.relacl,
        'rls', table_class.relrowsecurity,
        'force_rls', table_class.relforcerowsecurity
      ) INTO reference_ledger_definition
        FROM pg_class table_class
        JOIN pg_roles owner_role ON owner_role.oid = table_class.relowner
       WHERE table_class.oid = format('%I.yulalab_migration_ledger', reference_schema)::regclass;
      IF ledger_definition IS DISTINCT FROM reference_ledger_definition THEN
        RAISE EXCEPTION 'incompatible migration ledger owner/ACL/RLS definition';
      END IF;
      IF EXISTS (
        SELECT 1 FROM pg_attribute attribute
         WHERE attribute.attrelid = format('%I.yulalab_migration_ledger', current_schema())::regclass
           AND attribute.attnum > 0 AND NOT attribute.attisdropped AND attribute.attacl IS NOT NULL
      ) OR EXISTS (
        SELECT 1 FROM pg_policy
         WHERE polrelid = format('%I.yulalab_migration_ledger', current_schema())::regclass
      ) OR EXISTS (
        SELECT 1 FROM pg_trigger
         WHERE tgrelid = format('%I.yulalab_migration_ledger', current_schema())::regclass
           AND NOT tgisinternal
      ) THEN
        RAISE EXCEPTION 'incompatible migration ledger ACL/RLS definition';
      END IF;

      SELECT coalesce(array_agg(
        column_info.column_name || ':' || column_info.udt_name || ':' ||
        column_info.is_nullable || ':' || coalesce(column_info.column_default, '')
        ORDER BY column_info.ordinal_position
      ), ARRAY[]::text[]) INTO actual_columns
        FROM information_schema.columns column_info
       WHERE column_info.table_schema = current_schema()
         AND column_info.table_name = 'yulalab_migration_ledger';
      SELECT coalesce(array_agg(
        column_info.column_name || ':' || column_info.udt_name || ':' ||
        column_info.is_nullable || ':' || coalesce(column_info.column_default, '')
        ORDER BY column_info.ordinal_position
      ), ARRAY[]::text[]) INTO expected_columns
        FROM information_schema.columns column_info
       WHERE column_info.table_schema = reference_schema
         AND column_info.table_name = 'yulalab_migration_ledger';
      IF actual_columns <> expected_columns THEN
        RAISE EXCEPTION 'incompatible migration ledger definition';
      END IF;

      SELECT coalesce(array_agg(
        constraint_info.conname || ':' ||
        replace(replace(pg_get_constraintdef(constraint_info.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY constraint_info.conname
      ), ARRAY[]::text[]) INTO actual_definitions
        FROM pg_constraint constraint_info
       WHERE constraint_info.conrelid = format('%I.yulalab_migration_ledger', current_schema())::regclass;
      SELECT coalesce(array_agg(
        constraint_info.conname || ':' ||
        replace(replace(pg_get_constraintdef(constraint_info.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY constraint_info.conname
      ), ARRAY[]::text[]) INTO expected_definitions
        FROM pg_constraint constraint_info
       WHERE constraint_info.conrelid = format('%I.yulalab_migration_ledger', reference_schema)::regclass;
      IF actual_definitions <> expected_definitions THEN
        RAISE EXCEPTION 'incompatible migration ledger definition';
      END IF;

      SELECT coalesce(array_agg(
        index_class.relname || ':' || access_method.amname || ':' ||
        index_meta.indisunique || ':' || index_meta.indisvalid || ':' || index_meta.indisready || ':' ||
        replace(replace(pg_get_indexdef(index_meta.indexrelid, 0, true), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY index_class.relname
      ), ARRAY[]::text[]) INTO actual_definitions
        FROM pg_index index_meta
        JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
        JOIN pg_am access_method ON access_method.oid = index_class.relam
       WHERE index_meta.indrelid = format('%I.yulalab_migration_ledger', current_schema())::regclass;
      SELECT coalesce(array_agg(
        index_class.relname || ':' || access_method.amname || ':' ||
        index_meta.indisunique || ':' || index_meta.indisvalid || ':' || index_meta.indisready || ':' ||
        replace(replace(pg_get_indexdef(index_meta.indexrelid, 0, true), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY index_class.relname
      ), ARRAY[]::text[]) INTO expected_definitions
        FROM pg_index index_meta
        JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
        JOIN pg_am access_method ON access_method.oid = index_class.relam
       WHERE index_meta.indrelid = format('%I.yulalab_migration_ledger', reference_schema)::regclass;
      IF actual_definitions <> expected_definitions THEN
        RAISE EXCEPTION 'incompatible migration ledger definition';
      END IF;

      IF jsonb_typeof(ledger_prestate) <> 'object'
         OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(ledger_prestate) key) <> ARRAY[
           'backend_pid','default_privileges','functions','migration_level','schema_acl',
           'schema_owner','search_path','tables','target_schema','transaction_id'
         ]::text[]
         OR jsonb_typeof(ledger_prestate->'backend_pid') <> 'number'
         OR (ledger_prestate->>'backend_pid') !~ '^[1-9][0-9]*$'
         OR jsonb_typeof(ledger_prestate->'transaction_id') <> 'string'
         OR (ledger_prestate->>'transaction_id') !~ '^[1-9][0-9]*$'
         OR jsonb_typeof(ledger_prestate->'migration_level') <> 'number'
         OR (ledger_prestate->>'migration_level') !~ '^[0-3]$' THEN
        RAISE EXCEPTION 'incompatible migration ledger prestate';
      END IF;
      captured_migration_level := (ledger_prestate->>'migration_level')::integer;
      SELECT namespace.nspowner::regrole::text INTO captured_schema_owner
        FROM pg_namespace namespace WHERE namespace.oid = current_schema()::regnamespace;
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'name', table_name, 'owner', current_user, 'acl', NULL,
        'rls', false, 'force_rls', false
      ) ORDER BY table_name), '[]'::jsonb) INTO expected_prestate_tables
        FROM unnest(CASE captured_migration_level
          WHEN 0 THEN ARRAY[]::text[]
          WHEN 1 THEN ARRAY['attributions']::text[]
          ELSE ARRAY['attributions','data_requests','event_outbox','lead_consents','leads']::text[]
        END) table_name;
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'name', function_name, 'owner', current_user, 'acl', NULL, 'config', NULL
      ) ORDER BY function_name), '[]'::jsonb) INTO expected_prestate_functions
        FROM unnest(CASE WHEN captured_migration_level >= 2
          THEN ARRAY['set_lead_retention','set_outbox_purge']::text[]
          ELSE ARRAY[]::text[]
        END) function_name;
      expected_prestate := jsonb_build_object(
        'target_schema', current_schema(),
        'backend_pid', (ledger_prestate->>'backend_pid')::integer,
        'transaction_id', ledger_prestate->>'transaction_id',
        'schema_owner', captured_schema_owner,
        'schema_acl', NULL,
        'search_path', quote_ident(current_schema()),
        'migration_level', captured_migration_level,
        'tables', expected_prestate_tables,
        'functions', expected_prestate_functions,
        'default_privileges', '[]'::jsonb
      );
      IF ledger_prestate <> expected_prestate
         OR ledger_applied_by <> current_user
         OR ledger_applied_at > clock_timestamp() THEN
        RAISE EXCEPTION 'incompatible migration ledger prestate';
      END IF;
    END IF;
    SELECT coalesce(array_agg(c.relname ORDER BY c.relname), ARRAY[]::text[])
      INTO object_set
      FROM pg_class c
     WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'r'
       AND c.relname <> 'yulalab_migration_ledger';
    IF object_set = ARRAY['data_requests']::text[] THEN
        RAISE EXCEPTION 'incompatible data_requests pre-state: isolated or partial table shape';
    ELSIF object_set <> ARRAY[]::text[]
       AND object_set <> ARRAY['attributions']::text[]
       AND object_set <> ARRAY['attributions','data_requests','event_outbox','lead_consents','leads']::text[] THEN
        RAISE EXCEPTION 'incompatible table/object pre-state: %', object_set;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class c
         WHERE c.relnamespace = current_schema()::regnamespace
           AND c.relkind IN ('v','m','S','f','p')
    ) THEN
        RAISE EXCEPTION 'incompatible view/sequence/foreign/partition pre-state';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p
         WHERE p.pronamespace = current_schema()::regnamespace
           AND p.proname NOT IN ('set_lead_retention','set_outbox_purge')
    ) THEN
        RAISE EXCEPTION 'incompatible function pre-state';
    END IF;

    FOREACH protected_table IN ARRAY object_set LOOP
        IF (SELECT c.relowner <> current_user::regrole OR (
              NOT final_state AND (c.relacl IS NOT NULL OR c.relrowsecurity OR c.relforcerowsecurity)
            )
              FROM pg_class c
             WHERE c.oid = format('%I.%I', current_schema(), protected_table)::regclass) THEN
            RAISE EXCEPTION 'incompatible owner/ACL/RLS for %', protected_table;
        END IF;
        IF NOT final_state AND EXISTS (
          SELECT 1 FROM pg_attribute attribute
           WHERE attribute.attrelid = format('%I.%I', current_schema(), protected_table)::regclass
             AND attribute.attnum > 0 AND NOT attribute.attisdropped AND attribute.attacl IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'incompatible column ACL for %', protected_table;
        END IF;
        IF NOT final_state AND EXISTS (
            SELECT 1 FROM pg_policy
             WHERE polrelid = format('%I.%I', current_schema(), protected_table)::regclass
        ) THEN
            RAISE EXCEPTION 'incompatible policy pre-state for %', protected_table;
        END IF;
        EXECUTE format('SELECT count(*) FROM %I.%I', current_schema(), protected_table) INTO row_count;
        IF protected_table = 'data_requests' AND row_count > 0 THEN
            RAISE EXCEPTION 'incompatible non-empty data_requests requires explicit key-id reconciliation';
        END IF;

        SELECT array_agg(
            c.column_name || ':' || c.udt_name || ':' || c.is_nullable || ':' || coalesce(c.column_default, '')
            ORDER BY c.ordinal_position
        ) INTO actual_columns
          FROM information_schema.columns c
         WHERE c.table_schema = current_schema() AND c.table_name = protected_table;

        CASE protected_table
          WHEN 'attributions' THEN expected_columns := ARRAY[
            'id:uuid:NO:gen_random_uuid()','event_version:int4:NO:','session_id_hash:text:NO:',
            'event_name:text:NO:','product_slug:text:YES:','locale:text:NO:','source:text:YES:',
            'medium:text:YES:','campaign:text:YES:','content:text:YES:','page_path:text:NO:',
            'target_url:text:YES:','target_category:text:YES:','created_at:timestamptz:NO:now()',
            'purge_at:timestamptz:NO:(now() + ''30 days''::interval)'];
          WHEN 'leads' THEN expected_columns := ARRAY[
            'id:uuid:NO:gen_random_uuid()','created_at:timestamptz:NO:now()','name:text:NO:',
            'email:text:NO:','company:text:YES:','intent:text:NO:','product_slug:text:YES:',
            'message:text:NO:','locale:text:NO:','status:text:NO:''new''::text',
            'retention_until:timestamptz:NO:','dedupe_key:text:NO:'];
          WHEN 'lead_consents' THEN expected_columns := ARRAY[
            'id:uuid:NO:gen_random_uuid()','lead_id:uuid:NO:','notice_version:text:NO:',
            'accepted_at:timestamptz:NO:now()','lawful_basis:text:NO:'];
          WHEN 'event_outbox' THEN expected_columns := ARRAY[
            'id:uuid:NO:gen_random_uuid()','event_type:text:NO:','aggregate_id:uuid:NO:',
            'payload_json:jsonb:NO:','attempts:int4:NO:0','delivered_at:timestamptz:YES:',
            'created_at:timestamptz:NO:now()','purge_at:timestamptz:NO:'];
          WHEN 'data_requests' THEN
            expected_columns := ARRAY[
              'id:uuid:NO:gen_random_uuid()','email:text:NO:','request_type:text:NO:',
              'verification_state:text:NO:''pending''::text','created_at:timestamptz:NO:now()',
              'completed_at:timestamptz:YES:'];
            IF cardinality(actual_columns) = 8 THEN
              expected_columns := expected_columns || ARRAY[
                'verification_token_hash:text:YES:','verification_expires_at:timestamptz:YES:'];
            END IF;
        END CASE;
        SELECT coalesce(array_agg(
          c.column_name || ':' || c.udt_name || ':' || c.is_nullable || ':' || coalesce(c.column_default, '')
          ORDER BY c.ordinal_position
        ), ARRAY[]::text[]) INTO expected_columns
          FROM information_schema.columns c
         WHERE c.table_schema = reference_schema AND c.table_name = protected_table;
        IF actual_columns <> expected_columns THEN
            RAISE EXCEPTION 'incompatible columns/types/nullability/column_default for %', protected_table;
        END IF;

        SELECT coalesce(array_agg(
            con.conname || ':' ||
            replace(replace(pg_get_constraintdef(con.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
            ORDER BY con.conname
        ), ARRAY[]::text[]) INTO actual_definitions
          FROM pg_constraint con
         WHERE con.conrelid = format('%I.%I', current_schema(), protected_table)::regclass;
        CASE protected_table
          WHEN 'attributions' THEN expected_names := ARRAY[
            'attributions_campaign_check','attributions_content_check','attributions_event_name_check',
            'attributions_event_version_check','attributions_locale_check','attributions_medium_check',
            'attributions_page_path_check','attributions_pkey','attributions_product_slug_check',
            'attributions_session_id_hash_check','attributions_source_check','attributions_target_category_check',
            'attributions_target_url_check','purge_after_creation','target_pair_consistent'];
          WHEN 'leads' THEN expected_names := ARRAY[
            'leads_company_check','leads_dedupe_key_check','leads_dedupe_key_key','leads_email_check',
            'leads_intent_check','leads_locale_check','leads_message_check','leads_name_check','leads_pkey',
            'leads_product_slug_check','leads_status_check','product_slug_only_for_product_intent',
            'retention_after_creation'];
          WHEN 'lead_consents' THEN expected_names := ARRAY[
            'lead_consents_lawful_basis_check','lead_consents_lead_id_fkey',
            'lead_consents_lead_id_notice_version_key','lead_consents_notice_version_check','lead_consents_pkey'];
          WHEN 'event_outbox' THEN expected_names := ARRAY[
            'delivered_after_creation','event_outbox_attempts_check','event_outbox_event_type_check',
            'event_outbox_pkey','outbox_purge_after_creation'];
          WHEN 'data_requests' THEN expected_names := ARRAY[
            'completed_after_creation','completed_only_when_verified','data_requests_email_check',
            'data_requests_pkey','data_requests_request_type_check','data_requests_verification_state_check'];
            IF cardinality(actual_columns) = 8 THEN
              expected_names := expected_names || ARRAY[
                'pending_requires_a_live_token','spent_token_is_cleared','verification_token_is_a_hash'];
              SELECT array_agg(name ORDER BY name) INTO expected_names FROM unnest(expected_names) name;
            END IF;
        END CASE;
        SELECT coalesce(array_agg(
            con.conname || ':' ||
            replace(replace(pg_get_constraintdef(con.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
            ORDER BY con.conname
        ), ARRAY[]::text[]) INTO expected_definitions
          FROM pg_constraint con
         WHERE con.conrelid = format('%I.%I', reference_schema, protected_table)::regclass;
        IF actual_definitions <> expected_definitions THEN
            RAISE EXCEPTION 'incompatible constraint definition for %', protected_table;
        END IF;

        SELECT coalesce(array_agg(
            index_class.relname || ':' || access_method.amname || ':' ||
            index_meta.indisunique || ':' || index_meta.indisvalid || ':' || index_meta.indisready || ':' ||
            replace(replace(pg_get_indexdef(index_meta.indexrelid, 0, true), current_schema() || '.', ''), reference_schema || '.', '') || ':' ||
            coalesce(pg_get_expr(index_meta.indpred, index_meta.indrelid, true), '')
            ORDER BY index_class.relname
        ), ARRAY[]::text[]) INTO actual_definitions
          FROM pg_index index_meta
          JOIN pg_class table_class ON table_class.oid = index_meta.indrelid
          JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
          JOIN pg_am access_method ON access_method.oid = index_class.relam
         WHERE table_class.relnamespace = current_schema()::regnamespace
           AND table_class.relname = protected_table;
        CASE protected_table
          WHEN 'attributions' THEN expected_names := ARRAY[
            'attributions_pkey','attributions_product_idx','attributions_purge_idx','attributions_session_idx'];
          WHEN 'leads' THEN expected_names := ARRAY[
            'leads_created_idx','leads_dedupe_key_key','leads_pkey','leads_retention_idx'];
          WHEN 'lead_consents' THEN expected_names := ARRAY[
            'lead_consents_lead_id_notice_version_key','lead_consents_pkey'];
          WHEN 'event_outbox' THEN expected_names := ARRAY[
            'event_outbox_pkey','outbox_purge_idx','outbox_undelivered_idx'];
          WHEN 'data_requests' THEN expected_names := ARRAY['data_requests_email_idx','data_requests_pkey'];
            IF cardinality(actual_columns) = 8 THEN
              expected_names := expected_names || ARRAY['data_requests_token_idx'];
              SELECT array_agg(name ORDER BY name) INTO expected_names FROM unnest(expected_names) name;
            END IF;
        END CASE;
        SELECT coalesce(array_agg(
            index_class.relname || ':' || access_method.amname || ':' ||
            index_meta.indisunique || ':' || index_meta.indisvalid || ':' || index_meta.indisready || ':' ||
            replace(replace(pg_get_indexdef(index_meta.indexrelid, 0, true), current_schema() || '.', ''), reference_schema || '.', '') || ':' ||
            coalesce(pg_get_expr(index_meta.indpred, index_meta.indrelid, true), '')
            ORDER BY index_class.relname
        ), ARRAY[]::text[]) INTO expected_definitions
          FROM pg_index index_meta
          JOIN pg_class table_class ON table_class.oid = index_meta.indrelid
          JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
          JOIN pg_am access_method ON access_method.oid = index_class.relam
         WHERE table_class.relnamespace = reference_schema::regnamespace
           AND table_class.relname = protected_table;
        IF actual_definitions <> expected_definitions THEN
            RAISE EXCEPTION 'incompatible index definition for %', protected_table;
        END IF;

        IF final_state AND (
          SELECT row(target_table.relacl::text, target_table.relrowsecurity, target_table.relforcerowsecurity)
                 IS DISTINCT FROM
                 row(reference_table.relacl::text, reference_table.relrowsecurity, reference_table.relforcerowsecurity)
            FROM pg_class target_table, pg_class reference_table
           WHERE target_table.oid = format('%I.%I', current_schema(), protected_table)::regclass
             AND reference_table.oid = format('%I.%I', reference_schema, protected_table)::regclass
        ) THEN
          RAISE EXCEPTION 'incompatible table ACL/RLS definition for %', protected_table;
        END IF;
        IF final_state THEN
          SELECT coalesce(array_agg(
            attribute.attname || ':' || coalesce(attribute.attacl::text, '')
            ORDER BY attribute.attnum
          ), ARRAY[]::text[]) INTO actual_definitions
            FROM pg_attribute attribute
           WHERE attribute.attrelid = format('%I.%I', current_schema(), protected_table)::regclass
             AND attribute.attnum > 0 AND NOT attribute.attisdropped;
          SELECT coalesce(array_agg(
            attribute.attname || ':' || coalesce(attribute.attacl::text, '')
            ORDER BY attribute.attnum
          ), ARRAY[]::text[]) INTO expected_definitions
            FROM pg_attribute attribute
           WHERE attribute.attrelid = format('%I.%I', reference_schema, protected_table)::regclass
             AND attribute.attnum > 0 AND NOT attribute.attisdropped;
          IF actual_definitions <> expected_definitions THEN
            RAISE EXCEPTION 'incompatible column ACL definition for %', protected_table;
          END IF;
        END IF;
    END LOOP;

    IF object_set @> ARRAY['leads']::text[] THEN
        SELECT coalesce(array_agg(
          table_class.relname || ':' || trigger_meta.tgname || ':' ||
          replace(replace(pg_get_triggerdef(trigger_meta.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
          ORDER BY table_class.relname, trigger_meta.tgname
        ), ARRAY[]::text[]) INTO actual_definitions
          FROM pg_trigger trigger_meta JOIN pg_class table_class ON table_class.oid = trigger_meta.tgrelid
         WHERE table_class.relnamespace = current_schema()::regnamespace AND NOT trigger_meta.tgisinternal;
        SELECT coalesce(array_agg(
          table_class.relname || ':' || trigger_meta.tgname || ':' ||
          replace(replace(pg_get_triggerdef(trigger_meta.oid, true), current_schema() || '.', ''), reference_schema || '.', '')
          ORDER BY table_class.relname, trigger_meta.tgname
        ), ARRAY[]::text[]) INTO expected_definitions
          FROM pg_trigger trigger_meta JOIN pg_class table_class ON table_class.oid = trigger_meta.tgrelid
         WHERE table_class.relnamespace = reference_schema::regnamespace AND NOT trigger_meta.tgisinternal;
        IF actual_definitions <> expected_definitions THEN
            RAISE EXCEPTION 'incompatible trigger definition';
        END IF;
    END IF;
    IF NOT final_state AND EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = current_schema()::regnamespace AND (p.proowner <> current_user::regrole OR p.proacl IS NOT NULL OR p.proconfig IS NOT NULL)) THEN
        RAISE EXCEPTION 'incompatible function owner/ACL/SET search_path pre-state';
    END IF;
    IF NOT final_state AND (
      SELECT nspowner <> current_user::regrole OR nspacl IS NOT NULL
        FROM pg_namespace WHERE oid = current_schema()::regnamespace
    ) THEN
      RAISE EXCEPTION 'incompatible schema owner/ACL pre-state';
    ELSIF final_state AND (
      SELECT row(target.nspowner::regrole::text, coalesce(target.nspacl::text, ''))
             IS DISTINCT FROM
             row(reference.nspowner::regrole::text, coalesce(reference.nspacl::text, ''))
        FROM pg_namespace target, pg_namespace reference
       WHERE target.oid = current_schema()::regnamespace
         AND reference.oid = reference_schema::regnamespace
    ) THEN
      RAISE EXCEPTION 'incompatible schema owner/ACL final state';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM pg_default_acl defaults
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
       WHERE defaults.defaclrole = current_user::regrole
         AND defaults.defaclnamespace = 0
         AND acl.grantee <> current_user::regrole
    ) THEN
      RAISE EXCEPTION 'incompatible global default privilege state';
    END IF;
    IF NOT final_state AND EXISTS (
      SELECT 1
        FROM pg_default_acl defaults
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
       WHERE defaults.defaclrole = current_user::regrole
         AND defaults.defaclnamespace = current_schema()::regnamespace
         AND acl.grantee <> current_user::regrole
    ) THEN
      RAISE EXCEPTION 'incompatible default privilege pre-state';
    ELSIF final_state THEN
      SELECT coalesce(array_agg(
        defaults.defaclobjtype::text || ':' || coalesce(grantee.rolname, 'PUBLIC') || ':' ||
        acl.privilege_type || ':' || acl.is_grantable::text
        ORDER BY defaults.defaclobjtype, coalesce(grantee.rolname, 'PUBLIC'), acl.privilege_type
      ), ARRAY[]::text[]) INTO actual_definitions
        FROM pg_default_acl defaults
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
        LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
       WHERE defaults.defaclrole = current_user::regrole
         AND defaults.defaclnamespace = current_schema()::regnamespace;
      SELECT coalesce(array_agg(
        defaults.defaclobjtype::text || ':' || coalesce(grantee.rolname, 'PUBLIC') || ':' ||
        acl.privilege_type || ':' || acl.is_grantable::text
        ORDER BY defaults.defaclobjtype, coalesce(grantee.rolname, 'PUBLIC'), acl.privilege_type
      ), ARRAY[]::text[]) INTO expected_definitions
        FROM pg_default_acl defaults
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
        LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
       WHERE defaults.defaclrole = current_user::regrole
         AND defaults.defaclnamespace = reference_schema::regnamespace;
      IF actual_definitions <> expected_definitions THEN
        RAISE EXCEPTION 'incompatible default privilege final state';
      END IF;
    END IF;

    IF object_set @> ARRAY['leads']::text[] THEN
      SELECT coalesce(array_agg(
        proc.proname || ':' || pg_get_function_identity_arguments(proc.oid) || ':' ||
        proc.prosecdef || ':' || proc.proleakproof || ':' || proc.provolatile::text || ':' || language.lanname || ':' ||
        coalesce(proc.proconfig::text, '') || ':' || coalesce(proc.proacl::text, '') || ':' ||
        replace(replace(pg_get_functiondef(proc.oid), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY proc.proname, pg_get_function_identity_arguments(proc.oid)
      ), ARRAY[]::text[]) INTO actual_definitions
        FROM pg_proc proc JOIN pg_language language ON language.oid = proc.prolang
       WHERE proc.pronamespace = current_schema()::regnamespace;
      SELECT coalesce(array_agg(
        proc.proname || ':' || pg_get_function_identity_arguments(proc.oid) || ':' ||
        proc.prosecdef || ':' || proc.proleakproof || ':' || proc.provolatile::text || ':' || language.lanname || ':' ||
        coalesce(proc.proconfig::text, '') || ':' || coalesce(proc.proacl::text, '') || ':' ||
        replace(replace(pg_get_functiondef(proc.oid), current_schema() || '.', ''), reference_schema || '.', '')
        ORDER BY proc.proname, pg_get_function_identity_arguments(proc.oid)
      ), ARRAY[]::text[]) INTO expected_definitions
        FROM pg_proc proc JOIN pg_language language ON language.oid = proc.prolang
       WHERE proc.pronamespace = reference_schema::regnamespace;
      IF actual_definitions <> expected_definitions THEN
        RAISE EXCEPTION 'incompatible function definition';
      END IF;
    END IF;

    IF final_state THEN
      SELECT coalesce(array_agg(
        table_class.relname || ':' || policy.polname || ':' || policy.polcmd::text || ':' ||
        role_name.rolname || ':' || coalesce(pg_get_expr(policy.polqual, policy.polrelid, true), '') || ':' ||
        coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid, true), '')
        ORDER BY table_class.relname, policy.polname
      ), ARRAY[]::text[]) INTO actual_definitions
        FROM pg_policy policy JOIN pg_class table_class ON table_class.oid = policy.polrelid
        CROSS JOIN LATERAL unnest(policy.polroles) role_oid
        JOIN pg_roles role_name ON role_name.oid = role_oid
       WHERE table_class.relnamespace = current_schema()::regnamespace;
      SELECT coalesce(array_agg(
        table_class.relname || ':' || policy.polname || ':' || policy.polcmd::text || ':' ||
        role_name.rolname || ':' || coalesce(pg_get_expr(policy.polqual, policy.polrelid, true), '') || ':' ||
        coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid, true), '')
        ORDER BY table_class.relname, policy.polname
      ), ARRAY[]::text[]) INTO expected_definitions
        FROM pg_policy policy JOIN pg_class table_class ON table_class.oid = policy.polrelid
        CROSS JOIN LATERAL unnest(policy.polroles) role_oid
        JOIN pg_roles role_name ON role_name.oid = role_oid
       WHERE table_class.relnamespace = reference_schema::regnamespace;
      IF actual_definitions <> expected_definitions THEN
        RAISE EXCEPTION 'incompatible policy definition';
      END IF;
    END IF;

    -- These calls are intentionally part of the contract: raw ACL nullness
    -- is not an effective-privilege proof. Final role matrices are asserted
    -- again after 0004 applies the policies.
    -- The postflight uses has_schema/table/column/function_privilege for the
    -- three concrete login roles. PUBLIC is an ACL pseudo-grantee (OID 0),
    -- not a pg_roles row, so its access is inspected through aclexplode.
END
$$;

DROP TABLE IF EXISTS pg_temp.yulalab_prestate_snapshot;
CREATE TEMP TABLE yulalab_prestate_snapshot ON COMMIT PRESERVE ROWS AS
SELECT jsonb_build_object(
    'target_schema', namespace.nspname,
    'backend_pid', pg_backend_pid(),
    'transaction_id', txid_current()::text,
    'schema_owner', owner_role.rolname,
    'schema_acl', namespace.nspacl,
    'search_path', current_setting('search_path'),
    'migration_level', CASE
      WHEN to_regclass(format('%I.attributions', current_schema())) IS NULL THEN 0
      WHEN to_regclass(format('%I.leads', current_schema())) IS NULL THEN 1
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'data_requests'
           AND column_name = 'verification_token_hash'
      ) THEN 3
      ELSE 2
    END,
    'tables', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', c.relname, 'owner', c.relowner::regrole::text, 'acl', c.relacl,
        'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity
      ) ORDER BY c.relname) FROM pg_class c
       WHERE c.relnamespace = namespace.oid AND c.relkind = 'r'), '[]'::jsonb),
    'functions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', p.proname, 'owner', p.proowner::regrole::text, 'acl', p.proacl,
        'config', p.proconfig
      ) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = namespace.oid), '[]'::jsonb),
    'default_privileges', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.defaclobjtype)
      FROM pg_default_acl d WHERE d.defaclnamespace = namespace.oid), '[]'::jsonb)
) AS prestate
FROM pg_namespace namespace
JOIN pg_roles owner_role ON owner_role.oid = namespace.nspowner
WHERE namespace.oid = current_schema()::regnamespace;
