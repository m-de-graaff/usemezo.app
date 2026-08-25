import { z } from "zod";

/**
 * What lives inside the two `jsonb` columns, and the arithmetic over it.
 *
 * A routine and a session are the same document one field apart: a session's
 * set also knows whether it was done. Keeping them as one schema with an
 * extension means a session can be saved back as a routine without a
 * translation layer that could disagree with itself.
 *
 * Nothing here touches the database or the network, so the router validates
 * with it, the browser computes a running total with it, and the tests run it
 * without either.
 */

/** Bounds that only exclude the impossible. A 300 kg squat is somebody's Tuesday. */
const REPS_MAX = 1000;
const WEIGHT_MAX_KG = 1000;
const SETS_MAX = 30;
const EXERCISES_MAX = 50;

/**
 * What a set is, when it is not a working set.
 *
 * Mutually exclusive rather than two flags: a warm-up carried to failure is not
 * a thing anyone logs, and one field is one control on screen instead of two.
 */
export const SET_TYPES = ["warmup", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

const plannedSet = z.object({
	/**
	 * Absent until somebody types one. A blank box is not the same claim as zero
	 * reps, and filling it in for them is how an app ends up storing lifts that
	 * were never planned and never done.
	 */
	reps: z.number().int().min(0).max(REPS_MAX).optional(),
	/** Kilograms, always. 0 is a bodyweight set; absent is an unanswered one. */
	weightKg: z.number().min(0).max(WEIGHT_MAX_KG).optional(),
	/** Absent is a working set, which is almost all of them. */
	type: z.enum(SET_TYPES).optional(),
});

const entry = {
	/**
	 * Stable per entry, not per exercise: the same movement can appear twice in
	 * one routine, and this is what tells the two apart for React and for a
	 * reorder.
	 */
	key: z.string().min(1).max(32),
	exerciseId: z.string().min(1).max(32),
	note: z.string().max(500).optional(),
	/** Seconds. Absent means the routine has no opinion and no timer starts. */
	restSec: z.number().int().min(0).max(3600).optional(),
	/**
	 * Shared by consecutive entries trained back to back. Held per entry rather
	 * than as a list of groups, so a reorder cannot leave a group pointing at a
	 * position that has moved. `normaliseSupersets` re-issues these after every
	 * mutation, which is what keeps a group contiguous.
	 */
	supersetId: z.string().min(1).max(32).optional(),
};

export const routineExercise = z.object({
	...entry,
	// No minimum. An exercise you have just added has no sets yet, and inventing
	// three of ten reps is the guess this whole shape exists to stop making.
	sets: z.array(plannedSet).max(SETS_MAX),
});

export const routineExercises = z.array(routineExercise).max(EXERCISES_MAX);

const loggedSet = plannedSet.extend({ done: z.boolean() });

export const workoutExercise = z.object({
	...entry,
	sets: z.array(loggedSet).max(SETS_MAX),
});

export const workoutExercises = z.array(workoutExercise).max(EXERCISES_MAX);

export type PlannedSet = z.infer<typeof plannedSet>;
export type LoggedSet = z.infer<typeof loggedSet>;
export type RoutineExercise = z.infer<typeof routineExercise>;
export type WorkoutExercise = z.infer<typeof workoutExercise>;

/** Short enough to read in a debugger, long enough not to collide in one document. */
export const newKey = () => Math.random().toString(36).slice(2, 10);

/**
 * A session, seeded from the routine. The planned numbers stay as the prefill
 * rather than being blanked: what you lifted last time is the best guess at
 * what you are about to lift, and typing it all again is the thing people quit
 * an app over.
 */
export const startFromRoutine = (
	exercises: RoutineExercise[],
): WorkoutExercise[] =>
	exercises.map((exercise) => ({
		...exercise,
		sets: exercise.sets.map((set) => ({ ...set, done: false })),
	}));

/** A warm-up is training, not tonnage. It is logged and it counts for nothing. */
export const isCounted = (set: { type?: SetType }) => set.type !== "warmup";

/** Total weight moved, done working sets only, rounded to the kilogram. */
export const volumeKg = (exercises: WorkoutExercise[]) =>
	Math.round(
		exercises.reduce(
			(total, exercise) =>
				total +
				exercise.sets.reduce(
					(sum, set) =>
						sum +
						(set.done && isCounted(set)
							? (set.reps ?? 0) * (set.weightKg ?? 0)
							: 0),
					0,
				),
			0,
		),
	);

export const doneSetCount = (exercises: WorkoutExercise[]) =>
	exercises.reduce(
		(total, exercise) =>
			total + exercise.sets.filter((set) => set.done && isCounted(set)).length,
		0,
	);

/**
 * What gets stored when a session finishes. A set nobody ticked is a set nobody
 * did, and keeping it would put lifts in the history that never happened.
 */
export const dropUnfinished = (
	exercises: WorkoutExercise[],
): WorkoutExercise[] =>
	exercises
		.map((exercise) => ({
			...exercise,
			sets: exercise.sets.filter((set) => set.done),
		}))
		.filter((exercise) => exercise.sets.length > 0);

/**
 * `2026-08-25`, in the reader's own zone, which is what a chart axis labels.
 *
 * Built from the local parts rather than `toISOString().slice(0, 10)`, which
 * would file a session logged at nine in the evening under the following day
 * for anyone west of UTC.
 */
export const isoDay = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * The history cursor: a timestamp and an id, in that order.
 *
 * Both halves are needed. Two sessions can start in the same millisecond, and
 * ordering on the timestamp alone would then show one of them twice or not at
 * all as the reader pages past the tie.
 */
export const encodeCursor = (row: { startedAt: Date; id: string }) =>
	`${row.startedAt.toISOString()}|${row.id}`;

/**
 * The cursor is opaque to whoever holds it, so a malformed one is treated as no
 * cursor rather than as an error: the worst it does is start the list again.
 */
export function decodeCursor(cursor: string | null | undefined) {
	if (!cursor) return null;
	const [when, id] = cursor.split("|");
	if (!when || !id) return null;
	const startedAt = new Date(when);
	return Number.isNaN(startedAt.getTime()) ? null : { startedAt, id };
}

/** The reverse of `startFromRoutine`, for saving a session as a routine. */
export const toRoutineExercises = (
	exercises: WorkoutExercise[],
): RoutineExercise[] =>
	exercises.map((exercise) => ({
		...exercise,
		sets: exercise.sets.map(({ done: _done, ...set }) => set),
	}));

type HasSuperset = { supersetId?: string };

/**
 * Consecutive entries that share a `supersetId`, in list order.
 *
 * Everything else comes back as a run of one, so a caller renders one loop
 * rather than branching on whether an entry happens to be grouped.
 */
export function supersetRuns<T extends HasSuperset>(exercises: T[]) {
	const runs: { id: string | undefined; entries: T[] }[] = [];
	for (const exercise of exercises) {
		const last = runs.at(-1);
		if (last && exercise.supersetId && last.id === exercise.supersetId) {
			last.entries.push(exercise);
		} else {
			runs.push({ id: exercise.supersetId, entries: [exercise] });
		}
	}
	return runs;
}

/**
 * Re-issue every `supersetId` from the runs actually on screen.
 *
 * Run after any reorder, removal or join. Two members separated by a third
 * exercise are two groups that happen to share a stale id, and a member left on
 * its own is not a superset at all. Deriving the ids from position rather than
 * patching them per mutation makes every one of those the same case.
 */
export function normaliseSupersets<T extends HasSuperset>(exercises: T[]): T[] {
	return supersetRuns(exercises).flatMap((run) => {
		if (run.entries.length < 2 || !run.id) {
			return run.entries.map((entry) =>
				entry.supersetId === undefined
					? entry
					: { ...entry, supersetId: undefined },
			);
		}
		const id = newKey();
		return run.entries.map((entry) => ({ ...entry, supersetId: id }));
	});
}
