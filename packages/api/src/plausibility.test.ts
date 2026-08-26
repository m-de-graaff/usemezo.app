import assert from "node:assert/strict";
import { test } from "node:test";
import { searchExercises } from "./exercises.ts";
import { checkSet } from "./plausibility.ts";

const id = (query: string) => {
	const hit = searchExercises({ query, limit: 1 })[0];
	assert.ok(hit, `the catalogue no longer has "${query}"`);
	return hit.id;
};

const BENCH = id("barbell bench press");
const CURL = id("dumbbell biceps curl");
const ASSISTED = id("assisted pull-up");

/** An untrained 70 kg man, which is the profile a fake is most likely to sit on. */
const HIM = {
	weightKg: 70,
	heightCm: 178,
	gender: "male",
	birthDate: "1998-01-01",
	fitnessExperience: "beginner",
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-26T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

/** The case this whole file exists for: six at ten, then six at a hundred. */
const jump = (
	weightKg: number,
	options: Partial<Parameters<typeof checkSet>[0]> = {},
) =>
	checkSet({
		bestOneRepMaxKg: 36, // 6 × 10 kg on a 20 kg bar is a 36 kg single.
		exerciseId: BENCH,
		lastDoneAt: daysAgo(3),
		now: NOW,
		profile: HIM,
		set: { reps: 6, weightKg },
		...options,
	});

test("six reps at ten kilos becoming six at a hundred is asked about", () => {
	const doubt = jump(100);
	assert.ok(doubt, "a tenfold jump goes unremarked");
	assert.equal(doubt.kind, "decimal");
	assert.equal(doubt.suggestedKg, 10);
});

test("the week's normal progress is not", () => {
	for (const weightKg of [10, 12.5, 15, 20]) {
		assert.equal(jump(weightKg), null, `${weightKg} kg was doubted`);
	}
});

test("a beginner's very good day is left alone, and twice that is not", () => {
	// The novice envelope is wide on purpose: 28.2% ± 20.9% over twelve weeks
	// means a fast beginner really does move like this.
	assert.equal(jump(14), null, "a 40% session-on-session jump was doubted");
	assert.ok(jump(35), "two and a half times the best went unremarked");
});

test("time off widens the allowance, and a skewed clock does not", () => {
	// The bar is part of the lift, so 32 kg of plates on a 20 kg bar is 1.7× a
	// best of 6 × 10, not 3.2×. Comparing the plates alone is how a light lifter
	// gets flagged for adding a pair of fives.
	assert.ok(jump(32), "1.7× after three days should be asked about");
	assert.equal(jump(32, { lastDoneAt: daysAgo(120) }), null, "four months off");
	// A phone set to next year must not buy anybody a bigger allowance than the
	// cap, and one set to last week's future must not buy a negative one.
	assert.ok(jump(300, { lastDoneAt: daysAgo(3650) }), "the cap holds");
	assert.ok(jump(32, { lastDoneAt: new Date(NOW.getTime() + 90 * DAY) }));
});

test("pounds typed into a kilogram box are named as such", () => {
	const doubt = checkSet({
		bestOneRepMaxKg: 90,
		exerciseId: BENCH,
		lastDoneAt: daysAgo(4),
		now: NOW,
		profile: HIM,
		// 80 kg is a normal next set; 80 lb read as kg is not.
		set: { reps: 5, weightKg: 176 },
	});
	assert.ok(doubt);
	assert.equal(doubt.kind, "pounds");
	assert.equal(doubt.suggestedKg, 79.8);
});

test("a first ever set is judged against the standards, not against nothing", () => {
	const first = {
		bestOneRepMaxKg: 0,
		exerciseId: BENCH,
		now: NOW,
		profile: HIM,
	};
	assert.equal(
		checkSet({ ...first, set: { reps: 8, weightKg: 40 } }),
		null,
		"a plausible first bench was doubted",
	);
	const doubt = checkSet({ ...first, set: { reps: 8, weightKg: 200 } });
	assert.ok(doubt, "200 kg × 8 from somebody with no history went unremarked");
});

test("with no profile at all, only the impossible is asked about", () => {
	const blank = { bestOneRepMaxKg: 0, exerciseId: BENCH, now: NOW };
	assert.equal(checkSet({ ...blank, set: { reps: 8, weightKg: 200 } }), null);
	assert.ok(checkSet({ ...blank, set: { reps: 5, weightKg: 600 } }));
});

test("a warm-up, a blank box and an unknown exercise are never doubted", () => {
	const absurd = { reps: 6, weightKg: 900 };
	assert.equal(
		checkSet({
			exerciseId: BENCH,
			now: NOW,
			set: { ...absurd, type: "warmup" },
		}),
		null,
	);
	assert.equal(
		checkSet({ exerciseId: BENCH, now: NOW, set: { reps: 6 } }),
		null,
	);
	assert.equal(
		checkSet({ exerciseId: BENCH, now: NOW, set: { weightKg: 900 } }),
		null,
	);
	assert.equal(checkSet({ exerciseId: "nope", now: NOW, set: absurd }), null);
});

test("an assisted machine is never doubted on weight", () => {
	// The number is help taken away, so more of it is a weaker set. Nothing here
	// can read that, and reading it as load would flag every deload.
	assert.equal(
		checkSet({
			bestOneRepMaxKg: 0,
			exerciseId: ASSISTED,
			now: NOW,
			profile: HIM,
			set: { reps: 10, weightKg: 400 },
		}),
		null,
	);
});

test("the ceiling is per movement, not one number for the whole app", () => {
	// 200 kg is a real bench for a real person and a curl nobody has ever done.
	const at = (exerciseId: string, weightKg: number) =>
		checkSet({ exerciseId, now: NOW, set: { reps: 1, weightKg } });
	assert.equal(at(BENCH, 200), null);
	assert.ok(at(CURL, 200));
});
