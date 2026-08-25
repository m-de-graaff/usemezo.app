import assert from "node:assert/strict";
import { test } from "node:test";
import {
	doneSetCount,
	dropUnfinished,
	newKey,
	routineExercises,
	startFromRoutine,
	toRoutineExercises,
	volumeKg,
	workoutExercises,
} from "./workout-shape.ts";

const planned = [
	{
		key: "a",
		exerciseId: "0001",
		sets: [
			{ reps: 10, weightKg: 60 },
			{ reps: 10, weightKg: 60 },
		],
	},
];

test("a routine entry round-trips through its schema", () => {
	assert.deepEqual(routineExercises.parse(planned), planned);
});

test("a routine rejects impossible numbers", () => {
	assert.throws(() =>
		routineExercises.parse([
			{ key: "a", exerciseId: "0001", sets: [{ reps: 10, weightKg: -1 }] },
		]),
	);
	assert.throws(() =>
		routineExercises.parse([
			{ key: "a", exerciseId: "0001", sets: [{ reps: 1.5, weightKg: 60 }] },
		]),
	);
	// An entry with no sets is a row the logging screen cannot render.
	assert.throws(() =>
		routineExercises.parse([{ key: "a", exerciseId: "0001", sets: [] }]),
	);
});

test("keys are unique per call", () => {
	assert.notEqual(newKey(), newKey());
});

test("a session starts from a routine with nothing done", () => {
	const session = startFromRoutine(planned);
	assert.deepEqual(workoutExercises.parse(session), session);
	assert.ok(session[0]?.sets.every((set) => set.done === false));
	// The planned numbers survive as the prefill, which is the whole point.
	assert.equal(session[0]?.sets[0]?.weightKg, 60);
	// Keys are kept, so a routine edited mid-session still lines up.
	assert.equal(session[0]?.key, "a");
});

test("volume counts done sets only", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [
				{ reps: 10, weightKg: 60, done: true },
				{ reps: 10, weightKg: 60, done: false },
			],
		},
	];
	assert.equal(volumeKg(session), 600);
	assert.equal(doneSetCount(session), 1);
});

test("volume rounds to a whole kilogram", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [{ reps: 3, weightKg: 62.5, done: true }],
		},
	];
	assert.equal(volumeKg(session), 188);
});

test("bodyweight sets count as sets but add no volume", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [{ reps: 12, weightKg: 0, done: true }],
		},
	];
	assert.equal(volumeKg(session), 0);
	assert.equal(doneSetCount(session), 1);
});

test("finishing drops the sets nobody did, and the exercises left empty", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [
				{ reps: 10, weightKg: 60, done: true },
				{ reps: 10, weightKg: 60, done: false },
			],
		},
		{
			key: "b",
			exerciseId: "0002",
			sets: [{ reps: 10, weightKg: 40, done: false }],
		},
	];
	const kept = dropUnfinished(session);
	assert.equal(kept.length, 1);
	assert.equal(kept[0]?.sets.length, 1);
});

test("finishing an untouched session keeps nothing", () => {
	assert.deepEqual(dropUnfinished(startFromRoutine(planned)), []);
});

test("a session can be saved back as a routine", () => {
	const session = startFromRoutine(planned);
	assert.deepEqual(
		routineExercises.parse(toRoutineExercises(session)),
		planned,
	);
});
