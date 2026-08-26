import { WARMUP_MAX, warmupRamp, warmupReps } from "@mezo/api/training";
import {
	newKey,
	type PlannedSet,
	type RoutineExercise,
} from "@mezo/api/workout-shape";
import { z } from "zod";

/**
 * What Milo may propose, and how it becomes a routine.
 *
 * The tool schema is flatter than the stored shape on purpose. A model asked
 * for an array of three identical set objects writes an array of three nearly
 * identical set objects: "three sets of ten" is one row here and three rows in
 * the database, and this is where that expansion happens.
 *
 * It is also a little wider than the stored shape. A rep range, reps in reserve
 * and a rest interval are the difference between a list of exercises and a
 * prescription, and asking for them is what stops the model writing "4 × 10"
 * for a heavy squat and a lateral raise alike. Only the parts the routine
 * schema has a column for are stored; the rest is folded into the note the
 * lifter reads between sets.
 *
 * The rep range is one of the parts with a column. It goes onto every working
 * set as `reps` and `repsMax`, where the rows draw it and double progression
 * can read it, rather than into the note, where it was prose the app could not
 * count.
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
		.describe(
			"One or two lines: what the session is for, and how to progress it.",
		),
	timesPerWeek: z
		.number()
		.int()
		.min(1)
		.max(7)
		.optional()
		.describe(
			"How often this session is meant to be run in a week. Used to check weekly volume; it is not stored.",
		),
	exercises: z
		.array(
			z.object({
				exerciseId: z
					.string()
					.describe("An id from searchExercises. Never invent one."),
				sets: z.number().int().min(1).max(20),
				reps: z
					.number()
					.int()
					.min(1)
					.max(100)
					.describe(
						"The bottom of the rep range: the number to start the block at.",
					),
				repsMax: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.describe(
						"The top of the rep range, shown on every working set beside the bottom. When every set reaches it, the weight goes up. Leave it out only when the prescription really is one number, like a heavy triple.",
					),
				rir: z
					.number()
					.int()
					.min(0)
					.max(5)
					.optional()
					.describe("Reps left in reserve at the end of a working set."),
				restSec: z
					.number()
					.int()
					.min(15)
					.max(600)
					.optional()
					.describe("Rest between sets of this exercise, in seconds."),
				restAfterSec: z
					.number()
					.int()
					.min(15)
					.max(600)
					.optional()
					.describe(
						"Rest after the last set of this exercise, before the next one starts. A different number from restSec, and reviewSession returns it. Leave it out on the last exercise.",
					),
				warmupSets: z
					.number()
					.int()
					.min(0)
					.max(WARMUP_MAX)
					.optional()
					.describe(
						"Ramp-up sets before the working sets, added at a fraction of the working weight. They are logged and count for nothing. Leave it out for a bodyweight movement or anything already warm.",
					),
				failureSets: z
					.number()
					.int()
					.min(0)
					.max(20)
					.optional()
					.describe(
						"How many of the working sets, counted from the last one, are taken to failure. 1 marks the last set only. Leave it out for none.",
					),
				weightKg: z
					.number()
					.min(0)
					.max(1000)
					.optional()
					.describe(
						"Kilograms, always, whatever units the conversation is in. Leave it out for a bodyweight movement, and use estimateWeight rather than guessing.",
					),
				note: z
					.string()
					.trim()
					.max(200)
					.optional()
					.describe("A cue or a substitution, if there is one worth making."),
			}),
		)
		.min(1)
		.max(20),
});

export type ProposedRoutine = z.infer<typeof proposedRoutine>;
export type ProposedExercise = ProposedRoutine["exercises"][number];

/**
 * The prescription as a line of text, for the note a lifter reads mid-set.
 *
 * Empty when the model gave nothing beyond sets and reps, so the note stays
 * absent rather than becoming a restatement of the numbers already on the row.
 */
export function prescription(entry: ProposedExercise): string {
	const parts: string[] = [];

	// The rep range is not in here. It is on the set rows, in the column the
	// lifter is already reading, and repeating it in the note underneath would
	// be the same instruction twice with two places to disagree.
	//
	// Skipped only when every set is marked "to failure" on the rows, where the
	// lifter is already reading it. With one set marked, the reserve target is
	// what the other two are for, and dropping it would leave them unprescribed.
	if (entry.rir !== undefined && (entry.failureSets ?? 0) < entry.sets) {
		parts.push(entry.rir === 0 ? "to failure" : `${entry.rir} in reserve`);
	}
	if (entry.note) parts.push(entry.note);

	return parts.join(" · ");
}

/**
 * The sets, in the order they are performed: the ramp, then the work.
 *
 * Warm-ups are added here rather than asked for set by set, for the same reason
 * the working sets are: a model asked to write four ramp sets writes four nearly
 * identical ones, and the fractions are a thing the app should be sure of. They
 * are skipped entirely without a working weight, because there is nothing to be
 * a fraction of and a bodyweight movement warms up on its first set anyway.
 *
 * `failureSets` marks the working sets from the last one back. That is the
 * shape of the instruction people are actually given — take the final set all
 * the way — and marking the set rather than writing it in the note is what puts
 * it in the column the lifter reads between sets.
 */
export function proposedSets(entry: ProposedExercise): PlannedSet[] {
	const weightKg = entry.weightKg ?? 0;

	const warmups: PlannedSet[] =
		weightKg > 0
			? warmupRamp(entry.warmupSets ?? 0).map((fraction) => ({
					reps: warmupReps(entry.reps, fraction),
					// To the nearest plate change. A warm-up at 47.3 kg is a number
					// nobody can load, and rounding it here is the difference between
					// a prescription and a calculation.
					weightKg: Math.round((weightKg * fraction) / 2.5) * 2.5,
					type: "warmup",
				}))
			: [];

	const failing = Math.min(entry.failureSets ?? 0, entry.sets);

	// The top of the range, only when there is one. A `repsMax` equal to or below
	// `reps` is not a range, it is the same number written twice, and storing it
	// would turn every fixed prescription into a row that reads "8-8".
	//
	// Warm-ups never carry it. A ramp set is a fixed number of reps at a fraction
	// of the weight, not something to progress within.
	const range =
		entry.repsMax && entry.repsMax > entry.reps
			? { repsMax: entry.repsMax }
			: {};

	return [
		...warmups,
		...Array.from({ length: entry.sets }, (_unused, index) => ({
			reps: entry.reps,
			...range,
			weightKg,
			...(index >= entry.sets - failing ? { type: "failure" as const } : {}),
		})),
	];
}

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
	proposal.exercises.map((entry) => {
		const note = prescription(entry);

		return {
			key: newKey(),
			exerciseId: entry.exerciseId,
			...(note ? { note } : {}),
			...(entry.restSec ? { restSec: entry.restSec } : {}),
			...(entry.restAfterSec ? { restAfterSec: entry.restAfterSec } : {}),
			sets: proposedSets(entry),
		};
	});
