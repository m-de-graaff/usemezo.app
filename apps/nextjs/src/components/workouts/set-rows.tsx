"use client";

import {
	isCounted,
	type LoggedSet,
	type PlannedSet,
	SET_TYPES,
	type SetType,
} from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@mezo/ui/dropdown-menu";
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
 * uses. An empty box stays empty rather than becoming a zero, because a set
 * nobody has filled in yet is not a set of zero reps.
 */

/** The plate jump people actually make, in the unit they are reading. */
const WEIGHT_STEP = { metric: 2.5, imperial: 5 } as const;

/**
 * What each set type shows in the number column, and what it is called.
 *
 * The letter is the signal and the colour is decoration, so a warm-up is still
 * a warm-up in greyscale, to a colour-blind reader, and to a screen reader
 * (SC 1.4.1).
 */
const SET_TYPE = {
	warmup: {
		className: "text-amber-600 dark:text-amber-500",
		label: "Warm-up",
		letter: "W",
	},
	failure: { className: "text-destructive", label: "Failure", letter: "F" },
} as const satisfies Record<
	SetType,
	{ className: string; label: string; letter: string }
>;

/** The menu's value for "none of the above", which is what most sets are. */
const WORKING = "working";

/**
 * Working sets are numbered 1, 2, 3 among themselves. A warm-up sitting first
 * must not push the first working set to "2": that is the number the lifter is
 * counting, and the one their last session is compared against.
 */
const workingNumber = (sets: { type?: SetType }[], index: number) =>
	sets.slice(0, index + 1).filter(isCounted).length;

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
		? "2.25rem minmax(0,1fr) minmax(0,1fr) 1.75rem"
		: "2.25rem minmax(0,1fr) minmax(0,1fr)";

	const patch = (
		index: number,
		field: "reps" | "weightKg",
		value: number | undefined,
	) =>
		onChange(
			sets.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
		);

	const patchType = (index: number, type: SetType | undefined) =>
		onChange(sets.map((set, i) => (i === index ? { ...set, type } : set)));

	// A new set copies the last one's numbers. The second set of an exercise is
	// almost always the first set again, and typing it out is the friction people
	// quit over. It does not copy the type: a set added after a warm-up is a
	// working set, not another warm-up.
	const addSet = () => {
		const last = sets.at(-1);
		onChange([
			...sets,
			{
				reps: last?.reps,
				weightKg: last?.weightKg,
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
				<span>Set</span>
				<span>Weight ({unit})</span>
				<span>Reps</span>
				{onToggle && <span className="sr-only">Done</span>}
			</div>

			{sets.map((set, index) => {
				const done = onToggle ? (set as unknown as LoggedSet).done : false;
				const type = set.type;
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
						{/* The number doubles as the type control, the way every training
						    app puts it. A radio group rather than plain items, so which
						    type a set currently is gets announced and not only drawn. */}
						<DropdownMenu>
							<DropdownMenuTrigger
								aria-label={`Set ${index + 1} of ${exerciseName} is ${
									type ? SET_TYPE[type].label : "a working set"
								}. Change its type.`}
								className={cn(
									"flex h-7 w-8 items-center justify-center rounded-md font-medium text-sm tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
									type ? SET_TYPE[type].className : "text-muted-foreground",
									done && !type && "text-foreground",
								)}
							>
								{type ? SET_TYPE[type].letter : workingNumber(sets, index)}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuRadioGroup
									onValueChange={(value) =>
										patchType(
											index,
											value === WORKING ? undefined : (value as SetType),
										)
									}
									value={type ?? WORKING}
								>
									{/* Radio items keep the menu open by default, which here would
									    leave it covering the next set's row. One choice, then out
									    of the way. */}
									<DropdownMenuRadioItem closeOnClick value={WORKING}>
										Working set
									</DropdownMenuRadioItem>
									{SET_TYPES.map((option) => (
										<DropdownMenuRadioItem
											closeOnClick
											key={option}
											value={option}
										>
											{SET_TYPE[option].label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>

						<Stepper
							label={`Set ${index + 1} weight for ${exerciseName}, in ${unit}`}
							onChange={(value) =>
								patch(index, "weightKg", fromDisplay(value, "mass", system))
							}
							onClear={() => patch(index, "weightKg", undefined)}
							step={step}
							value={
								set.weightKg === undefined
									? undefined
									: toDisplay(set.weightKg, "mass", system)
							}
						/>

						<Stepper
							integer
							label={`Set ${index + 1} reps for ${exerciseName}`}
							onChange={(value) => patch(index, "reps", Math.round(value))}
							onClear={() => patch(index, "reps", undefined)}
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
				{sets.length > 0 && (
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
 * A number with a minus and a plus either side, and no number until somebody
 * puts one there.
 *
 * The buttons are 24 CSS px, which is the WCAG 2.2 minimum target, and each one
 * is named for the set it belongs to: forty controls all called "increase" tell
 * a screen reader user nothing.
 */
function Stepper({
	integer,
	label,
	onChange,
	onClear,
	step,
	value,
}: {
	integer?: boolean;
	label: string;
	onChange: (value: number) => void;
	onClear: () => void;
	step: number;
	value: number | undefined;
}) {
	const clamp = (next: number) => Math.max(0, Math.round(next * 100) / 100);

	return (
		<div className="flex min-w-0 items-center gap-1">
			<button
				aria-label={`Decrease ${label}`}
				className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				onClick={() => onChange(clamp((value ?? 0) - step))}
				type="button"
			>
				<MinusIcon aria-hidden="true" className="size-3" />
			</button>
			<Input
				aria-label={label}
				className="min-w-0 text-center tabular-nums"
				inputMode={integer ? "numeric" : "decimal"}
				onChange={(event) => {
					// An empty box stays empty. Coercing it to 0 would write a number
					// into the document that nobody typed, and would make the field
					// impossible to clear.
					if (event.target.value === "") return onClear();
					const next = Number(event.target.value);
					if (!Number.isNaN(next)) onChange(clamp(next));
				}}
				placeholder="0"
				value={value === undefined ? "" : String(value)}
			/>
			<button
				aria-label={`Increase ${label}`}
				className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				onClick={() => onChange(clamp((value ?? 0) + step))}
				type="button"
			>
				<PlusIcon aria-hidden="true" className="size-3" />
			</button>
		</div>
	);
}
