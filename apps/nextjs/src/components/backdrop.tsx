"use client";

import { useTheme } from "@mezo/ui/theme";
import { useEffect, useState } from "react";
import PixelBlast from "./pixel-blast";

/**
 * The dither field behind the auth forms. Achromatic on purpose: it is the
 * secondary ink colour of whichever theme is showing, so it spends none of the
 * colour budget the product reserves for data.
 *
 * Skipped entirely under `prefers-reduced-motion` — this is continuous ambient
 * motion carrying no information. Nothing renders until the theme resolves
 * either: that only happens on the client, and a wrong-colour first frame is
 * worse than a late one.
 */
const INK_SECONDARY = { light: "#666669", dark: "#A0A0A8" } as const;

export function Backdrop() {
	const { resolvedTheme } = useTheme();
	const [animate, setAnimate] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setAnimate(!query.matches);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);

	if (!animate || !resolvedTheme) return null;

	return (
		<div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
			<PixelBlast
				color={
					resolvedTheme === "light" ? INK_SECONDARY.light : INK_SECONDARY.dark
				}
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
