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

/** The reverse of `startFromRoutine`, for saving a session as a routine. */
export const toRoutineExercises = (
	exercises: WorkoutExercise[],
): RoutineExercise[] =>
	exercises.map((exercise) => ({
		...exercise,
		sets: exercise.sets.map(({ done: _done, ...set }) => set),
	}));
