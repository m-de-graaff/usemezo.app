-- Unit-system preference for the profile screens.
--
-- Additive and nullable, so old code ignores it and new code reads a null as
-- "metric". Heights stay in centimetres and weights in kilograms whatever this
-- says: it decides presentation, never storage, so no backfill is needed and
-- switching it can never lose precision.
--
-- Reverse with:
--   ALTER TABLE user_profile DROP COLUMN IF EXISTS units;

SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS units text;

RESET lock_timeout;
RESET statement_timeout;
