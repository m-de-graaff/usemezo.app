"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@mezo/ui/chart";
import { Bar, BarChart, Rectangle, XAxis } from "recharts";
import { sleepNights } from "~/components/dashboard/data";

const chartConfig = {
	deep: { label: "Deep", color: "var(--chart-1)" },
	rem: { label: "REM", color: "var(--chart-3)" },
	core: { label: "Core", color: "var(--chart-5)" },
} satisfies ChartConfig;

/** Half the bar width, so the stack's ends read as rounded caps. */
const BAR_RADIUS = 5;

export function SleepStagesChart() {
	return (
		<Card className="shadow-none sm:col-span-2 dark:ring-0">
			<CardHeader className="space-y-1">
				<CardTitle>Sleep stages</CardTitle>
				<CardDescription>Hours per stage, last 10 nights.</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-video w-full" config={chartConfig}>
					<BarChart accessibilityLayer data={sleepNights}>
						<XAxis
							axisLine={false}
							dataKey="night"
							interval={0}
							tickLine={false}
							tickMargin={10}
						/>
						<ChartTooltip
							content={<ChartTooltipContent />}
							cursor={
								<Rectangle
									fill="var(--muted)"
									fillOpacity={0.5}
									radius={BAR_RADIUS * 2}
									stroke="none"
								/>
							}
						/>
						<Bar
							background={{ fill: "var(--muted)", radius: BAR_RADIUS }}
							barSize={10}
							dataKey="core"
							fill="var(--color-core)"
							radius={[0, 0, BAR_RADIUS, BAR_RADIUS]}
							stackId="sleep"
						/>
						<Bar
							barSize={10}
							dataKey="rem"
							fill="var(--color-rem)"
							radius={0}
							stackId="sleep"
						/>
						<Bar
							barSize={10}
							dataKey="deep"
							fill="var(--color-deep)"
							radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
							stackId="sleep"
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
