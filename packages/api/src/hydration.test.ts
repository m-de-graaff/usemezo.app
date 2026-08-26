import assert from "node:assert/strict";
import { test } from "node:test";
import {
	baseTargetMl,
	DEFAULT_SESSION_SEC,
	DRINKS,
	dailyTargetMl,
	effectiveMl,
	MAX_GOAL_ML,
	MIN_GOAL_ML,
	streakDays,
	sweatMl,
	typicalSessionSec,
	weekdayOf,
} from "./hydration.ts";
import { WEEKDAYS } from "./profile-fields.ts";

test("every drink has a distinct slug and a believable index", () => {
	const slugs = DRINKS.map((drink) => drink.slug);
	assert.equal(new Set(slugs).size, slugs.length);
	for (const drink of DRINKS) {
		assert.ok(drink.index > 0 && drink.index <= 2, drink.slug);
		assert.ok(drink.serveMl > 0 && drink.serveMl <= 1000, drink.slug);
	}
});

test("weight drives the base target, rounded to 50ml", () => {
	assert.equal(baseTargetMl(80), 2800);
	// 72.4 * 35 = 2534, which is 2550 to the nearest 50.
	assert.equal(baseTargetMl(72.4), 2550);
});

test("no weight falls back to the EFSA figure for the gender on file", () => {
	assert.equal(baseTargetMl(null, "male"), 2500);
	assert.equal(baseTargetMl(null, "female"), 2000);
	// An unanswered or unrecognised answer gets the lower of the two rather
	// than a target nobody reaches.
	assert.equal(baseTargetMl(null, null), 2000);
	assert.equal(baseTargetMl(0, "non-binary"), 2000);
});

test("training adds fluid, and stops adding it somewhere sane", () => {
	assert.equal(sweatMl(0), 0);
	assert.equal(sweatMl(3600), 500);
	assert.equal(sweatMl(5400), 750);
	// Six hours would ask for 3000ml; the cap is the point of the assertion.
	assert.equal(sweatMl(6 * 3600), 1500);
});

test("an override replaces the base but still earns the sweat allowance", () => {
	const plain = dailyTargetMl({ weightKg: 80, trainingSec: 3600 });
	assert.deepEqual(plain, {
		baseMl: 2800,
		sweatMl: 500,
		targetMl: 3300,
		sweatFrom: "logged",
	});

	const overridden = dailyTargetMl({
		weightKg: 80,
		goalMl: 4000,
		trainingSec: 3600,
	});
	assert.deepEqual(overridden, {
		baseMl: 4000,
		sweatMl: 500,
		targetMl: 4500,
		sweatFrom: "logged",
	});

	// A cleared or nonsense override falls back rather than zeroing the target.
	assert.equal(dailyTargetMl({ weightKg: 80, goalMl: null }).targetMl, 2800);
	assert.equal(dailyTargetMl({ weightKg: 80, goalMl: 0 }).targetMl, 2800);
});

test("the goal bounds leave room for both a small person and an athlete", () => {
	assert.ok(MIN_GOAL_ML < baseTargetMl(40));
	assert.ok(MAX_GOAL_ML > baseTargetMl(150) + 1500);
});

test("the hydration index scales what a drink is worth", () => {
	assert.equal(effectiveMl(500, "water"), 500);
	assert.equal(effectiveMl(500, "milk"), 675);
	assert.equal(effectiveMl(500, "electrolyte"), 750);
	assert.equal(effectiveMl(150, "wine-spirits"), 90);
	// A slug that is not in the table is counted at face value rather than
	// dropped: an unknown drink is still fluid.
	assert.equal(effectiveMl(300, "kombucha"), 300);
});

const day = (date: string, ml: number, targetMl = 2500) => ({
	date,
	ml,
	targetMl,
});

test("a streak counts back from today and survives an unfinished today", () => {
	assert.equal(
		streakDays([
			day("2026-08-24", 2600),
			day("2026-08-25", 2700),
			day("2026-08-26", 2500),
		]),
		3,
	);

	// Today is still being drunk. Yesterday and the day before stand.
	assert.equal(
		streakDays([
			day("2026-08-24", 2600),
			day("2026-08-25", 2700),
			day("2026-08-26", 400),
		]),
		2,
	);

	// A miss that is not today ends it.
	assert.equal(
		streakDays([
			day("2026-08-24", 2600),
			day("2026-08-25", 100),
			day("2026-08-26", 2600),
		]),
		1,
	);

	assert.equal(streakDays([]), 0);
});

test("a scheduled training day earns the allowance before the session happens", () => {
	const planned = dailyTargetMl({
		weightKg: 80,
		plannedTraining: true,
		typicalTrainingSec: 75 * 60,
	});
	assert.deepEqual(planned, {
		baseMl: 2800,
		sweatMl: 650,
		targetMl: 3450,
		sweatFrom: "planned",
	});

	// A logged session wins over the estimate, including when it was shorter.
	// The plan is a guess; the session is a fact.
	const trained = dailyTargetMl({
		weightKg: 80,
		plannedTraining: true,
		typicalTrainingSec: 75 * 60,
		trainingSec: 30 * 60,
	});
	assert.equal(trained.sweatFrom, "logged");
	assert.equal(trained.sweatMl, 250);

	// No schedule and nothing logged adds nothing. Mezo does not assume
	// training nobody mentioned.
	const rest = dailyTargetMl({ weightKg: 80 });
	assert.equal(rest.sweatFrom, "none");
	assert.equal(rest.sweatMl, 0);
	assert.equal(rest.targetMl, 2800);

	// With no history to read, an unstarted training day assumes an hour.
	assert.equal(
		dailyTargetMl({ weightKg: 80, plannedTraining: true }).sweatMl,
		sweatMl(DEFAULT_SESSION_SEC),
	);
});

test("a typical session is the median of the real ones", () => {
	assert.equal(typicalSessionSec([3600, 4800, 5400]), 4800);
	// Even counts average the middle pair.
	assert.equal(typicalSessionSec([3600, 4800]), 4200);
	// A mistaken start and a discard is not a session, and would otherwise drag
	// the middle of the list down for weeks.
	assert.equal(typicalSessionSec([30, 60, 3600, 4800, 5400]), 4800);
	// Nothing to read falls back rather than reporting a zero-length session.
	assert.equal(typicalSessionSec([]), DEFAULT_SESSION_SEC);
	assert.equal(typicalSessionSec([12, 45]), DEFAULT_SESSION_SEC);
});

test("a day maps to the weekday somebody would call it", () => {
	// 2026-08-26 is a Wednesday.
	assert.equal(weekdayOf("2026-08-26"), "wed");
	assert.equal(weekdayOf("2026-08-30"), "sun");
	assert.equal(weekdayOf("2026-08-31"), "mon");
	// Every slug the schedule can hold is one this produces, or a scheduled
	// day would never match and the whole feature would silently do nothing.
	assert.deepEqual(
		[
			...new Set(
				Array.from({ length: 7 }, (_, index) =>
					weekdayOf(`2026-08-${24 + index}`),
				),
			),
		].sort(),
		Object.keys(WEEKDAYS).sort(),
	);
});
