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

const plannedSet = z.object({
	reps: z.number().int().min(0).max(REPS_MAX),
	/** Kilograms, always. 0 is a bodyweight set, not a missing answer. */
	weightKg: z.number().min(0).max(WEIGHT_MAX_KG),
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
};

export const routineExercise = z.object({
	...entry,
	sets: z.array(plannedSet).min(1).max(SETS_MAX),
});

export const routineExercises = z.array(routineExercise).max(EXERCISES_MAX);

const loggedSet = plannedSet.extend({ done: z.boolean() });

export const workoutExercise = z.object({
	...entry,
	sets: z.array(loggedSet).min(1).max(SETS_MAX),
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

/** Total weight moved, done sets only, rounded to the kilogram. */
export const volumeKg = (exercises: WorkoutExercise[]) =>
	Math.round(
		exercises.reduce(
			(total, exercise) =>
				total +
				exercise.sets.reduce(
					(sum, set) => sum + (set.done ? set.reps * set.weightKg : 0),
					0,
				),
			0,
		),
	);

export const doneSetCount = (exercises: WorkoutExercise[]) =>
	exercises.reduce(
		(total, exercise) => total + exercise.sets.filter((set) => set.done).length,
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
