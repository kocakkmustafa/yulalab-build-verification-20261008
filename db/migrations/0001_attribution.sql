-- Y-P0-004 — attribution and outbound chain.
--
-- HOW THIS IS APPLIED. There is no migration runner yet; until one exists
-- (Y-P1-002 adds 0002 and will need one), apply it by hand once, against
-- the attribution database only:
--
--     psql "$DATABASE_URL" -f db/migrations/0001_attribution.sql
--
-- It is idempotent (IF NOT EXISTS throughout), so re-running is safe. The
-- test-suite applies it automatically per schema; nothing applies it to
-- production, which is deliberate — provisioning that database is a founder
-- decision (see workspace/Y-P0-004-ANALYTICS-STREAM-AYRIMI.md).
--
-- This database is deliberately SEPARATE from every product database
-- (roadmap §7.3). Nothing here may be joined against LifeOS, Burun Farkı or
-- Braavolabs user data; the whole point of the pseudonymous rotating hash
-- is that such a join is not possible even by accident.
--
-- Every constraint below is enforced in the database, not only in the
-- application. Validation that lives only in TypeScript is validation that
-- a future direct INSERT, a migration script, or a second writer silently
-- skips.

CREATE TABLE IF NOT EXISTS attributions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stored shape version, so a later aggregation can tell two definitions
    -- of the same funnel step apart instead of averaging them together.
    event_version   integer     NOT NULL CHECK (event_version >= 1),

    -- NOTE: there is deliberately no lead_id column yet. It was here,
    -- always NULL, "reserved for Y-P1-002" — but an unused column still has
    -- to be disclosed, and the day it is populated BOTH "no name, email,
    -- message or in-product data can enter this record" and "does not link
    -- two different days together" on /privacy stop being true. A column
    -- that arms a future privacy claim while doing nothing today is worse
    -- than no column: it adds it in 0002, alongside the leads table and the
    -- privacy rewrite it forces.

    -- HMAC-SHA256 hex of the client session token under a daily-rotating
    -- key. 64 hex chars, enforced here so a raw token can never be written
    -- into this column by a path that skipped the hashing helper.
    session_id_hash text        NOT NULL CHECK (session_id_hash ~ '^[0-9a-f]{64}$'),

    event_name      text        NOT NULL CHECK (event_name IN (
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
                        'support_outbound')),

    product_slug    text        NULL CHECK (product_slug IS NULL OR product_slug ~ '^[a-z0-9-]{1,64}$'),
    locale          text        NOT NULL CHECK (locale IN ('tr', 'en')),

    -- UTM values are machine tokens, never prose. The charset restriction is
    -- the database-level half of the "no free text, no PII" rule: a sentence
    -- containing an email address cannot be stored in these columns at all.
    source          text        NULL CHECK (source   IS NULL OR source   ~ '^[A-Za-z0-9_.-]{1,64}$'),
    medium          text        NULL CHECK (medium   IS NULL OR medium   ~ '^[A-Za-z0-9_.-]{1,64}$'),
    campaign        text        NULL CHECK (campaign IS NULL OR campaign ~ '^[A-Za-z0-9_.-]{1,64}$'),
    content         text        NULL CHECK (content  IS NULL OR content  ~ '^[A-Za-z0-9_.-]{1,64}$'),

    -- A route path and nothing else.
    --
    -- The first version of this CHECK only forbade `?` and `#`, which let
    -- "/ad soyad a@b.co 5551234" through on a direct INSERT even though the
    -- application rejected it — so the header claim above ("enforced in the
    -- database, not only in the application") was not yet true for this
    -- column. The regex is now the same rule the validator applies: slug
    -- characters, slashes and dots. A sentence, an email address, a forged
    -- log line and a NUL byte are all unrepresentable here.
    -- CHARACTER-IDENTICAL to PAGE_PATTERN in src/lib/analytics/events.ts,
    -- same as target_url below; tests/target-rule-parity.test.ts checks both.
    page_path       text        NOT NULL CHECK (
                        page_path ~ '^/[A-Za-z0-9/_.-]{0,127}$'
                        AND page_path NOT LIKE '%//%'
                        AND page_path NOT LIKE '%..%'),

    -- Origin + path, never a query string. Storing the outbound URL verbatim
    -- would have re-opened the leak page_path closes: `?ref=a@b.co` is just
    -- as much personal data on an outbound link as on an internal one.
    -- CHARACTER-IDENTICAL to TARGET_URL_PATTERN in src/lib/analytics/events.ts.
    -- tests/target-rule-parity.test.ts reads both and fails if they drift.
    -- They already had: the app allowed '@' and the CHECK did not, so a real
    -- repo URL (youtube.com/@burunfarki) passed validation and then died
    -- here as a 503. The earlier class also admitted '%' and '+', which made
    -- the path a free-text channel in hex.
    target_url      text        NULL CHECK (
                        target_url IS NULL
                        OR (target_url ~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9/_.~-]*)?$'
                            AND length(target_url) <= 512)),
    target_category text        NULL CHECK (target_category IS NULL OR target_category IN
                        ('store', 'web', 'demo', 'support', 'internal')),

    created_at      timestamptz NOT NULL DEFAULT now(),

    -- 30-day raw retention (roadmap §7.3). Written explicitly by the
    -- application AND defaulted here, so a row inserted by any other path
    -- still carries an expiry rather than living forever.
    purge_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

    -- A target category without a target (or vice versa) is a mislabelled
    -- row: it would count as an outbound in one query and not in another.
    CONSTRAINT target_pair_consistent CHECK (
        (target_url IS NULL AND target_category IS NULL)
        OR (target_url IS NOT NULL AND target_category IS NOT NULL)),

    -- Retention must always be in the future relative to creation; a row
    -- born already-expired would be invisible to the funnel yet still
    -- present in the table.
    CONSTRAINT purge_after_creation CHECK (purge_at > created_at)
);

-- Funnel queries are "events for this session" and "events for this product
-- in a window"; the purge job is "everything past its date".
CREATE INDEX IF NOT EXISTS attributions_session_idx ON attributions (session_id_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS attributions_product_idx ON attributions (product_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS attributions_purge_idx   ON attributions (purge_at);
