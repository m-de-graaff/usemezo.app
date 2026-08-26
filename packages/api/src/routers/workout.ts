import type { db as Database } from "@mezo/db";
import { routine, routineFolder, userProfile, workout } from "@mezo/db/schema";
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
import { customById, type Exercise, exerciseById } from "../exercises.ts";
import { checkSet } from "../plausibility.ts";
import { type PastSession, progressExercise } from "../progression.ts";
import { oneRepMax, totalKg } from "../strength.ts";
import { weeklySets } from "../training.ts";
import { createTRPCRouter, protectedProcedure } from "../trpc.ts";
import {
	applyNotes,
	decodeCursor,
	doneSetCount,
	dropUnfinished,
	EXERCISES_MAX,
	encodeCursor,
	isCounted,
	isoDay,
	isTrusted,
	newKey,
	type RoutineExercise,
	routineExercises,
	setVolumeKg,
	startFromRoutine,
	volumeKg,
	type WorkoutExercise,
	workoutExercises,
} from "../workout-shape.ts";
import { userCatalogue } from "./exercise.ts";

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
/** Headings, not training. More than this and the list is the thing you scroll. */
const FOLDER_LIMIT = 50;
/** One page of history. Capped here; an uncapped limit is a denial of service parameter. */
const HISTORY_PAGE = 20;
const HISTORY_MAX = 50;
/** How far back the dashboard reads. Its widest range is 90 days. */
const STATS_DAYS = 90;
/** How many sessions the dashboard's recent list shows. */
const RECENT_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back `training` reads, and how many sessions it will unpack.
 *
 * This is the one query that opens the `jsonb`, because per-set numbers are the
 * whole point of it. The window is what keeps that bounded: four weeks is long
 * enough to hold a mesocycle's worth of volume and recent enough that the
 * weights in it are still the weights somebody is lifting.
 */
const TRAINING_DAYS = 28;
const TRAINING_SESSIONS = 40;

/**
 * How many finished sessions `exerciseHistory` reads back through.
 *
 * Somebody training four times a week takes eighteen months to reach it, and a
 * record set before that is one they will beat long before the row scrolls off.
 */
const RECORD_SESSIONS = 300;

/**
 * How many sessions of one exercise the progression looks back over.
 *
 * Three is what the rules need and no more: the last one to judge, the one
 * before it to tell a bad night from a stall, and the gap between them to tell
 * training from turning up occasionally.
 */
const PAST_SESSIONS = 3;

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
 * An id nothing can resolve is one nothing can render: a row the user can
 * neither identify nor, once it is in a session, explain. Checked here rather
 * than in the Zod schema because that schema is shared with the browser, and
 * shipping the check there would mean the same validation twice with only one
 * of them authoritative.
 *
 * "Known" is the fixed catalogue plus whatever this user added themselves, and
 * the second half is read only when the first half comes up short. Almost every
 * list is entirely dataset exercises, and `log` runs on every autosave: paying
 * a query per keystroke to look for exercises that are usually not there is a
 * cost with no reader.
 */
async function assertKnownExercises(
	db: typeof Database,
	userId: string,
	exercises: { key: string; exerciseId: string }[],
): Promise<void> {
	if (new Set(exercises.map((entry) => entry.key)).size !== exercises.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Two exercises in this list share a key.",
		});
	}

	const strangers = exercises.filter(
		(entry) => !exerciseById(entry.exerciseId),
	);
	if (strangers.length === 0) return;

	const mine = customById((await userCatalogue(db, userId)).custom);
	const unknown = strangers.find((entry) => !mine.has(entry.exerciseId));
	if (unknown) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `No exercise with id ${unknown.exerciseId}.`,
		});
	}
}

type Past = {
	/** The most a single set has moved: the number a medal is awarded against. */
	bestSetKg: number;
	/**
	 * The heaviest single they have shown they can do here, as a whole lift with
	 * the bar in it. The currency the plausibility check compares a new set
	 * against, because it is the one number that survives a change of rep range:
	 * five at a hundred and ten at eighty are the same claim about somebody.
	 */
	bestOneRepMaxKg: number;
	sessions: PastSession[];
};

