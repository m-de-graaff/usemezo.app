import assert from "node:assert/strict";
import { test } from "node:test";
import { EXERCISES, type Exercise, exerciseById } from "./exercises.ts";
import { FITNESS_EXPERIENCE } from "./profile-fields.ts";
import {
	auditVolume,
	coverage,
	EXPERIENCE_VOLUME,
	isCompound,
	muscleOf,
	musclesWorked,
	orderSession,
	REST_SEC,
	redundancies,
	regionsOf,
	restFor,
	scaleLandmarks,
	splitFor,
	VOLUME_LANDMARKS,
	WARMUP_MAX,
	warmupRamp,
	warmupReps,
	weeklySets,
} from "./training.ts";

/** Ids used below, checked once so a catalogue change fails loudly here. */
const FIXTURES = {
	BENCH: ["0025", "barbell bench press"],
	INCLINE: ["0047", "barbell incline bench press"],
	DB_BENCH: ["0289", "dumbbell bench press"],
	CURL: ["0031", "barbell curl"],
	PREACHER: ["0070", "barbell preacher curl"],
	RDL: ["0085", "barbell romanian deadlift"],
	SQUAT: ["0043", "barbell full squat"],
	RAISE: ["0334", "dumbbell lateral raise"],
} as const;

const [BENCH] = FIXTURES.BENCH;
const [INCLINE] = FIXTURES.INCLINE;
const [DB_BENCH] = FIXTURES.DB_BENCH;
const [CURL] = FIXTURES.CURL;
const [PREACHER] = FIXTURES.PREACHER;
const [RDL] = FIXTURES.RDL;
const [SQUAT] = FIXTURES.SQUAT;
const [RAISE] = FIXTURES.RAISE;

test("the fixtures are still the exercises this file thinks they are", () => {
	for (const [id, name] of Object.values(FIXTURES)) {
		assert.equal(exerciseById(id)?.name, name, id);
	}
});

test("every experience answer the form offers has a volume scale behind it", () => {
	assert.deepEqual(
		Object.keys(FITNESS_EXPERIENCE).sort(),
		Object.keys(EXPERIENCE_VOLUME).sort(),
	);
});

test("landmarks are ordered, for every muscle", () => {
	for (const [muscle, band] of Object.entries(VOLUME_LANDMARKS)) {
		assert.ok(band.mev < band.mav, `${muscle}: mev below mav`);
		assert.ok(band.mav < band.mrv, `${muscle}: mav below mrv`);
	}
});

test("a beginner's landmarks sit below an advanced lifter's", () => {
	const beginner = scaleLandmarks("chest", "beginner");
	const advanced = scaleLandmarks("chest", "advanced");
	assert.ok(beginner.mrv < advanced.mrv);
	// An unanswered question leaves the intermediate numbers alone.
	assert.deepEqual(scaleLandmarks("chest", null), VOLUME_LANDMARKS.chest);
});

test("the catalogue maps onto muscles Mezo counts", () => {
	// Not every row has to map, but the great majority must, or a volume audit
	// silently under-reports whatever it could not place.
	const placed = EXERCISES.filter(
		(exercise) => musclesWorked(exercise).primary !== null,
	);
	assert.ok(
		placed.length / EXERCISES.length > 0.95,
		`only ${placed.length} of ${EXERCISES.length} exercises have a primary muscle`,
	);
	assert.equal(muscleOf("pectorals"), "chest");
	assert.equal(muscleOf("Quadriceps"), "quads");
	assert.equal(muscleOf("cardiovascular system"), null);
});

test("a secondary muscle is worth half a set", () => {
	const sets = weeklySets([{ exerciseId: BENCH, sets: 4 }]);
	assert.equal(sets.chest, 4);
	// Bench lists shoulders and triceps as secondary.
	assert.equal(sets.triceps, 2);
	assert.equal(sets.shoulders, 2);
});

test("running the same session more often multiplies its volume", () => {
	const once = weeklySets([{ exerciseId: BENCH, sets: 3 }], 1);
	const twice = weeklySets([{ exerciseId: BENCH, sets: 3 }], 2);
	assert.equal(twice.chest, (once.chest as number) * 2);
});

test("the audit reports where a muscle sits, and only muscles it touches", () => {
	const rows = auditVolume([{ exerciseId: BENCH, sets: 2 }], {
		experience: "intermediate",
	});
	const chest = rows.find((row) => row.muscle === "chest");

	assert.ok(chest);
	assert.equal(chest.sets, 2);
	assert.equal(chest.verdict, "under", "two sets a week grows nothing");
	assert.ok(
		!rows.some((row) => row.muscle === "quads"),
		"no untouched muscles",
	);

	const plenty = auditVolume([{ exerciseId: BENCH, sets: 14 }], {
		experience: "intermediate",
	});
	assert.equal(
		plenty.find((row) => row.muscle === "chest")?.verdict,
		"productive",
	);

	const far_too_much = auditVolume([{ exerciseId: BENCH, sets: 30 }], {
		experience: "intermediate",
	});
	assert.equal(
		far_too_much.find((row) => row.muscle === "chest")?.verdict,
		"over",
	);
});

