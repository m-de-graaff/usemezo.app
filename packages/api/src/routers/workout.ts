import { routine, workout } from "@mezo/db/schema";
import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	lt,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { exerciseById } from "../exercises.ts";
import { createTRPCRouter, protectedProcedure } from "../trpc.ts";
import {
	decodeCursor,
	doneSetCount,
	dropUnfinished,
	encodeCursor,
	isoDay,
	type RoutineExercise,
	routineExercises,
	startFromRoutine,
	volumeKg,
	type WorkoutExercise,
	workoutExercises,
} from "../workout-shape.ts";

/**
 * Routines and training sessions.
 *
 * Every procedure filters on `ctx.session.user.id` alongside the row id. Ids
 * are minted in the browser, so an id is a value a signed-in user could type:
 * without the owner in the `where`, guessing one would be enough to read or
 * overwrite somebody else's training.
 */

/** Enough routines that nobody hits it, few enough that the list stays a list. */
const ROUTINE_LIMIT = 100;
/** One page of history. Capped here; an uncapped limit is a denial of service parameter. */
const HISTORY_PAGE = 20;
const HISTORY_MAX = 50;
/** How far back the dashboard reads. Its widest range is 90 days. */
const STATS_DAYS = 90;
/** How many sessions the dashboard's recent list shows. */
const RECENT_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

const ID = z.string().min(1).max(64);
const NAME = z.string().trim().min(1).max(80);
const NOTE = z.string().trim().max(1000).nullish();

/** The columns history and the dashboard read. Never the `jsonb`. */
const summaryColumns = {
	id: workout.id,
	name: workout.name,
	startedAt: workout.startedAt,
	finishedAt: workout.finishedAt,
	volumeKg: workout.volumeKg,
	setCount: workout.setCount,
	durationSec: workout.durationSec,
};

/**
 * An id the catalogue does not know is one nothing can render: a row the user
 * can neither identify nor, once it is in a session, explain. Checked here
 * rather than in the Zod schema because that schema is shared with the browser,
 * and shipping the check there would mean the same validation twice with only
 * one of them authoritative.
 */
function assertKnownExercises(
	exercises: { key: string; exerciseId: string }[],
): void {
	const unknown = exercises.find((entry) => !exerciseById(entry.exerciseId));
	if (unknown) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `No exercise with id ${unknown.exerciseId}.`,
		});
	}

	if (new Set(exercises.map((entry) => entry.key)).size !== exercises.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Two exercises in this list share a key.",
		});
	}
}

