"use client";

import { useEffect, useState } from "react";
import { BARS } from "./logo";

/**
 * One bar as [centre x, centre y, length, rotation in degrees]. Every frame
 * draws the same four bars, so the mark only ever moves and stretches them:
 * the logo itself is the first frame, and each letter is those four bars
 * rearranged.
 *
 * Two things keep the letters reading as solid strokes rather than as four
 * rectangles parked next to each other. They thin out, because four bars at
 * the logo's width close up the counters of an e or an o. And their ends round
 * to a half-circle, which lands every bar in a letter on a joint: caps that
 * share a centre merge into one round corner instead of leaving the notch two
 * square ends leave between them.
 */
type Bar = readonly [number, number, number, number];
type Frame = { width: number; radius: number; bars: Bar[] };

const LOGO_WIDTH = 3.6;
const LETTER_WIDTH = 2.6;
/** Half the width, so the ends are half-circles. */
const LETTER_RADIUS = LETTER_WIDTH / 2;

const REST: Frame = {
	width: LOGO_WIDTH,
	radius: 1,
	bars: BARS.map(
		(bar) =>
			[bar.x + LOGO_WIDTH / 2, bar.y + bar.height / 2, bar.height, 0] as const,
	),
};

/** Left stem, the two diagonals, right stem. */
const M: Frame = {
	width: LETTER_WIDTH,
	radius: LETTER_RADIUS,
	bars: [
		[5.3, 12, 16, 0],
		[8.65, 9.4, 10.59, -39.3],
		[15.35, 9.4, 10.59, 39.3],
		[18.7, 12, 16, 0],
	],
};

/** Stem, then the three arms top to bottom. */
const E: Frame = {
	width: LETTER_WIDTH,
	radius: LETTER_RADIUS,
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
	radius: LETTER_RADIUS,
	bars: [
		[9.15, 14.7, 9.4, 46.6],
		[12, 5.3, 14, 90],
		[14.85, 9.3, 9.4, 46.6],
		[12, 18.7, 14, 90],
	],
};

/** Four sides of a ring, meeting at the corners. */
const O: Frame = {
	width: LETTER_WIDTH,
	radius: LETTER_RADIUS,
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
	intervalMs = 620,
	pinnedFrame,
}: {
	className?: string;
	/** How long each frame is held, the morph into it included. */
	intervalMs?: number;
	/** Holds one frame instead of cycling. For looking at a shape, not for use. */
	pinnedFrame?: number;
}) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (pinnedFrame !== undefined) return;
		// Reduced motion keeps the resting bars: the mark is decoration, and the
		// state it stands for is announced by the label beside it.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const id = setInterval(
			() => setIndex((current) => (current + 1) % FRAMES.length),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [intervalMs, pinnedFrame]);

	const frame = FRAMES[pinnedFrame ?? index] ?? REST;
	// Most of the frame is the move, with just enough held at the end to read the
	// letter. Slower than this and four bars sliding is all you see.
	const morphMs = Math.round(intervalMs * 0.7);
	const transition = ["x", "y", "width", "height", "rx", "transform"]
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
						rx={frame.radius}
						style={{
							height: `${length}px`,
							rx: `${frame.radius}px`,
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
