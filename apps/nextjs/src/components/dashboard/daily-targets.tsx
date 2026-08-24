import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { cn } from "@mezo/ui/lib/utils";
import { dailyTargets } from "~/components/dashboard/data";

const format = (value: number, unit: string) =>
	`${value.toLocaleString("en-GB")}${unit ? ` ${unit}` : ""}`;

export function DailyTargets() {
	return (
		<Card className="shadow-none sm:col-span-2 dark:ring-0">
			<CardHeader className="space-y-1">
				<CardTitle>Today&rsquo;s targets</CardTitle>
				<CardDescription>Where you are against the plan.</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col gap-5">
					{dailyTargets.map((target) => {
						const pct = Math.round((target.current / target.goal) * 100);
						const hit = target.current >= target.goal;

						return (
							<li className="space-y-2" key={target.label}>
								<div className="flex items-baseline justify-between gap-2 text-sm">
									<span className="font-medium">{target.label}</span>
									<span className="text-muted-foreground tabular-nums">
										{format(target.current, target.unit)}
										<span className="text-muted-foreground/60">
											{" / "}
											{format(target.goal, target.unit)}
										</span>
									</span>
								</div>
								<div
									aria-label={`${target.label}: ${pct}% of goal`}
									aria-valuemax={100}
									aria-valuemin={0}
									aria-valuenow={pct}
									className="h-2 w-full overflow-hidden rounded-full bg-muted"
									role="progressbar"
								>
									<div
										className={cn(
											"h-full rounded-full",
											hit ? "bg-emerald-500" : "bg-primary",
										)}
										// The bar caps at 100% so overshooting a goal does not
										// blow out the track.
										style={{ width: `${Math.min(pct, 100)}%` }}
									/>
								</div>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
