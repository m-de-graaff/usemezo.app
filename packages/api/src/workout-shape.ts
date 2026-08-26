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
export const EXERCISES_MAX = 50;

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
	/**
	 * The top of a rep range, when the set is prescribed as one.
	 *
	 * Absent means `reps` is the whole target: five means five. Present, `reps`
	 * is the bottom and this is the top, which is how almost every hypertrophy
	 * block is actually written down. Double progression needs both numbers to
	 * be readable at the rack, and a range folded into the note is a range the
	 * app cannot count, compare or progress.
	 *
	 * Not validated against `reps`. A range entered backwards is a display
	 * problem, and the two screens that render one sort the pair rather than
	 * refusing to save a routine somebody is halfway through typing.
	 */
	repsMax: z.number().int().min(0).max(REPS_MAX).optional(),
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
	 * has no opinion and the session falls back to `DEFAULT_REST_SEC`; `0` is an
	 * explicit no rest, and the only way to get no timer.
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

/**
 * What a plausibility check made of this set, once anything has.
 *
 * Absent is the normal state and means one of two things that do not need
 * telling apart: the set passed, or it was never the kind of set the check
 * speaks to. `suspect` is a question nobody has answered yet, and it is what
 * keeps the set out of records and out of the estimator without keeping it out
 * of the log. `confirmed` is the lifter saying it happened, which is the end of
 * the matter: `finish` will not re-flag it and nothing downstream skips it.
 *
 * Written by the server on finish and by the logging screen when somebody
 * answers the prompt. Not part of a routine: a plan cannot be implausible, it
 * has not happened yet.
 */
export const SET_FLAGS = ["suspect", "confirmed"] as const;
export type SetFlag = (typeof SET_FLAGS)[number];

const loggedSet = plannedSet.extend({
	done: z.boolean(),
	flag: z.enum(SET_FLAGS).optional(),
});

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

/**
 * Whether a set is allowed to make a claim about somebody.
 *
 * A set under an unanswered question stays in the log and stays in the
 * session's volume, because it is their diary and they wrote it. What it does
 * not get to do is set a record, move the strength estimate, or decide what
 * goes on the bar next week. Those are the three places one wrong number does
 * lasting damage, and they are the three places this guards.
 */
export const isTrusted = (set: { flag?: SetFlag }) => set.flag !== "suspect";

/**
 * Total weight moved, done working sets only, rounded to the kilogram.
 *
 * Doubted sets are in it. A session total is a diary entry, and a diary that
 * silently disagrees with the sets printed underneath it is worse than one
 * carrying a number somebody typed wrong.
 *
 * ponytail: `workout.volume_kg` is therefore not a figure to rank people by.
 * Recompute it over trusted sets only on the day there is a leaderboard.
 */
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

/** Weight moved by one set. A warm-up moves none: it is training, not tonnage. */
export const setVolumeKg = (set: PlannedSet) =>
	isCounted(set) ? (set.reps ?? 0) * (set.weightKg ?? 0) : 0;

/**
 * Which set of one exercise beat the record, if any.
 *
 * "Record" is the heaviest total a single set has moved: weight times reps.
 * Comparing on weight alone would call a heavy double a record over a set of
 * ten that moved twice as much, and comparing on the session's total would make
 * the record a function of how many sets somebody had time for.
 *
 * Only one index comes back per exercise, so a session where every set beats a
 * long-neglected exercise's old best gets one medal rather than five. Ties go
 * to the earliest set: that is the one that broke it.
 *
 * A set under an unanswered plausibility question is not in the running. A
 * record is the one number in the app that is a claim rather than a note, and
 * the whole reason to doubt a set is that it would otherwise become one.
 */
export function recordSetIndex(
	sets: LoggedSet[],
	previousBestKg: number,
): number | undefined {
	let bestIndex: number | undefined;
	let bestKg = previousBestKg;

	sets.forEach((set, index) => {
		if (!set.done || !isTrusted(set)) return;
		const volume = setVolumeKg(set);
		if (volume > bestKg) {
			bestKg = volume;
			bestIndex = index;
		}
	});

	return bestIndex;
}

/**
 * What an exercise with no interval of its own rests for.
 *
 * Absent used to mean no timer, which read well and was wrong: almost nobody
 * fills these fields in, so almost nobody ever saw a countdown, and "the app
 * has no rest timer" is what that looks like from outside. Two minutes is the
 * same number `estimatedSec` has always assumed for an unset exercise, so the
 * clock on screen and the time-left estimate now agree.
 *
 * Turning it off is still possible; it is `0`, which is a choice somebody made
 * rather than a field they never opened.
 */
export const DEFAULT_REST_SEC = 120;

