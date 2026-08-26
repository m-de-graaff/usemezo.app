import assert from "node:assert/strict";
import { test } from "node:test";
import { loadStep, type PastSession, progressExercise } from "./progression.ts";
import type { PlannedSet } from "./workout-shape.ts";

const NOW = new Date("2026-08-26T10:00:00Z");
const daysAgo = (n: number) =>
	new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

/** Three sets of eight to twelve, which is what most of this is written against. */
const planned: PlannedSet[] = [
	{ reps: 8, repsMax: 12, weightKg: 60 },
	{ reps: 8, repsMax: 12, weightKg: 60 },
	{ reps: 8, repsMax: 12, weightKg: 60 },
];

const session = (
	at: Date,
	sets: { reps: number; weightKg: number; done?: boolean }[],
): PastSession => ({
	at,
	sets: sets.map((set) => ({ done: true, ...set })),
});

const run = (
	past: PastSession[],
	equipment = "barbell",
	sets: PlannedSet[] = planned,
) => progressExercise({ equipment, now: NOW, past, planned: sets });

test("the jump is one the equipment can make, and scales with the load", () => {
	// A rack goes up in twos; a bar goes up in a pair of small plates.
	assert.equal(loadStep("dumbbell", 20), 2);
	assert.equal(loadStep("barbell", 40), 2.5);
	// 2.5% of 220 kg is 5.5, which rounds down onto the bar's own grid.
	assert.equal(loadStep("barbell", 220), 5);
	// Nothing to add weight to.
	assert.equal(loadStep("body weight", 0), 0);
	assert.equal(loadStep("resistance band", 0), 0);
});

test("every set at the top of the range earns the weight", () => {
	const next = run([
		session(daysAgo(7), [
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
		]),
	]);

	assert.ok(next);
	// Up one jump, and the reps go back to the bottom of the range. That pair is
	// the whole of double progression.
	assert.deepEqual(
		next.sets.map((set) => [set.weightKg, set.reps]),
		[
			[62.5, 8],
			[62.5, 8],
			[62.5, 8],
		],
	);
	assert.match(next.reason, /Up 2\.5 kg/);
});

test("most of the sets at the top is not all of them", () => {
	const next = run([
		session(daysAgo(7), [
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 9, weightKg: 60 },
		]),
	]);

	assert.ok(next);
	// Same weight, still climbing. Adding load here is how week four becomes a
	// week of failed sets.
	assert.deepEqual(next.sets[0]?.weightKg, 60);
	assert.equal(next.sets[0]?.reps, 12);
});

test("a heavy single somebody worked up to is not the working weight", () => {
	const next = run([
		session(daysAgo(7), [
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 3, weightKg: 90 },
		]),
	]);

	assert.ok(next);
	// Progressed from the 60 that was worked, not the 90 that was touched once.
	assert.equal(next.sets[0]?.weightKg, 62.5);
});

test("one bad session repeats; two in a row deloads", () => {
	const bad = (at: Date) =>
		session(at, [
			{ reps: 5, weightKg: 100 },
			{ reps: 5, weightKg: 100 },
			{ reps: 4, weightKg: 100 },
		]);

	const once = run([bad(daysAgo(4))]);
	assert.ok(once);
	assert.equal(once.sets[0]?.weightKg, 100);
	assert.match(once.reason, /not a trend/);

	const twice = run([bad(daysAgo(4)), bad(daysAgo(11))]);
	assert.ok(twice);
	// 10% off 100, rounded onto the bar's grid.
	assert.equal(twice.sets[0]?.weightKg, 90);
	assert.match(twice.reason, /Stalled twice/);
});

test("a long time off repeats the session rather than raising it", () => {
	const next = run([
		session(daysAgo(40), [
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
		]),
	]);

	assert.ok(next);
	assert.equal(next.sets[0]?.weightKg, 60);
	assert.match(next.reason, /40 days off/);
});

test("a good session after a long gap holds the weight", () => {
	const top = (at: Date) =>
		session(at, [
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
			{ reps: 12, weightKg: 60 },
		]);

	// Trained a week ago, but the one before that was a month earlier. One good
	// session is not a trend to add weight to either.
	const next = run([top(daysAgo(5)), top(daysAgo(35))]);
	assert.ok(next);
	assert.equal(next.sets[0]?.weightKg, 60);
	assert.match(next.reason, /twice/);
});

test("assistance comes down, because down is the hard direction", () => {
	const next = run(
		[
			session(daysAgo(7), [
				{ reps: 12, weightKg: 30 },
				{ reps: 12, weightKg: 30 },
				{ reps: 12, weightKg: 30 },
			]),
		],
		"assisted",
	);

	assert.ok(next);
	assert.equal(next.sets[0]?.weightKg, 27.5);
	assert.match(next.reason, /Down to 27\.5 kg of assistance/);
});

test("a bodyweight movement progresses on reps and stays at no weight", () => {
	const next = run(
		[
			session(daysAgo(7), [
				{ reps: 12, weightKg: 0 },
				{ reps: 12, weightKg: 0 },
				{ reps: 12, weightKg: 0 },
			]),
		],
		"body weight",
		[
			{ reps: 8, repsMax: 12, weightKg: 0 },
			{ reps: 8, repsMax: 12, weightKg: 0 },
			{ reps: 8, repsMax: 12, weightKg: 0 },
		],
	);

	assert.ok(next);
	assert.equal(next.sets[0]?.reps, 13);
	assert.equal(next.sets[0]?.weightKg, 0);
});

