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
import { MedalIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { lastTime, previousFor } from "~/components/workouts/summary";
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

/**
 * The rep target of one set, as a lifter reads it: `10`, or `8-12`.
 *
 * Sorted rather than trusted. Nothing stops a half-typed range reading 12 to 8
 * on the way to reading 12 to 15, and a card that flickers "12-8" while
 * somebody types is a card that looks broken.
 */
function repTarget(set: PlannedSet): string | null {
	if (set.reps === undefined && set.repsMax === undefined) return null;
	if (set.repsMax === undefined) return String(set.reps);
	if (set.reps === undefined) return String(set.repsMax);
	const [low, high] = [set.reps, set.repsMax].sort((a, b) => a - b);
	return low === high ? String(low) : `${low}-${high}`;
}

export function SetRows<T extends PlannedSet>({
	exerciseName,
	onChange,
	onToggle,
	previous,
	recordIndex,
	sets,
	system,
}: {
	exerciseName: string;
	onChange: (sets: T[]) => void;
	/** Present only on a live session, where a set can be ticked off. */
	onToggle?: (index: number) => void;
	/**
	 * What was logged for this exercise last time, set for set. Present only on
	 * a live session; the builder is writing a plan and has no last time.
	 */
	previous?: PlannedSet[];
	/** The set that beat this exercise's record, if one of them did. */
	recordIndex?: number;
	sets: T[];
	system: UnitSystem;
}) {
	const unit = unitLabel("mass", system) ?? "kg";
	const step = WEIGHT_STEP[system];
	// The previous column only exists where there is a previous: the builder is
	// writing a plan, and a plan has no last time.
	const columns = onToggle
		? `2.25rem ${previous ? "minmax(0,5.5rem) " : ""}minmax(0,1fr) minmax(0,1fr) 1.75rem`
		: "2.25rem minmax(0,1fr) minmax(0,1fr)";

	/**
	 * Whether this exercise is prescribed as a range rather than a number.
	 *
	 * Local state, seeded from the document, rather than derived from it on every
	 * render. Switching a range on has to show two empty boxes, and deriving it
	 * would mean writing a `repsMax` nobody typed just to make the boxes appear,
	 * which is the invented-number habit the rest of this screen exists to avoid.
	 *
	 * Per exercise, not per set. "Three sets of eight to twelve" is one decision
	 * and one control; a range picker on every row would be the same choice asked
	 * three times.
	 */
	const [ranged, setRanged] = useState(() =>
		sets.some((set) => set.repsMax !== undefined),
	);

	const patch = (
		index: number,
		field: "reps" | "repsMax" | "weightKg",
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
				repsMax: last?.repsMax,
				weightKg: last?.weightKg,
				...(onToggle ? { done: false } : {}),
			} as T,
		]);
	};

	/**
	 * Turn the rep target from a number into a range, or back.
	 *
	 * Switching it on writes nothing: the top boxes come up empty and stay empty
	 * until somebody fills them in. Switching it off clears every top, because a
	 * range left in the document that no screen draws is a range that comes back
	 * next time the routine is opened.
	 */
	const toggleRange = () => {
		if (ranged) {
			onChange(
				sets.map(({ repsMax: _dropped, ...set }) => set as unknown as T),
			);
		}
		setRanged(!ranged);
	};

	return (
		<div>
			<div
				className="grid items-center gap-2 pb-1 text-muted-foreground text-xs"
				style={{ gridTemplateColumns: columns }}
			>
				<span>Set</span>
				{previous && <span>Previous</span>}
				<span>Weight ({unit})</span>
				<span>{ranged && !onToggle ? "Reps (range)" : "Reps"}</span>
				{onToggle && <span className="sr-only">Done</span>}
			</div>

			{sets.map((set, index) => {
				const done = onToggle ? (set as unknown as LoggedSet).done : false;
				const type = set.type;
				const record = index === recordIndex;
				return (
					<div
						className={cn(
							"-mx-1 grid items-center gap-2 rounded-lg px-1 py-1 transition-colors",
							// The tint is the celebration; the medal is the message. A row
							// that only went green would say nothing in greyscale, to a
							// colour-blind reader, or to a screen reader (SC 1.4.1).
							record && "bg-amber-500/10",
						)}
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
								}${record ? ", and a personal record" : ""}. Change its type.`}
								className={cn(
									"flex h-7 w-8 items-center justify-center rounded-md font-medium text-sm tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
									type ? SET_TYPE[type].className : "text-muted-foreground",
									done && !type && "text-foreground",
									record && "text-amber-600 dark:text-amber-500",
								)}
							>
								{/* The medal takes the number's place, which is what every
								    training app does with it, and the number survives in the
								    label above so nobody loses which set this is. */}
								{record ? (
									<MedalIcon aria-hidden="true" className="size-4" />
								) : type ? (
									SET_TYPE[type].letter
								) : (
									workingNumber(sets, index)
								)}
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

						{previous && (
							// Read-only, and quiet. It is the number you are trying to beat,
							// not one to type into: a tappable "last time" is a tap away from
							// overwriting today's set with last week's.
							//
							// Empty on a warm-up rather than a dash: a dash says "you have no
							// history here", and about a warm-up the truthful thing to say is
							// nothing at all. The cell still renders, so the grid keeps its
							// columns lined up.
							<span className="truncate text-muted-foreground text-xs tabular-nums">
								{isCounted(set) &&
									(lastTime(previousFor(sets, previous, index), system) ?? (
										<span aria-hidden="true">—</span>
									))}
							</span>
						)}

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

						{/* Two boxes when the exercise is prescribed as a range, and only
						    on the planning screen. In a live session there is one number
						    worth having and it is what you actually did; the range you were
						    aiming at is beside it, to read rather than to edit. */}
						{ranged && !onToggle ? (
							<div className="flex min-w-0 items-center gap-1">
								<Stepper
									compact
									integer
									label={`Set ${index + 1} lowest reps for ${exerciseName}`}
									onChange={(value) => patch(index, "reps", Math.round(value))}
									onClear={() => patch(index, "reps", undefined)}
									step={1}
									value={set.reps}
								/>
								<span aria-hidden="true" className="text-muted-foreground">
									–
								</span>
								<Stepper
									compact
									integer
									label={`Set ${index + 1} highest reps for ${exerciseName}`}
									onChange={(value) =>
										patch(index, "repsMax", Math.round(value))
									}
									onClear={() => patch(index, "repsMax", undefined)}
									step={1}
									value={set.repsMax}
								/>
							</div>
						) : (
							<div className="flex min-w-0 items-center gap-1.5">
								<Stepper
									integer
									label={`Set ${index + 1} reps for ${exerciseName}`}
									onChange={(value) => patch(index, "reps", Math.round(value))}
									onClear={() => patch(index, "reps", undefined)}
									step={1}
									value={set.reps}
								/>
								{onToggle && set.repsMax !== undefined && (
									// The prescription, not a control. It is what tells somebody
									// mid-set whether nine reps was the job or one short of it.
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										<span className="sr-only">Target </span>
										{repTarget(set)}
									</span>
								)}
							</div>
						)}

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
				{/* Planning only. A live session inherits whatever the routine said,
				    and changing the prescription while standing under the bar is not
				    a thing anybody wants a button for. */}
				{!onToggle && (
					<Button
						aria-pressed={ranged}
						className="ml-auto"
						onClick={toggleRange}
						size="sm"
						type="button"
						variant="ghost"
					>
						{ranged ? "Fixed reps" : "Rep range"}
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
	compact,
	integer,
	label,
	onChange,
	onClear,
	step,
	value,
}: {
	/**
	 * Drop the buttons and keep the box.
	 *
	 * Two of these share one column when a set is prescribed as a range, and six
	 * 24 px targets across a phone leaves nothing to type into. The buttons are
	 * the affordance for nudging a weight between sets; a rep range is typed once
	 * when the block is written and not touched again.
	 */
	compact?: boolean;
	integer?: boolean;
	label: string;
	onChange: (value: number) => void;
	onClear: () => void;
	step: number;
	value: number | undefined;
}) {
	const clamp = (next: number) => Math.max(0, Math.round(next * 100) / 100);

	const box = (
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
	);

	if (compact) return box;

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
			{box}
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
