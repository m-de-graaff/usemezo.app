import assert from "node:assert/strict";
import { test } from "node:test";
import {
	prescription,
	proposalToExercises,
	proposedRoutine,
} from "./routine-proposal.ts";

const proposal = {
	name: "Upper body",
	exercises: [
		{ exerciseId: "0007", sets: 3, reps: 10, weightKg: 40 },
		{ exerciseId: "0009", sets: 4, reps: 8 },
	],
};

test("a proposal parses", () => {
	assert.equal(proposedRoutine.parse(proposal).name, "Upper body");
});

test("a proposal asking for nothing is rejected", () => {
	assert.throws(() => proposedRoutine.parse({ name: "Empty", exercises: [] }));
});

test("sets expand into one row each, carrying the proposed numbers", () => {
	const exercises = proposalToExercises(proposedRoutine.parse(proposal));
	assert.equal(exercises.length, 2);
	assert.equal(exercises[0]?.sets.length, 3);
	assert.equal(exercises[1]?.sets.length, 4);
	assert.deepEqual(exercises[0]?.sets[0], { reps: 10, weightKg: 40 });
});

test("an unnamed weight is a bodyweight set, not a guess", () => {
	const exercises = proposalToExercises(proposedRoutine.parse(proposal));
	assert.deepEqual(exercises[1]?.sets[0], { reps: 8, weightKg: 0 });
});

test("every entry gets its own key", () => {
	const exercises = proposalToExercises(proposedRoutine.parse(proposal));
	assert.equal(new Set(exercises.map((e) => e.key)).size, exercises.length);
});

test("a rep range lands on the sets, and the effort target on the note", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Push",
			exercises: [
				{
					exerciseId: "0007",
					sets: 3,
					reps: 8,
					repsMax: 10,
					rir: 2,
					restSec: 150,
					note: "elbows tucked",
				},
			],
		}),
	);

	// The range is on the rows now, so repeating it underneath them would be the
	// same instruction twice with two places to disagree.
	assert.equal(entry?.note, "2 in reserve · elbows tucked");
	assert.equal(entry?.restSec, 150);
	// Both ends of the range, on every working set: it is what double
	// progression reads, and what the lifter checks against at the rack.
	assert.deepEqual(entry?.sets[0], { reps: 8, repsMax: 10, weightKg: 0 });
});

test("a range that is not one is stored as the single number it is", () => {
	// A model that answers `repsMax` on every exercise whatever it was asked
	// will sometimes echo `reps` back, and a row reading "8-8" is worse than a
	// row reading "8".
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Push",
			exercises: [{ exerciseId: "0007", sets: 2, reps: 8, repsMax: 8 }],
		}),
	);

	assert.deepEqual(entry?.sets[0], { reps: 8, weightKg: 0 });
});

test("a warm-up ramp carries no rep range", () => {
	// The ramp is a fixed number of reps at a fraction of the weight. There is
	// nothing to progress within, and a range on it would count as a target the
	// lifter is meant to be working up.
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Push",
			exercises: [
				{
					exerciseId: "0007",
					sets: 3,
					reps: 8,
					repsMax: 12,
					weightKg: 100,
					warmupSets: 2,
				},
			],
		}),
	);

	const warmups = entry?.sets.filter((set) => set.type === "warmup") ?? [];
	assert.equal(warmups.length, 2);
	assert.ok(warmups.every((set) => set.repsMax === undefined));
	assert.equal(entry?.sets.at(-1)?.repsMax, 12);
});

test("a prescription with nothing in it is no note at all", () => {
	assert.equal(prescription({ exerciseId: "0007", sets: 3, reps: 10 }), "");
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Push",
			exercises: [{ exerciseId: "0007", sets: 3, reps: 10 }],
		}),
	);
	assert.equal(entry?.note, undefined);
});

test("zero reps in reserve is a set to failure, not a missing answer", () => {
	assert.equal(
		prescription({ exerciseId: "0007", sets: 3, reps: 12, rir: 0 }),
		"to failure",
	);
});

