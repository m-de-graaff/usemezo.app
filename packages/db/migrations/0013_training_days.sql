-- The week somebody plans to train, so a target can be right before the day is.
--
-- Purely additive: one new nullable column, so code written against the
-- previous schema is still correct against this one.
--
-- A `text[]` of weekday slugs rather than seven booleans or a bitmask, matching
-- `goals` and `preferred_activities` beside it. The slugs are `WEEKDAYS` in
-- `packages/api/src/profile-fields.ts` and are constrained in code rather than
-- by a CHECK, the same rule every other option column here follows.
--
-- This is a plan and not a record. What somebody actually trained is in
-- `workout`, and that always wins: the schedule only decides what to assume
-- before a session has been logged. Without it a hydration target only rises
-- once training is over, which is the wrong half of the day to find out you
-- needed another litre.
--
-- NULL and the empty array are deliberately the same thing here: no schedule.
-- Anyone who trains when they feel like it should not have to say so.

ALTER TABLE "user_profile"
	ADD COLUMN IF NOT EXISTS "training_days" text[];
