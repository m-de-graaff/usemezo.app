import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkoutHistoryList } from "~/components/workouts/history-list";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Workout history" };

export default async function WorkoutHistoryPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts/history");

	const [history, profile] = await Promise.all([
		api.workout.history({}),
		api.profile.get(),
	]);

	return (
		<div className="mx-auto w-full max-w-3xl">
			<WorkoutHistoryList
				heading="All workouts"
				initial={history}
				units={profile.units}
			/>
		</div>
	);
}
