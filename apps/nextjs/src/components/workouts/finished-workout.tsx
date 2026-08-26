import { exerciseById } from "@mezo/api/exercises";
import { supersetRuns, type WorkoutExercise } from "@mezo/api/workout-shape";
import { cn } from "@mezo/ui/lib/utils";
import { ConfirmSet } from "~/components/workouts/confirm-set";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { Stats } from "~/components/workouts/stats";
import { formatDuration, formatVolume } from "~/components/workouts/summary";
import { supersetLabel } from "~/components/workouts/superset";
import {
	toDisplay,
	type UnitSystem,
	unitLabel,
	unitSystem,
} from "~/lib/measure";

/**
 * One set, read back.
 *
 * Spelled out rather than the W and F of the logging screen: this is prose
 * somebody is reading, not a control they are operating. A number nobody
 * entered shows as a dash, because a set logged without one is not a set of
 * zero.
 */
const describeSet =
	(system: UnitSystem, unit: string) =>
	(set: WorkoutExercise["sets"][number]) => {
		const weight =
			set.weightKg === undefined
				? "–"
				: `${toDisplay(set.weightKg, "mass", system)} ${unit}`;
		const line = `${weight} × ${set.reps ?? "–"}`;
		if (set.type === "warmup") return `${line} warm-up`;
		if (set.type === "failure") return `${line} to failure`;
		return line;
	};

/**
 * The sets of one exercise, a row each.
 *
 * A row each rather than one comma-separated line. Reading a session back is
 * comparing set three to set one — did it hold, did it drop — and a sentence
 * makes that a counting exercise while a column makes it a glance. The numbers
 * are the only thing that changes between rows, so they line up: `tabular-nums`
 * and a fixed first column are what let somebody read down them.
 *
 * Working sets are numbered among themselves, exactly as they are on the
 * logging screen. A warm-up sitting first must not push the first working set
 * to "2": that is the number the lifter counted at the time.
 */
function SetList({
	entryKey,
	sets,
	system,
	unit,
	workoutId,
}: {
	entryKey: string;
	sets: WorkoutExercise["sets"];
	system: UnitSystem;
	unit: string;
	workoutId: string;
}) {
	const describe = describeSet(system, unit);
	let working = 0;

	return (
		<ol className="mt-1.5">
			{sets.map((set, index) => {
				const warmup = set.type === "warmup";
				if (!warmup) working += 1;

				return (
					<li
						className="flex items-baseline gap-3 py-0.5 text-sm"
						// A finished session is a record: this list is rendered once and
						// nothing ever reorders it.
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={index}
					>
						{/* The letter carries the type, not the colour, so a warm-up is
						    still a warm-up in greyscale and to a screen reader (SC 1.4.1). */}
						<span
							className={cn(
								"w-4 shrink-0 text-xs tabular-nums",
								warmup
									? "text-amber-600 dark:text-amber-500"
									: "text-muted-foreground",
							)}
						>
							{warmup ? "W" : working}
						</span>
						<span className="tabular-nums">{describe(set)}</span>
						{/* Stated in words next to the set rather than drawn as a badge
						    somewhere else. The sentence is the whole explanation of why
						    this one is not on the medal table, and the button beside it is
						    the whole of putting it back. */}
						{set.flag === "suspect" && (
							<span className="flex items-baseline gap-1 text-muted-foreground text-xs">
								Not counted toward records
								<ConfirmSet
									index={index}
									setKey={entryKey}
									workoutId={workoutId}
								/>
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}

/** A session that is over. Read-only on purpose: history is not a draft. */
export function FinishedWorkout({
	units,
	workout,
}: {
	units: string | null | undefined;
	workout: {
		id: string;
		name: string;
		note: string | null;
		startedAt: Date;
		volumeKg: number;
		setCount: number;
		durationSec: number;
		exercises: WorkoutExercise[];
	};
}) {
	const system = unitSystem(units);
	const unit = unitLabel("mass", system) ?? "kg";
	// Counted over the supersets rather than over every run, so the first pair in
	// a session is always A whatever ran on its own before it.
	let group = 0;

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<header className="rounded-xl border bg-card p-4">
				<h1 className="font-semibold text-lg tracking-tight">{workout.name}</h1>
				<p className="text-muted-foreground text-sm">
					{workout.startedAt.toLocaleDateString("en-GB", {
						day: "numeric",
						month: "long",
						weekday: "long",
						year: "numeric",
					})}
				</p>
				<div className="mt-3">
					<Stats
						items={[
							{
								label: "Duration",
								value: formatDuration(workout.durationSec),
							},
							{ label: "Sets", value: workout.setCount },
							{
								label: "Volume",
								value: formatVolume(workout.volumeKg, system),
							},
						]}
					/>
				</div>
				{workout.note && (
					<p className="mt-3 text-sm leading-relaxed">{workout.note}</p>
				)}
			</header>

			{workout.exercises.length === 0 ? (
				<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
					Nothing was logged in this session.
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{supersetRuns(workout.exercises).flatMap((run) => {
						const label =
							run.entries.length > 1 ? supersetLabel(group++) : null;
						return run.entries.map((entry) => {
							const exercise = exerciseById(entry.exerciseId);
							return (
								<li
									className="flex items-start gap-3 rounded-xl border bg-card p-4"
									key={entry.key}
								>
									<ExerciseThumb exerciseId={entry.exerciseId} />
									<div className="min-w-0">
										{/* A finished session is read only, so the pairing is
										    stated rather than drawn as a frame to work inside. */}
										{label && (
											<p className="text-muted-foreground text-xs uppercase tracking-wide">
												Superset {label}
											</p>
										)}
										<p className="truncate font-medium capitalize">
											{exercise?.name ?? "Unknown exercise"}
										</p>
										{/* Whatever was noted on this exercise, by the lifter
										    mid-session or by Milo after it. Above the sets, where the
										    same line sits on the logging screen: underneath them it
										    reads as a caption on the numbers rather than the plan. */}
										{entry.note && (
											<p className="mt-0.5 text-muted-foreground text-sm leading-relaxed">
												{entry.note}
											</p>
										)}
										<SetList
											entryKey={entry.key}
											sets={entry.sets}
											system={system}
											unit={unit}
											workoutId={workout.id}
										/>
									</div>
								</li>
							);
						});
					})}
				</ul>
			)}
		</div>
	);
}
