"use client";

import { Input } from "@mezo/ui/input";

/**
 * The two rest timers on an exercise.
 *
 * They are different numbers in real training: thirty seconds between sets of
 * curls and two minutes before you walk to the squat rack. One field for both
 * would make you pick which one to be wrong about.
 *
 * Blank is not zero. An empty box means the routine has no opinion and no timer
 * starts, which is what most exercises want; zero would be an instruction to
 * rest for no time at all.
 */

/** Longer than any rest anybody programmes, and the same cap the schema has. */
const MAX_SEC = 3600;

export function RestFields({
	exerciseName,
	onChange,
	restAfterSec,
	restSec,
}: {
	exerciseName: string;
	onChange: (rest: { restAfterSec?: number; restSec?: number }) => void;
	restAfterSec: number | undefined;
	restSec: number | undefined;
}) {
	return (
		<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2 text-muted-foreground text-xs">
			<Seconds
				label={`Rest between sets of ${exerciseName}, in seconds`}
				onChange={(restSec) => onChange({ restSec })}
				text="Between sets"
				value={restSec}
			/>
			<Seconds
				label={`Rest after ${exerciseName}, in seconds`}
				onChange={(restAfterSec) => onChange({ restAfterSec })}
				text="After exercise"
				value={restAfterSec}
			/>
		</div>
	);
}

function Seconds({
	label,
	onChange,
	text,
	value,
}: {
	label: string;
	onChange: (value: number | undefined) => void;
	text: string;
	value: number | undefined;
}) {
	return (
		<span className="flex items-center gap-1.5">
			{/* The visible words are the label, so the box is not a number with no
			    name once somebody has stopped looking at the row above it. */}
			<span>{text}</span>
			<Input
				aria-label={label}
				className="h-7 w-16 px-2 text-center text-sm tabular-nums"
				inputMode="numeric"
				onChange={(event) => {
					if (event.target.value === "") return onChange(undefined);
					const next = Number(event.target.value);
					if (Number.isNaN(next)) return;
					onChange(Math.max(0, Math.min(MAX_SEC, Math.round(next))));
				}}
				placeholder="off"
				value={value === undefined ? "" : String(value)}
			/>
			<span aria-hidden="true">s</span>
		</span>
	);
}
