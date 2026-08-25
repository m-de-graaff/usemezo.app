-- Routines and workouts, one table each.
--
-- Purely additive: two new tables nothing reads yet, so the code running before
-- this deploy is correct against the schema after it, and there is no
-- expand-contract to stage. Both are empty on creation, so the indexes are
-- built inline rather than CONCURRENTLY: the build scans nothing and blocks
-- nothing.
--
-- Both exercise lists are single `jsonb` documents. Nothing queries inside one;
-- see the comments on `routine` and `workout` in `schema.ts` for why, and
-- `@mezo/api/workout-shape` for the shape a write has to satisfy.
--
-- `workout_one_live_per_user` is the load-bearing one. A live session is a row
-- with `finished_at IS NULL`, so this partial unique index is what makes "at
-- most one session in progress" a property of the data rather than a rule the
-- application has to keep remembering. Without it, two tabs pressing Start at
-- the same moment both succeed and the user has two.
--
-- `workout.routine_id` is ON DELETE SET NULL, not CASCADE: deleting a routine
-- must not delete the training somebody did from it. `user_id` is CASCADE,
-- because a deleted account takes its own training with it.
--
-- Reverse with:
--   DROP TABLE IF EXISTS workout;
--   DROP TABLE IF EXISTS routine;
-- In that order, for the foreign key. That is not a real rollback: it destroys
-- every logged session and there is nowhere else they are kept. Before running
-- it anywhere but a local database, take a dump of both tables first.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS routine (
	id text PRIMARY KEY,
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	name text NOT NULL,
	note text,
	position integer NOT NULL DEFAULT 0,
	exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now()
);

-- The list screen's only query: this user's routines, in their order.
CREATE INDEX IF NOT EXISTS routine_user_position_idx
	ON routine (user_id, position);

CREATE TABLE IF NOT EXISTS workout (
	id text PRIMARY KEY,
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	routine_id text REFERENCES routine(id) ON DELETE SET NULL,
	name text NOT NULL,
	note text,
	exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
	started_at timestamp NOT NULL DEFAULT now(),
	finished_at timestamp,
	volume_kg real NOT NULL DEFAULT 0,
	set_count integer NOT NULL DEFAULT 0,
	duration_sec integer NOT NULL DEFAULT 0
);

-- History, newest first, and every date-ranged read the dashboard makes.
CREATE INDEX IF NOT EXISTS workout_user_started_idx
	ON workout (user_id, started_at DESC);

-- At most one live session per user. See the note above.
CREATE UNIQUE INDEX IF NOT EXISTS workout_one_live_per_user
	ON workout (user_id) WHERE finished_at IS NULL;

RESET lock_timeout;
RESET statement_timeout;
