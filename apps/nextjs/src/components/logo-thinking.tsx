"use client";

import { useEffect, useState } from "react";
import { BARS } from "./logo";

/**
 * One bar as [centre x, centre y, length, rotation in degrees]. Every frame
 * uses the same four bars at the same width, so the mark only ever moves and
 * stretches them: the logo itself is the first frame, and the letters are the
 * same four bars rearranged.
 */
type Bar = readonly [number, number, number, number];

const BAR_WIDTH = 3.6;

const REST: Bar[] = BARS.map(
	(bar) =>
		[bar.x + BAR_WIDTH / 2, bar.y + bar.height / 2, bar.height, 0] as const,
);

/** Left stem, the two diagonals, right stem. */
const M: Bar[] = [
	[5.5, 12, 12, 0],
	[8.9, 10, 10.3, -39],
	[15.1, 10, 10.3, 39],
	[18.5, 12, 12, 0],
];

/** Stem, then the three arms top to bottom. */
const E: Bar[] = [
	[7.8, 12, 12, 0],
	[12.4, 7.8, 9.2, 90],
	[11.6, 12, 7.5, 90],
	[12.4, 16.2, 9.2, 90],
];

/** The diagonal is two bars end to end, since there are four to place. */
const Z: Bar[] = [
	[9.25, 14, 7.2, 54],
	[12, 7.8, 13, 90],
	[14.75, 10, 7.2, 54],
	[12, 16.2, 13, 90],
];

/** Four sides of a ring, overlapping at the corners. */
const O: Bar[] = [
	[7.3, 12, 13, 0],
	[12, 7.3, 9.4, 90],
	[16.7, 12, 13, 0],
	[12, 16.7, 9.4, 90],
];

const FRAMES = [REST, M, E, Z, O];

export function LogoThinking({
	className,
	intervalMs = 1100,
}: {
	className?: string;
	/** Time each frame is held, including the morph into it. */
	intervalMs?: number;
}) {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		// Reduced motion keeps the resting bars: the mark is decoration, and the
		// state it stands for is announced by the label beside it.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const id = setInterval(
			() => setFrame((current) => (current + 1) % FRAMES.length),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [intervalMs]);

	const morphMs = Math.round(intervalMs * 0.45);
	const transition = ["x", "y", "height", "transform"]
		.map((property) => `${property} ${morphMs}ms var(--ease-out-quint)`)
		.join(", ");

	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="currentColor"
			focusable="false"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			{REST.map((restingBar, index) => {
				const [centreX, centreY, length, rotation] =
					FRAMES[frame]?.[index] ?? restingBar;
				const x = centreX - BAR_WIDTH / 2;
				const y = centreY - length / 2;

				return (
					// The geometry is set twice on purpose: as CSS so it can transition,
					// and as attributes so a browser without CSS geometry properties
					// still draws the frame, just without the morph.
					<rect
						height={length}
						key={restingBar[0]}
						rx="1"
						style={{
							height: `${length}px`,
							transform: `rotate(${rotation}deg)`,
							transformBox: "fill-box",
							transformOrigin: "center",
							transition,
							width: `${BAR_WIDTH}px`,
							x: `${x}px`,
							y: `${y}px`,
						}}
						width={BAR_WIDTH}
						x={x}
						y={y}
					/>
				);
			})}
		</svg>
	);
}
