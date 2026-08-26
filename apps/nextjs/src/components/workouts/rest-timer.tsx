"use client";

import { Button } from "@mezo/ui/button";
import { SkipForwardIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The rest countdown, in the bar at the bottom of a live session.
 *
 * It lives down there rather than on the exercise card because rest is when you
 * put the phone down and walk away: the number has to be readable from arm's
 * length and it has to still be there after the list has been scrolled. That is
 * also why it is a bar and not a toast — a toast that dismisses itself is the
 * one thing a timer must never do.
 *
 * Its own component for the same reason `Elapsed` is: a clock inside the
 * workout tree would re-render every set row once a second while somebody is
 * typing into one.
 *
 * The countdown is derived from a wall-clock deadline rather than counted down
 * in state. A phone that sleeps mid-set stops firing intervals, and a timer
 * that resumes from where it was paused would tell somebody they have two
 * minutes of rest left after they have already had five.
 */

/** What the two nudge buttons are worth. A quarter minute, the way every app does it. */
const NUDGE_SEC = 15;

/** Long enough to feel through a pocket, short enough not to be a notification. */
const BUZZ_MS = 400;

export type Rest = {
	/** `Date.now()` in milliseconds, not a duration: see above. */
	endsAt: number;
	/** What it started at, which is all the progress bar needs. */
	totalSec: number;
	/** What the rest is after, for the line above the clock. */
	label: string;
};

const secondsLeft = (endsAt: number) =>
	Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

/** `95` -> `01:35`. Digits, not prose: this one is read at a glance, not aloud. */
const clock = (seconds: number) =>
	`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function RestTimer({
	onAdjust,
	onDone,
	rest,
}: {
	onAdjust: (deltaSec: number) => void;
	onDone: () => void;
	rest: Rest;
}) {
	const [left, setLeft] = useState(() => secondsLeft(rest.endsAt));

	// Read through a ref, the same way the session reads its autosave mutation:
	// `onDone` is a fresh closure on every render of the screen above, and
	// depending on it would restart the interval each time somebody types a
	// number into a set row.
	const doneRef = useRef(onDone);
	doneRef.current = onDone;

	useEffect(() => {
		setLeft(secondsLeft(rest.endsAt));

		const id = setInterval(() => {
			const next = secondsLeft(rest.endsAt);
			setLeft(next);
			if (next > 0) return;

			clearInterval(id);
			// Optional chaining rather than a feature test: no browser on a desktop
			// has this, and it is not worth a branch that says so.
			navigator.vibrate?.(BUZZ_MS);
			doneRef.current();
		}, 1000);

		return () => clearInterval(id);
	}, [rest.endsAt]);

	// A rest that has been extended past what it started at is still full.
	const share = Math.min(1, left / Math.max(1, rest.totalSec));

	return (
		<div className="mx-auto max-w-3xl pb-2">
			{/* The bar is decoration: it says the same thing as the digits, faster.
			    The transition is what makes it sweep rather than step once a second. */}
			<div
				aria-hidden="true"
				className="h-1 overflow-hidden rounded-full bg-muted"
			>
				<div
					className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
					style={{ width: `${share * 100}%` }}
				/>
			</div>

			<div className="mt-2 flex items-center gap-2">
				<div className="min-w-0 flex-1">
					<p className="truncate text-muted-foreground text-xs">
						Resting after {rest.label}
					</p>
					{/* `aria-live="off"` on purpose. A screen reader reading out a new
					    number every second would make the rest of the screen unusable
					    for exactly as long as the rest lasts. */}
					<p
						aria-live="off"
						className="font-semibold text-2xl tabular-nums leading-tight"
						role="timer"
					>
						{clock(left)}
					</p>
				</div>

				<Button
					aria-label={`Take ${NUDGE_SEC} seconds off the rest`}
					onClick={() => onAdjust(-NUDGE_SEC)}
					variant="outline"
				>
					-{NUDGE_SEC}
				</Button>
				<Button
					aria-label={`Add ${NUDGE_SEC} seconds to the rest`}
					onClick={() => onAdjust(NUDGE_SEC)}
					variant="outline"
				>
					+{NUDGE_SEC}
				</Button>
				<Button onClick={onDone} variant="secondary">
					<SkipForwardIcon aria-hidden="true" />
					Skip
				</Button>
			</div>
		</div>
	);
}
