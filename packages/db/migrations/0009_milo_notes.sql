-- What Milo remembers about somebody between conversations.
--
-- Purely additive: a new table nothing reads yet, so old code is correct
-- against this schema and there is no expand-contract to stage. Creating the
-- index inline is safe here for the same reason CONCURRENTLY is needed
-- elsewhere and not here — the table is empty, so the build scans nothing and
-- blocks nothing.
--
-- `user_profile` holds the answers Mezo knows to ask for. This holds the ones
-- it does not: a goal somebody mentions in passing, a piece of equipment their
-- gym does not have, a shoulder that gives out on overhead work. No column
-- could have anticipated them, and they are the difference between a coach and
-- a form.
--
-- A row per note rather than an array on the profile, because notes are written
-- and deleted one at a time from two places — the model as it works, and the
-- user reviewing the list — and a whole-document rewrite between those two
-- loses whichever one wrote second.
--
-- `kind` is text rather than an enum: it orders the list and nothing branches
-- on it in SQL, so adding a kind should be a deploy and not a migration. The
-- values are `NOTE_KINDS` in `packages/api/src/routers/milo.ts`, and the
-- default matches the column default there.
--
-- ON DELETE CASCADE from `user`: a deleted account takes its notes with it,
-- which is the only defensible answer for anything written down about
-- someone's body.
--
-- Reverse with:
--   DROP TABLE IF EXISTS milo_note;
-- That is not a real rollback — it destroys every note, and there is nowhere
-- else they are kept. Before running it on anything but a local database, take
-- a dump of the table first.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS milo_note (
	id text PRIMARY KEY,
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	kind text NOT NULL DEFAULT 'fact',
	text text NOT NULL,
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now()
);

-- The one query anything makes: this user's notes, most recently touched first.
CREATE INDEX IF NOT EXISTS milo_note_user_updated_idx
	ON milo_note (user_id, updated_at DESC);

RESET lock_timeout;
RESET statement_timeout;
