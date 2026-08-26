import "server-only";

import {
	createInMemoryResumableStreamStore,
	createResumableStreamContext,
	type ResumableStreamContext,
} from "assistant-stream/resumable";
import { after } from "next/server";

/**
 * The buffer a reply is written into while it is being written.
 *
 * A turn used to live entirely inside one HTTP response: close the tab and the
 * generation went with it, and because the conversation was only saved once the
 * stream finished, the question that started it went too. This is the other
 * half of the fix. The run's bytes are kept here as they are produced, so a
 * browser coming back to the conversation can be handed the same stream from
 * the beginning and watch the rest of it arrive.
 *
 * `after` is what keeps the producer alive once the response has been returned:
 * without it the runtime is entitled to stop the work the moment the handler
 * hands back a stream, which is exactly the case this exists for.
 *
 * ponytail: in memory, so a restart drops every buffer and a second instance
 * cannot see the first one's runs. The conversation itself is in Postgres and
 * the endpoint answers "nothing to resume" rather than failing, so the cost is
 * a lost reply rather than a broken screen. Swap the store for the Redis one
 * from the same package if this ever runs on more than one process.
 */
const TTL_MS = 10 * 60 * 1000;

/**
 * Cached on `globalThis` for the same reason the database client is: a module
 * reloaded on every edit in development would otherwise strand the run that
 * was going when the file was saved.
 */
const globalForStreams = globalThis as unknown as {
	miloStreams?: ResumableStreamContext;
};

export const miloStreams: ResumableStreamContext =
	globalForStreams.miloStreams ??
	createResumableStreamContext({
		store: createInMemoryResumableStreamStore({ defaultTtlMs: TTL_MS }),
		ttlMs: TTL_MS,
		waitUntil: after,
	});

globalForStreams.miloStreams = miloStreams;
