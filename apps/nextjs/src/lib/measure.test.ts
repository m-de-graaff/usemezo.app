import assert from "node:assert/strict";
import test from "node:test";
import {
	displayMeasure,
	formatDuration,
	formatFeetInches,
	formatRest,
	formatVolume,
	fromDisplay,
	QUICK_ADD_ML,
	toDisplay,
	unitSystem,
} from "./measure.ts";

test("unitSystem falls back to metric for anything unset or unknown", () => {
	assert.equal(unitSystem("imperial"), "imperial");
	assert.equal(unitSystem("metric"), "metric");
	assert.equal(unitSystem(null), "metric");
	assert.equal(unitSystem(undefined), "metric");
	assert.equal(unitSystem("nonsense"), "metric");
});

test("feet and inches carry rather than showing twelve inches", () => {
	assert.equal(formatFeetInches(180), `5' 11"`);
	assert.equal(formatFeetInches(152.4), `5' 0"`);
	// 179.2cm is 70.55in, which rounds to 71 and must not render as 5' 11" + 12.
	assert.equal(formatFeetInches(179.2), `5' 11"`);
	assert.equal(formatFeetInches(182.9), `6' 0"`);
});

test("a stored value renders in the chosen system without changing", () => {
	assert.deepEqual(displayMeasure(180, "length", "metric"), {
		text: "180",
		unit: "cm",
	});
	assert.deepEqual(displayMeasure(180, "length", "imperial"), {
		text: `5' 11"`,
		unit: "",
	});
	assert.deepEqual(displayMeasure(75, "mass", "metric"), {
		text: "75",
		unit: "kg",
	});
	assert.deepEqual(displayMeasure(75, "mass", "imperial"), {
		text: "165",
		unit: "lb",
	});
});

test("a fractional weight keeps one decimal in metric", () => {
	assert.equal(displayMeasure(72.45, "mass", "metric").text, "72.5");
	assert.equal(displayMeasure(72, "mass", "metric").text, "72");
});

test("a number input round-trips through imperial without drifting", () => {
	// 180cm -> 71in -> 180.34cm. Display rounding is the only loss, and it is
	// bounded by half a unit, so an untouched field never walks.
	const cm = toDisplay(180, "length", "imperial");
	assert.equal(cm, 71);
	assert.ok(Math.abs(fromDisplay(cm, "length", "imperial") - 180) < 1.3);

	const lb = toDisplay(82.5, "mass", "imperial");
	assert.equal(lb, 181.9);
	assert.ok(Math.abs(fromDisplay(lb, "mass", "imperial") - 82.5) < 0.05);
});

test("metric passes a number input through untouched", () => {
	assert.equal(toDisplay(180, "length", "metric"), 180);
	assert.equal(fromDisplay(180, "length", "metric"), 180);
	assert.equal(toDisplay(82.5, "mass", "metric"), 82.5);
	assert.equal(fromDisplay(82.5, "mass", "metric"), 82.5);
});

test("a field with no measure is never converted", () => {
	assert.equal(toDisplay(2400, undefined, "imperial"), 2400);
	assert.equal(fromDisplay(2400, undefined, "imperial"), 2400);
});

test("a rest interval reads as a person counts it", () => {
	// Nobody rests for "150 seconds". A number the reader has to divide by sixty
	// is a number they stop reading.
	assert.equal(formatRest(150), "2m 30s");
	assert.equal(formatRest(45), "45s");
	// A round two minutes is two minutes, not "2m 0s".
	assert.equal(formatRest(120), "2m");
	assert.equal(formatRest(0), "0s");
});

test("a duration past an hour stops being minutes", () => {
	assert.equal(formatDuration(4080), "1h 08m");
	assert.equal(formatDuration(1800), "30m");
	assert.equal(formatDuration(0), "0m");
});

test("a volume reads in the unit the reader chose", () => {
	// Litres past a litre, because nobody says "one thousand seven hundred
	// millilitres" — and millilitres below it, because a glass of water is not
	// "0.3 L".
	assert.equal(formatVolume(1700, "metric"), "1.7 L");
	assert.equal(formatVolume(2000, "metric"), "2.0 L");
	assert.equal(formatVolume(250, "metric"), "250 ml");
	assert.equal(formatVolume(0, "metric"), "0 ml");
	// US fluid ounces, which is what an imperial reader means by "oz".
	assert.equal(formatVolume(473, "imperial"), "16 oz");
	assert.equal(formatVolume(1700, "imperial"), "57 oz");
});

test("the quick-add sizes are vessels somebody actually pours", () => {
	// The imperial row has to round to whole ounces, or the buttons read
	// "8 oz, 12 oz, 16 oz" in one system and "8 oz, 11 oz, 17 oz" in the other.
	for (const ml of QUICK_ADD_ML("imperial")) {
		assert.match(formatVolume(ml, "imperial"), /^(8|12|16|24) oz$/);
	}
	assert.deepEqual(QUICK_ADD_ML("metric"), [150, 250, 330, 500, 750]);
});
