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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mezo/ui/select";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { parseDay } from "~/components/dashboard/data";
import { formatVolume, type UnitSystem } from "~/lib/measure";

export type Day = { date: string; ml: number; targetMl: number };

const RANGES = [
	{ value: 7, label: "Last 7 days" },
	{ value: 14, label: "Last 14 days" },
	{ value: 30, label: "Last 30 days" },
];

// Two named series for one `dataKey`, because the colour is the reading: a bar
// is either over its target or under it. `ChartContainer` turns each key into a
// `--color-*` variable, which is what the cells below reach for.
const chartConfig = {
	ml: { label: "Hydration" },
	hit: { label: "On target", color: "var(--chart-1)" },
	short: { label: "Short", color: "var(--chart-3)" },
} satisfies ChartConfig;

const formatTick = (isoDate: string, days: number) =>
	parseDay(isoDate).toLocaleDateString(
		"en-GB",
		days <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" },
	);

/**
 * A bar a day, coloured by whether it cleared that day's target.
 *
 * Per-day rather than one line across all of them, because the question a
 * hydration history answers is "how often do I hit it", and a target that moves
 * with training is not a single line to draw. The colour carries the answer;
 * the tooltip carries the two numbers behind it.
 */
export function HydrationChart({
	days: all,
	system,
}: {
	days: Day[];
	system: UnitSystem;
}) {
	const [days, setDays] = useState(14);
	const rows = useMemo(() => all.slice(-days), [all, days]);

	const hit = rows.filter((row) => row.ml >= row.targetMl).length;

	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1">
					<CardTitle>History</CardTitle>
					<CardDescription>
						{hit} of {rows.length} days on target.
					</CardDescription>
				</div>
				<Select
					items={RANGES}
					onValueChange={(value) => setDays(Number(value ?? 14))}
					value={days}
				>
					<SelectTrigger
						aria-label="Hydration history range"
						className="w-full sm:w-fit"
						size="sm"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="end">
						{RANGES.map((range) => (
							<SelectItem key={range.value} value={range.value}>
								{range.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent>
				<ChartContainer className="aspect-16/9 w-full" config={chartConfig}>
					<BarChart
						accessibilityLayer
						data={rows}
						margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
					>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval="preserveStartEnd"
							minTickGap={days <= 7 ? undefined : 24}
							tickFormatter={(value: unknown) =>
								formatTick(String(value), days)
							}
							tickLine={false}
							tickMargin={8}
						/>
						<YAxis
							axisLine={false}
							tick={{ className: "tabular-nums" }}
							tickFormatter={(value: unknown) =>
								formatVolume(Number(value), system)
							}
							tickLine={false}
							tickMargin={8}
							width={48}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, _name, item) => {
										const target = Number(item?.payload?.targetMl ?? 0);
										return `${formatVolume(Number(value), system)} of ${formatVolume(target, system)}`;
									}}
									indicator="dot"
									labelFormatter={(_, payload) => {
										const date = payload?.[0]?.payload?.date;
										return date
											? parseDay(String(date)).toLocaleDateString("en-GB", {
													day: "numeric",
													month: "short",
													weekday: "short",
												})
											: "";
									}}
								/>
							}
							cursor={false}
						/>
						<Bar dataKey="ml" radius={4}>
							{rows.map((row) => (
								<Cell
									fill={
										row.ml >= row.targetMl
											? "var(--color-hit)"
											: "var(--color-short)"
									}
									key={row.date}
									// A day with nothing logged still gets a cell, so the axis
									// keeps its spacing and a gap reads as a gap.
									opacity={row.ml === 0 ? 0.25 : 1}
								/>
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
