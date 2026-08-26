-- The two readings from a bioimpedance scan that Mezo could not already hold.
--
-- Purely additive: two nullable columns on an existing table, no default and no
-- backfill, so the rewrite is metadata-only and old code is correct against the
-- new schema. Nothing reads them until the settings form and Milo are deployed.
--
-- Why only two, when a scan prints a dozen figures.
--
-- Most of what an InBody-style device reports is the same handful of
-- measurements rearranged. Fat free mass is weight minus fat mass. Soft lean
-- mass is fat free mass minus bone. Intracellular water is total body water
-- minus the extracellular part. Storing those next to their own inputs buys
-- columns that disagree with each other the first time somebody updates their
-- weight and not the rest, and a profile that contradicts itself is worse than
-- one with a row missing. They are computed on read instead, in
-- `bodyComposition` in packages/api/src/plan.ts.
--
-- These two are not derivable from anything already stored:
--
--   extracellular_water_kg  The water outside the cells. Its ratio against
--                           total body water is what a clinician reads, and
--                           the intracellular half falls out of the pair.
--
--   phase_angle_deg         Degrees, straight off the device's reactance and
--                           resistance. The one figure on a scan that is not
--                           arithmetic on the others: it tracks cell membrane
--                           integrity, so it moves with training and recovery
--                           rather than with hydration.
--
-- Both are `real` and nullable, matching every other body composition column:
-- these come off a smart scale or a DEXA, and most users have none of them.
--
-- Reverse with:
--   ALTER TABLE user_profile
--     DROP COLUMN IF EXISTS extracellular_water_kg,
--     DROP COLUMN IF EXISTS phase_angle_deg;
-- That destroys the readings and nothing else; the derived figures are
-- unaffected because they were never stored.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE user_profile
	ADD COLUMN IF NOT EXISTS extracellular_water_kg real,
	ADD COLUMN IF NOT EXISTS phase_angle_deg real;

RESET lock_timeout;
RESET statement_timeout;
