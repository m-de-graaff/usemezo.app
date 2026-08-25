import { Card, CardContent, CardHeader, CardTitle } from "@mezo/ui/card";
import type { Stat } from "~/components/dashboard/data";
import { Delta } from "~/components/dashboard/delta";

export function StatCards({ stats }: { stats: Stat[] }) {
	return (
		<>
			{stats.map((stat) => (
				<Card className="shadow-none dark:ring-0" key={stat.label}>
					<CardHeader>
						<CardTitle className="font-normal text-muted-foreground text-xs">
							{stat.label}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<p className="font-semibold text-2xl tabular-nums">{stat.value}</p>
						<div className="flex items-center gap-1.5 text-xs">
							<Delta lowerIsBetter={stat.lowerIsBetter} value={stat.delta} />
							<span className="text-muted-foreground">{stat.footnote}</span>
						</div>
					</CardContent>
				</Card>
			))}
		</>
	);
}
