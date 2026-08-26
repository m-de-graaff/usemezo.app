import assert from "node:assert/strict";
import test from "node:test";
import { describeSets, lastTime, previousFor } from "./summary.ts";

const entry = (sets: unknown[], rest?: number) =>
	({
		key: "k",
		exerciseId: "x",
		restSec: rest,
		sets,
		// The helper only reads sets and rest; the rest of the shape is noise here.
	}) as Parameters<typeof describeSets>[0];

test("describeSets reads sets, reps and rest as one line", () => {
	assert.deepEqual(
		describeSets(
			entry([{ reps: 8 }, { reps: 10 }, { reps: 12 }], 150),
			"metric",
		),
		["3 sets · 8-12 reps · Rest 2m 30s"],
	);
});

test("describeSets counts warm-ups apart from working sets", () => {
	assert.deepEqual(
		describeSets(entry([{ reps: 10, type: "warmup" }, { reps: 6 }]), "metric"),
		["1 set · 1 warm-up · 6 reps"],
	);
});

test("describeSets puts load on its own line, in the reader's units", () => {
	assert.deepEqual(describeSets(entry([{ reps: 5, weightKg: 40 }]), "metric"), [
		"1 set · 5 reps",
		"40 kg",
	]);
});

test("describeSets says nothing about a bodyweight set's load", () => {
	assert.deepEqual(describeSets(entry([{ reps: 12, weightKg: 0 }]), "metric"), [
		"1 set · 12 reps",
	]);
});

test("describeSets survives an exercise with no sets at all", () => {
	assert.deepEqual(describeSets(entry([]), "metric"), []);
});

test("last time's sets line up by role, not by position", () => {
	// The reported bug: three warm-ups skipped and three working sets done comes
	// back as three sets, and lining those up by index printed them against
	// today's warm-up rows.
	const today = [
		{ type: "warmup" as const, reps: 10 },
		{ type: "warmup" as const, reps: 8 },
		{ type: "warmup" as const, reps: 6 },
		{ reps: 6 },
		{ reps: 6 },
		{ reps: 6 },
	];
	const previous = [
		{ reps: 6, weightKg: 50 },
		{ reps: 6, weightKg: 215 },
		{ reps: 6, weightKg: 63 },
	];

	const at = (index: number) =>
		lastTime(previousFor(today, previous, index), "metric");

	// Warm-ups never show a previous at all. A ramp is whatever gets you to the
	// first work set on the day, not a number worth comparing week to week.
	assert.equal(at(0), null);
	assert.equal(at(1), null);
	assert.equal(at(2), null);
	// The working sets land on the working rows, in order.
	assert.equal(at(3), "50 kg × 6");
	assert.equal(at(4), "215 kg × 6");
	assert.equal(at(5), "63 kg × 6");
});

test("a set with no matching history shows nothing", () => {
	const today = [{ reps: 8 }, { reps: 8 }, { reps: 8 }];
	const previous = [{ reps: 10, weightKg: 40 }];

	assert.equal(
		lastTime(previousFor(today, previous, 0), "metric"),
		"40 kg × 10",
	);
	// A fourth set of an exercise you did one of.
	assert.equal(previousFor(today, previous, 1), undefined);
	// Bodyweight reads as reps alone: "0 kg × 10" is true and useless.
	assert.equal(lastTime({ reps: 10, weightKg: 0 }, "metric"), "10 reps");
});

test("a warm-up has no previous even when one was logged last time", () => {
	const today = [{ type: "warmup" as const, reps: 10 }, { reps: 8 }];
	// Last time the warm-up was ticked off too. It is still not shown.
	const previous = [
		{ type: "warmup" as const, reps: 10, weightKg: 20 },
		{ reps: 8, weightKg: 60 },
	];

	assert.equal(previousFor(today, previous, 0), undefined);
	assert.equal(
		lastTime(previousFor(today, previous, 1), "metric"),
		"60 kg × 8",
	);
});
