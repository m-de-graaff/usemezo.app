"use client";

import {
	BODY_PARTS,
	EQUIPMENT,
	type Exercise,
	MEDIA_ATTRIBUTION,
	searchExercises,
} from "@mezo/api/exercises";
import { Input } from "@mezo/ui/input";
import { cn } from "@mezo/ui/lib/utils";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@mezo/ui/sheet";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";

/** As many rows as a sheet can show before scrolling stops being browsing. */
const RESULTS = 60;

/**
 * Pick an exercise out of the catalogue.
 *
 * Search runs against the bundled list rather than the server, so typing does
 * not wait on a round trip per keystroke.
 *
 * It stays open after a pick. Adding six exercises to a routine is the normal
 * case, and closing after each one means six trips through the same sheet.
 */
export function ExercisePicker({
	onPick,
	trigger,
}: {
	onPick: (exercise: Exercise) => void;
	/** The control that opens the sheet. Rendered as the trigger itself. */
	trigger: ReactElement;
}) {
	const [query, setQuery] = useState("");
	const [bodyPart, setBodyPart] = useState<string>();
	const [equipment, setEquipment] = useState<string>();

	const results = useMemo(
		() => searchExercises({ query, bodyPart, equipment, limit: RESULTS }),
		[query, bodyPart, equipment],
	);

	return (
		<Sheet>
			<SheetTrigger render={trigger} />
			<SheetContent
				className="flex w-full flex-col gap-0 sm:max-w-md"
				side="right"
			>
				<SheetHeader>
					<SheetTitle>Add an exercise</SheetTitle>
					<SheetDescription>
						{results.length === RESULTS
							? `Showing the first ${RESULTS}. Keep typing to narrow it.`
							: `${results.length} match${results.length === 1 ? "" : "es"}.`}
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-col gap-2 px-4 pb-3">
					<Input
						aria-label="Search exercises"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Bench press, squat, curl…"
						type="search"
						value={query}
					/>
					<ChipRow
						label="Body part"
						onChange={setBodyPart}
						options={BODY_PARTS}
						value={bodyPart}
					/>
					<ChipRow
						label="Equipment"
						onChange={setEquipment}
						options={EQUIPMENT}
						value={equipment}
					/>
				</div>

				<ul className="min-h-0 flex-1 overflow-y-auto border-t">
					{results.map((exercise) => (
						<li key={exercise.id}>
							<button
								className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
								onClick={() => onPick(exercise)}
								type="button"
							>
								<ExerciseThumb exerciseId={exercise.id} />
								<span className="min-w-0">
									<span className="block truncate font-medium text-sm capitalize">
										{exercise.name}
									</span>
									<span className="block truncate text-muted-foreground text-xs capitalize">
										{exercise.target} · {exercise.equipment}
									</span>
								</span>
							</button>
						</li>
					))}
					{results.length === 0 && (
						<li className="px-4 py-8 text-center text-muted-foreground text-sm">
							Nothing matches. Try fewer filters.
						</li>
					)}
				</ul>

				{/* The pictures are somebody's work, and this is the only screen that
				    shows enough of them to owe the credit. */}
				<p className="border-t px-4 py-2 text-muted-foreground text-xs">
					<a
						className="underline-offset-4 hover:underline"
						href={MEDIA_ATTRIBUTION.href}
						rel="noreferrer noopener"
						target="_blank"
					>
						{MEDIA_ATTRIBUTION.label}
					</a>
				</p>
			</SheetContent>
		</Sheet>
	);
}

/**
 * A single-select row of filter chips. `aria-pressed` rather than colour alone
 * is what says which one is on.
 */
function ChipRow({
	label,
	onChange,
	options,
	value,
}: {
	label: string;
	onChange: (next: string | undefined) => void;
	options: readonly string[];
	value: string | undefined;
}) {
	return (
		// A scrolling chip row with a native scrollbar under it is two controls
		// where there should be one, and on Windows the bar comes with arrows.
		<fieldset className="flex min-w-0 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<legend className="sr-only">{label}</legend>
			{options.map((option) => {
				const on = option === value;
				return (
					<button
						aria-pressed={on}
						className={cn(
							"min-h-6 shrink-0 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
							on
								? "border-primary bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted",
						)}
						key={option}
						onClick={() => onChange(on ? undefined : option)}
						type="button"
					>
						{option}
					</button>
				);
			})}
		</fieldset>
	);
}
