-- Tables for the Better Auth plugins added alongside Google/Apple sign-in:
--   jwt          -> jwks
--   mcp          -> oauth_* (an OAuth 2.1 authorization server)
--   apiKey       -> apikey
--   stripe       -> user.stripe_customer_id
--
-- Hand-written for the same reason as 0001: drizzle-kit would try to reconcile
-- the whole database against src/schema.ts, which declares only a fraction of
-- the tables that exist here.
--
-- Reverse with:
--   ALTER TABLE "user" DROP COLUMN IF EXISTS stripe_customer_id;
--   DROP TABLE IF EXISTS oauth_client_assertion, oauth_consent, oauth_access_token,
--     oauth_refresh_token, oauth_client_resource, oauth_resource, oauth_client,
--     apikey, jwks CASCADE;

BEGIN;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE TABLE IF NOT EXISTS jwks (
  id text PRIMARY KEY,
  public_key text NOT NULL,
  private_key text NOT NULL,
  created_at timestamp NOT NULL,
  expires_at timestamp,
  alg text,
  crv text
);

CREATE TABLE IF NOT EXISTS oauth_client (
  id text PRIMARY KEY,
  client_id text NOT NULL UNIQUE,
  client_secret text,
  client_discovery_id text,
  disabled boolean,
  skip_consent boolean,
  enable_end_session boolean,
  subject_type text,
  scopes text[],
  client_credentials_scopes text[],
  user_id text,
  created_at timestamp,
  updated_at timestamp,
  name text,
  uri text,
  icon text,
  contacts text[],
  tos text,
  policy text,
  software_id text,
  software_version text,
  software_statement text,
  redirect_uris text[] NOT NULL,
  post_logout_redirect_uris text[],
  backchannel_logout_uri text,
  backchannel_logout_session_required boolean,
  token_endpoint_auth_method text,
  application_type text,
  jwks text,
  jwks_uri text,
  grant_types text[],
  response_types text[],
  require_pkce boolean,
  dpop_bound_access_tokens boolean,
  reference_id text,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS oauth_resource (
  id text PRIMARY KEY,
  identifier text NOT NULL UNIQUE,
  name text NOT NULL,
  access_token_ttl integer,
  refresh_token_ttl integer,
  signing_algorithm text,
  signing_key_id text,
  allowed_scopes text[],
  custom_claims jsonb,
  dpop_bound_access_tokens_required boolean,
  disabled boolean,
  created_at timestamp,
  updated_at timestamp,
  policy_version integer,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS oauth_client_resource (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  resource_id text NOT NULL,
  metadata jsonb,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS oauth_refresh_token (
  id text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  client_id text NOT NULL,
  session_id text,
  user_id text NOT NULL,
  reference_id text,
  authorization_code_id text,
  resources text[],
  requested_user_info_claims text[],
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL,
  revoked timestamp,
  rotated_at timestamp,
  rotation_replay_response text,
  rotation_replay_expires_at timestamp,
  auth_time timestamp,
  confirmation jsonb,
  scopes text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_access_token (
  id text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  client_id text NOT NULL,
  session_id text,
  user_id text,
  reference_id text,
  authorization_code_id text,
  resources text[],
  requested_user_info_claims text[],
  refresh_id text,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL,
  revoked timestamp,
  confirmation jsonb,
  scopes text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_consent (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  user_id text,
  reference_id text,
  resources text[],
  requested_user_info_claims text[],
  scopes text[] NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_client_assertion (
  id text PRIMARY KEY,
  expires_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS apikey (
  id text PRIMARY KEY,
  config_id text NOT NULL,
  name text,
  start text,
  reference_id text NOT NULL,
  prefix text,
  key text NOT NULL,
  refill_interval integer,
  refill_amount integer,
  last_refill_at timestamp,
  enabled boolean,
  rate_limit_enabled boolean,
  rate_limit_time_window integer,
  rate_limit_max integer,
  request_count integer,
  remaining integer,
  last_request timestamp,
  expires_at timestamp,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  permissions text,
  metadata text
);

-- Foreign keys, added after every table exists.

ALTER TABLE oauth_client ADD CONSTRAINT oauth_client_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE oauth_client_resource ADD CONSTRAINT oauth_client_resource_client_id_fkey FOREIGN KEY (client_id) REFERENCES oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE oauth_client_resource ADD CONSTRAINT oauth_client_resource_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES oauth_resource (identifier) ON DELETE CASCADE;
ALTER TABLE oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_client_id_fkey FOREIGN KEY (client_id) REFERENCES oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_session_id_fkey FOREIGN KEY (session_id) REFERENCES session (id) ON DELETE CASCADE;
ALTER TABLE oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE oauth_access_token ADD CONSTRAINT oauth_access_token_client_id_fkey FOREIGN KEY (client_id) REFERENCES oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE oauth_access_token ADD CONSTRAINT oauth_access_token_session_id_fkey FOREIGN KEY (session_id) REFERENCES session (id) ON DELETE CASCADE;
ALTER TABLE oauth_access_token ADD CONSTRAINT oauth_access_token_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE oauth_access_token ADD CONSTRAINT oauth_access_token_refresh_id_fkey FOREIGN KEY (refresh_id) REFERENCES oauth_refresh_token (id) ON DELETE CASCADE;
ALTER TABLE oauth_consent ADD CONSTRAINT oauth_consent_client_id_fkey FOREIGN KEY (client_id) REFERENCES oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE oauth_consent ADD CONSTRAINT oauth_consent_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;

COMMIT;
