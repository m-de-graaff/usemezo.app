import assert from "node:assert/strict";
import { test } from "node:test";
import {
	decodeCursor,
	doneSetCount,
	dropUnfinished,
	encodeCursor,
	isoDay,
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

test("a history cursor round-trips", () => {
	const row = { startedAt: new Date("2026-08-25T09:30:00.000Z"), id: "w1" };
	const decoded = decodeCursor(encodeCursor(row));
	assert.equal(decoded?.id, "w1");
	assert.equal(decoded?.startedAt.getTime(), row.startedAt.getTime());
});

test("a missing or malformed cursor is no cursor, not an error", () => {
	// A cursor is opaque to whoever holds it, so a strange one has to restart
	// the list rather than take the page down.
	assert.equal(decodeCursor(null), null);
	assert.equal(decodeCursor(undefined), null);
	assert.equal(decodeCursor(""), null);
	assert.equal(decodeCursor("rubbish"), null);
	assert.equal(decodeCursor("|w1"), null);
	assert.equal(decodeCursor("2026-08-25T09:30:00.000Z|"), null);
	assert.equal(decodeCursor("not-a-date|w1"), null);
});

test("a day label follows the local clock, not UTC", () => {
	// Nine in the evening is the day it was, wherever the reader is. Slicing an
	// ISO string would file it under tomorrow for anyone west of UTC.
	assert.equal(isoDay(new Date(2026, 7, 25, 21, 0, 0)), "2026-08-25");
	// Padded, or the chart's labels stop sorting as strings.
	assert.equal(isoDay(new Date(2026, 0, 5)), "2026-01-05");
});
