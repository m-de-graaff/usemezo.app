import { getSession } from "@mezo/auth/server";
import { redirect } from "next/navigation";
import { DailyTargets } from "~/components/dashboard/daily-targets";
import { MacroSplitChart } from "~/components/dashboard/macro-split-chart";
import { RecentWorkouts } from "~/components/dashboard/recent-workouts";
import { SleepStagesChart } from "~/components/dashboard/sleep-stages-chart";
import { StatCards } from "~/components/dashboard/stat-cards";
import { TrainingVolumeChart } from "~/components/dashboard/training-volume-chart";

export default async function DashboardPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/dashboard");

	// Everything below is hardcoded — see `~/components/dashboard/data.ts`.
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCards />
			<TrainingVolumeChart />
			<MacroSplitChart />
			<SleepStagesChart />
			<RecentWorkouts />
			<DailyTargets />
		</div>
	);
}
