"use client";

import type { LoggedSet, PlannedSet } from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import { Input } from "@mezo/ui/input";
import { cn } from "@mezo/ui/lib/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
import {
	fromDisplay,
	toDisplay,
	type UnitSystem,
	unitLabel,
} from "~/lib/measure";

/**
 * The weight-by-reps grid, shared by the routine builder and the live session.
 *
 * The live session passes `onToggle` and gets a check column; the builder does
 * not and gets the same grid without one. Two copies of a numeric stepper that
 * have to agree about rounding is how a routine and the session started from it
 * end up disagreeing about the weight.
 *
 * Inputs hold display units and convert on the way out, which is the rule the
 * settings form already follows: stored kilograms, shown in whatever the reader
 * uses.
 */

/** The plate jump people actually make, in the unit they are reading. */
const WEIGHT_STEP = { metric: 2.5, imperial: 5 } as const;

export function SetRows<T extends PlannedSet>({
	exerciseName,
	onChange,
	onToggle,
	sets,
	system,
}: {
	exerciseName: string;
	onChange: (sets: T[]) => void;
	/** Present only on a live session, where a set can be ticked off. */
	onToggle?: (index: number) => void;
	sets: T[];
	system: UnitSystem;
}) {
	const unit = unitLabel("mass", system) ?? "kg";
	const step = WEIGHT_STEP[system];
	const columns = onToggle
		? "1.25rem minmax(0,1fr) minmax(0,1fr) 1.75rem"
		: "1.25rem minmax(0,1fr) minmax(0,1fr)";

	const patch = (index: number, field: "reps" | "weightKg", value: number) =>
		onChange(
			sets.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
		);

	// A new set copies the last one. The second set of an exercise is almost
	// always the first set again, and typing it out is the friction people quit
	// over.
	const addSet = () => {
		const last = sets.at(-1);
		onChange([
			...sets,
			{
				...(last ?? { reps: 10, weightKg: 0 }),
				...(onToggle ? { done: false } : {}),
			} as T,
		]);
	};

	return (
		<div>
			<div
				className="grid items-center gap-2 pb-1 text-muted-foreground text-xs"
				style={{ gridTemplateColumns: columns }}
			>
				<span>#</span>
				<span>Weight ({unit})</span>
				<span>Reps</span>
				{onToggle && <span className="sr-only">Done</span>}
			</div>

			{sets.map((set, index) => {
				const done = onToggle ? (set as unknown as LoggedSet).done : false;
				return (
					<div
						className="grid items-center gap-2 py-1"
						// Sets are only ever appended to or truncated from the end, never
						// reordered or spliced from the middle, so a row's index is stable
						// for its whole life. Giving every set an id of its own would mean
						// carrying one in the stored document for a list nobody can reorder.
						// biome-ignore lint/suspicious/noArrayIndexKey: append-only list
						key={index}
						style={{ gridTemplateColumns: columns }}
					>
						<span
							className={cn(
								"text-muted-foreground text-sm tabular-nums",
								done && "text-foreground",
							)}
						>
							{index + 1}
						</span>

						<Stepper
							label={`Set ${index + 1} weight for ${exerciseName}, in ${unit}`}
							onChange={(value) =>
								patch(index, "weightKg", fromDisplay(value, "mass", system))
							}
							step={step}
							value={toDisplay(set.weightKg, "mass", system)}
						/>

						<Stepper
							integer
							label={`Set ${index + 1} reps for ${exerciseName}`}
							onChange={(value) => patch(index, "reps", Math.round(value))}
							step={1}
							value={set.reps}
						/>

						{onToggle && (
							// A native checkbox, so the done state is announced rather than
							// only drawn, and colour is never the only signal.
							<label className="flex size-7 items-center justify-center">
								<span className="sr-only">
									Set {index + 1} of {exerciseName} done
								</span>
								<input
									checked={done}
									className="size-5 accent-primary"
									onChange={() => onToggle(index)}
									type="checkbox"
								/>
							</label>
						)}
					</div>
				);
			})}

			<div className="mt-2 flex gap-2">
				<Button onClick={addSet} size="sm" type="button" variant="ghost">
					<PlusIcon aria-hidden="true" />
					Add set
				</Button>
				{sets.length > 1 && (
					<Button
						onClick={() => onChange(sets.slice(0, -1))}
						size="sm"
						type="button"
						variant="ghost"
					>
						<MinusIcon aria-hidden="true" />
						Remove set
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * A number with a minus and a plus either side.
 *
 * The buttons are 24 CSS px, which is the WCAG 2.2 minimum target, and each one
 * is named for the set it belongs to: forty controls all called "increase" tell
 * a screen reader user nothing.
 */
function Stepper({
	integer,
	label,
	onChange,
	step,
	value,
}: {
	integer?: boolean;
	label: string;
	onChange: (value: number) => void;
	step: number;
	value: number;
}) {
	const clamp = (next: number) => Math.max(0, Math.round(next * 100) / 100);

	return (
		<div className="flex min-w-0 items-center gap-1">
			<button
				aria-label={`Decrease ${label}`}
				className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				onClick={() => onChange(clamp(value - step))}
				type="button"
			>
				<MinusIcon aria-hidden="true" className="size-3" />
			</button>
			<Input
				aria-label={label}
				className="min-w-0 text-center tabular-nums"
				inputMode={integer ? "numeric" : "decimal"}
				onChange={(event) => {
					// An empty box while somebody is retyping is 0, not NaN. Rejecting
					// the keystroke instead would make the field impossible to clear.
					const next =
						event.target.value === "" ? 0 : Number(event.target.value);
					if (!Number.isNaN(next)) onChange(clamp(next));
				}}
				value={String(value)}
			/>
			<button
				aria-label={`Increase ${label}`}
				className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				onClick={() => onChange(clamp(value + step))}
				type="button"
			>
				<PlusIcon aria-hidden="true" className="size-3" />
			</button>
		</div>
	);
}
