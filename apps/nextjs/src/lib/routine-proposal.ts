import { newKey, type RoutineExercise } from "@mezo/api/workout-shape";
import { z } from "zod";

/**
 * What Milo may propose, and how it becomes a routine.
 *
 * The tool schema is flatter than the stored shape on purpose. A model asked
 * for an array of three identical set objects writes an array of three nearly
 * identical set objects: "three sets of ten" is one row here and three rows in
 * the database, and this is where that expansion happens.
 */
export const proposedRoutine = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(80)
		.describe("A short name for the routine, like 'Upper A' or 'Push day'."),
	note: z
		.string()
		.trim()
		.max(500)
		.optional()
		.describe("One line on what it is for."),
	exercises: z
		.array(
			z.object({
				exerciseId: z
					.string()
					.describe("An id from searchExercises. Never invent one."),
				sets: z.number().int().min(1).max(20),
				reps: z.number().int().min(1).max(100),
				weightKg: z
					.number()
					.min(0)
					.max(1000)
					.optional()
					.describe(
						"Kilograms, always, whatever units the conversation is in. Leave it out for a bodyweight movement, and leave it out rather than guess when you have no basis for a number.",
					),
			}),
		)
		.min(1)
		.max(20),
});

export type ProposedRoutine = z.infer<typeof proposedRoutine>;

/**
 * A proposal as the database stores it.
 *
 * An unnamed weight becomes 0, which is exactly what a bodyweight set is.
 * Better an honest zero the user corrects on the first set than an invented
 * number they train to.
 */
export const proposalToExercises = (
	proposal: ProposedRoutine,
): RoutineExercise[] =>
	proposal.exercises.map((entry) => ({
		key: newKey(),
		exerciseId: entry.exerciseId,
		sets: Array.from({ length: entry.sets }, () => ({
			reps: entry.reps,
			weightKg: entry.weightKg ?? 0,
		})),
	}));
