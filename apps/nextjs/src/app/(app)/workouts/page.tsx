import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkoutHistoryList } from "~/components/workouts/history-list";
import { RoutineList } from "~/components/workouts/routine-list";
import { StartWorkout } from "~/components/workouts/start-workout";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Workouts | Mezo" };

/** How many past sessions the home screen previews before "All workouts". */
const PREVIEW = 5;

export default async function WorkoutsPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts");

	// One round of reads rather than four waterfalls. Nothing here depends on
	// anything else here.
	const [active, routines, history, profile] = await Promise.all([
		api.workout.active(),
		api.workout.routines(),
		api.workout.history({ limit: PREVIEW }),
		api.profile.get(),
	]);

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<StartWorkout
				active={active ? { id: active.id, name: active.name } : null}
				hasRoutines={routines.length > 0}
			/>
			<RoutineList
				hasLiveWorkout={active !== null}
				routines={routines.map((routine) => ({
					id: routine.id,
					name: routine.name,
					exercises: routine.exercises,
				}))}
			/>
			<WorkoutHistoryList
				heading="Recent"
				initial={history}
				linkToAll
				units={profile.units}
			/>
		</div>
	);
}
