import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkoutHistoryList } from "~/components/workouts/history-list";
import { RoutineList } from "~/components/workouts/routine-list";
import { StartWorkout } from "~/components/workouts/start-workout";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Workouts" };

/** How many past sessions the home screen previews before "All workouts". */
const PREVIEW = 5;

export default async function WorkoutsPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts");

	// One round of reads rather than five waterfalls. Nothing here depends on
	// anything else here.
	const [active, routines, folders, history, profile] = await Promise.all([
		api.workout.active(),
		api.workout.routines(),
		api.workout.folders(),
		api.workout.history({ limit: PREVIEW }),
		api.profile.get(),
	]);

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			{/* The one control the screen exists for, in its heading rather than in
			    a card of its own: a panel whose whole job is to hold one button is
			    a screenful spent on a button. */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-semibold text-xl tracking-tight">Workouts</h1>
				<StartWorkout
					active={active ? { id: active.id, name: active.name } : null}
				/>
			</div>

			<RoutineList
				folders={folders.map((folder) => ({
					id: folder.id,
					name: folder.name,
				}))}
				hasLiveWorkout={active !== null}
				routines={routines.map((routine) => ({
					id: routine.id,
					name: routine.name,
					folderId: routine.folderId,
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
