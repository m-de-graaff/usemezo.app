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
	ChartLegend,
	ChartLegendContent,
} from "@mezo/ui/chart";
import { LabelList, Pie, PieChart } from "recharts";
import { macroSplit } from "~/components/dashboard/data";

const chartConfig = {
	share: { label: "Share" },
	protein: { label: "Protein", color: "var(--chart-1)" },
	carbs: { label: "Carbs", color: "var(--chart-3)" },
	fat: { label: "Fat", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function MacroSplitChart() {
	return (
		<Card className="flex flex-col shadow-none sm:col-span-2 dark:ring-0">
			<CardHeader className="space-y-1">
				<CardTitle>Macro split</CardTitle>
				<CardDescription>Share of today&rsquo;s calories.</CardDescription>
			</CardHeader>
			<CardContent className="my-auto">
				<ChartContainer
					className="mx-auto aspect-square max-h-64 w-full"
					config={chartConfig}
				>
					<PieChart accessibilityLayer>
						<Pie
							cornerRadius={8}
							data={macroSplit}
							dataKey="share"
							innerRadius={36}
							nameKey="macro"
							outerRadius="88%"
							stroke="var(--card)"
							strokeWidth={4}
						>
							<LabelList
								className="fill-background font-medium"
								dataKey="share"
								fill="currentColor"
								formatter={(label: unknown) => `${label}%`}
								position="inside"
								stroke="none"
							/>
						</Pie>
						<ChartLegend content={<ChartLegendContent nameKey="macro" />} />
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