test("a muscle asked about but never trained is reported as none", () => {
	const rows = auditVolume([{ exerciseId: BENCH, sets: 4 }], {
		include: ["quads"],
	});
	assert.equal(rows.find((row) => row.muscle === "quads")?.verdict, "none");
});

test("an exercise id nothing knows contributes nothing rather than throwing", () => {
	assert.deepEqual(weeklySets([{ exerciseId: "not-an-id", sets: 5 }]), {});
});

test("compounds rest longer than isolation", () => {
	const bench = exerciseById(BENCH);
	const curl = exerciseById(CURL);
	assert.ok(bench && curl);
	assert.ok(isCompound(bench));
	assert.ok(!isCompound(curl));
	assert.equal(restFor(curl), REST_SEC.isolation);
	assert.ok(restFor(bench) >= REST_SEC.compound);
});

test("rest follows how long the set was as well as what the lift costs", () => {
	const squat = exerciseById(SQUAT);
	const raise = exerciseById(RAISE);
	assert.ok(squat && raise);

	// A squat is systemic however the catalogue files it, and a set of four
	// needs longer back than a set of twenty.
	assert.ok(restFor(squat, 4) > restFor(squat, 8));
	assert.ok(restFor(squat, 20) < restFor(squat, 8));
	assert.ok(restFor(squat, 8) > restFor(raise, 8), "a squat is not a raise");
	assert.ok(restFor(squat, 1) <= REST_SEC.max, "and nobody rests forever");
	// No reps given is no adjustment, which is what a routine without a rep
	// range should get.
	assert.equal(restFor(squat), restFor(squat, 8));
});

test("an exercise is credited to the part of the muscle it actually loads", () => {
	const regions = (id: string) => regionsOf(exerciseById(id) as Exercise);

	assert.deepEqual(regions(INCLINE), [{ muscle: "chest", regions: ["upper"] }]);
	// The whole point of the distinction: a flat press does not cover the
	// clavicular head, so it must not be credited with it.
	assert.deepEqual(regions(BENCH), [{ muscle: "chest", regions: ["mid"] }]);
	// A movement that loads a muscle whole is credited with all of it, or a
	// standing curl would read as missing both heads of the biceps.
	assert.deepEqual(regions(CURL), [
		{ muscle: "biceps", regions: ["long", "short"] },
	]);
	assert.deepEqual(regions(PREACHER), [
		{ muscle: "biceps", regions: ["short"] },
	]);
	// The catalogue files a Romanian deadlift under the glutes. The hip end of
	// the hamstrings is what it is for.
	assert.deepEqual(regions(RDL), [
		{ muscle: "hamstrings", regions: ["hinge"] },
	]);
});

test("a session with twelve chest sets and no incline is reported as such", () => {
	const rows = coverage([
		{ exerciseId: BENCH, sets: 4 },
		{ exerciseId: DB_BENCH, sets: 4 },
		{ exerciseId: RAISE, sets: 4 },
	]);

	const chest = rows.find((row) => row.muscle === "chest");
	assert.ok(chest);
	assert.deepEqual(
		chest.missing.map((gap) => gap.region),
		["upper"],
	);
	assert.equal(chest.covered[0]?.sets, 8);

	// Swapping one press for an incline closes it.
	const fixed = coverage([
		{ exerciseId: INCLINE, sets: 4 },
		{ exerciseId: BENCH, sets: 4 },
	]);
	assert.deepEqual(fixed.find((row) => row.muscle === "chest")?.missing, []);
});

test("a gap is only worth naming once the muscle is trained at all", () => {
	// One set of bench is not "missing the upper chest", it is missing a chest
	// session, and leading with the wrong one of those is unhelpful.
	assert.deepEqual(coverage([{ exerciseId: BENCH, sets: 1 }]), []);
});

test("the same movement twice is reported, a different angle is not", () => {
	const same = redundancies([
		{ exerciseId: BENCH, sets: 4 },
		{ exerciseId: DB_BENCH, sets: 3 },
	]);
	assert.equal(same.length, 1);
	assert.deepEqual(same[0]?.exerciseIds, [BENCH, DB_BENCH]);

	assert.deepEqual(
		redundancies([
			{ exerciseId: INCLINE, sets: 4 },
			{ exerciseId: BENCH, sets: 3 },
		]),
		[],
		"an incline and a flat press are two exercises",
	);
});

