import { miloThread } from "@mezo/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Milo's conversations.
 *
 * Every procedure filters on `ctx.session.user.id` as well as the thread id.
 * The id is generated in the browser, so it is a value a signed-in user could
 * type: without the owner in the `where`, guessing one would be enough to read
 * somebody else's health conversation.
 */

/** How many threads the sidebar shows before someone has to ask for more. */
const PAGE = 30;

/**
 * A stored conversation is whatever the AI SDK last streamed. Validating its
 * shape here would mean keeping a copy of `UIMessage` that has to be updated
 * every time the SDK adds a part type — and the only reader is the same SDK.
 * The cap is the part that matters: it is what stops a thread growing until it
 * cannot be loaded.
 */
const MAX_MESSAGES = 400;
const messages = z.array(z.unknown()).max(MAX_MESSAGES);

/** Long enough to tell two conversations apart in a sidebar, short enough to fit. */
const TITLE_LENGTH = 80;

export const miloRouter = createTRPCRouter({
	/** The sidebar list: newest first, titles only. */
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db.query.miloThread.findMany({
			where: eq(miloThread.userId, ctx.session.user.id),
			columns: { id: true, title: true, updatedAt: true },
			orderBy: desc(miloThread.updatedAt),
			limit: PAGE,
		}),
	),

	/**
	 * One conversation, for a page that is about to render it. Returns null for
	 * a thread that does not exist *or* is not this user's, so the two cases are
	 * indistinguishable from outside.
	 */
	get: protectedProcedure
		.input(z.object({ id: z.string().min(1).max(64) }))
		.query(async ({ ctx, input }) => {
			const thread = await ctx.db.query.miloThread.findFirst({
				where: and(
					eq(miloThread.id, input.id),
					eq(miloThread.userId, ctx.session.user.id),
				),
			});

			return thread ?? null;
		}),

	/**
	 * Written by the chat endpoint once a turn has finished streaming, so a
	 * cancelled or failed run leaves the previous state alone.
	 *
	 * The title is set on the first save and left alone after: a conversation
	 * that wanders is still the conversation the user started, and a name that
	 * changes under them is worse than one that is only roughly right.
	 */
	save: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1).max(64),
				title: z.string().trim().min(1).max(TITLE_LENGTH).nullish(),
				messages,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(miloThread)
				.values({
					id: input.id,
					userId: ctx.session.user.id,
					title: input.title ?? null,
					messages: input.messages,
				})
				.onConflictDoUpdate({
					target: miloThread.id,
					set: { messages: input.messages, updatedAt: new Date() },
					// Someone else's thread id is not one to overwrite.
					setWhere: eq(miloThread.userId, ctx.session.user.id),
				});
		}),

	remove: protectedProcedure
		.input(z.object({ id: z.string().min(1).max(64) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(miloThread)
				.where(
					and(
						eq(miloThread.id, input.id),
						eq(miloThread.userId, ctx.session.user.id),
					),
				);
		}),
});

/** The opening message, trimmed to something that fits a sidebar row. */
export const threadTitle = (text: string) => {
	const line = text.trim().replace(/\s+/g, " ");
	if (!line) return null;
	return line.length > TITLE_LENGTH
		? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
		: line;
};
