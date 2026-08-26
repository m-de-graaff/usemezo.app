"use client";

import { DEFAULT_REST_SEC } from "@mezo/api/workout-shape";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mezo/ui/select";
import { useId } from "react";
import { formatRest } from "~/components/workouts/summary";

/**
 * The two rest timers on an exercise.
 *
 * They are different numbers in real training: thirty seconds between sets of
 * curls and two minutes before you walk to the squat rack. One field for both
 * would make you pick which one to be wrong about.
 *
 * Blank is not zero. An empty box means the routine has no opinion and the
 * session falls back to two minutes; zero is an instruction to rest for no time
 * at all, which is a thing somebody chose and the only way to get no timer.
 *
 * A list of intervals rather than a number box. Rest is a choice from about a
 * dozen sensible values, not a free number: typing "150" into a box and reading
 * it back as "150" makes the lifter do the division every time they look at the
 * card, and it lets somebody enter 137 seconds, which nobody has ever meant.
 *
 * The app's own `Select` rather than a native one. A native `<select>` arrives
 * with keyboard operation and a correct target size for free, which is why it
 * was here first, but its dropped list is painted by the platform and takes no
 * styling: in dark mode that meant white text on a white popup, which is not a
 * control anybody can read. The one in `@mezo/ui` is themed, is already what
 * every other select in the app uses, and keeps the keyboard behaviour.
 */

/**
 * The intervals worth offering: fine near the short end where fifteen seconds
 * is the difference between a superset and a rest, coarse past two minutes
 * where nobody is counting.
 */
const PRESETS = [
	15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300,
] as const;

/**
 * "No opinion", as a value of its own.
 *
 * A named sentinel rather than the empty string: `""` is how a *native* select
 * says nothing is selected, and this is a real choice with a real label sitting
 * at the top of the list.
 */
const UNSET = "default";

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
			<Interval
				exerciseName={exerciseName}
				onChange={(restSec) => onChange({ restSec })}
				text="Between sets"
				value={restSec}
			/>
			<Interval
				exerciseName={exerciseName}
				onChange={(restAfterSec) => onChange({ restAfterSec })}
				text="After exercise"
				value={restAfterSec}
			/>
		</div>
	);
}

/** What one value reads as, in the trigger and in the list alike. */
const intervalLabel = (value: string) => {
	if (value === UNSET) return `Default (${formatRest(DEFAULT_REST_SEC)})`;
	return value === "0" ? "Off" : formatRest(Number(value));
};

function Interval({
	exerciseName,
	onChange,
	text,
	value,
}: {
	exerciseName: string;
	onChange: (value: number | undefined) => void;
	text: string;
	value: number | undefined;
}) {
	const id = useId();

	// A routine Milo wrote can carry an interval that is not on the list, and
	// dropping it would silently round somebody's programme on first open.
	const options =
		value === undefined ||
		value === 0 ||
		PRESETS.includes(value as (typeof PRESETS)[number])
			? PRESETS
			: [...PRESETS, value].sort((a, b) => a - b);

	return (
		<span className="flex items-center gap-1.5">
			{/* The visible words are the name, so the control is not a value with no
			    label once somebody has stopped looking at the row above it. A native
			    `<label for>` rather than `aria-label`, because Base UI computes the
			    trigger's own `aria-labelledby` and would override the attribute. The
			    exercise is named for a screen reader only: on screen it is already
			    the heading three rows up. */}
			<label htmlFor={id}>
				{text}
				<span className="sr-only"> for {exerciseName}</span>
			</label>
			<Select
				onValueChange={(next) =>
					onChange(next === UNSET ? undefined : Number(next))
				}
				value={value === undefined ? UNSET : String(value)}
			>
				<SelectTrigger className="tabular-nums" id={id}>
					{/* Formatted here rather than left to resolve from the item list.
					    Without an `items` map Base UI stringifies the raw value, and
					    "150" is the number this control exists to stop anybody reading. */}
					<SelectValue>{(next: string) => intervalLabel(next)}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{/* The default is named, not blank. "Off" sitting where the fallback
					    lives is what made a two minute rest look like no rest at all. */}
					<SelectItem value={UNSET}>{intervalLabel(UNSET)}</SelectItem>
					<SelectItem value="0">{intervalLabel("0")}</SelectItem>
					{options.map((seconds) => (
						<SelectItem key={seconds} value={String(seconds)}>
							{intervalLabel(String(seconds))}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</span>
	);
}
