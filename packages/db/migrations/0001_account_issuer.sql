-- Better Auth 1.7 added a required `issuer` column to `account` plus a unique
-- index on (issuer, account_id). Without it every sign-up fails with
-- "The field \"issuer\" does not exist in the \"account\" Drizzle schema".
--
-- Written by hand rather than generated: `drizzle-kit push/generate` would try
-- to reconcile the whole database against src/server/db/schema.ts, which still
-- only declares a fraction of the tables that exist here.
--
-- Reverse with:
--   DROP INDEX IF EXISTS account_issuer_account_id_unique;
--   ALTER TABLE account DROP COLUMN IF EXISTS issuer;

BEGIN;

ALTER TABLE account ADD COLUMN IF NOT EXISTS issuer text;

-- Synthetic issuers, matching createLocalAccountIssuer / createOAuthAccountIssuer.
-- Rows predating this column are all credential (email + password) accounts.
UPDATE account
SET issuer = CASE
    WHEN provider_id = 'credential' THEN 'local:credential'
    ELSE 'local:oauth:' || provider_id
  END
WHERE issuer IS NULL;

ALTER TABLE account ALTER COLUMN issuer SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_id_unique
  ON account (issuer, account_id);

COMMIT;
