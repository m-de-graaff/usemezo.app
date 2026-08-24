import assert from "node:assert/strict";
import { test } from "node:test";
import { profileInput, usernameSchema } from "./profile-fields.ts";

const accepts = (value: string) => usernameSchema.safeParse(value).success;

test("usernames are lower-cased, so a handle cannot be claimed twice by case", () => {
	assert.equal(usernameSchema.parse("MarkDG"), "markdg");
	assert.equal(usernameSchema.parse("  markdg  "), "markdg");
});

test("usernames accept the documented shape", () => {
	assert.ok(accepts("abc"));
	assert.ok(accepts("mark_dg"));
	assert.ok(accepts("m4rk1"));
	assert.ok(accepts("a".repeat(30)));
});

test("usernames reject anything that would break a profile URL", () => {
	assert.ok(!accepts("ab"), "under three characters");
	assert.ok(!accepts("a".repeat(31)), "over thirty characters");
	assert.ok(!accepts("_mark"), "leading underscore");
	assert.ok(!accepts("mark_"), "trailing underscore");
	assert.ok(!accepts("mark dg"), "space");
	assert.ok(!accepts("mark.dg"), "dot");
	assert.ok(!accepts("mark/dg"), "path separator");
	assert.ok(!accepts("../etc"), "traversal");
});

test("reserved handles are rejected whatever the casing", () => {
	assert.ok(!accepts("admin"));
	assert.ok(!accepts("AdMiN"));
	assert.ok(!accepts("support"));
	assert.ok(!accepts("mezo"));
});

test("an absent answer stays absent, and null clears one", () => {
	// This is what lets a single settings screen save without wiping the rest.
	const parsed = profileInput.parse({ gender: null });
	assert.equal(parsed.gender, null);
	assert.ok(!("weightKg" in parsed), "untouched fields must not appear");
});

test("out-of-range measurements are rejected", () => {
	assert.ok(!profileInput.safeParse({ heightCm: 5 }).success);
	assert.ok(!profileInput.safeParse({ weightKg: 900 }).success);
	assert.ok(!profileInput.safeParse({ dailyCalories: 50 }).success);
	assert.ok(!profileInput.safeParse({ birthDate: "3000-01-01" }).success);
	assert.ok(!profileInput.safeParse({ gender: "not-an-option" }).success);
});
