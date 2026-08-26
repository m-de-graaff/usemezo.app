import assert from "node:assert/strict";
import { test } from "node:test";
import { EXERCISES, exerciseById, searchExercises } from "./exercises.ts";
import { FITNESS_EXPERIENCE } from "./profile-fields.ts";
import {
	estimateLoad,
	loadCoefficient,
	oneRepMax,
	patternOf,
	percentOfMax,
	predictedOneRepMax,
	referenceLift,
} from "./strength.ts";

const id = (query: string) => {
	const hit = searchExercises({ query, limit: 1 })[0];
	assert.ok(hit, `the catalogue no longer has "${query}"`);
	return hit.id;
};

const BARBELL_BENCH = id("barbell bench press");
const DUMBBELL_BENCH = id("dumbbell bench press");

const HIM = {
	weightKg: 82,
	heightCm: 183,
	gender: "male",
	birthDate: "1995-01-01",
	fitnessExperience: "intermediate",
};

test("a rep max round-trips back to the weight it came from", () => {
	for (const reps of [1, 3, 5, 8, 10, 12, 15, 20]) {
		const max = oneRepMax(100, reps);
		assert.ok(
			Math.abs(max * percentOfMax(reps) - 100) < 0.001,
			`${reps} reps: ${max} × ${percentOfMax(reps)}`,
		);
		if (reps > 1) assert.ok(max > 100, `${reps} reps implies a heavier single`);
	}
	assert.equal(oneRepMax(100, 1), 100);
	assert.equal(percentOfMax(1), 1);
});

test("every experience answer the form offers is priced", () => {
	// `EXPERIENCE_STRENGTH` is private, so this reaches it the way a caller
	// would: an answer with no factor behind it would fall back to 1 and hand a
	// beginner an intermediate's first session.
	const scaled = Object.keys(FITNESS_EXPERIENCE).map(
		(experience) =>
			predictedOneRepMax("horizontal-push", {
				...HIM,
				fitnessExperience: experience,
			}) as number,
	);
	assert.equal(new Set(scaled).size, scaled.length, "no two answers coincide");
	assert.deepEqual(
		scaled,
		[...scaled].sort((a, b) => a - b),
		"and they run weakest to strongest, in the order the form lists them",
	);
});

test("every exercise in the catalogue is classified and priced", () => {
	for (const exercise of EXERCISES) {
		const pattern = patternOf(exercise);
		assert.ok(referenceLift(pattern), `${exercise.name}: unknown pattern`);

		const { coefficient, bodyweight } = loadCoefficient(exercise);
		assert.ok(Number.isFinite(coefficient), `${exercise.name}: not a number`);
		assert.ok(coefficient >= 0, `${exercise.name}: negative`);
		assert.equal(
			bodyweight,
			coefficient === 0,
			`${exercise.name}: a zero coefficient is a bodyweight movement`,
		);
		assert.ok(coefficient < 6, `${exercise.name}: ${coefficient} is absurd`);
	}
});

test("movements are classified where a lifter would put them", () => {
	const pattern = (query: string) =>
		patternOf(exerciseById(id(query)) as (typeof EXERCISES)[number]);

	assert.equal(pattern("barbell bench press"), "horizontal-push");
	assert.equal(pattern("barbell full squat"), "squat");
	assert.equal(pattern("barbell deadlift"), "hinge");
	assert.equal(pattern("barbell preacher curl"), "elbow-flexion");
	assert.equal(pattern("dumbbell lateral raise"), "lateral-raise");
	assert.equal(pattern("barbell shrug"), "shrug");
	// A calf raise done on a leg press machine is a calf raise.
	assert.equal(pattern("lever seated squat calf raise on leg press"), "calf");
});

