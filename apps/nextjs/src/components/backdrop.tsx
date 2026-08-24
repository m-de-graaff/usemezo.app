"use client";

import { useIsMobile } from "@mezo/ui/hooks/use-mobile";
import { cn } from "@mezo/ui/lib/utils";
import { useTheme } from "@mezo/ui/theme";
import { useEffect, useState } from "react";
import PixelBlast from "./pixel-blast";

/**
 * The dither field behind the auth forms and onboarding. Achromatic on purpose:
 * it is the secondary ink colour of whichever theme is showing, so it spends
 * none of the colour budget the product reserves for data.
 *
 * Three things switch it off, and each returns null rather than hiding a
 * mounted canvas — the cost here is a continuously rendering WebGL surface, so
 * hiding it with CSS would pay for it and show nothing:
 *
 * - `prefers-reduced-motion`, since this is ambient motion carrying no meaning.
 * - A phone, where it is a constant draw on a battery for pure decoration and
 *   the form fills the screen anyway.
 * - A theme that has not resolved yet, which only happens on the client; a
 *   wrong-colour first frame is worse than a late one.
 */
const INK_SECONDARY = { light: "#666669", dark: "#A0A0A8" } as const;

export function Backdrop({
	className,
	inverted = false,
}: {
	/**
	 * Replaces the default full-viewport positioning. Pass `absolute inset-0`
	 * to sit inside a `relative` parent instead — onboarding's brand panel does,
	 * so the field is clipped to the panel rather than running under the form.
	 */
	className?: string;
	/**
	 * For a surface painted `bg-foreground`, where the page's own ink would be
	 * the low-contrast choice: this takes the other theme's value, so the field
	 * reads against the inverted panel the way it does against the page.
	 */
	inverted?: boolean;
}) {
	const { resolvedTheme } = useTheme();
	const isMobile = useIsMobile();
	const [animate, setAnimate] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setAnimate(!query.matches);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);

	if (!animate || isMobile || !resolvedTheme) return null;

	const light = resolvedTheme === "light";
	const ink = (light ? !inverted : inverted)
		? INK_SECONDARY.light
		: INK_SECONDARY.dark;

	return (
		<div
			aria-hidden="true"
			className={cn("pointer-events-none", className ?? "fixed inset-0 -z-10")}
		>
			<PixelBlast
				color={ink}
				edgeFade={0.43}
				enableRipples={false}
				patternDensity={0.7}
				patternScale={4.75}
				pixelSize={5}
				pixelSizeJitter={1.4}
				speed={0.4}
				transparent
				variant="triangle"
			/>
		</div>
	);
}
