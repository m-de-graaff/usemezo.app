"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Button } from "./button";

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

const NEXT_THEME = { system: "light", light: "dark", dark: "system" } as const;
const ICONS = {
	system: MonitorIcon,
	light: SunIcon,
	dark: MoonIcon,
} as const;

/**
 * Cycles system -> light -> dark. Renders the *current* theme's icon, so before
 * hydration (when `theme` is undefined) it shows the system icon rather than
 * flashing the wrong one.
 */
export function ThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const current = (theme ?? "system") as keyof typeof NEXT_THEME;
	const Icon = ICONS[current] ?? MonitorIcon;

	return (
		<Button
			aria-label={`Theme: ${current}. Switch to ${NEXT_THEME[current] ?? "light"}.`}
			className={className}
			onClick={() => setTheme(NEXT_THEME[current] ?? "light")}
			size="icon"
			variant="ghost"
		>
			<Icon />
		</Button>
	);
}
