import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyNotes,
	DEFAULT_REST_SEC,
	decodeCursor,
	doneSetCount,
	dropUnfinished,
	encodeCursor,
	estimatedSec,
	insertIntoSuperset,
	isoDay,
	moveExerciseNextTo,
	moveIntoSuperset,
	newKey,
	normaliseSupersets,
	recordSetIndex,
	restAfterSet,
	routineExercises,
	startFromRoutine,
	supersetRuns,
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
});

test("an exercise can be added with no sets at all", () => {
	const empty = [{ key: "a", exerciseId: "0001", sets: [] }];
	assert.deepEqual(routineExercises.parse(empty), empty);
});

test("a set can carry no numbers yet", () => {
	const blank = [{ key: "a", exerciseId: "0001", sets: [{}] }];
	assert.deepEqual(routineExercises.parse(blank), blank);
});

test("warm-up sets are logged but count for nothing", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [
				{ reps: 10, weightKg: 20, done: true, type: "warmup" as const },
				{ reps: 5, weightKg: 100, done: true, type: "failure" as const },
			],
		},
	];
	assert.equal(volumeKg(session), 500);
	assert.equal(doneSetCount(session), 1);
});

test("a set with no numbers contributes no volume", () => {
	assert.equal(
		volumeKg([{ key: "a", exerciseId: "0001", sets: [{ done: true }] }]),
		0,
	);
});

test("a consecutive run is left exactly as it is", () => {
	const joined = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b", supersetId: "x" },
		{ key: "c", supersetId: "x" },
	]);
	assert.deepEqual(
		joined.map((entry) => entry.supersetId),
		["x", "x", "x"],
	);
});

test("a superset of one survives, because that is how one starts", () => {
	const seed = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b" },
	]);
	assert.equal(seed[0]?.supersetId, "x");
	assert.equal(seed[1]?.supersetId, undefined);
});

test("an exercise moved inside a superset joins it", () => {
	// The single-pointer alternative to dragging: move a row in with the arrows
	// and it is in.
	const absorbed = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b" },
		{ key: "c", supersetId: "x" },
	]);
	assert.deepEqual(
		absorbed.map((entry) => entry.supersetId),
		["x", "x", "x"],
	);
});

test("members pulled apart become two supersets, not one with a hole", () => {
	const split = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b" },
		{ key: "c" },
		{ key: "d", supersetId: "x" },
	]);
	// Two unassigned rows in the gap is a move out, not a move in.
	assert.equal(split[1]?.supersetId, undefined);
	assert.equal(split[2]?.supersetId, undefined);
	assert.equal(split[0]?.supersetId, "x", "the first run keeps the id");
	assert.notEqual(split[3]?.supersetId, "x");
	assert.notEqual(split[3]?.supersetId, undefined);
});

test("an exercise dragged into a superset lands at the end of it", () => {
	const moved = moveIntoSuperset(
		[
			{ key: "a", supersetId: "x" },
			{ key: "b", supersetId: "x" },
			{ key: "c" },
			{ key: "d" },
		],
		"x",
		"d",
	);
	// Spliced in after the last member, not left where it was: a superset is
	// exercises done back to back.
	assert.deepEqual(
		moved.map((entry) => entry.key),
		["a", "b", "d", "c"],
	);
	assert.equal(moved[2]?.supersetId, "x");
});

test("a drop that means nothing changes nothing", () => {
	const list = [{ key: "a", supersetId: "x" }, { key: "b" }];
	// Already in the group, an unknown key, and an unknown group.
	assert.equal(moveIntoSuperset(list, "x", "a"), list);
	assert.equal(moveIntoSuperset(list, "x", "nope"), list);
	assert.equal(moveIntoSuperset(list, "nope", "b"), list);
});

test("a picked exercise is inserted into the group, not appended to the list", () => {
	const added = insertIntoSuperset(
		[{ key: "a", supersetId: "x" }, { key: "b" }],
		"x",
		{ key: "c" },
	);
	assert.deepEqual(
		added.map((entry) => entry.key),
		["a", "c", "b"],
	);
	assert.equal(added[1]?.supersetId, "x");
});

test("dragging one exercise onto another reorders the list", () => {
	const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
	assert.deepEqual(
		moveExerciseNextTo(list, "c", "a", false).map((entry) => entry.key),
		["c", "a", "b"],
	);
	assert.deepEqual(
		moveExerciseNextTo(list, "a", "c", true).map((entry) => entry.key),
		["b", "c", "a"],
	);
	// Onto itself, or onto a row that is not there, is a no-op.
	assert.equal(moveExerciseNextTo(list, "a", "a", true), list);
	assert.equal(moveExerciseNextTo(list, "a", "nope", true), list);
});

