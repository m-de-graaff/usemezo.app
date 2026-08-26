-- Exercises a user added, and exercises a user never wants offered again.
--
-- Purely additive: two new tables nothing reads yet, so old code is correct
-- against this schema and there is no expand-contract to stage. The indexes are
-- built inline rather than CONCURRENTLY because the tables are empty, so the
-- build scans nothing and blocks nothing.
--
-- The catalogue in `packages/api/src/exercises.ts` is a fixed list of about
-- 1300 movements committed into the repository. It is missing things people
-- actually train, and it offers things a given person never will.
-- `custom_exercise` is the first gap and `hidden_exercise` is the second, and
-- between them they turn one shared list into one per user.
--
-- `custom_exercise.body_part`, `equipment` and `target` are constrained in code
-- rather than by CHECK constraints. Their allowed values are derived from the
-- dataset itself, so they change whenever the dataset is regenerated and a
-- constraint here would make that a migration every time.
--
-- `hidden_exercise.exercise_id` has deliberately no foreign key: it holds ids
-- from the fixed catalogue *and* from custom_exercise, and there is no single
-- table to point at. A deleted custom exercise therefore leaves its blacklist
-- row behind, which is a row matching nothing rather than a broken reference.
--
-- ON DELETE CASCADE from "user" on both: a deleted account takes its own
-- exercises and its own blacklist with it.
--
-- Reverse with:
--   DROP TABLE IF EXISTS hidden_exercise;
--   DROP TABLE IF EXISTS custom_exercise;
-- Dropping custom_exercise destroys the definitions, and every routine and
-- finished session that referenced one is left holding an id nothing can
-- resolve. Those rows still render, as "Unknown exercise". Before running this
-- on anything but a local database, take a dump of both tables first.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS custom_exercise (
	id text PRIMARY KEY,
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	name text NOT NULL,
	body_part text NOT NULL,
	equipment text NOT NULL,
	target text NOT NULL,
	secondary text[] NOT NULL DEFAULT '{}',
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now()
);

-- The one query anything makes: this user's exercises, to merge into the
-- catalogue before it is searched or rendered.
CREATE INDEX IF NOT EXISTS custom_exercise_user_idx
	ON custom_exercise (user_id, name);

CREATE TABLE IF NOT EXISTS hidden_exercise (
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	exercise_id text NOT NULL,
	reason text,
	created_at timestamp NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, exercise_id)
);

RESET lock_timeout;
RESET statement_timeout;
