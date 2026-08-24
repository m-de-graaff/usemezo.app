-- Public handles, profile visibility, and the onboarding marker.
--
-- Additive: three nullable-or-defaulted columns on user_profile. Old code
-- ignores them, and new code treats a null username as "has not onboarded yet",
-- which is what every existing row is.
--
-- The unique index is built CONCURRENTLY because it takes a write lock for the
-- whole build otherwise. It cannot run inside a transaction, so it is the last
-- statement here; if it fails it leaves an INVALID index behind — drop that
-- before retrying, or the retry fails too:
--   DROP INDEX IF EXISTS user_profile_username_key;
--
-- Usernames are lower-cased by the API before they are written, so a plain
-- unique index is the case-insensitive check.
--
-- Reverse with:
--   ALTER TABLE user_profile
--     DROP COLUMN IF EXISTS username,
--     DROP COLUMN IF EXISTS is_public,
--     DROP COLUMN IF EXISTS onboarded_at;

SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE user_profile
	ADD COLUMN IF NOT EXISTS username text,
	ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS onboarded_at timestamp;

RESET lock_timeout;
RESET statement_timeout;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS user_profile_username_key
	ON user_profile (username);
