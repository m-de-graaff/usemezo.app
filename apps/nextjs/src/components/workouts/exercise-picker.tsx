"use client";

import {
	BODY_PARTS,
	EQUIPMENT,
	type Exercise,
	exerciseById,
	isCustomExercise,
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
import { toast } from "@mezo/ui/sonner";
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useCatalogue } from "~/components/workouts/exercise-catalogue";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { api } from "~/trpc/react";

/** As many rows as a sheet can show before scrolling stops being browsing. */
const RESULTS = 60;

/**
 * Pick an exercise out of the catalogue.
 *
 * Search runs against the bundled list rather than the server, so typing does
 * not wait on a round trip per keystroke. What it searches is this user's view
 * of that list: their own exercises first, and nothing they have blacklisted.
 *
 * It stays open after a pick. Adding six exercises to a routine is the normal
 * case, and closing after each one means six trips through the same sheet.
 *
 * Blacklisting lives here rather than on a settings screen because here is
 * where somebody meets the exercise they never want to see again. The same
 * sheet shows the blacklist back and takes things off it, so it is not a
 * one-way door.
 */
export function ExercisePicker({
	moveable,
	onMove,
	onPick,
	trigger,
}: {
	/**
	 * Exercises already in the list, offered as a move rather than an add.
	 *
	 * Only the superset tile passes these, and it is what makes dragging one in
	 * optional rather than the only way (SC 2.5.7).
	 */
	moveable?: { exerciseId: string; key: string }[];
	onMove?: (key: string) => void;
	onPick: (exercise: Exercise) => void;
	/** The control that opens the sheet. Rendered as the trigger itself. */
	trigger: ReactElement;
}) {
	const [query, setQuery] = useState("");
	const [bodyPart, setBodyPart] = useState<string>();
	const [equipment, setEquipment] = useState<string>();
	/** Showing the blacklist instead of the catalogue. */
	const [blacklist, setBlacklist] = useState(false);

	const { custom, hidden } = useCatalogue();
	const utils = api.useUtils();
	const refresh = () => {
		void utils.exercise.catalogue.invalidate();
		void utils.exercise.hidden.invalidate();
	};
	const onError = (error: { message: string }) => toast.error(error.message);

	const hide = api.exercise.hide.useMutation({ onSuccess: refresh, onError });
	const unhide = api.exercise.unhide.useMutation({
		onSuccess: refresh,
		onError,
	});
	const remove = api.exercise.remove.useMutation({
		onSuccess: refresh,
		onError,
	});
	const busy = hide.isPending || unhide.isPending || remove.isPending;

	const results = useMemo(
		() =>
			searchExercises({
				query,
				bodyPart,
				equipment,
				custom,
				hidden,
				onlyHidden: blacklist,
				limit: RESULTS,
			}),
		[query, bodyPart, equipment, custom, hidden, blacklist],
	);

	// A blacklisted custom exercise that was then deleted has no row in either
	// list, and would otherwise be stuck hidden with nothing to press.
	const orphaned = useMemo(
		() => (blacklist ? [...hidden].filter((id) => !exerciseById(id)) : []),
		[blacklist, hidden],
	);

	return (
		<Sheet>
			<SheetTrigger render={trigger} />
			<SheetContent
				className="flex w-full flex-col gap-0 sm:max-w-md"
				side="right"
			>
				<SheetHeader>
					<SheetTitle>
						{blacklist ? "Exercises you hid" : "Add an exercise"}
					</SheetTitle>
					<SheetDescription>
						{blacklist
							? "These are never offered, here or by Milo. Your saved routines and your history still have them."
							: results.length === RESULTS
								? `Showing the first ${RESULTS}. Keep typing to narrow it.`
								: `${results.length} match${results.length === 1 ? "" : "es"}.`}
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-col gap-2 px-4 pb-3">
					<Input
						aria-label={
							blacklist ? "Search hidden exercises" : "Search exercises"
						}
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

				{moveable && moveable.length > 0 && onMove && !blacklist && (
					<div className="border-t">
						<p className="px-4 pt-3 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Move one you already have
						</p>
						<ul className="max-h-48 overflow-y-auto pb-2">
							{moveable.map((entry) => {
								const exercise = exerciseById(entry.exerciseId);
								return (
									<li key={entry.key}>
										<button
											className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
											onClick={() => onMove(entry.key)}
											type="button"
										>
											<ExerciseThumb exerciseId={entry.exerciseId} />
											<span className="min-w-0 truncate font-medium text-sm capitalize">
												{exercise?.name ?? "Unknown exercise"}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				)}

				<ul className="min-h-0 flex-1 overflow-y-auto border-t">
					{results.map((exercise) => {
						const mine = isCustomExercise(exercise.id);
						return (
							<li
								className="flex items-center gap-1 pr-2 transition-colors focus-within:bg-muted hover:bg-muted"
								key={exercise.id}
							>
								<button
									className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left focus-visible:outline-none"
									// Picking a blacklisted exercise would add the one thing this
									// list exists to keep out, so in that view the row only
									// identifies it and the button beside it is the whole point.
									disabled={blacklist}
									onClick={() => onPick(exercise)}
									type="button"
								>
									<ExerciseThumb exerciseId={exercise.id} />
									<span className="min-w-0">
										<span className="block truncate font-medium text-sm capitalize">
											{exercise.name}
											{mine && (
												<span className="ml-1.5 rounded-full border px-1.5 py-0.5 align-middle font-normal text-[10px] text-muted-foreground uppercase tracking-wide">
													Yours
												</span>
											)}
										</span>
										<span className="block truncate text-muted-foreground text-xs capitalize">
											{exercise.target} · {exercise.equipment}
										</span>
									</span>
								</button>

								{blacklist ? (
									<RowAction
										disabled={busy}
										icon={<EyeIcon aria-hidden="true" className="size-4" />}
										label={`Stop hiding ${exercise.name}`}
										onClick={() => unhide.mutate({ exerciseId: exercise.id })}
									/>
								) : mine ? (
									<RowAction
										disabled={busy}
										icon={<Trash2Icon aria-hidden="true" className="size-4" />}
										// Deleting is the right verb for your own row, and the
										// warning is the honest one: it is not a tidy-up.
										label={`Delete ${exercise.name}. Routines and sessions that used it will show it as unknown.`}
										onClick={() => remove.mutate({ id: exercise.id })}
									/>
								) : (
									<RowAction
										disabled={busy}
										icon={<EyeOffIcon aria-hidden="true" className="size-4" />}
										label={`Never offer ${exercise.name} again`}
										onClick={() => hide.mutate({ exerciseId: exercise.id })}
									/>
								)}
							</li>
						);
					})}

					{orphaned.map((id) => (
						<li className="flex items-center gap-1 py-2.5 pr-2 pl-4" key={id}>
							<span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
								An exercise you deleted, still on the list
							</span>
							<RowAction
								disabled={busy}
								icon={<EyeIcon aria-hidden="true" className="size-4" />}
								label="Clear this entry"
								onClick={() => unhide.mutate({ exerciseId: id })}
							/>
						</li>
					))}

					{results.length === 0 && orphaned.length === 0 && (
						<li className="px-4 py-8 text-center text-muted-foreground text-sm">
							{blacklist
								? "You have not hidden anything."
								: "Nothing matches. Try fewer filters, or ask Milo to add the exercise."}
						</li>
					)}
				</ul>

				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2 text-xs">
					<button
						aria-pressed={blacklist}
						className="underline-offset-4 hover:underline"
						onClick={() => setBlacklist((on) => !on)}
						type="button"
					>
						{blacklist
							? "Back to the catalogue"
							: `Hidden${hidden.size > 0 ? ` (${hidden.size})` : ""}`}
					</button>

					{/* The pictures are somebody's work, and this is the only screen
					    that shows enough of them to owe the credit. */}
					<a
						className="text-muted-foreground underline-offset-4 hover:underline"
						href={MEDIA_ATTRIBUTION.href}
						rel="noreferrer noopener"
						target="_blank"
					>
						{MEDIA_ATTRIBUTION.label}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * The icon button beside a row. Icon-only, so the label is the whole
 * description of what it does rather than the verb on its own.
 */
function RowAction({
	disabled,
	icon,
	label,
	onClick,
}: {
	disabled: boolean;
	icon: ReactElement;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-label={label}
			className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
			disabled={disabled}
			onClick={onClick}
			title={label}
			type="button"
		>
			{icon}
		</button>
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