/**
 * Everything the app knows about how one user has trained each exercise: their
 * best single set, and their last few sessions of it, newest first.
 *
 * One scan, two readers. The logging screen wants the last session and the
 * record; the progression wants a short run of sessions so it can tell a bad
 * night from a stall. Running that twice would be the same `jsonb` opened
 * twice for numbers derived the same way.
 *
 * Only ticked sets are kept. A finished session has already dropped the rest,
 * but one finished before that rule existed has not, and a row nobody touched
 * is not something that happened.
 *
 * ponytail: this opens the `jsonb` of every session in the window. Fine for a
 * few hundred; if anyone's history outgrows it, keep a per-exercise row on its
 * own table and write it on finish.
 */
async function exercisePast(
	db: typeof Database,
	userId: string,
	custom?: ReadonlyMap<string, Exercise>,
): Promise<Map<string, Past>> {
	const rows = await db
		.select({ startedAt: workout.startedAt, exercises: workout.exercises })
		.from(workout)
		.where(
			and(eq(workout.userId, userId), sql`${workout.finishedAt} is not null`),
		)
		.orderBy(desc(workout.startedAt))
		.limit(RECORD_SESSIONS);

	const past = new Map<string, Past>();

	for (const row of rows) {
		for (const entry of row.exercises as WorkoutExercise[]) {
			let seen = past.get(entry.exerciseId);
			if (!seen) {
				seen = { bestSetKg: 0, bestOneRepMaxKg: 0, sessions: [] };
				past.set(entry.exerciseId, seen);
			}

			const done = entry.sets.filter((set) => set.done);
			if (done.length === 0) continue;

			// The session list keeps the doubtful sets in it. `progressExercise`
			// drops them itself, and a session that reads as empty here would be a
			// session the progression treats as a gap rather than as training.
			if (seen.sessions.length < PAST_SESSIONS) {
				seen.sessions.push({ at: row.startedAt, sets: done });
			}

			const exercise = exerciseById(entry.exerciseId, custom);
			for (const set of done) {
				// A set nobody has vouched for is not a best. Both of these are what
				// a later set gets measured against, so letting one through would
				// mean a single wrong number raising the bar for every set after it
				// and quietly turning the check off for that exercise.
				if (!isTrusted(set)) continue;
				seen.bestSetKg = Math.max(seen.bestSetKg, setVolumeKg(set));
				if (exercise && isCounted(set) && set.reps && set.weightKg) {
					seen.bestOneRepMaxKg = Math.max(
						seen.bestOneRepMaxKg,
						oneRepMax(totalKg(exercise, set.weightKg), set.reps),
					);
				}
			}
		}
	}

	return past;
}

/**
 * The routine, with today's weights on it, when the user has asked for that.
 *
 * The toggle is read here rather than passed in, so there is exactly one place
 * that decides whether a programme gets rewritten. Off — which is the default,
 * and the answer for anybody who is training to stay fit rather than to add
 * plates — costs one column read and returns the routine untouched.
 *
 * An exercise the progression declines to judge keeps whatever the routine
 * wrote, so a movement with no history is never guessed at.
 *
 * ponytail: equipment comes from the fixed catalogue only, so an exercise
 * somebody added themselves progresses on the default barbell jump. The zero
 * load guard in `progressExercise` is what stops that inventing a first
 * kilogram for a bodyweight one; read `userCatalogue` here if custom exercises
 * ever need their own increments.
 */
async function progressRoutine(
	db: typeof Database,
	userId: string,
	planned: RoutineExercise[],
): Promise<{ exercises: RoutineExercise[]; progressed: string[] }> {
	const profile = await db.query.userProfile.findFirst({
		where: eq(userProfile.userId, userId),
		columns: { progressiveOverload: true },
	});
	if (!profile?.progressiveOverload)
		return { exercises: planned, progressed: [] };

	const past = await exercisePast(db, userId);
	const now = new Date();
	const progressed: string[] = [];

	const exercises = planned.map((entry) => {
		const next = progressExercise({
			equipment: exerciseById(entry.exerciseId)?.equipment ?? "",
			now,
			past: past.get(entry.exerciseId)?.sessions ?? [],
			planned: entry.sets,
		});
		if (!next) return entry;

		const name = exerciseById(entry.exerciseId)?.name ?? "an exercise";
		progressed.push(`${name}: ${next.reason}`);
		return { ...entry, sets: next.sets };
	});

	return { exercises, progressed };
}

