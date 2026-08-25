import { getSession } from "@mezo/auth/server";
import { redirect } from "next/navigation";
import { DailyTargets } from "~/components/dashboard/daily-targets";
import { fakeStats, type Stat } from "~/components/dashboard/data";
import { MacroSplitChart } from "~/components/dashboard/macro-split-chart";
import { RecentWorkouts } from "~/components/dashboard/recent-workouts";
import { SleepStagesChart } from "~/components/dashboard/sleep-stages-chart";
import { StatCards } from "~/components/dashboard/stat-cards";
import { TrainingVolumeChart } from "~/components/dashboard/training-volume-chart";
import { formatVolume } from "~/components/workouts/summary";
import { unitSystem } from "~/lib/measure";
import { api } from "~/trpc/server";

/**
 * Nothing to compare against is not a 100% rise, and it is not a fall either.
 * A first week of training should read as no change rather than as a number
 * that will never be beaten again.
 */
const percentChange = (now: number, before: number) =>
	before ? ((now - before) / before) * 100 : 0;

export default async function DashboardPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/dashboard");

	const [stats, profile] = await Promise.all([
		api.workout.stats(),
		api.profile.get(),
	]);
	const system = unitSystem(profile.units);

	// Two of the four cards are real. Sleep and resting heart rate are still
	// invented; see `~/components/dashboard/data.ts`.
	const cards: Stat[] = [
		{
			label: "Weekly volume",
			value: formatVolume(stats.weekVolumeKg, system),
			delta: percentChange(stats.weekVolumeKg, stats.prevWeekVolumeKg),
			footnote: "vs the week before",
		},
		{
			label: "Sessions",
			value: String(stats.weekSessions),
			delta: percentChange(stats.weekSessions, stats.prevWeekSessions),
			footnote: "last 7 days",
		},
		...fakeStats,
	];

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCards stats={cards} />
			<TrainingVolumeChart rows={stats.volume} />
			<MacroSplitChart />
			<SleepStagesChart />
			<RecentWorkouts units={profile.units} workouts={stats.recent} />
			<DailyTargets />
		</div>
	);
}
