"use client";

import { exerciseById } from "@mezo/api/exercises";
import {
	estimatedSec,
	type RoutineExercise,
	setCount,
	supersetRuns,
} from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { ArrowLeftIcon, PencilIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExerciseInfo } from "~/components/workouts/exercise-info";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { toastProgressed } from "~/components/workouts/progressed-toast";
import { Stats } from "~/components/workouts/stats";
import { describeSets, formatDuration } from "~/components/workouts/summary";
import { SupersetGroup } from "~/components/workouts/superset";
import { VolumeSummary } from "~/components/workouts/volume-summary";
import { unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/**
 * A routine, read rather than edited.
 *
 * The screen you land on from the list, and the same shape as the builder it
 * flips into: the numbers along the top, the body down the side, the exercises
 * in the middle. Editing changes what the middle column is made of, not where
 * anything is, so nothing moves under you when you press Edit.
 *
 * Nothing here is a control that could change the routine by accident, which is
 * the whole point of the split: a rep range is not something to rewrite with a
 * stray tap on a phone.
 */
export function RoutineView({
	exercises,
	hasLiveWorkout,
	id,
	name,
	note,
	onEdit,
}: {
	exercises: RoutineExercise[];
	hasLiveWorkout: boolean;
	id: string;
	name: string;
	note: string | null;
	onEdit: () => void;
}) {
	const router = useRouter();
	const profile = api.profile.get.useQuery();
	const system = unitSystem(profile.data?.units);

	const start = api.workout.start.useMutation({
		onSuccess: ({ id: workoutId, progressed }) => {
			toastProgressed(progressed);
			router.push(`/workouts/${workoutId}`);
		},
		onError: (error) => toast.error(error.message),
	});

	const row = (entry: RoutineExercise) => {
		const exercise = exerciseById(entry.exerciseId);

		return (
			<li className="flex gap-3 px-4 py-3" key={entry.key}>
				<ExerciseThumb exerciseId={entry.exerciseId} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1">
						<p className="min-w-0 flex-1 font-medium capitalize">
							{exercise?.name ?? "Unknown exercise"}
						</p>
						{/* The same note as the logging screens, on the screen somebody
						    reads before they walk to the rack. */}
						<ExerciseInfo exerciseId={entry.exerciseId} />
					</div>
					{describeSets(entry, system).map((line) => (
						<p
							className="text-muted-foreground text-sm tabular-nums"
							key={line}
						>
							{line}
						</p>
					))}
					{entry.note && (
						<p className="mt-1 whitespace-pre-line text-muted-foreground text-sm">
							{entry.note}
						</p>
					)}
				</div>
			</li>
		);
	};

	// Groups keep the rail and the letter the builder gives them, so what you set
	// up back to back still reads as back to back here.
	let group = 0;
	const rows = supersetRuns(exercises).flatMap((run) => {
		const cards = run.entries.map(row);
		if (run.id === undefined) return cards;

		return (
			<SupersetGroup index={group++} key={run.id} size={run.entries.length}>
				{cards}
			</SupersetGroup>
		);
	});

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center gap-3">
				<Button
					aria-label="Back to workouts"
					render={<Link href="/workouts" />}
					size="icon"
					variant="ghost"
				>
					<ArrowLeftIcon aria-hidden="true" />
				</Button>
				<h1 className="min-w-0 flex-1 truncate font-semibold text-xl tracking-tight">
					{name}
				</h1>
				{/* The two things you came here to do, where the page's own actions
				    live on every other screen. A panel to hold them would be a panel
				    holding two buttons. */}
				<Button
					disabled={start.isPending || hasLiveWorkout || !exercises.length}
					onClick={() =>
						start.mutate({ id: crypto.randomUUID(), routineId: id })
					}
				>
					<PlayIcon aria-hidden="true" />
					Start
				</Button>
				<Button onClick={onEdit} variant="outline">
					<PencilIcon aria-hidden="true" />
					Edit
				</Button>
			</div>

			{note && (
				<p className="whitespace-pre-line text-muted-foreground text-sm">
					{note}
				</p>
			)}

			{exercises.length > 0 && (
				<Stats
					items={[
						{ label: "Exercises", value: exercises.length },
						{ label: "Sets", value: setCount(exercises) },
						// Rest is most of a session, so a routine that looks like six
						// exercises is an hour.
						{
							label: "Estimated",
							value: `~${formatDuration(estimatedSec(exercises))}`,
						},
					]}
				/>
			)}

			{/* Same rail as the builder, in the same place: the body beside the
			    exercises so a slot you are still filling and the shoulder that is
			    already amber are read as one thought. DOM-first so it lands above
			    the list on a narrow screen rather than forty exercises below it. */}
			<div className="flex flex-col gap-6 lg:flex-row">
				{exercises.length > 0 && (
					<aside className="lg:order-last lg:w-60 lg:shrink-0">
						{/* `top-18` is the app header's `h-14` plus the page's gap: the
						    header is sticky too, and anything stopping short of it gets
						    its own top sliced off. */}
						<div className="rounded-xl border bg-card p-4 lg:sticky lg:top-18">
							<VolumeSummary
								exercises={exercises.map((entry) => ({
									exerciseId: entry.exerciseId,
									// Warm-ups are training, not volume, exactly as they are
									// everywhere else the app counts a set.
									sets: entry.sets.filter((set) => set.type !== "warmup")
										.length,
								}))}
							/>
						</div>
					</aside>
				)}

				<div className="min-w-0 flex-1">
					{exercises.length === 0 ? (
						<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
							No exercises yet. Edit this routine to add the first one.
						</p>
					) : (
						<ul className="divide-y overflow-hidden rounded-xl border bg-card">
							{rows}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