test("where it lands decides what it belongs to", () => {
	const list = [
		{ key: "a", supersetId: "x" },
		{ key: "b", supersetId: "x" },
		{ key: "c" },
	];
	// Dropped between two members, it is in the superset.
	const inside = moveExerciseNextTo(list, "c", "a", true);
	assert.deepEqual(
		inside.map((entry) => entry.key),
		["a", "c", "b"],
	);
	assert.equal(inside[1]?.supersetId, "x");

	// Dragged clear of the group it shared, it leaves it behind.
	const outside = moveExerciseNextTo(list, "b", "c", true);
	assert.deepEqual(
		outside.map((entry) => entry.key),
		["a", "c", "b"],
	);
	assert.equal(outside[2]?.supersetId, undefined);
});

test("a superset of one keeps its group when it is only being moved", () => {
	// The seed of an empty superset is a frame waiting to be filled. Dragging it
	// up the list must not quietly dissolve it.
	const moved = moveExerciseNextTo(
		[{ key: "a" }, { key: "b" }, { key: "seed", supersetId: "x" }],
		"seed",
		"a",
		false,
	);
	assert.deepEqual(
		moved.map((entry) => entry.key),
		["seed", "a", "b"],
	);
	assert.equal(moved[0]?.supersetId, "x");
});

test("reordering inside a superset keeps everyone in it", () => {
	const shuffled = moveExerciseNextTo(
		[
			{ key: "a", supersetId: "x" },
			{ key: "b", supersetId: "x" },
			{ key: "c" },
		],
		"a",
		"b",
		true,
	);
	assert.deepEqual(
		shuffled.map((entry) => entry.key),
		["b", "a", "c"],
	);
	assert.deepEqual(
		shuffled.slice(0, 2).map((entry) => entry.supersetId),
		["x", "x"],
	);
});

test("runs group consecutive members and nothing else", () => {
	const runs = supersetRuns([
		{ key: "a" },
		{ key: "b", supersetId: "x" },
		{ key: "c", supersetId: "x" },
		{ key: "d" },
	]);
	assert.deepEqual(
		runs.map((run) => run.entries.map((entry) => entry.key)),
		[["a"], ["b", "c"], ["d"]],
	);
});

test("a session started from a routine keeps set types and supersets", () => {
	const session = startFromRoutine([
		{
			key: "a",
			exerciseId: "0001",
			supersetId: "x",
			sets: [{ reps: 10, weightKg: 20, type: "warmup" }],
		},
		{ key: "b", exerciseId: "0002", supersetId: "x", sets: [] },
	]);
	assert.equal(session[0]?.supersetId, "x");
	assert.equal(session[0]?.sets[0]?.type, "warmup");
	assert.deepEqual(toRoutineExercises(session)[0]?.sets, [
		{ reps: 10, weightKg: 20, type: "warmup" },
	]);
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

test("a note is written onto every entry for that exercise", () => {
	const { exercises, missing } = applyNotes(
		[
			{ key: "a", exerciseId: "squat", sets: [] },
			{ key: "b", exerciseId: "bench", sets: [], note: "old" },
			{ key: "c", exerciseId: "squat", sets: [] },
		],
		[
			{ exerciseId: "squat", note: "knee felt fine" },
			{ exerciseId: "bench", note: "shoulder twinged on set 3" },
		],
	);

	assert.equal(exercises[0]?.note, "knee felt fine");
	// The same movement twice takes the same note. Picking one of the two would
	// be a coin toss the reader cannot see.
	assert.equal(exercises[2]?.note, "knee felt fine");
	assert.equal(exercises[1]?.note, "shoulder twinged on set 3");
	assert.deepEqual(missing, []);
});

test("an empty note clears one, and an unknown exercise is reported", () => {
	const { exercises, missing } = applyNotes(
		[{ key: "a", exerciseId: "squat", sets: [], note: "old" }],
		[
			{ exerciseId: "squat", note: "" },
			{ exerciseId: "deadlift", note: "went well" },
		],
	);

	// Absent, not empty: a cleared note has to look like one that was never
	// written, or the reader gets a blank line where the plan used to be.
	assert.deepEqual(exercises, [{ key: "a", exerciseId: "squat", sets: [] }]);
	assert.deepEqual(missing, ["deadlift"]);
});

test("an estimate counts the rest, which is most of a session", () => {
	// Three sets of ten with two minutes between them: three minutes of lifting
	// and four of standing about. An estimate that counts only the lifting is
	// wrong by more than the thing it is estimating.
	const estimate = estimatedSec([
		{ sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }], restSec: 120 },
	]);
	assert.equal(estimate, 30 * 3 + 120 * 2);

	// Nothing after the last exercise: the session is over.
	assert.equal(
		estimatedSec([{ sets: [{ reps: 10 }], restSec: 120, restAfterSec: 180 }]),
		30,
	);
	// But between two, the walk counts.
	assert.equal(
		estimatedSec([
			{ sets: [{ reps: 10 }], restSec: 120, restAfterSec: 180 },
			{ sets: [{ reps: 10 }], restSec: 120 },
		]),
		30 + 180 + 30,
	);
});

