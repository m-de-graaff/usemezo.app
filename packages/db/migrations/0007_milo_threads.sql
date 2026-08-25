-- Milo's conversations, one row per thread.
--
-- Purely additive: a new table nothing reads yet, so old code is correct
-- against this schema and there is no expand-contract to stage. Creating the
-- index inline is safe here for the same reason CONCURRENTLY is needed
-- elsewhere and not here — the table is empty, so the build scans nothing and
-- blocks nothing.
--
-- `messages` holds the whole conversation as the `UIMessage[]` the AI SDK
-- streams, rewritten once per turn. Nothing queries inside it: the sidebar
-- wants titles and the chat wants the lot, and taking a thread apart into rows
-- would serve neither. See the comment on `miloThread` in `schema.ts`.
--
-- `title` is nullable because it is taken from the opening message, which does
-- not exist when the row is first written.
--
-- ON DELETE CASCADE from `user`: a deleted account takes its conversations
-- with it, which is the only defensible answer for chat about someone's health.
--
-- Reverse with:
--   DROP TABLE IF EXISTS milo_thread;
-- That is not a real rollback — it destroys every conversation, and there is
-- nowhere else they are kept. Before running it on anything but a local
-- database, take a dump of the table first.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS milo_thread (
	id text PRIMARY KEY,
	user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	title text,
	messages jsonb NOT NULL DEFAULT '[]'::jsonb,
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now()
);

-- The one query the list screen makes: this user's threads, newest first.
CREATE INDEX IF NOT EXISTS milo_thread_user_updated_idx
	ON milo_thread (user_id, updated_at DESC);

RESET lock_timeout;
RESET statement_timeout;
