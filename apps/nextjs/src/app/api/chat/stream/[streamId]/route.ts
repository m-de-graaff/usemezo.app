import { createCaller } from "@mezo/api";
import { createTRPCContext } from "@mezo/api/trpc";
import { auth } from "@mezo/auth";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { miloStreams } from "~/lib/milo-streams";

export const maxDuration = 60;

/**
 * Reconnect a browser to a reply that is still being written.
 *
 * Called on its own by the chat runtime when it opens a conversation whose
 * thread row names a run: the buffer replays what has already been generated
 * and then keeps up with the rest, so the screen lands where the reply is
 * rather than where it was when the tab closed.
 *
 * 204 rather than 404 for a run this process knows nothing about. A restarted
 * server, an instance that did not produce it, or a run whose buffer has aged
 * out are all the same answer to the browser: there is nothing to catch up on,
 * show what is saved.
 */
export async function GET(
	req: Request,
	{ params }: { params: Promise<{ streamId: string }> },
) {
	// Route handlers read the request's own headers rather than `headers()`,
	// which is what `/api/trpc` does and what keeps the cookie in reach.
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return new Response("Unauthorized", { status: 401 });

	const { streamId } = await params;

	// The thread row is the authority on whose run this is. A stream id is a
	// value a signed-in user could type, and what it addresses is somebody's
	// health conversation.
	const trpc = createCaller(() => createTRPCContext({ headers: req.headers }));
	const owned = await trpc.milo.resumable({ streamId });
	if (!owned) return new Response(null, { status: 204 });

	const stream = await miloStreams.resume(streamId);
	if (!stream) return new Response(null, { status: 204 });

	return new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS });
}

/**
 * Stop a reply that is still being written.
 *
 * The counterpart to leaving the page: that must not stop the run, so pressing
 * stop has to say so explicitly. Dropping the buffer cancels whatever is
 * feeding it, and clearing the thread's stream id is what stops the next visit
 * asking to be reconnected to a run nobody is producing any more.
 *
 * The conversation is left as whatever was last written to it. Nothing is
 * saved from here: what a stopped reply had got to is on the screen of the
 * browser that stopped it, and it goes back to the model with the next turn
 * either way.
 */
export async function DELETE(
	req: Request,
	{ params }: { params: Promise<{ streamId: string }> },
) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) return new Response("Unauthorized", { status: 401 });

	const { streamId } = await params;

	const trpc = createCaller(() => createTRPCContext({ headers: req.headers }));
	const owned = await trpc.milo.resumable({ streamId });
	// Already over, or never this user's. Either way there is nothing to stop
	// and nothing worth telling them apart.
	if (!owned) return new Response(null, { status: 204 });

	await trpc.milo.stopped({ streamId });
	await miloStreams.delete(streamId);

	return new Response(null, { status: 204 });
}
