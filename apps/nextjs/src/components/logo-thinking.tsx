"use client";

import { useEffect, useState } from "react";
import { BARS } from "./logo";

/**
 * One bar as [centre x, centre y, length, rotation in degrees]. Every frame
 * draws the same four bars, so the mark only ever moves and stretches them:
 * the logo itself is the first frame, and each letter is those four bars
 * rearranged. They thin out for the letters, since four bars at the logo's
 * width would close up the counters of an e or an o.
 */
type Bar = readonly [number, number, number, number];
type Frame = { width: number; bars: Bar[] };

const LOGO_WIDTH = 3.6;
const LETTER_WIDTH = 2.6;

const REST: Frame = {
	width: LOGO_WIDTH,
	bars: BARS.map(
		(bar) =>
			[bar.x + LOGO_WIDTH / 2, bar.y + bar.height / 2, bar.height, 0] as const,
	),
};

/** Left stem, the two diagonals, right stem. */
const M: Frame = {
	width: LETTER_WIDTH,
	bars: [
		[5.3, 12, 16, 0],
		[8.65, 8.5, 12, -36.7],
		[15.35, 8.5, 12, 36.7],
		[18.7, 12, 16, 0],
	],
};

/** Stem, then the three arms top to bottom. */
const E: Frame = {
	width: LETTER_WIDTH,
	bars: [
		[5.8, 12, 16, 0],
		[11.9, 5.3, 12.2, 90],
		[10.9, 12, 10.2, 90],
		[11.9, 18.7, 12.2, 90],
	],
};

/** The diagonal is two bars end to end, since there are four to place. */
const Z: Frame = {
	width: LETTER_WIDTH,
	bars: [
		[9.15, 14.7, 8.2, 46.6],
		[12, 5.3, 14, 90],
		[14.85, 9.3, 8.2, 46.6],
		[12, 18.7, 14, 90],
	],
};

/** Four sides of a ring, meeting at the corners. */
const O: Frame = {
	width: LETTER_WIDTH,
	bars: [
		[6.3, 12, 16, 0],
		[12, 5.3, 11.4, 90],
		[17.7, 12, 16, 0],
		[12, 18.7, 11.4, 90],
	],
};

const FRAMES = [REST, M, E, Z, O];

export function LogoThinking({
	className,
	intervalMs = 1100,
}: {
	className?: string;
	/** How long each frame is held, the morph into it included. */
	intervalMs?: number;
}) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		// Reduced motion keeps the resting bars: the mark is decoration, and the
		// state it stands for is announced by the label beside it.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const id = setInterval(
			() => setIndex((current) => (current + 1) % FRAMES.length),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [intervalMs]);

	const frame = FRAMES[index] ?? REST;
	const morphMs = Math.round(intervalMs * 0.45);
	const transition = ["x", "y", "width", "height", "transform"]
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
			{REST.bars.map((restingBar, position) => {
				const [centreX, centreY, length, rotation] =
					frame.bars[position] ?? restingBar;
				const x = centreX - frame.width / 2;
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
							width: `${frame.width}px`,
							x: `${x}px`,
							y: `${y}px`,
						}}
						width={frame.width}
						x={x}
						y={y}
					/>
				);
			})}
		</svg>
	);
}
