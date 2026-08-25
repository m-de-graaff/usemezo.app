import assert from "node:assert/strict";
import { test } from "node:test";
import { proposalToExercises, proposedRoutine } from "./routine-proposal.ts";

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

test("what comes out is what saveRoutine accepts", async () => {
	// The proposal is only useful if it satisfies the stored shape, and the two
	// schemas live in different packages, so this is the seam worth checking.
	const { routineExercises } = await import("@mezo/api/workout-shape");
	const exercises = proposalToExercises(proposedRoutine.parse(proposal));
	assert.deepEqual(routineExercises.parse(exercises), exercises);
});
