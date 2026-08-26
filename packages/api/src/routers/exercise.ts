import type { db as Database } from "@mezo/db";
import { customExercise, hiddenExercise } from "@mezo/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	BODY_PARTS,
	CUSTOM_PREFIX,
	customById,
	EQUIPMENT,
	type Exercise,
	exerciseById,
	normaliseName,
	searchExercises,
	type UserCatalogue,
} from "../exercises.ts";
import { muscleOf } from "../training.ts";
import { createTRPCRouter, protectedProcedure } from "../trpc.ts";

/**
 * The two things a user can do to the exercise catalogue: add to it, and take
 * things out of it.
 *
 * Neither is a preference dressed up as one. An exercise somebody added is a
 * real row that routines and finished sessions reference by id, and an exercise
 * somebody blacklisted is never offered again by the picker or by Milo. That
 * second one has to be exact: a ranking that merely deprioritises a movement
 * somebody's shoulder cannot do is how it comes back in a routine six weeks
 * later.
 *
 * Every procedure filters on `ctx.session.user.id`, the same as everywhere
 * else: ids in this app are values a signed-in user could type.
 */

/**
 * How many exercises one person can add.
 *
 * A cap rather than an eviction policy, the same call `milo_note` makes: a full
 * list is reported so the model can propose deleting one, because which
 * exercise is no longer wanted is not a question a limit should answer.
 */
const CUSTOM_LIMIT = 100;
/** How many one person can blacklist. Generous; it is one narrow row each. */
const HIDDEN_LIMIT = 500;

const ID = z.string().min(1).max(64);
const REASON = z.string().trim().min(1).max(200).nullish();

/**
 * A muscle the catalogue's own vocabulary knows, which is what `musclesWorked`
 * needs before it can count a set towards anything.
 *
 * Validated rather than accepted as free text, because the failure is silent:
 * an exercise whose target maps to nothing contributes zero to every volume
 * audit for the rest of its life, and nothing on any screen says why.
 */
const muscleName = z
	.string()
	.trim()
	.min(2)
	.max(40)
	.refine((name) => muscleOf(name) !== null, {
		message:
			"Not a muscle this app counts volume for. Use the catalogue's own names: pectorals, lats, traps, delts, biceps, triceps, forearms, quads, hamstrings, glutes, calves, abs.",
	});

export const customExerciseInput = z.object({
	name: z.string().trim().min(3).max(80),
	bodyPart: z.enum(BODY_PARTS as [string, ...string[]]),
	equipment: z.enum(EQUIPMENT as [string, ...string[]]),
	target: muscleName,
	secondary: z.array(muscleName).max(6).default([]),
});

/** A stored row, as the rest of the app wants to see it. */
const toExercise = (row: {
	id: string;
	name: string;
	bodyPart: string;
	equipment: string;
	target: string;
	secondary: string[];
}): Exercise => ({
	id: row.id,
	name: row.name,
	bodyPart: row.bodyPart,
	equipment: row.equipment,
	target: row.target,
	secondary: row.secondary,
});

/** Whether the dataset already has an exercise under this exact name. */
const inCatalogue = (name: string) =>
	searchExercises({ query: name, custom: [], limit: 20 }).find(
		(exercise) => normaliseName(exercise.name) === normaliseName(name),
	);

/**
 * One user's own layer over the catalogue, in one round trip.
 *
 * Exported rather than only reachable as a procedure because the workout router
 * needs the same thing: checking that a saved routine's exercises exist has to
 * consider the ones this user invented, and calling ourselves over tRPC for
 * that would be a serialisation round trip for two indexed reads.
 */
export async function userCatalogue(
	db: typeof Database,
	userId: string,
): Promise<UserCatalogue> {
	const [custom, hidden] = await Promise.all([
		db.query.customExercise.findMany({
			where: eq(customExercise.userId, userId),
			orderBy: asc(customExercise.name),
			limit: CUSTOM_LIMIT,
		}),
		db.query.hiddenExercise.findMany({
			where: eq(hiddenExercise.userId, userId),
			columns: { exerciseId: true },
			limit: HIDDEN_LIMIT,
		}),
	]);

	return {
		custom: custom.map(toExercise),
		hidden: new Set(hidden.map((row) => row.exerciseId)),
	};
}