test("a bodyweight climb keeps going past the routine's own ceiling", () => {
	// Last week's session already beat the written range. Counting from the
	// range instead of from the session parks this at thirteen for ever.
	const next = run(
		[
			session(daysAgo(7), [
				{ reps: 15, weightKg: 0 },
				{ reps: 15, weightKg: 0 },
				{ reps: 15, weightKg: 0 },
			]),
		],
		"body weight",
		[
			{ reps: 8, repsMax: 12, weightKg: 0 },
			{ reps: 8, repsMax: 12, weightKg: 0 },
			{ reps: 8, repsMax: 12, weightKg: 0 },
		],
	);

	assert.ok(next);
	assert.equal(next.sets[0]?.reps, 16);
	// A target above the range is a target, not a range: leaving `repsMax` on
	// would prescribe "12-16" at the rack.
	assert.equal(next.sets[0]?.repsMax, undefined);
});

test("a small step leaves the ramp exactly where it was", () => {
	const next = run(
		[
			session(daysAgo(7), [
				{ reps: 12, weightKg: 60 },
				{ reps: 12, weightKg: 60 },
				{ reps: 12, weightKg: 60 },
			]),
		],
		"barbell",
		[{ reps: 10, weightKg: 20, type: "warmup" as const }, ...planned],
	);

	assert.ok(next);
	assert.deepEqual(next.sets[0], {
		reps: 10,
		weightKg: 20,
		type: "warmup",
	});
	assert.equal(next.sets[1]?.weightKg, 62.5);
});

test("nothing to go on means nothing is touched", () => {
	// No history at all.
	assert.equal(run([]), null);
	// A session where nothing was ticked off is a session that did not happen.
	assert.equal(
		run([session(daysAgo(7), [{ reps: 12, weightKg: 60, done: false }])]),
		null,
	);
	// A routine with no rep target has no range to progress through.
	assert.equal(
		run([session(daysAgo(7), [{ reps: 12, weightKg: 60 }])], "barbell", [
			{ weightKg: 60 },
		]),
		null,
	);
});

test("a plain rep target progresses without needing a range", () => {
	const flat = [
		{ reps: 5, weightKg: 100 },
		{ reps: 5, weightKg: 100 },
	];
	const next = run(
		[
			session(daysAgo(4), [
				{ reps: 5, weightKg: 100 },
				{ reps: 5, weightKg: 100 },
			]),
		],
		"barbell",
		flat,
	);

	assert.ok(next);
	// Five of five is the top of a range of exactly five, so the weight moves.
	assert.equal(next.sets[0]?.weightKg, 102.5);
	assert.equal(next.sets[0]?.reps, 5);
});

test("a session that never repeated a weight has no working weight", () => {
	// Three working sets at three weights. This is the shape that handed a 32.5
	// kg lifter 215 kg when the tie-break took the heaviest number in the room.
	const next = run([
		session(daysAgo(7), [
			{ reps: 6, weightKg: 50 },
			{ reps: 6, weightKg: 215 },
			{ reps: 6, weightKg: 63 },
		]),
	]);

	assert.equal(next, null);
});

test("one working set is its own corroboration", () => {
	const next = run(
		[session(daysAgo(7), [{ reps: 12, weightKg: 60 }])],
		"barbell",
		[{ reps: 8, repsMax: 12, weightKg: 60 }],
	);

	assert.ok(next);
	assert.equal(next.sets[0]?.weightKg, 62.5);
});

test("warm-ups keep their shape as the work set travels", () => {
	// A 40/60/80% ramp under a 60 kg work set. Twenty sessions of adding 2.5 kg
	// takes the work set to 110, and a ramp still topping out at 40 would leave
	// a 70 kg jump into the first working set.
	const ramp = [
		{ reps: 10, weightKg: 24, type: "warmup" as const },
		{ reps: 8, weightKg: 36, type: "warmup" as const },
		{ reps: 5, weightKg: 48, type: "warmup" as const },
		{ reps: 8, repsMax: 12, weightKg: 60 },
		{ reps: 8, repsMax: 12, weightKg: 60 },
	];

	const next = run(
		[
			session(daysAgo(5), [
				{ reps: 12, weightKg: 100 },
				{ reps: 12, weightKg: 100 },
			]),
			session(daysAgo(12), [
				{ reps: 12, weightKg: 100 },
				{ reps: 12, weightKg: 100 },
			]),
		],
		"barbell",
		ramp,
	);

	assert.ok(next);
	// 100 kg earned a 2.5 kg step, so the work sets go to 102.5 and the ramp
	// follows in proportion to the routine's own 40/60/80.
	assert.equal(next.sets[3]?.weightKg, 102.5);
	assert.deepEqual(
		next.sets.slice(0, 3).map((set) => set.weightKg),
		[40, 60, 80],
	);
	// Still warm-ups, still their own rep counts: only the load moved.
	assert.deepEqual(
		next.sets.slice(0, 3).map((set) => [set.type, set.reps]),
		[
			["warmup", 10],
			["warmup", 8],
			["warmup", 5],
		],
	);
});

test("a warm-up never lands at or above the work set", () => {
	// A ramp typed level with the work set, which is a routine somebody got
	// wrong rather than a warm-up.
	const next = run(
		[
			session(daysAgo(5), [
				{ reps: 12, weightKg: 60 },
				{ reps: 12, weightKg: 60 },
			]),
		],
		"barbell",
		[
			{ reps: 5, weightKg: 60, type: "warmup" as const },
			{ reps: 8, repsMax: 12, weightKg: 60 },
			{ reps: 8, repsMax: 12, weightKg: 60 },
		],
	);

	assert.ok(next);
	const working = next.sets[1]?.weightKg as number;
	assert.equal(working, 62.5);
	assert.ok(
		(next.sets[0]?.weightKg as number) < working,
		`${next.sets[0]?.weightKg} kg is not below the ${working} kg work set`,
	);
});