test("what comes out is what saveRoutine accepts", async () => {
	// The proposal is only useful if it satisfies the stored shape, and the two
	// schemas live in different packages, so this is the seam worth checking.
	const { routineExercises } = await import("@mezo/api/workout-shape");
	const exercises = proposalToExercises(proposedRoutine.parse(proposal));
	assert.deepEqual(routineExercises.parse(exercises), exercises);
});

test("warm-ups ramp below the working weight and count for nothing", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Legs",
			exercises: [
				{ exerciseId: "0007", sets: 3, reps: 8, weightKg: 100, warmupSets: 3 },
			],
		}),
	);

	assert.equal(entry?.sets.length, 6);
	const warmups = entry?.sets.filter((set) => set.type === "warmup") ?? [];
	assert.equal(warmups.length, 3);
	// The ramp climbs and never reaches the working set. A warm-up at the working
	// weight is a working set somebody decided not to count.
	const weights = warmups.map((set) => set.weightKg ?? 0);
	assert.deepEqual(
		weights,
		[...weights].sort((a, b) => a - b),
	);
	assert.ok(
		weights.every((weight) => weight > 0 && weight < 100),
		weights.join(),
	);
	// Loadable numbers, not the output of a percentage.
	assert.ok(
		weights.every((weight) => weight % 2.5 === 0),
		weights.join(),
	);
	// And the work is untouched by any of it.
	assert.deepEqual(entry?.sets.slice(3), [
		{ reps: 8, weightKg: 100 },
		{ reps: 8, weightKg: 100 },
		{ reps: 8, weightKg: 100 },
	]);
});

test("a bodyweight movement gets no ramp, because there is nothing to ramp", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Pull",
			exercises: [{ exerciseId: "0009", sets: 3, reps: 8, warmupSets: 3 }],
		}),
	);

	assert.equal(entry?.sets.length, 3);
	assert.ok(entry?.sets.every((set) => set.type === undefined));
});

test("failure sets are marked from the last working set back", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Arms",
			exercises: [
				{
					exerciseId: "0007",
					sets: 3,
					reps: 12,
					weightKg: 20,
					warmupSets: 1,
					failureSets: 1,
				},
			],
		}),
	);

	// The ramp is never the set that goes to failure, whatever the count says.
	assert.equal(entry?.sets[0]?.type, "warmup");
	assert.equal(entry?.sets[1]?.type, undefined);
	assert.equal(entry?.sets[2]?.type, undefined);
	assert.equal(entry?.sets[3]?.type, "failure");
});

test("asking for more failure sets than there are sets marks all of them", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Arms",
			exercises: [
				{ exerciseId: "0007", sets: 2, reps: 12, weightKg: 20, failureSets: 9 },
			],
		}),
	);

	assert.ok(entry?.sets.every((set) => set.type === "failure"));
});

test("every set to failure is said on the rows, not twice", () => {
	// The grid already says it, in the column the lifter is reading.
	const all = prescription({
		exerciseId: "0007",
		sets: 3,
		reps: 10,
		rir: 0,
		failureSets: 3,
	});
	assert.ok(!all.includes("failure"));

	// But with one set marked, the reserve target is what the other two are for.
	// Dropping it would leave most of the exercise unprescribed.
	const last = prescription({
		exerciseId: "0007",
		sets: 3,
		reps: 10,
		rir: 2,
		failureSets: 1,
	});
	assert.ok(last.includes("2 in reserve"));
});

test("both rest intervals survive into the routine", () => {
	const [entry] = proposalToExercises(
		proposedRoutine.parse({
			name: "Push",
			exercises: [
				{
					exerciseId: "0007",
					sets: 3,
					reps: 8,
					restSec: 150,
					restAfterSec: 180,
				},
			],
		}),
	);

	assert.equal(entry?.restSec, 150);
	assert.equal(entry?.restAfterSec, 180);
});