export const exerciseRouter = createTRPCRouter({
	/**
	 * Everything the browser needs to render the catalogue as this user sees it.
	 * Read once in the app shell and registered there, so no component that only
	 * wants an exercise's name has to know any of this exists.
	 */
	catalogue: protectedProcedure.query(async ({ ctx }) => {
		const { custom, hidden } = await userCatalogue(ctx.db, ctx.session.user.id);
		// A Set does not survive the wire; the shell puts it back together.
		return { custom, hidden: [...hidden] };
	}),

	/** The blacklist, named, for the screen that offers to undo it. */
	hidden: protectedProcedure.query(async ({ ctx }) => {
		const [rows, { custom }] = await Promise.all([
			ctx.db.query.hiddenExercise.findMany({
				where: eq(hiddenExercise.userId, ctx.session.user.id),
				orderBy: asc(hiddenExercise.createdAt),
				limit: HIDDEN_LIMIT,
			}),
			userCatalogue(ctx.db, ctx.session.user.id),
		]);

		const mine = customById(custom);
		return rows.map((row) => ({
			exerciseId: row.exerciseId,
			reason: row.reason,
			// Null for a custom exercise that was deleted after it was hidden. The
			// row is still shown, so it can still be cleared.
			name: exerciseById(row.exerciseId, mine)?.name ?? null,
		}));
	}),

	/**
	 * Add one the dataset never had.
	 *
	 * Two names that differ only in case or spacing are the same exercise, and so
	 * are a new one and a dataset one. Returning what already exists rather than
	 * refusing is what stops a model that has forgotten it added something from
	 * either failing outright or leaving a duplicate somebody has to clean up.
	 */
	create: protectedProcedure
		.input(customExerciseInput)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { custom } = await userCatalogue(ctx.db, userId);

			const mine = custom.find(
				(exercise) =>
					normaliseName(exercise.name) === normaliseName(input.name),
			);
			if (mine) return { exercise: mine, status: "already yours" as const };

			const known = inCatalogue(input.name);
			if (known) return { exercise: known, status: "already known" as const };

			if (custom.length >= CUSTOM_LIMIT) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `You already have ${CUSTOM_LIMIT} exercises of your own, which is the limit. Delete one first.`,
				});
			}

			const row = {
				id: `${CUSTOM_PREFIX}${crypto.randomUUID()}`,
				userId,
				name: input.name,
				bodyPart: input.bodyPart,
				equipment: input.equipment,
				target: input.target,
				secondary: input.secondary,
			};
			await ctx.db.insert(customExercise).values(row);

			return { exercise: toExercise(row), status: "created" as const };
		}),

	/**
	 * Delete one.
	 *
	 * Routines and finished sessions that used it keep the id and render as
	 * "Unknown exercise" from here on. That is the deliberate answer: rewriting
	 * somebody's history to erase a movement they actually did is the worse of
	 * the two, and a session that happened happened.
	 */
	remove: protectedProcedure
		.input(z.object({ id: ID }))
		.mutation(async ({ ctx, input }) => {
			const gone = await ctx.db
				.delete(customExercise)
				.where(
					and(
						eq(customExercise.id, input.id),
						eq(customExercise.userId, ctx.session.user.id),
					),
				)
				.returning({ id: customExercise.id });

			return { removed: gone.length > 0 };
		}),

	/** Never offer this one again. Hiding the same exercise twice is one fact. */
	hide: protectedProcedure
		.input(z.object({ exerciseId: ID, reason: REASON }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { custom } = await userCatalogue(ctx.db, userId);

			const exercise = exerciseById(input.exerciseId, customById(custom));
			if (!exercise) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `No exercise with id ${input.exerciseId}.`,
				});
			}

			await ctx.db
				.insert(hiddenExercise)
				.values({
					userId,
					exerciseId: input.exerciseId,
					reason: input.reason ?? null,
				})
				.onConflictDoUpdate({
					target: [hiddenExercise.userId, hiddenExercise.exerciseId],
					// A second attempt usually carries a better reason than the first.
					set: { reason: input.reason ?? null },
				});

			return { exerciseId: exercise.id, name: exercise.name };
		}),

	unhide: protectedProcedure
		.input(z.object({ exerciseId: ID }))
		.mutation(async ({ ctx, input }) => {
			const gone = await ctx.db
				.delete(hiddenExercise)
				.where(
					and(
						eq(hiddenExercise.exerciseId, input.exerciseId),
						eq(hiddenExercise.userId, ctx.session.user.id),
					),
				)
				.returning({ exerciseId: hiddenExercise.exerciseId });

			return { unhidden: gone.length > 0 };
		}),
});
