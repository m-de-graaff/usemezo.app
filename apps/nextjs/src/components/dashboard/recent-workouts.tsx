import { Badge } from "@mezo/ui/badge";
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
import {
	parseDay,
	recentWorkouts,
	type Workout,
} from "~/components/dashboard/data";

const STATE: Record<
	Workout["state"],
	{ label: string; variant: "secondary" | "outline" | "destructive" }
> = {
	completed: { label: "Done", variant: "secondary" },
	partial: { label: "Cut short", variant: "destructive" },
	planned: { label: "Planned", variant: "outline" },
};

const formatDay = (isoDate: string) =>
	parseDay(isoDate).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
	});

export function RecentWorkouts() {
	return (
		<Card className="gap-0 shadow-none sm:col-span-2 dark:ring-0">
			<CardHeader className="border-b pb-4">
				<CardTitle>Recent workouts</CardTitle>
				<CardDescription>Your last four sessions.</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="pl-6">Session</TableHead>
							<TableHead className="hidden sm:table-cell">Focus</TableHead>
							<TableHead className="text-right">Volume</TableHead>
							<TableHead className="text-right">Time</TableHead>
							<TableHead className="pr-6 text-right">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{recentWorkouts.map((workout) => (
							<TableRow
								className="h-14 hover:bg-transparent"
								key={workout.date}
							>
								<TableCell className="pl-6">
									<span className="font-medium">{workout.name}</span>
									<span className="block text-muted-foreground text-xs">
										{formatDay(workout.date)}
									</span>
								</TableCell>
								<TableCell className="hidden max-w-40 sm:table-cell">
									<span className="line-clamp-1 text-muted-foreground text-sm">
										{workout.focus}
									</span>
								</TableCell>
								<TableCell className="text-right text-sm tabular-nums">
									{workout.volumeKg
										? `${workout.volumeKg.toLocaleString("en-GB")} kg`
										: "n/a"}
								</TableCell>
								<TableCell className="text-right text-muted-foreground text-sm tabular-nums">
									{workout.durationMinutes}m
								</TableCell>
								<TableCell className="pr-6 text-right">
									<Badge variant={STATE[workout.state].variant}>
										{STATE[workout.state].label}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
