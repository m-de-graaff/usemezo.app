-- The settings questionnaire: one row per user, created on first save.
--
-- Purely additive — a new table with no constraint on any existing one — so
-- code running before this migration is unaffected, and code running after it
-- against the old schema only fails on the settings screens. No lock is taken
-- on a live table, so no lock_timeout dance is needed here.
--
-- Every column is nullable: the questionnaire is answered over time and a
-- partially filled profile is the normal state. The allowed values for the text
-- columns are enforced in the API (packages/api/src/profile-fields.ts), not by
-- a CHECK constraint, so adding an option later stays a code change.
--
-- Reverse with (destroys every answered profile — take a dump first):
--   DROP TABLE IF EXISTS user_profile;

CREATE TABLE IF NOT EXISTS user_profile (
	user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,

	goals text[],
	fitness_experience text,
	preferred_activities text[],
	sleep_hours text,

	birth_date date,
	gender text,
	blood_type text,

	body_type text,
	height_cm integer,
	weight_kg real,

	eating_habits text,
	daily_calories integer,

	medications text,
	supplements text,
	physical_limitations text,
	checkup_frequency text,

	updated_at timestamp NOT NULL DEFAULT now()
);
