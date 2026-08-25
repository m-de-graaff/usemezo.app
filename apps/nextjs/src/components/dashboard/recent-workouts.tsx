import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@mezo/ui/table";
import Link from "next/link";
import type { WorkoutSummary } from "~/components/workouts/history-list";
import {
	formatDay,
	formatDuration,
	formatVolume,
} from "~/components/workouts/summary";
import { unitSystem } from "~/lib/measure";

/**
 * The last few sessions, from the workout tables.
 *
 * There is no status column any more. A stored session is finished or it is
 * still in progress and not in this list at all; "planned" was a state the
 * mock data invented and nothing produces.
 */
export function RecentWorkouts({
	units,
	workouts,
}: {
	units: string | null | undefined;
	workouts: WorkoutSummary[];
}) {
	const system = unitSystem(units);

	return (
		<Card className="gap-0 shadow-none sm:col-span-2 dark:ring-0">
			<CardHeader className="border-b pb-4">
				<CardTitle>Recent workouts</CardTitle>
				<CardDescription>
					{workouts.length
						? `Your last ${workouts.length === 1 ? "session" : `${workouts.length} sessions`}.`
						: "Nothing logged yet."}
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				{workouts.length === 0 ? (
					<p className="px-6 py-8 text-center text-muted-foreground text-sm">
						<Link className="underline underline-offset-4" href="/workouts">
							Log your first workout
						</Link>{" "}
						and it will show up here.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="pl-6">Session</TableHead>
								<TableHead className="text-right">Volume</TableHead>
								<TableHead className="text-right">Sets</TableHead>
								<TableHead className="pr-6 text-right">Time</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{workouts.map((workout) => (
								<TableRow
									className="h-14 hover:bg-transparent"
									key={workout.id}
								>
									<TableCell className="pl-6">
										<Link
											className="font-medium underline-offset-4 hover:underline"
											href={`/workouts/${workout.id}`}
										>
											{workout.name}
										</Link>
										<span className="block text-muted-foreground text-xs">
											{formatDay(workout.startedAt)}
										</span>
									</TableCell>
									<TableCell className="text-right text-sm tabular-nums">
										{formatVolume(workout.volumeKg, system)}
									</TableCell>
									<TableCell className="text-right text-sm tabular-nums">
										{workout.setCount}
									</TableCell>
									<TableCell className="pr-6 text-right text-muted-foreground text-sm tabular-nums">
										{formatDuration(workout.durationSec)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