test("a short set still costs the walk to the rack", () => {
	// A triple is ten seconds of lifting and a minute of setting up.
	assert.equal(estimatedSec([{ sets: [{ reps: 1 }] }]), 20);
	// And a set nobody has filled in is not a set of zero seconds.
	assert.equal(estimatedSec([{ sets: [{}] }]), 20);
	assert.equal(estimatedSec([]), 0);
});

test("a set can carry a rep range, and the range is not what is counted", () => {
	const routine = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [{ reps: 8, repsMax: 12, weightKg: 60 }],
		},
	];
	assert.deepEqual(routineExercises.parse(routine), routine);

	// Volume is what was lifted, not what was prescribed: a set logged at 10
	// reps counts 10, whatever range it was written down as.
	assert.equal(
		volumeKg([
			{
				key: "a",
				exerciseId: "0001",
				sets: [{ reps: 10, repsMax: 12, weightKg: 60, done: true }],
			},
		]),
		600,
	);
});

test("a rep range survives the round trip through a session", () => {
	const session = startFromRoutine([
		{ key: "a", exerciseId: "0001", sets: [{ reps: 8, repsMax: 12 }] },
	]);
	assert.equal(session[0]?.sets[0]?.repsMax, 12);
	assert.deepEqual(toRoutineExercises(session)[0]?.sets, [
		{ reps: 8, repsMax: 12 },
	]);
});

test("the record set is the one that moved the most weight", () => {
	const sets = [
		{ reps: 10, weightKg: 60, done: true },
		{ reps: 5, weightKg: 100, done: true },
		{ reps: 12, weightKg: 60, done: true },
	];

	// 720 beats the old best of 700; the heavier double moved less and is not it.
	assert.equal(recordSetIndex(sets, 700), 2);
	// Nothing beats a best that already stands.
	assert.equal(recordSetIndex(sets, 800), undefined);
	// A set nobody ticked is a set nobody did.
	assert.equal(
		recordSetIndex([{ reps: 20, weightKg: 100, done: false }], 0),
		undefined,
	);
	// A warm-up is training, not tonnage, so it cannot be a record.
	assert.equal(
		recordSetIndex(
			[{ reps: 20, weightKg: 100, done: true, type: "warmup" }],
			0,
		),
		undefined,
	);
});

test("rest after a set knows which set it was", () => {
	const exercises = [
		{
			key: "a",
			exerciseId: "0001",
			supersetId: "g",
			restSec: 30,
			restAfterSec: 180,
			sets: [
				{ reps: 10, done: true },
				{ reps: 10, done: false },
			],
		},
		{
			key: "b",
			exerciseId: "0002",
			supersetId: "g",
			restSec: 45,
			restAfterSec: 240,
			sets: [{ reps: 10, done: false }],
		},
		{ key: "c", exerciseId: "0003", sets: [{ reps: 10, done: false }] },
		{
			key: "d",
			exerciseId: "0004",
			restSec: 0,
			sets: [{ reps: 10, done: false }],
		},
	];

	// Mid-exercise: the between-sets interval.
	assert.equal(restAfterSet(exercises, "a", 0), 30);
	// Last set, but the next exercise is the other half of the superset, so the
	// answer is to turn around and start it.
	assert.equal(restAfterSet(exercises, "a", 1), undefined);
	// Last set of the last member: the round is over.
	assert.equal(restAfterSet(exercises, "b", 0), 240);
	// An exercise nobody set an interval on still rests. A field almost nobody
	// fills in is not a reason to have no timer.
	assert.equal(restAfterSet(exercises, "c", 0), DEFAULT_REST_SEC);
	// Zero is off, and off is a choice rather than an unopened field.
	assert.equal(restAfterSet(exercises, "d", 0), undefined);
	assert.equal(restAfterSet(exercises, "gone", 0), undefined);
});
