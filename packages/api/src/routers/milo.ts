import { miloNote, miloThread } from "@mezo/db/schema";
import { TRPCError } from "@trpc/server";
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

/* -------------------------------------------------------------------------- */
/* What Milo remembers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The kinds of thing worth keeping between conversations, in the order they
 * matter.
 *
 * A goal shapes every routine that follows it. A constraint rules things out
 * and is the one that hurts most when it is forgotten. A preference is worth
 * honouring and worth overriding. A fact is context, and the bucket everything
 * else falls into.
 */
export const NOTE_KINDS = ["goal", "constraint", "preference", "fact"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** Long enough for a sentence about somebody, short enough to be one. */
const NOTE_LENGTH = 300;

export const noteInput = z.object({
	kind: z.enum(NOTE_KINDS),
	text: z.string().trim().min(3).max(NOTE_LENGTH),
});

/**
 * How many notes one person can accumulate.
 *
 * A cap rather than an eviction policy. Silently dropping the oldest note is
 * how an assistant forgets the injury somebody mentioned once, and the fix for
 * a full list is a decision about what no longer matters, which is the user's
 * to make or the model's to argue for.
 */
const NOTE_LIMIT = 50;

/** Two notes are the same note if they say the same thing in the same words. */
const normalise = (text: string) =>
	text.trim().toLowerCase().replace(/\s+/g, " ");

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
				/**
				 * The run this save belongs to, or null to say there is no longer
				 * one. Left out entirely, whatever is stored is left alone: a save
				 * that is not about a run has no opinion on whether one is going.
				 */
				activeStreamId: z.string().min(1).max(64).nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const stream =
				input.activeStreamId === undefined
					? {}
					: { activeStreamId: input.activeStreamId };

			await ctx.db
				.insert(miloThread)
				.values({
					id: input.id,
					userId: ctx.session.user.id,
					title: input.title ?? null,
					messages: input.messages,
					...stream,
				})
				.onConflictDoUpdate({
					target: miloThread.id,
					set: { messages: input.messages, updatedAt: new Date(), ...stream },
					// Someone else's thread id is not one to overwrite.
					setWhere: eq(miloThread.userId, ctx.session.user.id),
				});
		}),

	/**
	 * Whose run this is, for the endpoint that reconnects a browser to it.
	 *
	 * A stream id is a value somebody could type, and the buffer behind it is
	 * one person's health conversation. The row is the authority on who may
	 * read it, which is the same rule every other procedure here follows.
	 */
	resumable: protectedProcedure
		.input(z.object({ streamId: z.string().min(1).max(64) }))
		.query(async ({ ctx, input }) => {
			const thread = await ctx.db.query.miloThread.findFirst({
				columns: { id: true },
				where: and(
					eq(miloThread.activeStreamId, input.streamId),
					eq(miloThread.userId, ctx.session.user.id),
				),
			});

			return thread ? { threadId: thread.id } : null;
		}),

	/**
	 * Mark a run as over without touching the conversation.
	 *
	 * Its own procedure rather than a `save` with no messages: stopping is about
	 * the run, and the messages the browser holds at that moment are a half a
	 * reply nobody asked to keep.
	 */
	stopped: protectedProcedure
		.input(z.object({ streamId: z.string().min(1).max(64) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(miloThread)
				.set({ activeStreamId: null })
				.where(
					and(
						eq(miloThread.activeStreamId, input.streamId),
						eq(miloThread.userId, ctx.session.user.id),
					),
				);
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

	/**
	 * Everything Milo has been told to remember, goals first.
	 *
	 * Sorted here rather than in SQL: ordering by a text column's position in a
	 * list means a CASE expression that has to be kept in step with `NOTE_KINDS`,
	 * and this is fifty rows.
	 */
	notes: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db.query.miloNote.findMany({
			where: eq(miloNote.userId, ctx.session.user.id),
			orderBy: desc(miloNote.updatedAt),
			limit: NOTE_LIMIT,
		});

		return rows.sort(
			(a, b) =>
				NOTE_KINDS.indexOf(a.kind as NoteKind) -
				NOTE_KINDS.indexOf(b.kind as NoteKind),
		);
	}),

	/**
	 * Write one down.
	 *
	 * Three things it will not do. It will not store the same sentence twice —
	 * a model reminded of a goal every session would otherwise write it every
	 * session. It will not grow past `NOTE_LIMIT`; a full list is reported so
	 * the model can propose forgetting something rather than a note vanishing.
	 * And `replaces` is how a change of mind is one operation instead of a
	 * delete and an insert with a gap in the middle where the old answer is
	 * gone and the new one is not there yet.
	 */
	remember: protectedProcedure
		.input(
			noteInput.extend({
				replaces: z
					.string()
					.min(1)
					.max(64)
					.nullish()
					.describe("The note this one supersedes, if it supersedes one."),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const existing = await ctx.db.query.miloNote.findMany({
				where: eq(miloNote.userId, userId),
				columns: { id: true, text: true },
			});

			const same = existing.find(
				(note) => normalise(note.text) === normalise(input.text),
			);
			if (same) {
				// Touched rather than duplicated, so a fact repeated in a later
				// conversation still floats to the top of the list.
				await ctx.db
					.update(miloNote)
					.set({ kind: input.kind, updatedAt: new Date() })
					.where(and(eq(miloNote.id, same.id), eq(miloNote.userId, userId)));
				return { id: same.id, status: "already known" as const };
			}

			if (input.replaces) {
				const replaced = await ctx.db
					.update(miloNote)
					.set({ kind: input.kind, text: input.text, updatedAt: new Date() })
					.where(
						and(eq(miloNote.id, input.replaces), eq(miloNote.userId, userId)),
					)
					.returning({ id: miloNote.id });

				// A `replaces` pointing at nothing is a model working from a stale
				// list, not a reason to lose the note: it falls through and is
				// written as a new one.
				if (replaced[0]) {
					return { id: replaced[0].id, status: "replaced" as const };
				}
			}

			if (existing.length >= NOTE_LIMIT) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Milo is already remembering ${NOTE_LIMIT} things, which is the limit. Forget one first.`,
				});
			}

			const id = crypto.randomUUID();
			await ctx.db
				.insert(miloNote)
				.values({ id, userId, kind: input.kind, text: input.text });

			return { id, status: "saved" as const };
		}),

	forget: protectedProcedure
		.input(z.object({ id: z.string().min(1).max(64) }))
		.mutation(async ({ ctx, input }) => {
			const gone = await ctx.db
				.delete(miloNote)
				.where(
					and(
						eq(miloNote.id, input.id),
						eq(miloNote.userId, ctx.session.user.id),
					),
				)
				.returning({ id: miloNote.id });

			return { forgotten: gone.length > 0 };
		}),

	/** The whole list, for somebody who wants none of it kept. */
	forgetEverything: protectedProcedure.mutation(async ({ ctx }) => {
		const gone = await ctx.db
			.delete(miloNote)
			.where(eq(miloNote.userId, ctx.session.user.id))
			.returning({ id: miloNote.id });

		return { forgotten: gone.length };
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
