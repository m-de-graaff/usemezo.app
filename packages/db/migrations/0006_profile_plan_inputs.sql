-- The three answers the starting-plan calculation needs and could not derive.
--
-- `activity_level` is the TDEE multiplier's input: without it a total daily
-- energy expenditure is a guess dressed as a number, which is worse than
-- declining to show one. `goal_direction` decides whether the calorie target
-- sits above or below maintenance, and `target_weight_kg` is what turns that
-- into a pace and a finish line.
--
-- All three are additive and nullable, so old code ignores them and new code
-- reads a null as "not answered" — the plan screen names what is missing
-- rather than substituting a default. No backfill: there is no honest value to
-- backfill with.
--
-- `target_weight_kg` is real and in kilograms, matching `weight_kg`. Storage
-- stays metric whatever `units` says.
--
-- Reverse with:
--   ALTER TABLE user_profile DROP COLUMN IF EXISTS activity_level;
--   ALTER TABLE user_profile DROP COLUMN IF EXISTS target_weight_kg;
--   ALTER TABLE user_profile DROP COLUMN IF EXISTS goal_direction;
-- Those drops lose the answers; nothing else depends on them.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS goal_direction text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS target_weight_kg real;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS activity_level text;

RESET lock_timeout;
RESET statement_timeout;