test("a session is ordered by what it costs to perform", () => {
	const order = orderSession([
		{ exerciseId: RAISE, sets: 4 },
		{ exerciseId: CURL, sets: 3 },
		{ exerciseId: SQUAT, sets: 4 },
		{ exerciseId: BENCH, sets: 4 },
	]);

	// Systemic first, then the other compound, then the isolation. Within a
	// tier the order given is kept, so the model's own sequencing survives.
	assert.deepEqual(
		order.map((row) => row.exerciseId),
		[SQUAT, BENCH, RAISE, CURL],
	);
	// Every row carries what to do with it, not just where it goes.
	assert.ok(order.every((row) => row.reason && row.restSec > 0));
});

test("a priority moves an exercise up, but never past the heavy work", () => {
	const entries = [
		{ exerciseId: SQUAT, sets: 4 },
		{ exerciseId: BENCH, sets: 4 },
		{ exerciseId: CURL, sets: 3 },
		{ exerciseId: RAISE, sets: 4 },
	];
	const at = (order: ReturnType<typeof orderSession>, id: string) =>
		order.findIndex((row) => row.exerciseId === id);

	const plain = orderSession(entries);
	assert.ok(at(plain, CURL) < at(plain, RAISE), "given order, given back");

	const order = orderSession(entries, { prioritise: ["shoulders"] });
	assert.deepEqual(
		[order[0]?.exerciseId, order[1]?.exerciseId],
		[SQUAT, BENCH],
		"the barbell work still goes first: a raise is not worth a worse press",
	);
	assert.ok(
		at(order, RAISE) < at(order, CURL),
		"but the raise moved ahead of the accessory work that is not a priority",
	);
	assert.match(order[at(order, RAISE)]?.reason ?? "", /priority/);
});

test("an exercise nothing knows is dropped from an order, not crashed on", () => {
	const order = orderSession([
		{ exerciseId: "not-an-id", sets: 3 },
		{ exerciseId: BENCH, sets: 4 },
	]);
	assert.deepEqual(
		order.map((row) => row.exerciseId),
		[BENCH],
	);
});

test("a split comes back for any number of days somebody might train", () => {
	for (let days = 1; days <= 7; days++) {
		assert.equal(splitFor(days).days.length, days);
	}
	// Out of range clamps rather than returning undefined; nobody trains nine
	// days a week and a screen should still render.
	assert.equal(splitFor(0).days.length, 1);
	assert.equal(splitFor(12).days.length, 7);
});

test("a warm-up ramp climbs and stops short of the working weight", () => {
	for (const count of [1, 2, 3, 4]) {
		const ramp = warmupRamp(count);
		assert.equal(ramp.length, count);
		assert.deepEqual(
			ramp,
			[...ramp].sort((a, b) => a - b),
			`${count} rungs`,
		);
		// The top rung is the working set. A warm-up single at 95% is a working
		// set somebody has decided not to count.
		assert.ok(ramp.every((fraction) => fraction > 0.3 && fraction < 0.9));
	}

	// One warm-up is the one most people take, and it lands where they take it.
	const [single] = warmupRamp(1);
	assert.ok(single !== undefined && single > 0.6 && single < 0.75);
	assert.deepEqual(warmupRamp(0), []);
	// A count nobody should have sent is clamped rather than obeyed.
	assert.equal(warmupRamp(50).length, WARMUP_MAX);
});

test("warm-up reps fall as the ramp gets heavier", () => {
	const ramp = warmupRamp(3);
	const reps = ramp.map((fraction) => warmupReps(10, fraction));
	assert.deepEqual(
		reps,
		[...reps].sort((a, b) => b - a),
	);
	// Never fewer than three, which warms nothing, nor more than twelve, which
	// is a working set with a light weight on it.
	assert.ok(reps.every((count) => count >= 3 && count <= 12));
	assert.ok(warmupReps(30, 0.4) <= 12);
	assert.ok(warmupReps(3, 0.85) >= 3);
});

test("the rest before an exercise is set by the heavier of the two", () => {
	const ordered = orderSession([
		{ exerciseId: SQUAT, sets: 3 },
		{ exerciseId: CURL, sets: 3 },
	]);

	const squat = ordered[0];
	const curl = ordered[1];
	assert.ok(squat && curl);
	// Nobody is ready for a curl forty seconds after a squat set, so the rest
	// between them is the squat's, not the curl's.
	assert.equal(squat.restAfterSec, Math.max(squat.restSec, curl.restSec));
	assert.ok((squat.restAfterSec ?? 0) > curl.restSec);
	// Nothing follows the last exercise, so there is nothing to be ready for.
	assert.equal(curl.restAfterSec, undefined);
});
