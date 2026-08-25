import assert from "node:assert/strict";
import test from "node:test";
import {
	describeField,
	formatAnswer,
	MILO_FIELDS,
	miloField,
	profileChange,
} from "./milo.ts";

const field = (name: string) => {
	const found = miloField(name);
	assert.ok(found, `${name} is not a field Milo can see`);
	return found;
};

test("Milo sees the health questions and none of the identity ones", () => {
	assert.ok(miloField("bodyFatPercent"));
	assert.ok(miloField("skeletalMuscleMassKg"));
	assert.ok(miloField("units"));

	// A handle is permanent and visibility is a privacy decision; neither is
	// something to settle in a chat.
	assert.equal(miloField("username"), undefined);
	assert.equal(miloField("isPublic"), undefined);
	assert.equal(miloField("name"), undefined);
});

test("a mass is read back in whichever system the user picked", () => {
	const muscle = field("skeletalMuscleMassKg");
	assert.equal(formatAnswer(muscle, 34.2, "metric"), "34.2 kg");
	assert.equal(formatAnswer(muscle, 34.2, "imperial"), "75 lb");
});

test("a height in imperial is feet and inches, not a bare number", () => {
	const height = field("heightCm");
	assert.equal(formatAnswer(height, 180, "metric"), "180 cm");
	assert.equal(formatAnswer(height, 180, "imperial"), `5' 11"`);
});

test("a fixed unit does not convert", () => {
	// Per cent is per cent, and a BMR is kilocalories in both systems.
	assert.equal(
		formatAnswer(field("bodyFatPercent"), 18.4, "imperial"),
		"18.4 %",
	);
	assert.equal(
		formatAnswer(field("basalMetabolicRateKcal"), 1750, "imperial"),
		"1750 kcal",
	);
});

test("an option is read back as its label, not its key", () => {
	assert.equal(
		formatAnswer(field("gender"), "non-binary", "metric"),
		"Non-binary",
	);
	assert.equal(
		formatAnswer(field("goals"), ["lose-weight", "improve-sleep"], "metric"),
		"Lose weight, Sleep better",
	);
});

test("an unanswered question says so rather than rendering null", () => {
	assert.equal(
		formatAnswer(field("bodyFatPercent"), null, "metric"),
		"not set",
	);
	assert.equal(formatAnswer(field("goals"), [], "metric"), "none");
});

test("the model is told option keys, so it cannot send a label", () => {
	const described = describeField(field("gender"));
	assert.match(described, /non-binary/);
	assert.doesNotMatch(described, /Non-binary/);
});

test("a measured field is described in stored units, never display ones", () => {
	// The whole unit contract rests on this: the model writes metric and the
	// app converts. A description in pounds would quietly invite the opposite.
	const described = describeField(field("skeletalMuscleMassKg"));
	assert.match(described, /5 to 100 kg/);
});

test("the tool schema accepts every field Milo can see, and nothing else", () => {
	for (const f of MILO_FIELDS) {
		const parsed = profileChange.safeParse({
			field: f.name,
			value: null,
			reason: "clearing it",
		});
		assert.ok(parsed.success, `${f.name} was rejected by the tool schema`);
	}

	assert.equal(
		profileChange.safeParse({
			field: "username",
			value: "mark",
			reason: "no",
		}).success,
		false,
	);
});