export const workoutRouter = createTRPCRouter({
	/** The list screen: every routine this user has, in their own order. */
	routines: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db.query.routine.findMany({
			where: eq(routine.userId, ctx.session.user.id),
			orderBy: [asc(routine.position), asc(routine.createdAt)],
			limit: ROUTINE_LIMIT,
		});

		return rows.map((row) => ({
			...row,
			exercises: row.exercises as RoutineExercise[],
		}));
	}),

	/**
	 * One routine. Null for one that does not exist *or* is not this user's, so
	 * the two are indistinguishable from outside.
	 */
	routine: protectedProcedure
		.input(z.object({ id: ID }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.routine.findFirst({
				where: and(
					eq(routine.id, input.id),
					eq(routine.userId, ctx.session.user.id),
				),
			});

			return row
				? { ...row, exercises: row.exercises as RoutineExercise[] }
				: null;
		}),

	/**
	 * Create or replace. The builder holds the whole routine on screen and sends
	 * the whole routine back, so a partial update would be a shape nothing
	 * produces.
	 */
	saveRoutine: protectedProcedure
		.input(
			z.object({
				id: ID,
				name: NAME,
				note: NOTE,
				exercises: routineExercises,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertKnownExercises(input.exercises);

			await ctx.db
				.insert(routine)
				.values({
					id: input.id,
					userId: ctx.session.user.id,
					name: input.name,
					note: input.note ?? null,
					exercises: input.exercises,
				})
				.onConflictDoUpdate({
					target: routine.id,
					set: {
						name: input.name,
						note: input.note ?? null,
						exercises: input.exercises,
						updatedAt: new Date(),
					},
					// Somebody else's routine id is not one to overwrite.
					setWhere: eq(routine.userId, ctx.session.user.id),
				});

			return { id: input.id };
		}),

	removeRoutine: protectedProcedure
		.input(z.object({ id: ID }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(routine)
				.where(
					and(
						eq(routine.id, input.id),
						eq(routine.userId, ctx.session.user.id),
					),
				);
		}),

	/**
	 * The whole order at once, as the list renders it. One statement rather than
	 * a write per row, so a half-applied reorder is not a state the list can be
	 * left in.
	 */
	reorderRoutines: protectedProcedure
		.input(z.object({ ids: z.array(ID).min(1).max(ROUTINE_LIMIT) }))
		.mutation(async ({ ctx, input }) => {
			// The `::int` is not decoration. The driver binds every parameter as
			// text, and a bare CASE arm has no column to take its type from, so
			// Postgres refuses the assignment with 42804.
			const cases = input.ids.map(
				(id, index) => sql`when ${routine.id} = ${id} then ${index}::int`,
			);

			await ctx.db
				.update(routine)
				.set({ position: sql`case ${sql.join(cases, sql` `)} end` })
				.where(
					and(
						eq(routine.userId, ctx.session.user.id),
						inArray(routine.id, input.ids),
					),
				);
		}),

	/**
	 * The session in progress, or null. This is the whole of "am I mid-workout":
	 * the partial unique index guarantees there is at most one, so there is no
	 * ordering or tie-break to get wrong.
	 */
	active: protectedProcedure.query(async ({ ctx }) => {
		const row = await ctx.db.query.workout.findFirst({
			where: and(
				eq(workout.userId, ctx.session.user.id),
				isNull(workout.finishedAt),
			),
		});

		return row
			? { ...row, exercises: row.exercises as WorkoutExercise[] }
			: null;
	}),

	/**
	 * Begin one, from a routine or from nothing.
	 *
	 * The id comes from the browser so the logging screen has a URL before the
	 * round trip. A second start while one is live is a conflict rather than a
	 * silent replacement: the live session holds sets somebody actually did.
	 */
	start: protectedProcedure
		.input(
			z.object({
				id: ID,
				routineId: ID.nullish(),
				/** Only used when there is no routine to take a name from. */
				name: NAME.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const live = await ctx.db.query.workout.findFirst({
				where: and(
					eq(workout.userId, ctx.session.user.id),
					isNull(workout.finishedAt),
				),
				columns: { id: true },
			});
			if (live) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You already have a workout in progress.",
				});
			}

			let name = input.name ?? "Workout";
			let exercises: WorkoutExercise[] = [];

			if (input.routineId) {
				const source = await ctx.db.query.routine.findFirst({
					where: and(
						eq(routine.id, input.routineId),
						eq(routine.userId, ctx.session.user.id),
					),
				});
				if (!source) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "That routine is gone.",
					});
				}
				name = source.name;
				exercises = startFromRoutine(source.exercises as RoutineExercise[]);
			}

			await ctx.db.insert(workout).values({
				id: input.id,
				userId: ctx.session.user.id,
				routineId: input.routineId ?? null,
				name,
				exercises,
			});

			return { id: input.id };
		}),

	/**
	 * Autosave. Called as the user types, so it writes the document and nothing
	 * else: the totals are computed on finish, from what is stored then.
	 *
	 * `isNull(finishedAt)` in the `where` is the guard that matters. A tab left
	 * open on a session finished elsewhere would otherwise write its stale copy
	 * back over the finished one.
	 */
	log: protectedProcedure
		.input(
			z.object({
				id: ID,
				name: NAME.optional(),
				note: NOTE,
				exercises: workoutExercises,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertKnownExercises(input.exercises);

			const updated = await ctx.db
				.update(workout)
				.set({
					exercises: input.exercises,
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.note === undefined ? {} : { note: input.note ?? null }),
				})
				.where(
					and(
						eq(workout.id, input.id),
						eq(workout.userId, ctx.session.user.id),
						isNull(workout.finishedAt),
					),
				)
				.returning({ id: workout.id });

			if (updated.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This workout is no longer in progress.",
				});
			}
		}),

	/**
	 * End it. Sets nobody ticked are dropped, the totals are computed from what
	 * is left, and `finishedAt` closing the row is what frees the user to start
	 * another.
	 */
	finish: protectedProcedure
		.input(
			z.object({
				id: ID,
				name: NAME.optional(),
				note: NOTE,
				exercises: workoutExercises,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertKnownExercises(input.exercises);

			// Read the start before writing, so the duration is measured against
			// what the server stored rather than against a browser's clock.
			const existing = await ctx.db.query.workout.findFirst({
				where: and(
					eq(workout.id, input.id),
					eq(workout.userId, ctx.session.user.id),
					isNull(workout.finishedAt),
				),
				columns: { startedAt: true },
			});
			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This workout is no longer in progress.",
				});
			}

			const kept = dropUnfinished(input.exercises);
			const finishedAt = new Date();
			const setCount = doneSetCount(kept);

			await ctx.db
				.update(workout)
				.set({
					exercises: kept,
					finishedAt,
					volumeKg: volumeKg(kept),
					setCount,
					durationSec: Math.max(
						0,
						Math.round(
							(finishedAt.getTime() - existing.startedAt.getTime()) / 1000,
						),
					),
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.note === undefined ? {} : { note: input.note ?? null }),
				})
				.where(
					and(
						eq(workout.id, input.id),
						eq(workout.userId, ctx.session.user.id),
						isNull(workout.finishedAt),
					),
				);

			return { id: input.id, setCount };
		}),

	/** Throw it away. Only ever the live one, the only one with nothing worth keeping. */
	discard: protectedProcedure
		.input(z.object({ id: ID }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(workout)
				.where(
					and(
						eq(workout.id, input.id),
						eq(workout.userId, ctx.session.user.id),
						isNull(workout.finishedAt),
					),
				);
		}),

	/**
	 * Finished sessions, newest first.
	 *
	 * Cursor rather than offset: this table is written to while somebody is
	 * paging through it, and an offset would skip a session or show one twice
	 * the moment a new one lands. The cursor is `startedAt` and `id` together,
	 * because two sessions can share a timestamp, and it is opaque to the client.
	 */
	history: protectedProcedure
		.input(
			z.object({
				cursor: z.string().max(120).nullish(),
				limit: z.number().int().min(1).max(HISTORY_MAX).default(HISTORY_PAGE),
			}),
		)
		.query(async ({ ctx, input }) => {
			const after = decodeCursor(input.cursor);

			const rows = await ctx.db
				.select(summaryColumns)
				.from(workout)
				.where(
					and(
						eq(workout.userId, ctx.session.user.id),
						sql`${workout.finishedAt} is not null`,
						after
							? or(
									lt(workout.startedAt, after.startedAt),
									and(
										eq(workout.startedAt, after.startedAt),
										lt(workout.id, after.id),
									),
								)
							: undefined,
					),
				)
				.orderBy(desc(workout.startedAt), desc(workout.id))
				// One more than asked for, which is how we learn there is a next page
				// without a second count query.
				.limit(input.limit + 1);

			const items = rows.slice(0, input.limit);
			const last = items.at(-1);

			return {
				items,
				nextCursor:
					rows.length > input.limit && last ? encodeCursor(last) : null,
			};
		}),

	/** One session, in full. Null for one that is not this user's. */
	workout: protectedProcedure
		.input(z.object({ id: ID }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.workout.findFirst({
				where: and(
					eq(workout.id, input.id),
					eq(workout.userId, ctx.session.user.id),
				),
			});

			return row
				? { ...row, exercises: row.exercises as WorkoutExercise[] }
				: null;
		}),

	/**
	 * Everything the dashboard asks about training, in one round trip.
	 *
	 * Reads the stored totals rather than the documents, which is what those
	 * columns are for: ninety days of sessions is ninety small rows instead of
	 * ninety `jsonb` documents unpacked for numbers already computed.
	 */
	stats: protectedProcedure.query(async ({ ctx }) => {
		const since = new Date(Date.now() - (STATS_DAYS - 1) * DAY_MS);
		since.setHours(0, 0, 0, 0);

		const rows = await ctx.db
			.select(summaryColumns)
			.from(workout)
			.where(
				and(
					eq(workout.userId, ctx.session.user.id),
					sql`${workout.finishedAt} is not null`,
					gte(workout.startedAt, since),
				),
			)
			.orderBy(desc(workout.startedAt));

		// Zero-filled, because a chart that skips rest days draws a week as five
		// evenly spaced points and lies about the shape of the training.
		const byDay = new Map<string, number>();
		for (const row of rows) {
			const day = isoDay(row.startedAt);
			byDay.set(day, (byDay.get(day) ?? 0) + row.volumeKg);
		}
		const volume = Array.from({ length: STATS_DAYS }, (_, index) => {
			const date = isoDay(new Date(since.getTime() + index * DAY_MS));
			return { date, value: Math.round(byDay.get(date) ?? 0) };
		});

		const now = Date.now();
		const inWindow = (from: number, to: number) =>
			rows.filter(
				(row) =>
					row.startedAt.getTime() >= from && row.startedAt.getTime() < to,
			);
		const week = inWindow(now - 7 * DAY_MS, now + DAY_MS);
		const prevWeek = inWindow(now - 14 * DAY_MS, now - 7 * DAY_MS);
		const total = (list: typeof rows) =>
			Math.round(list.reduce((sum, row) => sum + row.volumeKg, 0));

		return {
			volume,
			recent: rows.slice(0, RECENT_LIMIT),
			weekVolumeKg: total(week),
			prevWeekVolumeKg: total(prevWeek),
			weekSessions: week.length,
			prevWeekSessions: prevWeek.length,
		};
	}),
});
