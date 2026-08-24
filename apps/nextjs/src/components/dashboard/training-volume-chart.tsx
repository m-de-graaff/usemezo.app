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
import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { parseDay, trainingVolume } from "~/components/dashboard/data";
import { Delta } from "~/components/dashboard/delta";

const RANGES = [
	{ value: 7, label: "Last 7 days" },
	{ value: 30, label: "Last 30 days" },
	{ value: 90, label: "Last 90 days" },
];

const chartConfig = {
	value: { label: "Volume (kg)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const formatTick = (isoDate: string, days: number) =>
	parseDay(isoDate).toLocaleDateString("en-GB", {
		...(days <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" }),
	});

export function TrainingVolumeChart() {
	// `useId` contains colons, which are not valid in an SVG fragment reference.
	const gradientId = `training-volume-${useId().replace(/:/g, "")}`;
	const [days, setDays] = useState(30);

	const rows = useMemo(() => trainingVolume.slice(-days), [days]);
	const change = useMemo(() => {
		const first = rows[0]?.value ?? 0;
		const last = rows.at(-1)?.value ?? 0;
		return first ? ((last - first) / first) * 100 : 0;
	}, [rows]);

	return (
		<Card className="shadow-none sm:col-span-2 lg:col-span-4 dark:ring-0">
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle>Training volume</CardTitle>
						<Delta badge value={change} />
					</div>
					<CardDescription>
						Total weight moved per session day, in kilograms.
					</CardDescription>
				</div>
				<Select
					items={RANGES}
					onValueChange={(value) => setDays(value ?? 30)}
					value={days}
				>
					<SelectTrigger
						aria-label="Training volume range"
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
				<ChartContainer className="aspect-22/8 w-full" config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={rows}
						margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-value)"
									stopOpacity={0.45}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-value)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval={days <= 7 ? 0 : "preserveStartEnd"}
							minTickGap={days <= 7 ? undefined : 28}
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
								`${Math.round(Number(value) / 1000)}k`
							}
							tickLine={false}
							tickMargin={8}
							width={36}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									indicator="line"
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
						<Area
							dataKey="value"
							dot={false}
							fill={`url(#${gradientId})`}
							stroke="var(--color-value)"
							strokeWidth={2}
							type="natural"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
