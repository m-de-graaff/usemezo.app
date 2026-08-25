import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_MULTIPLIERS, ageFrom, buildPlan } from "./plan.ts";
import { ACTIVITY_LEVELS } from "./profile-fields.ts";

/** Pinned, so a test does not start failing on someone's birthday. */
const AT = new Date(2026, 7, 24);

const BASE = {
	birthDate: "1990-05-04",
	gender: "male",
	heightCm: 180,
	weightKg: 80,
	activityLevel: "moderate",
	goalDirection: "maintain",
};

test("every activity level the form offers has a multiplier behind it", () => {
	// `plan.ts` deliberately imports nothing, so nothing but this notices when
	// an option is added to one list and not the other — and the symptom there
	// would be a plan that silently reports the answer as missing.
	assert.deepEqual(
		Object.keys(ACTIVITY_LEVELS).sort(),
		Object.keys(ACTIVITY_MULTIPLIERS).sort(),
	);
});

test("age counts whole years and does not tick over early", () => {
	assert.equal(ageFrom("1990-05-04", AT), 36);
	assert.equal(ageFrom("1990-08-24", AT), 36, "on the birthday itself");
	assert.equal(ageFrom("1990-08-25", AT), 35, "the day before");
});

test("a plan missing an input says which one rather than guessing", () => {
	const plan = buildPlan({ ...BASE, weightKg: null }, AT);
	assert.equal(plan.ok, false);
	assert.deepEqual(plan.missing, ["your weight"]);
});

test("every missing input is named, in the order they were asked", () => {
	const plan = buildPlan({}, AT);
	assert.equal(plan.ok, false);
	assert.deepEqual(plan.missing, [
		"your date of birth",
		"your height",
		"your weight",
		"how active you are",
	]);
});

test("Mifflin-St Jeor, then the activity multiplier", () => {
	const plan = buildPlan(BASE, AT);
	assert.ok(plan.ok);
	// 10*80 + 6.25*180 - 5*36 + 5 = 1750
	assert.equal(plan.bmr, 1750);
	assert.equal(plan.tdee, Math.round(1750 * 1.55));
	assert.equal(plan.calories, plan.tdee, "maintaining eats maintenance");
});

test("gender the model has no constant for uses the midpoint, not male", () => {
	const male = buildPlan(BASE, AT);
	const nonBinary = buildPlan({ ...BASE, gender: "non-binary" }, AT);
	const unanswered = buildPlan({ ...BASE, gender: null }, AT);
	assert.ok(male.ok && nonBinary.ok && unanswered.ok);
	// +5 for male against -78 for the midpoint of +5 and -161.
	assert.equal(male.bmr - nonBinary.bmr, 83);
	assert.equal(unanswered.bmr, nonBinary.bmr);
});

test("losing weight cuts a share of TDEE", () => {
	const plan = buildPlan({ ...BASE, goalDirection: "lose" }, AT);
	assert.ok(plan.ok);
	assert.ok(plan.calories < plan.tdee);
	assert.equal(plan.atFloor, false);
});

test("gaining weight adds a share of TDEE", () => {
	const plan = buildPlan({ ...BASE, goalDirection: "gain" }, AT);
	assert.ok(plan.ok);
	assert.ok(plan.calories > plan.tdee);
});

test("a deficit never lands below the safe floor", () => {
	// Small, sedentary, and losing: the arithmetic wants a dangerous number.
	const plan = buildPlan(
		{
			...BASE,
			gender: "female",
			heightCm: 150,
			weightKg: 45,
			activityLevel: "sedentary",
			goalDirection: "lose",
		},
		AT,
	);
	assert.ok(plan.ok);
	assert.equal(plan.atFloor, true);
	assert.ok(plan.calories >= 1200, `${plan.calories} kcal`);
	assert.ok(plan.calories >= plan.bmr, "never below resting expenditure");
});

test("macros add up to the calorie target", () => {
	for (const goalDirection of ["lose", "maintain", "gain"]) {
		const plan = buildPlan({ ...BASE, goalDirection }, AT);
		assert.ok(plan.ok);
		const fromMacros = plan.protein * 4 + plan.carbs * 4 + plan.fat * 9;
		// Rounding each macro to a whole gram cannot land exactly on the target.
		assert.ok(
			Math.abs(fromMacros - plan.calories) <= 12,
			`${goalDirection}: ${fromMacros} against ${plan.calories}`,
		);
	}
});

test("carbs never go negative when protein and fat already fill the target", () => {
	const plan = buildPlan(
		{
			...BASE,
			weightKg: 150,
			heightCm: 160,
			activityLevel: "sedentary",
			goalDirection: "lose",
		},
		AT,
	);
	assert.ok(plan.ok);
	assert.ok(plan.carbs >= 0, `${plan.carbs}g of carbs`);
});

test("BMI bands follow the WHO cut-offs", () => {
	const band = (weightKg: number) => {
		const plan = buildPlan({ ...BASE, weightKg }, AT);
		assert.ok(plan.ok);
		return plan.bmiBand;
	};
	assert.equal(band(59), "underweight"); // 18.2
	assert.equal(band(70), "healthy"); // 21.6
	assert.equal(band(85), "overweight"); // 26.2
	assert.equal(band(100), "obese"); // 30.9
});

test("a weight target becomes a pace and a number of weeks", () => {
	const plan = buildPlan(
		{ ...BASE, goalDirection: "lose", targetWeightKg: 72 },
		AT,
	);
	assert.ok(plan.ok);
	assert.ok(plan.paceKgPerWeek > 0);
	assert.ok(plan.weeksToTarget !== null && plan.weeksToTarget > 0);
});

test("maintaining has no pace and no finish line", () => {
	const plan = buildPlan(BASE, AT);
	assert.ok(plan.ok);
	assert.equal(plan.paceKgPerWeek, 0);
	assert.equal(plan.weeksToTarget, null);
});

test("a target already met has no weeks left to run", () => {
	const plan = buildPlan(
		{ ...BASE, goalDirection: "lose", targetWeightKg: 80 },
		AT,
	);
	assert.ok(plan.ok);
	assert.equal(plan.weeksToTarget, null);
});

test("a birth date in the future does not produce a negative age", () => {
	const plan = buildPlan({ ...BASE, birthDate: "2030-01-01" }, AT);
	assert.equal(plan.ok, false);
	assert.deepEqual(plan.missing, ["your date of birth"]);
});

test("an unknown activity level is a missing answer, not a default", () => {
	const plan = buildPlan({ ...BASE, activityLevel: "occasionally" }, AT);
	assert.equal(plan.ok, false);
	assert.deepEqual(plan.missing, ["how active you are"]);
});
