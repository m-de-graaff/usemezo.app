import assert from "node:assert/strict";
import { test } from "node:test";
import { themeButton } from "./theme-state.ts";

/**
 * The invariant the hydration mismatch violated.
 *
 * The server rendered `Theme: system. Switch to light.` with a monitor icon,
 * the client rendered `Theme: dark. Switch to system.` with a moon, and React
 * threw the tree away. It happened because the component asked what the theme
 * was at a moment when only the client could answer.
 */
test("nothing before mount depends on the stored theme", () => {
	const unmounted = themeButton(undefined, false);

	for (const theme of ["system", "light", "dark", undefined]) {
		assert.deepEqual(
			themeButton(theme, false),
			unmounted,
			`a pre-mount render varied with theme=${theme}, which is the mismatch`,
		);
	}
});

test("the pre-mount label claims nothing about the current theme", () => {
	// "Theme: system." on the server is a lie whenever the stored theme is not
	// system, and it is announced to a screen reader before it is corrected.
	const { label, icon } = themeButton(undefined, false);
	assert.equal(label, "Change theme");
	assert.doesNotMatch(label, /light|dark|system/);
	assert.equal(icon, "system", "and it still occupies the same space");
});

test("a click before mount still goes somewhere defined", () => {
	assert.equal(themeButton(undefined, false).next, "light");
});

test("after mount it shows the real theme and the real next step", () => {
	assert.deepEqual(themeButton("dark", true), {
		icon: "dark",
		label: "Theme: dark. Switch to system.",
		next: "system",
	});
	assert.deepEqual(themeButton("light", true), {
		icon: "light",
		label: "Theme: light. Switch to dark.",
		next: "dark",
	});
	assert.deepEqual(themeButton("system", true), {
		icon: "system",
		label: "Theme: system. Switch to light.",
		next: "light",
	});
});

test("the cycle returns to where it started", () => {
	let theme: string = "system";
	const seen = [theme];
	for (let step = 0; step < 3; step++) {
		theme = themeButton(theme, true).next;
		seen.push(theme);
	}
	assert.deepEqual(seen, ["system", "light", "dark", "system"]);
});

test("a theme nothing recognises is the neutral state, not a crash", () => {
	// `localStorage` is user-writable and survives a rename of the theme names.
	assert.deepEqual(
		themeButton("sepia", true),
		themeButton(undefined, false),
		"an unknown stored theme falls back rather than indexing into nothing",
	);
});
