-- Hydration: one row per drink, and a target the user can take over.
--
-- Purely additive: a new table nothing else reads and one new nullable column
-- on `user_profile`, so code written against the previous schema is still
-- correct against this one and there is no expand-contract to stage. The index
-- is built inline rather than CONCURRENTLY because the table is empty, so the
-- build scans nothing and blocks nothing.
--
-- `day` is a DATE and not a timestamp, and it is written by the browser rather
-- than derived on the server. A glass at half eleven at night belongs to the
-- day the person drinking it thinks it does; the server knows the instant and
-- has no idea what day that is where they are standing. Deriving it here would
-- file a late drink under tomorrow for anyone east of the deployment.
--
-- `amount_ml` is what was in the glass, before the beverage hydration index in
-- `packages/api/src/hydration.ts` is applied to it. The index is a published
-- finding that may be revised; what somebody drank is not, and storing the
-- adjusted figure would bake one into rows nobody could unpick later.
--
-- `drink` has deliberately no CHECK constraint and no foreign key. Its values
-- are slugs from a list in the API package that grows whenever somebody thinks
-- of a drink nobody had listed, and a constraint here would make each of those
-- a migration. An unrecognised slug counts at face value, which is the right
-- answer for a fluid Mezo has no index for.
--
-- `user_profile.hydration_goal_ml` is nullable on purpose: NULL is "the
-- computed target stands", which is a different fact from any number, and a
-- default would be this file guessing at arithmetic that lives in code.

CREATE TABLE IF NOT EXISTS "hydration_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"day" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"drink" text DEFAULT 'water' NOT NULL,
	"logged_at" timestamp NOT NULL
);

-- Every read this table has is one user over a range of days.
CREATE INDEX IF NOT EXISTS "hydration_log_user_day_idx"
	ON "hydration_log" ("user_id", "day");

ALTER TABLE "user_profile"
	ADD COLUMN IF NOT EXISTS "hydration_goal_ml" integer;
