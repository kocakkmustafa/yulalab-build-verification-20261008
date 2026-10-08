-- Y-P1-002 — proof of address for data requests.
--
-- Appended rather than folded into 0002, even though 0002 has almost
-- certainly never been applied outside local test schemas. "Nothing I can
-- see says it ran" is not the same as "it did not run" — a migration applied
-- by hand leaves no trace in this repo, and being wrong about that means a
-- production database whose shape no longer matches its history.
--
-- WHY A TOKEN AT ALL: acting on an unverified "delete my data" is itself a
-- way to delete somebody else's. The address has to be proven before the
-- request becomes actionable, so `pending` is the only state a submission
-- can create.

ALTER TABLE data_requests
    ADD COLUMN IF NOT EXISTS verification_token_hash text,
    ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz;

-- The token is a CAPABILITY: whoever holds it can prove ownership of that
-- address. Stored as a sha256 hex digest, never in plaintext, so a database
-- read cannot be turned into the ability to verify other people's requests.
ALTER TABLE data_requests
    DROP CONSTRAINT IF EXISTS verification_token_is_a_hash;
ALTER TABLE data_requests
    ADD CONSTRAINT verification_token_is_a_hash CHECK (
        verification_token_hash IS NULL OR verification_token_hash ~ '^[0-9a-f]{64}$');

-- A pending request must carry a token and a deadline; a link that never
-- expires is a permanent capability sitting in someone's inbox.
ALTER TABLE data_requests
    DROP CONSTRAINT IF EXISTS pending_requires_a_live_token;
ALTER TABLE data_requests
    ADD CONSTRAINT pending_requires_a_live_token CHECK (
        verification_state <> 'pending'
        OR (verification_token_hash IS NOT NULL AND verification_expires_at IS NOT NULL));

-- Once verified or expired the token is spent and must be cleared, so a
-- replay of the same link cannot re-verify.
ALTER TABLE data_requests
    DROP CONSTRAINT IF EXISTS spent_token_is_cleared;
ALTER TABLE data_requests
    ADD CONSTRAINT spent_token_is_cleared CHECK (
        verification_state = 'pending' OR verification_token_hash IS NULL);

CREATE INDEX IF NOT EXISTS data_requests_token_idx ON data_requests (verification_token_hash)
    WHERE verification_token_hash IS NOT NULL;
