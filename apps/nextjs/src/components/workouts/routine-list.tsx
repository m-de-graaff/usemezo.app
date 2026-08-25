"use client";

import type { RoutineExercise } from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { PencilIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { summariseRoutine } from "~/components/workouts/summary";
import { api } from "~/trpc/react";

type Row = {
	id: string;
	name: string;
	exercises: RoutineExercise[];
};

/**
 * Every routine, each one tap from being under way.
 *
 * Start is disabled rather than hidden while a session is live: hiding it
 * leaves somebody hunting for a button that was there a minute ago, and the
 * banner above already says why.
 */
export function RoutineList({
	hasLiveWorkout,
	routines,
}: {
	hasLiveWorkout: boolean;
	routines: Row[];
}) {
	const router = useRouter();

	const start = api.workout.start.useMutation({
		onSuccess: ({ id }) => router.push(`/workouts/${id}`),
		onError: (error) => toast.error(error.message),
	});

	return (
		<section>
			<h2 className="mb-3 font-medium text-sm">Routines</h2>

			{routines.length === 0 ? (
				<p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
					No routines yet. Build one, or ask Milo for one.
				</p>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2">
					{routines.map((routine) => (
						<li
							className="flex flex-col gap-3 rounded-xl border bg-card p-4"
							key={routine.id}
						>
							<div className="min-w-0">
								<p className="truncate font-medium">{routine.name}</p>
								<p className="line-clamp-2 text-muted-foreground text-sm capitalize">
									{summariseRoutine(routine.exercises)}
								</p>
							</div>
							<div className="mt-auto flex gap-2">
								<Button
									className="flex-1"
									disabled={start.isPending || hasLiveWorkout}
									onClick={() =>
										start.mutate({
											id: crypto.randomUUID(),
											routineId: routine.id,
										})
									}
								>
									<PlayIcon aria-hidden="true" />
									Start
								</Button>
								<Button
									aria-label={`Edit ${routine.name}`}
									render={<Link href={`/workouts/routines/${routine.id}`} />}
									size="icon"
									variant="outline"
								>
									<PencilIcon aria-hidden="true" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
