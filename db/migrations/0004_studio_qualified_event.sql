-- Y-P1-004: Studio interaction events accepted from anonymous clients.
--
-- The form first carried it in `product_slug`, which the API refuses (that
-- column is the per-product funnel index, constrained to registry slugs), so
-- every studio submission event was rejected at the door. Two names give the
-- acceptance denominator remains `studio_application_submitted`. The
-- qualified numerator is server-bound to the accepted lead by 0005; keeping
-- it in this anonymous allowlist lets a script mint qualified rows with no
-- application.
--
-- The first draft of this file did not execute: it said `event` (the column
-- is `event_name`) and dropped `attributions_event_check` (0001 declares the
-- CHECK inline, so Postgres named it `attributions_event_name_check`). The
-- test guarding it asserted the file's TEXT, which every name satisfied, so
-- a migration that could not run looked verified — and the failure mode was
-- QUIET: submissions would land while qualified rows were rejected, and the
-- gate would read 0% rather than erroring.
--
-- Keep the manual `psql -f` deployment atomic. Without an explicit
-- transaction, an interrupt or a failing ADD after the DROP leaves the table
-- with no event allowlist at all.
BEGIN;

ALTER TABLE attributions DROP CONSTRAINT IF EXISTS attributions_event_name_check;

-- Generated from src/lib/analytics/events.ts, not retyped: the hand-copied
-- version silently omitted four names the code accepts.
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

COMMIT;
