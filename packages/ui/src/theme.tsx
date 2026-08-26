"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { themeButton } from "./theme-state.ts";

// Re-exported so apps read the theme without depending on next-themes directly.
export { useTheme };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<NextThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			{children}
		</NextThemeProvider>
	);
}

const ICONS = {
	system: MonitorIcon,
	light: SunIcon,
	dark: MoonIcon,
} as const;

/**
 * Cycles system -> light -> dark.
 *
 * The theme lives in `localStorage`, so the server cannot know it and neither
 * can the first client render — `useTheme()` returns `undefined` for both, then
 * the real value once the effect has run. Rendering the answer straight away is
 * what made the server emit a monitor icon and "Theme: system" while the client
 * emitted a moon and "Theme: dark", which React reports as a hydration mismatch
 * and recovers from by rebuilding the tree.
 *
 * `suppressHydrationWarning` on `<html>` does not help: it applies to the
 * element it is set on, not to every descendant, and this button is one.
 *
 * So the button holds a neutral state until `mounted`, exactly as `backdrop.tsx`
 * waits for `resolvedTheme` before drawing anything. It keeps its space rather
 * than returning `null`, because it sits in a sticky header and in an
 * absolutely positioned corner, and disappearing would move the layout.
 *
 * `themeButton` in `./theme-state` is the whole of the decision, and is where
 * the test for it lives.
 */
export function ThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// A genuine effect: it synchronises with something outside React, namely
	// whether the browser has taken over from the server's HTML.
	useEffect(() => setMounted(true), []);

	const { icon, label, next } = themeButton(theme, mounted);
	const Icon = ICONS[icon];

	return (
		<Button
			aria-label={label}
			className={className}
			onClick={() => setTheme(next)}
			size="icon"
			variant="ghost"
		>
			<Icon />
		</Button>
	);
}
