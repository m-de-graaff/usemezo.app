import { exerciseById } from "@mezo/api/exercises";
import type { WorkoutExercise } from "@mezo/api/workout-shape";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { formatDuration, formatVolume } from "~/components/workouts/summary";
import { toDisplay, unitLabel, unitSystem } from "~/lib/measure";

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
					{workout.exercises.map((entry) => {
						const exercise = exerciseById(entry.exerciseId);
						return (
							<li
								className="flex items-start gap-3 rounded-xl border bg-card p-4"
								key={entry.key}
							>
								<ExerciseThumb exerciseId={entry.exerciseId} />
								<div className="min-w-0">
									<p className="truncate font-medium capitalize">
										{exercise?.name ?? "Unknown exercise"}
									</p>
									<p className="text-muted-foreground text-sm tabular-nums">
										{entry.sets
											.map(
												(set) =>
													`${toDisplay(set.weightKg, "mass", system)} ${unit} × ${set.reps}`,
											)
											.join(", ")}
									</p>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