/**
 * How long to rest after ticking one set off, in seconds, or nothing at all.
 *
 * Three cases, and the third is the one supersets exist for:
 *
 * 1. A set with more sets after it rests `restSec`.
 * 2. The last set of an exercise rests `restAfterSec`, which is the walk to
 *    whatever is next.
 * 3. The last set of an exercise that is *not* the last in its superset rests
 *    for nothing. Going straight into the next movement is what a superset is;
 *    a timer there would be counting down the thing it is meant to prevent.
 *
 * Anything that comes out as zero comes back as undefined: no rest and no
 * timer are the same thing to a caller, and one of them is not a countdown
 * worth drawing.
 */
export function restAfterSet(
	exercises: WorkoutExercise[],
	key: string,
	index: number,
): number | undefined {
	const at = exercises.findIndex((entry) => entry.key === key);
	const entry = exercises[at];
	if (!entry) return undefined;

	const next = exercises[at + 1];
	const last = index >= entry.sets.length - 1;

	if (
		last &&
		entry.supersetId !== undefined &&
		next?.supersetId === entry.supersetId
	) {
		return undefined;
	}

	const chosen = last ? (entry.restAfterSec ?? entry.restSec) : entry.restSec;

	return (chosen ?? DEFAULT_REST_SEC) || undefined;
}

/**
 * How long a session should take, in seconds.
 *
 * Rest is most of it. A set of ten is under a minute of work and the two
 * minutes after it are not, which is why a session of twenty sets is an hour
 * rather than fifteen minutes, and why an estimate that counts only the lifting
 * is wrong by a factor of four.
 *
 * The work itself is priced per rep, floored: a triple still costs the walk to
 * the rack and the setup. Warm-ups count — they take the same time as anything
 * else, whatever they do for the volume total.
 *
 * `REST_ASSUMED` is what an exercise with no rest interval costs. Absent means
 * the routine has no opinion, not that the lifter turns straight around.
 *
 * ponytail: supersets are counted as if they were separate exercises, so a
 * session built out of them reads longer than it runs. Pair the entries by
 * `supersetId` if anyone starts programming rounds seriously.
 */
const SEC_PER_REP = 3;
const SET_SEC_MIN = 20;
const REST_ASSUMED = 120;

export function estimatedSec(
	exercises: {
		sets: { reps?: number }[];
		restSec?: number;
		restAfterSec?: number;
	}[],
): number {
	return exercises.reduce((total, exercise, index) => {
		const work = exercise.sets.reduce(
			(sum, set) => sum + Math.max(SET_SEC_MIN, (set.reps ?? 0) * SEC_PER_REP),
			0,
		);
		// One fewer rest than there are sets: nobody rests after the last one,
		// they move on, and that move is `restAfterSec`.
		const between =
			Math.max(0, exercise.sets.length - 1) *
			(exercise.restSec ?? REST_ASSUMED);
		const after =
			index === exercises.length - 1
				? 0
				: (exercise.restAfterSec ?? exercise.restSec ?? REST_ASSUMED);

		return total + work + between + after;
	}, 0);
}

/** Every set in the list, warm-ups included: what the session asks you to do. */
export const setCount = (exercises: { sets: unknown[] }[]) =>
	exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

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

/**
 * The reverse of `startFromRoutine`, for saving a session as a routine.
 *
 * The flag comes off with the tick. Both are facts about a session that
 * happened, and a plan for next Tuesday cannot be under a question about
 * whether it took place.
 */
export const toRoutineExercises = (
	exercises: WorkoutExercise[],
): RoutineExercise[] =>
	exercises.map((exercise) => ({
		...exercise,
		sets: exercise.sets.map(({ done: _done, flag: _flag, ...set }) => set),
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

/**
 * Notes written onto a session's exercises from outside the logging screen.
 *
 * Keyed on `exerciseId` rather than on `key`, because the writer is Milo and
 * `key` is an id minted in a browser that Milo never saw. The cost is that the
 * same movement twice in one session takes the same note twice, which is the
 * right answer far more often than annotating one of two identical rows at
 * random would be.
 *
 * An empty string clears a note. That is the only way to take one back off
 * without opening the session, and "" is what a model sends when asked to
 * remove something.
 *
 * `missing` is what the caller could not place: ids the session does not
 * contain. Reported rather than ignored, so a note written against the wrong
 * exercise comes back as something to correct instead of vanishing.
 */
export function applyNotes<T extends { exerciseId: string; note?: string }>(
	exercises: T[],
	notes: { exerciseId: string; note: string }[],
): { exercises: T[]; missing: string[] } {
	const byId = new Map(notes.map((note) => [note.exerciseId, note.note]));
	const placed = new Set<string>();

	const next = exercises.map((entry) => {
		const note = byId.get(entry.exerciseId);
		if (note === undefined) return entry;
		placed.add(entry.exerciseId);
		// Deleted rather than set to "", so a cleared note is absent in the
		// document exactly as it is for an exercise nobody ever annotated.
		const { note: _cleared, ...rest } = entry;
		return (note ? { ...rest, note } : rest) as T;
	});

	return {
		exercises: next,
		missing: [...byId.keys()].filter((id) => !placed.has(id)),
	};
}