/**
 * The plausibility pass, run once over a session that is being closed.
 *
 * The logging screen runs the same check the moment a set is ticked, and that
 * is the copy that matters to the person: it is immediate, it can name the
 * likely mistake, and a tap answers it. This is the copy that matters to the
 * data. Everything the browser sends is a value somebody could have typed, so
 * a flag the client set can be dropped and a `confirmed` the client set can be
 * invented, and the only place the answer can be made a fact is here.
 *
 * `confirmed` from the client is honoured rather than re-derived. A confirm is
 * a person saying "I did that", which is exactly the input this has no way of
 * producing on its own, and forging one buys somebody nothing they could not
 * get by tapping the button they are already being shown.
 *
 * Sessions that got here before this existed are untouched: the pass only ever
 * reads sets that are being written now.
 */
async function flagImplausible(
	db: typeof Database,
	userId: string,
	exercises: WorkoutExercise[],
): Promise<{ exercises: WorkoutExercise[]; flagged: number }> {
	const [profile, catalogue] = await Promise.all([
		db.query.userProfile.findFirst({
			where: eq(userProfile.userId, userId),
			columns: {
				birthDate: true,
				bodyFatPercent: true,
				fitnessExperience: true,
				gender: true,
				heightCm: true,
				weightKg: true,
			},
		}),
		userCatalogue(db, userId),
	]);

	const custom = customById(catalogue.custom);
	const past = await exercisePast(db, userId, custom);
	const now = new Date();
	let flagged = 0;

	const checked = exercises.map((entry) => {
		const seen = past.get(entry.exerciseId);

		return {
			...entry,
			sets: entry.sets.map((set) => {
				if (set.flag === "confirmed") return set;

				const doubt = checkSet({
					bestOneRepMaxKg: seen?.bestOneRepMaxKg ?? 0,
					custom,
					exerciseId: entry.exerciseId,
					lastDoneAt: seen?.sessions[0]?.at ?? null,
					now,
					profile: profile ?? {},
					set,
				});
				if (!doubt) {
					// Cleared. A set the browser marked and the lifter then corrected
					// must not keep the mark, or a fixed typo stays doubted forever.
					const { flag: _flag, ...rest } = set;
					return rest;
				}

				flagged += 1;
				return { ...set, flag: "suspect" as const };
			}),
		};
	});

	return { exercises: checked, flagged };
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
			await assertKnownExercises(ctx.db, ctx.session.user.id, input.exercises);

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

	/**
	 * The same routine again, under a new id, at the end of the list.
	 *
	 * A copy on the server rather than a read and a save from the browser. The
	 * exercises are already valid — they were checked when the original was
	 * saved — so re-sending them through the client would be a round trip whose
	 * only job is to hand back what it was given, and a chance to hand back
	 * something else.
	 *
	 * "Copy" rather than a name the user types. Most duplicates are edited
	 * immediately anyway, and the builder is where naming belongs.
	 */
	copyRoutine: protectedProcedure
		.input(z.object({ id: ID, newId: ID }))
		.mutation(async ({ ctx, input }) => {
			const source = await ctx.db.query.routine.findFirst({
				where: and(
					eq(routine.id, input.id),
					eq(routine.userId, ctx.session.user.id),
				),
			});
			if (!source) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "That routine is gone.",
				});
			}

			// New keys throughout. They only have to be unique inside one document,
			// but sharing them across two is the kind of thing that reads as
			// deliberate later and is not.
			const exercises = (source.exercises as RoutineExercise[]).map(
				(entry) => ({
					...entry,
					key: newKey(),
				}),
			);

			await ctx.db.insert(routine).values({
				id: input.newId,
				userId: ctx.session.user.id,
				name: `${source.name} copy`.slice(0, 80),
				note: source.note,
				// Next to the original, which is where somebody looking for it will be.
				folderId: source.folderId,
				position: source.position + 1,
				exercises,
			});

			return { id: input.newId };
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

	/** The folders the list screen files routines under, in the user's order. */
	folders: protectedProcedure.query(async ({ ctx }) => {
		return await ctx.db.query.routineFolder.findMany({
			where: eq(routineFolder.userId, ctx.session.user.id),
			orderBy: [asc(routineFolder.position), asc(routineFolder.createdAt)],
			limit: FOLDER_LIMIT,
		});
	}),

	/**
	 * Create or rename. One procedure because a folder is a name and nothing
	 * else, so there is no second field for an update to touch.
	 */
	saveFolder: protectedProcedure
		.input(z.object({ id: ID, name: NAME }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(routineFolder)
				.values({
					id: input.id,
					userId: ctx.session.user.id,
					name: input.name,
				})
				.onConflictDoUpdate({
					target: routineFolder.id,
					set: { name: input.name, updatedAt: new Date() },
					// Somebody else's folder id is not one to rename.
					setWhere: eq(routineFolder.userId, ctx.session.user.id),
				});

			return { id: input.id };
		}),

	/**
	 * The heading goes; the routines under it do not. They land back in the loose
	 * pile, which the schema does with `set null` rather than this procedure
	 * walking them.
	 */
	removeFolder: protectedProcedure
		.input(z.object({ id: ID }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(routineFolder)
				.where(
					and(
						eq(routineFolder.id, input.id),
						eq(routineFolder.userId, ctx.session.user.id),
					),
				);
		}),

	/** File one routine under a folder, or null to take it out of every folder. */
	moveRoutine: protectedProcedure
		.input(z.object({ id: ID, folderId: ID.nullable() }))
		.mutation(async ({ ctx, input }) => {
			// A folder id from another account would otherwise file this user's
			// routine somewhere they cannot see it.
			if (input.folderId !== null) {
				const owned = await ctx.db.query.routineFolder.findFirst({
					columns: { id: true },
					where: and(
						eq(routineFolder.id, input.folderId),
						eq(routineFolder.userId, ctx.session.user.id),
					),
				});
				if (!owned) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "That folder is gone.",
					});
				}
			}

			await ctx.db
				.update(routine)
				.set({ folderId: input.folderId })
				.where(
					and(
						eq(routine.id, input.id),
						eq(routine.userId, ctx.session.user.id),
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
			let progressed: string[] = [];

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

				const planned = source.exercises as RoutineExercise[];
				const raised = await progressRoutine(
					ctx.db,
					ctx.session.user.id,
					planned,
				);
				progressed = raised.progressed;
				exercises = startFromRoutine(raised.exercises);
			}

			await ctx.db.insert(workout).values({
				id: input.id,
				userId: ctx.session.user.id,
				routineId: input.routineId ?? null,
				name,
				exercises,
			});

			// Named rather than counted. "Weights raised" with no subject is the
			// app telling somebody it changed their programme without saying what.
			return { id: input.id, progressed };
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
			await assertKnownExercises(ctx.db, ctx.session.user.id, input.exercises);

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
			await assertKnownExercises(ctx.db, ctx.session.user.id, input.exercises);

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

			// Doubted after the unticked sets are dropped, so nothing is asked about
			// a row somebody left blank and walked away from.
			const { exercises: kept, flagged } = await flagImplausible(
				ctx.db,
				ctx.session.user.id,
				dropUnfinished(input.exercises),
			);
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

			return { id: input.id, setCount, flagged };
		}),

	/**
	 * "That one is right."
	 *
	 * The other half of doubting a set, and the half without which doubting one
	 * is just a punishment. A check that reads a session at ten times the usual
	 * weight has no way of telling a typo from the best day of somebody's life,
	 * so the person who was there gets the last word, from the session screen,
	 * after the fact, with no appeal to write and nobody to write it to.
	 *
	 * Addressed by key and index rather than by value: the row is the thing
	 * being vouched for, and matching on the numbers would mean a session with
	 * the same set twice taking one confirmation for both.
	 */
	confirmSet: protectedProcedure
		.input(
			z.object({
				id: ID,
				key: z.string().min(1).max(32),
				index: z.number().int().min(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.query.workout.findFirst({
				where: and(
					eq(workout.id, input.id),
					eq(workout.userId, ctx.session.user.id),
				),
				columns: { exercises: true },
			});
			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No such workout.",
				});
			}

			const exercises = (existing.exercises as WorkoutExercise[]).map(
				(entry) =>
					entry.key === input.key
						? {
								...entry,
								sets: entry.sets.map((set, index) =>
									index === input.index && set.flag === "suspect"
										? { ...set, flag: "confirmed" as const }
										: set,
								),
							}
						: entry,
			);

			await ctx.db
				.update(workout)
				.set({ exercises })
				.where(
					and(
						eq(workout.id, input.id),
						eq(workout.userId, ctx.session.user.id),
					),
				);
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
	 * The session there is to talk about: the live one, or the last one finished.
	 *
	 * Milo has no session ids. Every other read here starts from one the user
	 * clicked, and a coach asked "how did that go" has clicked nothing, so this
	 * is the entry point that turns "my workout" into a row.
	 *
	 * The live session wins when there is one, because a note about training
	 * that is still happening belongs to the training that is still happening.
	 */
	latest: protectedProcedure.query(async ({ ctx }) => {
		const row = await ctx.db.query.workout.findFirst({
			where: eq(workout.userId, ctx.session.user.id),
			// Nulls sort first descending in Postgres, which is exactly the rule
			// this wants: a live session has no `finishedAt` and comes out on top.
			orderBy: [desc(workout.finishedAt), desc(workout.startedAt)],
		});

		return row
			? { ...row, exercises: row.exercises as WorkoutExercise[] }
			: null;
	}),

	/**
	 * Write notes onto a session without holding the session.
	 *
	 * `log` is the logging screen's write: it sends the whole document because it
	 * has the whole document on screen. Milo has neither, and giving it that
	 * procedure would mean a model reconstructing every set from a summary and
	 * writing its guesses back over the real ones.
	 *
	 * Finished sessions are writable here on purpose. Most of what anyone wants
	 * to record about a session — what hurt, what felt easy, what to change next
	 * time — is known after it, not during it.
	 *
	 * ponytail: a note written while the logging screen is open is overwritten by
	 * that screen's next autosave, which sends the whole document. Fine while
	 * Milo lives on its own page; if notes ever arrive mid-session, `log` needs to
	 * stop sending the entry notes it did not change.
	 */
	annotate: protectedProcedure
		.input(
			z.object({
				/** Defaults to whatever `latest` would return. */
				id: ID.optional(),
				note: NOTE,
				exercises: z
					.array(
						z.object({
							exerciseId: ID,
							/** Empty clears the note this exercise already had. */
							note: z.string().trim().max(500),
						}),
					)
					.max(EXERCISES_MAX)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const target = await ctx.db.query.workout.findFirst({
				where: and(
					eq(workout.userId, ctx.session.user.id),
					input.id ? eq(workout.id, input.id) : undefined,
				),
				orderBy: [desc(workout.finishedAt), desc(workout.startedAt)],
			});
			if (!target) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: input.id
						? "No workout with that id."
						: "You have not logged a workout yet.",
				});
			}

			const { exercises, missing } = applyNotes(
				target.exercises as WorkoutExercise[],
				input.exercises ?? [],
			);

			// Nothing to write is not an error: it is a read of what is already
			// there, which is how a caller checks before annotating.
			if (input.note !== undefined || input.exercises) {
				await ctx.db
					.update(workout)
					.set({
						exercises,
						...(input.note === undefined ? {} : { note: input.note ?? null }),
					})
					.where(
						and(
							eq(workout.id, target.id),
							eq(workout.userId, ctx.session.user.id),
						),
					);
			}

			return {
				id: target.id,
				name: target.name,
				live: target.finishedAt === null,
				note: input.note === undefined ? target.note : (input.note ?? null),
				exercises,
				// Ids the session does not contain. Handed back rather than dropped,
				// so a note aimed at the wrong exercise is correctable.
				missing,
			};
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

	/**
	 * What the logging screen needs to know about everything before today, per
	 * exercise: the last time you did it, and the best a single set has moved.
	 *
	 * One query for both because both are the same scan. The screen reads it once
	 * when it opens and never refetches: the record a set is measured against is
	 * the one that stood when the session began, and a value that moved
	 * underneath the screen would take a medal back off a set that earned it.
	 *
	 * `previous` is the whole set list from the most recent session that included
	 * the exercise, in its own order, so row three of today lines up against row
	 * three of last time. Sessions arrive newest first, so the first one to
	 * mention an exercise is the last one that trained it.
	 *
	 * Unlike `training` there is no date window. A record is a record, and the
	 * last time you benched is worth showing whether that was Tuesday or in
	 * March. `RECORD_SESSIONS` is the bound instead.
	 *
	 * ponytail: this opens the `jsonb` of every session in that window on each
	 * cold load. Fine for a few hundred; if anyone's history outgrows it, keep a
	 * per-exercise row on its own table and write it on finish.
	 */
	exerciseHistory: protectedProcedure.query(async ({ ctx }) => {
		// Their own exercises too. Without them the logging screen has no record
		// and no best for anything somebody invented, which is the same as saying
		// the plausibility check is off for exactly the movements the catalogue
		// knows least about.
		const mine = customById(
			(await userCatalogue(ctx.db, ctx.session.user.id)).custom,
		);
		const past = await exercisePast(ctx.db, ctx.session.user.id, mine);

		return Object.fromEntries(
			[...past].map(([exerciseId, entry]) => [
				exerciseId,
				{
					bestSetKg: entry.bestSetKg,
					bestOneRepMaxKg: entry.bestOneRepMaxKg,
					previous: entry.sessions[0]?.sets ?? [],
					previousAt: entry.sessions[0]?.at ?? null,
				},
			]),
		);
	}),

	/**
	 * What this user has actually been lifting, as an estimator and an assistant
	 * need it: one row per exercise with their best set in it, plus how the last
	 * four weeks of sets landed across the muscles.
	 *
	 * "Best" is by estimated one-rep max rather than by weight. A heavier set of
	 * two is not a better set than a lighter set of ten, and picking on weight
	 * alone would hand every estimate the day somebody worked up to a single.
	 *
	 * This is the only query that opens the `jsonb`, and `TRAINING_DAYS` and
	 * `TRAINING_SESSIONS` between them are what keep that from growing with the
	 * user's training age.
	 */
	training: protectedProcedure.query(async ({ ctx }) => {
		const since = new Date(Date.now() - TRAINING_DAYS * DAY_MS);

		// Their own exercises count as exercises: a movement somebody invented and
		// has been training for a month is exactly what an estimator and a volume
		// audit need to see, and dropping it here is how it silently stops
		// counting the moment it leaves the picker.
		const mine = customById(
			(await userCatalogue(ctx.db, ctx.session.user.id)).custom,
		);

		const rows = await ctx.db
			.select({
				id: workout.id,
				startedAt: workout.startedAt,
				exercises: workout.exercises,
			})
			.from(workout)
			.where(
				and(
					eq(workout.userId, ctx.session.user.id),
					sql`${workout.finishedAt} is not null`,
					gte(workout.startedAt, since),
				),
			)
			.orderBy(desc(workout.startedAt))
			.limit(TRAINING_SESSIONS);

		type Best = {
			exerciseId: string;
			name: string;
			weightKg: number;
			reps: number;
			estimatedOneRepMaxKg: number;
			sets: number;
			sessions: number;
			lastDoneAt: Date;
		};

		const best = new Map<string, Best>();
		const seenIn = new Map<string, Set<string>>();

		for (const row of rows) {
			for (const entry of row.exercises as WorkoutExercise[]) {
				const exercise = exerciseById(entry.exerciseId, mine);
				if (!exercise) continue;

				const sessions = seenIn.get(entry.exerciseId) ?? new Set<string>();
				sessions.add(row.id);
				seenIn.set(entry.exerciseId, sessions);

				for (const set of entry.sets) {
					// A blank box is not a zero, and a warm-up is not a working set.
					// Counting either would inflate the volume audit and hand the
					// estimator a lift nobody did. A set under an unanswered
					// plausibility question is the same problem with a sharper edge:
					// this is where the weight to put on the bar comes from, so one
					// wrong number here is a wrong number handed back to the lifter.
					const reps = set.reps ?? 0;
					const weightKg = set.weightKg ?? 0;
					if (!set.done || !isCounted(set) || !isTrusted(set) || reps <= 0)
						continue;

					const existing = best.get(entry.exerciseId);
					const estimate = weightKg > 0 ? oneRepMax(weightKg, reps) : 0;

					if (!existing) {
						best.set(entry.exerciseId, {
							exerciseId: entry.exerciseId,
							name: exercise.name,
							weightKg,
							reps,
							estimatedOneRepMaxKg: Math.round(estimate * 10) / 10,
							sets: 1,
							sessions: 0,
							lastDoneAt: row.startedAt,
						});
						continue;
					}

					existing.sets += 1;
					if (estimate > existing.estimatedOneRepMaxKg) {
						existing.weightKg = weightKg;
						existing.reps = reps;
						existing.estimatedOneRepMaxKg = Math.round(estimate * 10) / 10;
					}
					// Rows arrive newest first, so the first session an exercise
					// appears in is the last time it was done.
				}
			}
		}

		const exercises = [...best.values()]
			.map((row) => ({
				...row,
				sessions: seenIn.get(row.exerciseId)?.size ?? 1,
			}))
			.sort((a, b) => b.lastDoneAt.getTime() - a.lastDoneAt.getTime());

		const weeks = TRAINING_DAYS / 7;

		return {
			days: TRAINING_DAYS,
			sessions: rows.length,
			sessionsPerWeek: Math.round((rows.length / weeks) * 10) / 10,
			exercises,
			// Averaged over the window rather than counted for one week, so a
			// deload or a holiday does not read as a training decision.
			weeklySetsPerMuscle: weeklySets(
				exercises.map((row) => ({
					exerciseId: row.exerciseId,
					sets: row.sets / weeks,
				})),
				1,
				mine,
			),
		};
	}),
});
