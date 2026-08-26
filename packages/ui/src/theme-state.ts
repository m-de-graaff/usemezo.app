/**
 * What the theme toggle should render, as a value rather than as markup.
 *
 * Split out of `theme.tsx` because it is the whole of the component's logic and
 * the whole of where it went wrong, and because a `.ts` file with no JSX can be
 * run by `node --test` without a DOM.
 *
 * The rule this exists to enforce: **nothing rendered before mount may depend
 * on the stored theme.** `next-themes` keeps the preference in `localStorage`,
 * so the server cannot know it and neither can the first client render. A
 * component that reads `useTheme()` and renders the answer immediately emits
 * one thing on the server and a different thing on the client, and React tears
 * the tree down and rebuilds it.
 *
 * The flash from the neutral state to the real one is not a bug being papered
 * over; it is the cost of storing the preference somewhere the server cannot
 * see. Removing it means moving the theme into a cookie, which is a different
 * decision than this one.
 */

export type ThemeName = "system" | "light" | "dark";

/** Cycles system -> light -> dark -> system. */
const NEXT: Record<ThemeName, ThemeName> = {
	system: "light",
	light: "dark",
	dark: "system",
};

export type ThemeButton = {
	/** Which icon to draw. The caller owns the mapping to a component. */
	icon: ThemeName;
	label: string;
	/** The theme a click should move to. */
	next: ThemeName;
};

/**
 * Before mount the theme is unknowable, so this is what everyone gets: a
 * neutral icon, a label that claims nothing about the current theme, and a
 * defined destination for a click that lands in the single frame before
 * hydration finishes.
 */
const UNKNOWN: ThemeButton = {
	icon: "system",
	label: "Change theme",
	next: "light",
};

export function themeButton(
	theme: string | undefined,
	mounted: boolean,
): ThemeButton {
	if (!mounted) return UNKNOWN;

	// Mounted but still undefined should not happen; if it does, the neutral
	// state is the honest answer rather than a guess at "system".
	const current = theme as ThemeName | undefined;
	if (!current || !(current in NEXT)) return UNKNOWN;

	return {
		icon: current,
		label: `Theme: ${current}. Switch to ${NEXT[current]}.`,
		next: NEXT[current],
	};
}
