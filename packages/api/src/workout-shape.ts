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
	/**
	 * Seconds to rest between this exercise's own sets. Absent means the routine
	 * has no opinion and no timer starts.
	 */
	restSec: z.number().int().min(0).max(3600).optional(),
	/**
	 * Seconds to rest after the last set of this exercise, before the next one
	 * begins. The two are different numbers in real training and in every app
	 * that lets you set them: thirty seconds between sets of curls and two
	 * minutes before you walk to the rack is one exercise, not two settings of
	 * the same thing.
	 *
	 * Inside a superset it is the rest at the end of the round, which is why it
	 * reads as "after" rather than "between rounds": the entry it belongs to is
	 * the one you just finished either way.
	 */
	restAfterSec: z.number().int().min(0).max(3600).optional(),
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
 * Where a group's last member sits, or -1.
 *
 * A hand-rolled scan rather than `findLastIndex`, which needs a newer lib
 * target than this package compiles against.
 */
function lastIndexOfSuperset(
	exercises: HasSuperset[],
	supersetId: string,
): number {
	for (let index = exercises.length - 1; index >= 0; index -= 1) {
		if (exercises[index]?.supersetId === supersetId) return index;
	}
	return -1;
}

/**
 * Put an exercise already in the list into a superset.
 *
 * It is spliced onto the end of the group rather than left where it was: a
 * superset is exercises done back to back, so a member the list draws somewhere
 * else is a group that is not what it says it is.
 *
 * An unknown key, an unknown group, or an exercise already in that group all
 * return the list untouched, so a stray drop is a no-op rather than an error.
 */
export function moveIntoSuperset<T extends HasSuperset & { key: string }>(
	exercises: T[],
	supersetId: string,
	key: string,
): T[] {
	const moving = exercises.find((entry) => entry.key === key);
	if (!moving || moving.supersetId === supersetId) return exercises;

	const rest = exercises.filter((entry) => entry.key !== key);
	const last = lastIndexOfSuperset(rest, supersetId);
	if (last === -1) return exercises;

	const next = [...rest];
	next.splice(last + 1, 0, { ...moving, supersetId });
	return normaliseSupersets(next);
}

/**
 * Drop one exercise above or below another.
 *
 * The same drag that fills a superset tile also reorders the list, so this is
 * the other half of it. Where the exercise lands decides what it belongs to:
 * dropped between two members of one group it joins them, and dropped anywhere
 * else it keeps whatever group it already had. That is the same rule the up and
 * down buttons follow, so a list reordered either way ends up the same.
 */
export function moveExerciseNextTo<T extends HasSuperset & { key: string }>(
	exercises: T[],
	key: string,
	targetKey: string,
	after: boolean,
): T[] {
	if (key === targetKey) return exercises;

	const moving = exercises.find((entry) => entry.key === key);
	if (!moving) return exercises;

	const rest = exercises.filter((entry) => entry.key !== key);
	const target = rest.findIndex((entry) => entry.key === targetKey);
	if (target === -1) return exercises;

	const at = after ? target + 1 : target;
	const before = rest[at - 1]?.supersetId;
	const behind = rest[at]?.supersetId;
	const own = moving.supersetId;
	// A group it was the only member of is a superset waiting to be filled, not
	// a group it can be dragged out of.
	const alone =
		own !== undefined &&
		exercises.filter((entry) => entry.supersetId === own).length === 1;

	let supersetId: string | undefined;
	if (before !== undefined && before === behind) {
		// Landed between two members of one group. That is what joining looks like.
		supersetId = before;
	} else if (before === own || behind === own) {
		// Still touching its own group, so this was a shuffle within it.
		supersetId = own;
	} else {
		supersetId = alone ? own : undefined;
	}

	const next = [...rest];
	next.splice(at, 0, { ...moving, supersetId });
	return normaliseSupersets(next);
}

/** The same, for an exercise that is not in the list yet. */
export function insertIntoSuperset<T extends HasSuperset>(
	exercises: T[],
	supersetId: string,
	entry: T,
): T[] {
	const last = lastIndexOfSuperset(exercises, supersetId);
	if (last === -1) return exercises;

	const next = [...exercises];
	next.splice(last + 1, 0, { ...entry, supersetId });
	return normaliseSupersets(next);
}

/**
 * Settle superset membership after the list has been rearranged.
 *
 * Two rules, and between them every reorder, removal, join and drop is the same
 * case:
 *
 * 1. An exercise with no group of its own, sitting between two members of one
 *    group, is inside that group. Moving a row in with the up and down buttons
 *    is what makes those buttons a way to join a superset without dragging,
 *    which SC 2.5.7 requires of anything a drag can do.
 * 2. Members of one group that are no longer consecutive are no longer one
 *    group. The first run keeps the id and the rest are re-issued, so a split
 *    becomes two supersets rather than one drawn with a hole in it.
 *
 * A group of one is left alone. That is what a superset looks like the moment
 * it is created, before anything has been dropped into it.
 */
export function normaliseSupersets<T extends HasSuperset>(exercises: T[]): T[] {
	const absorbed = exercises.map((entry, index) => {
		if (entry.supersetId !== undefined) return entry;
		const before = exercises[index - 1]?.supersetId;
		const after = exercises[index + 1]?.supersetId;
		return before !== undefined && before === after
			? { ...entry, supersetId: before }
			: entry;
	});

	// Ids are kept rather than always re-minted, so a reorder that changes
	// nothing about the grouping writes the same document back.
	const used = new Set<string>();
	return supersetRuns(absorbed).flatMap((run) => {
		if (run.id === undefined) return run.entries;
		if (!used.has(run.id)) {
			used.add(run.id);
			return run.entries;
		}
		const id = newKey();
		return run.entries.map((entry) => ({ ...entry, supersetId: id }));
	});
}
