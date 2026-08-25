import { exerciseById } from "@mezo/api/exercises";
import { supersetRuns, type WorkoutExercise } from "@mezo/api/workout-shape";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
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

/** A session that is over. Read-only on purpose: history is not a draft. */
export function FinishedWorkout({
	units,
	workout,
}: {
	units: string | null | undefined;
	workout: {
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
				<dl className="mt-3 flex gap-6 text-sm">
					<div>
						<dt className="text-muted-foreground text-xs">Duration</dt>
						<dd className="tabular-nums">
							{formatDuration(workout.durationSec)}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Sets</dt>
						<dd className="tabular-nums">{workout.setCount}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Volume</dt>
						<dd className="tabular-nums">
							{formatVolume(workout.volumeKg, system)}
						</dd>
					</div>
				</dl>
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
										<p className="text-muted-foreground text-sm tabular-nums">
											{entry.sets.map(describeSet(system, unit)).join(", ")}
										</p>
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