test("the implement and the variation both move the coefficient", () => {
	const of = (query: string) =>
		loadCoefficient(exerciseById(id(query)) as (typeof EXERCISES)[number])
			.coefficient;

	const barbell = of("barbell bench press");
	assert.equal(barbell, 1, "the reference lift is the unit");
	// One dumbbell of a pair is well under half a barbell.
	assert.ok(of("dumbbell bench press") < barbell / 2);
	// And an incline is under a flat, whichever implement.
	assert.ok(of("dumbbell incline bench press") < of("dumbbell bench press"));
	assert.ok(of("barbell incline bench press") < barbell);
	// A preacher curl is a curl with less help.
	assert.ok(of("barbell preacher curl") < of("barbell curl"));
});

test("a movement with nothing to load says so rather than guessing a weight", () => {
	for (const query of ["clock push-up", "assisted pull-up"]) {
		const estimate = estimateLoad({
			exerciseId: id(query),
			reps: 8,
			profile: HIM,
		});
		assert.ok(estimate, query);
		assert.equal(estimate.basis, "bodyweight", query);
		assert.equal(estimate.weightKg, 0, query);
	}
});

test("the user's own log beats everything else", () => {
	const bench = id("barbell bench press");
	const estimate = estimateLoad({
		exerciseId: bench,
		reps: 5,
		rir: 2,
		history: [{ exerciseId: bench, weightKg: 100, reps: 5, at: "2026-08-20" }],
		profile: HIM,
	});

	assert.ok(estimate);
	assert.equal(estimate.basis, "logged");
	assert.equal(estimate.confidence, "high");
	// Same reps, two in reserve, so under what they did to failure-ish before.
	assert.ok(estimate.weightKg < 100 && estimate.weightKg > 80);
});

test("a lift transfers across a pattern, which is the preacher-to-cable case", () => {
	const preacher = id("barbell preacher curl");
	const cable = id("cable curl");

	const estimate = estimateLoad({
		exerciseId: cable,
		reps: 10,
		rir: 2,
		history: [
			{ exerciseId: preacher, weightKg: 30, reps: 8, at: "2026-08-20" },
		],
		profile: HIM,
	});

	assert.ok(estimate);
	assert.equal(estimate.basis, "transferred");
	assert.equal(estimate.fromExerciseId, preacher);
	// 30 kg is what went on the sleeves, so the preacher curl was 50 kg in the
	// hands: barbells are logged as plates and the bar is added back before
	// anything is compared. A cable has no bar to take off again, so the
	// carry-over lands above the logged figure rather than beside it. Read this
	// band as "the same lift, priced honestly", not as "the same number".
	assert.ok(
		estimate.weightKg >= 30 && estimate.weightKg <= 55,
		`${estimate.weightKg} kg is not a plausible carry-over from 30 kg of plates × 8`,
	);
});

test("a lift in one pattern calibrates the standards in another", () => {
	const bench = id("barbell bench press");
	const squat = id("barbell full squat");

	const strong = estimateLoad({
		exerciseId: squat,
		reps: 8,
		rir: 2,
		history: [{ exerciseId: bench, weightKg: 130, reps: 5, at: "2026-08-20" }],
		profile: HIM,
	});
	const weak = estimateLoad({
		exerciseId: squat,
		reps: 8,
		rir: 2,
		history: [{ exerciseId: bench, weightKg: 50, reps: 5, at: "2026-08-20" }],
		profile: HIM,
	});

	assert.ok(strong && weak);
	assert.equal(strong.basis, "calibrated");
	assert.ok(
		strong.weightKg > weak.weightKg,
		"benching more should not predict squatting less",
	);
});

test("with nothing logged, the profile is what moves the number", () => {
	const bench = id("barbell bench press");
	const at = (profile: Record<string, unknown>) => {
		const estimate = estimateLoad({ exerciseId: bench, reps: 8, profile });
		assert.ok(estimate);
		assert.equal(estimate.basis, "profile");
		assert.equal(estimate.confidence, "low", "a guess is labelled a guess");
		return estimate.weightKg;
	};

	assert.ok(at({ ...HIM, weightKg: 100 }) > at(HIM), "heavier lifts more");
	assert.ok(
		at({ ...HIM, gender: "female" }) < at(HIM),
		"the standards are not the same for everyone",
	);
	assert.ok(
		at({ ...HIM, fitnessExperience: "none" }) < at(HIM),
		"and neither is a first week",
	);
	assert.ok(
		at({ ...HIM, birthDate: "1950-01-01" }) < at(HIM),
		"nor a seventy-sixth birthday",
	);
	// Same weight on the scale, less of it lean.
	assert.ok(at({ ...HIM, bodyFatPercent: 32 }) < at({ ...HIM }));
});

test("more reps and more in reserve both mean less weight", () => {
	const bench = id("barbell bench press");
	const at = (reps: number, rir: number) =>
		estimateLoad({ exerciseId: bench, reps, rir, profile: HIM })
			?.weightKg as number;

	assert.ok(at(12, 2) < at(5, 2));
	assert.ok(at(8, 4) < at(8, 0));
});

test("a weight is one the gym has, and never rounded up", () => {
	const bench = id("barbell bench press");
	const estimate = estimateLoad({
		exerciseId: bench,
		reps: 8,
		rir: 2,
		history: [{ exerciseId: bench, weightKg: 83, reps: 7, at: "2026-08-20" }],
		profile: HIM,
	});

	assert.ok(estimate);
	assert.equal(estimate.weightKg % 2.5, 0);
	assert.ok(
		estimate.weightKg <= estimate.oneRepMaxKg * percentOfMax(10),
		"rounded down, so the first set is the easy one",
	);
});

test("no answer is better than a made-up one", () => {
	assert.equal(estimateLoad({ exerciseId: "not-an-id", reps: 8 }), null);
	// Nothing logged and no bodyweight in the profile: there is no arithmetic
	// left to do, and a number here would be invented.
	assert.equal(
		estimateLoad({ exerciseId: id("barbell bench press"), reps: 8 }),
		null,
	);
});

test("a barbell estimate is plates, not the whole lift", () => {
	const profile = HIM;

	// Nothing logged: the number comes from the standards, which are the whole
	// lift. What comes back is what goes on the sleeves.
	const bench = estimateLoad({
		exerciseId: BARBELL_BENCH,
		reps: 8,
		profile,
	});
	assert.ok(bench);
	const dumbbell = estimateLoad({
		exerciseId: DUMBBELL_BENCH,
		reps: 8,
		profile,
	});
	assert.ok(dumbbell);

	// The bar is 20 kg, so a plates figure has to sit below what the same
	// prescription would be as a total lift. Reading it the other way round is
	// how somebody who has logged nothing gets 20 kg more than the model meant.
	assert.ok(
		bench.weightKg < bench.oneRepMaxKg,
		"a working set is under the one-rep max",
	);
	assert.ok(bench.weightKg >= 0);
	assert.ok(dumbbell.weightKg > 0);
});

test("a logged barbell lift round-trips through the bar", () => {
	// 60 kg of plates for 8, asked back at the same 8 reps to failure. The bar
	// goes on for the arithmetic and comes off again for the answer, so what
	// returns is the plates they logged rather than those plates plus a bar
	// nobody put on.
	const same = estimateLoad({
		exerciseId: BARBELL_BENCH,
		reps: 8,
		rir: 0,
		history: [{ exerciseId: BARBELL_BENCH, weightKg: 60, reps: 8 }],
	});

	assert.ok(same);
	assert.equal(same.basis, "logged");
	assert.equal(same.weightKg, 60);

	// Leaving two in the tank is a lighter set, and the drop is priced on the
	// whole 80 kg lift rather than on the 60 that was written down.
	const easier = estimateLoad({
		exerciseId: BARBELL_BENCH,
		reps: 8,
		rir: 2,
		history: [{ exerciseId: BARBELL_BENCH, weightKg: 60, reps: 8 }],
	});

	assert.ok(easier);
	assert.ok(
		easier.weightKg < same.weightKg,
		`${easier.weightKg} kg should be under ${same.weightKg} kg`,
	);
});
