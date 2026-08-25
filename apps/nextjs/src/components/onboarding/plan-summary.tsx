"use client";

import { buildPlan } from "@mezo/api/plan";
import { Button } from "@mezo/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@mezo/ui/chart";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { cn } from "@mezo/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { SettingsValues } from "~/components/settings/settings-form";

const MICRO =
	"font-medium text-[0.6875rem] uppercase leading-none tracking-[0.16em]";

/** Kept in step with `SCREEN_BODY` in `onboarding-flow.tsx`. */
const SCREEN_BODY =
	"flex flex-1 flex-col items-center justify-center py-8 text-center";

/** What each band is called on the page. Never the only signal — see below. */
const BMI_BAND: Record<string, string> = {
	underweight: "Underweight",
	healthy: "Healthy range",
	overweight: "Overweight",
	obese: "Obese",
};

/**
 * The payoff screen: what the answers work out to.
 *
 * The one rule it exists to keep is that it never invents a number. Everything
 * on it comes from `@mezo/api/plan`, and when that says it is missing an input,
 * this says which one instead of filling the space with something plausible.
 */
export function PlanSummary({
	values,
	pending,
	onFinish,
}: {
	values: SettingsValues;
	pending: boolean;
	onFinish: (dailyCalories: number | null) => void;
}) {
	const plan = buildPlan({
		activityLevel: asString(values.activityLevel),
		birthDate: asString(values.birthDate),
		gender: asString(values.gender),
		goalDirection: asString(values.goalDirection),
		heightCm: asNumber(values.heightCm),
		targetWeightKg: asNumber(values.targetWeightKg),
		weightKg: asNumber(values.weightKg),
	});

	if (!plan.ok)
		return (
			<Incomplete
				missing={plan.missing}
				onFinish={onFinish}
				pending={pending}
			/>
		);

	return <Complete onFinish={onFinish} pending={pending} plan={plan} />;
}

const asString = (value: unknown) =>
	typeof value === "string" ? value : undefined;
const asNumber = (value: unknown) =>
	typeof value === "number" ? value : undefined;

function Complete({
	plan,
	pending,
	onFinish,
}: {
	plan: Extract<ReturnType<typeof buildPlan>, { ok: true }>;
	pending: boolean;
	onFinish: (dailyCalories: number | null) => void;
}) {
	const id = useId();
	// Seeded from the calculation and editable before it is saved: it is an
	// estimate, and someone who already knows their number should not have to
	// go and correct ours in Settings straight afterwards.
	const [calories, setCalories] = useState(String(plan.calories));
	const parsed = Number.parseInt(calories, 10);
	const valid = Number.isFinite(parsed) && parsed >= 500 && parsed <= 10000;

	return (
		<div className="flex flex-1 flex-col">
			<div className={SCREEN_BODY}>
				<p className={cn(MICRO, "text-muted-foreground")}>Your starting plan</p>
				{/* `tabIndex` so the flow can move focus here on the screen change; it
			    finds this by tag, which is why every branch has exactly one. */}
				<h1
					className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
					tabIndex={-1}
				>
					Here is where to start
				</h1>
				<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
					Built from what you told us about your body, your week and what you
					are aiming at. A starting point to adjust from, not medical advice.
				</p>

				<div className="mt-8 grid w-full gap-3">
					{/* The number the whole flow was for, as an editable field rather
				    than a readout with an edit affordance hidden behind it. */}
					<div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
						<Label className={cn(MICRO, "text-muted-foreground")} htmlFor={id}>
							Daily calories
						</Label>
						{/* Centred as one unit: the field and its unit read as the number
						    on the screen, not as a form control that happens to be big. */}
						<div className="mt-4 flex items-baseline justify-center gap-2">
							<Input
								aria-describedby={`${id}-note`}
								className="h-auto w-[4.5ch] border-0 bg-transparent p-0 text-center font-semibold text-6xl tabular-nums tracking-[-0.04em] shadow-none [-moz-appearance:textfield] focus-visible:ring-0 md:text-6xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								id={id}
								max={10000}
								min={500}
								onChange={(event) => setCalories(event.target.value)}
								step={10}
								type="number"
								value={calories}
							/>
							<span className="font-medium text-muted-foreground text-xl">
								kcal
							</span>
						</div>
						<p
							className="mx-auto mt-3 max-w-sm text-muted-foreground text-xs"
							id={`${id}-note`}
							// The floor notice is a correction to the number above it, so it
							// has to reach someone who is not looking at the number.
							role={plan.atFloor ? "status" : undefined}
						>
							{plan.atFloor
								? "Raised to a safe minimum. The deficit your goal implied was lower than anyone should eat for long."
								: "Our recommendation from your answers. Change it if you already know your number, and again in Settings whenever it changes."}
						</p>
						{!valid && (
							<p className="mt-2 text-destructive text-xs" role="alert">
								Enter a number between 500 and 10,000 kcal.
							</p>
						)}
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<Macros carbs={plan.carbs} fat={plan.fat} protein={plan.protein} />
						<Energy bmr={plan.bmr} calories={plan.calories} tdee={plan.tdee} />
					</div>

					<BmiScale band={plan.bmiBand} value={plan.bmi} />

					<dl className="flex flex-wrap justify-center gap-x-12 gap-y-4 rounded-2xl border border-border p-5 text-center">
						<Stat label="Age" value={`${plan.age}`} />
						<Stat label="Water" value={`${plan.waterMl / 1000} L`} />
						{plan.weeksToTarget !== null && (
							<Stat
								label="To your target"
								value={`about ${plan.weeksToTarget} weeks`}
							/>
						)}
					</dl>

					<p className="text-pretty text-muted-foreground text-xs leading-relaxed">
						BMI does not know the difference between muscle and fat, so a
						well-trained body reads high on it. Treat it as one number among
						several, not a verdict.
					</p>
				</div>
			</div>

			<Finish
				disabled={!valid}
				onFinish={() => onFinish(valid ? parsed : null)}
				pending={pending}
			/>
		</div>
	);
}

/** Four calories to a gram of protein or carbohydrate, nine to a gram of fat. */
const KCAL_PER_GRAM = { carbs: 4, fat: 9, protein: 4 } as const;

/**
 * Three weights of the same ink rather than three hues. The chart palette is
 * one fixed set of greys across both themes, so half of it disappears into
 * whichever background it lands on; `foreground` is the colour that flips.
 */
const MACRO_CHART = {
	protein: { label: "Protein", color: "var(--foreground)" },
	carbs: {
		label: "Carbs",
		color: "color-mix(in oklab, var(--foreground) 55%, transparent)",
	},
	fat: {
		label: "Fat",
		color: "color-mix(in oklab, var(--foreground) 28%, transparent)",
	},
} satisfies ChartConfig;

/**
 * The split, as the share of the day's calories each macro is — which is the
 * thing a ring can show and a row of three numbers cannot. The grams are still
 * spelled out beside it, because grams are what anyone actually weighs out.
 */
function Macros({
	protein,
	carbs,
	fat,
}: {
	protein: number;
	carbs: number;
	fat: number;
}) {
	const grams = { carbs, fat, protein };
	const slices = (["protein", "carbs", "fat"] as const).map((key) => ({
		key,
		grams: grams[key],
		kcal: grams[key] * KCAL_PER_GRAM[key],
		label: MACRO_CHART[key].label,
	}));
	const total = slices.reduce((sum, slice) => sum + slice.kcal, 0);

	return (
		<div className="rounded-2xl border border-border p-5 text-left">
			<p className={cn(MICRO, "text-muted-foreground")}>Macro split</p>
			<div className="mt-3 flex items-center gap-4">
				<div className="shrink-0">
					<ChartContainer
						className="aspect-square h-28 w-28"
						config={MACRO_CHART}
					>
						<PieChart>
							<ChartTooltip content={<ChartTooltipContent hideLabel />} />
							<Pie
								data={slices}
								dataKey="kcal"
								innerRadius="62%"
								nameKey="key"
								outerRadius="100%"
								paddingAngle={2}
								strokeWidth={0}
							>
								{slices.map((slice) => (
									<Cell fill={`var(--color-${slice.key})`} key={slice.key} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
				</div>

				<dl className="min-w-0 flex-1 space-y-2">
					{slices.map((slice) => (
						<div className="flex items-center gap-2" key={slice.key}>
							<span
								aria-hidden="true"
								className="size-2.5 shrink-0 rounded-[3px]"
								style={{ background: MACRO_CHART[slice.key].color }}
							/>
							<dt className="flex-1 text-muted-foreground text-xs">
								{slice.label}
							</dt>
							<dd className="font-medium text-sm tabular-nums">
								{slice.grams} g
								<span className="ml-1.5 text-muted-foreground text-xs">
									{Math.round((slice.kcal / total) * 100)}%
								</span>
							</dd>
						</div>
					))}
				</dl>
			</div>
		</div>
	);
}

/**
 * Where the day's burn comes from, and what the plan feeds against it. The two
 * bars share one scale, so the difference between them is the deficit or the
 * surplus — the one thing on this screen that decides which way weight moves.
 */
function Energy({
	bmr,
	tdee,
	calories,
}: {
	bmr: number;
	tdee: number;
	calories: number;
}) {
	const top = Math.max(tdee, calories);
	const gap = calories - tdee;
	const parts = [
		{ key: "resting", label: "Resting", value: bmr },
		{ key: "moving", label: "Moving", value: Math.max(0, tdee - bmr) },
	];

	return (
		<div className="rounded-2xl border border-border p-5 text-left">
			<p className={cn(MICRO, "text-muted-foreground")}>Energy</p>

			<dl className="mt-4 space-y-4">
				<div>
					<div className="flex items-baseline justify-between gap-2">
						<dt className="text-xs">You burn</dt>
						<dd className="font-medium text-sm tabular-nums">
							{tdee.toLocaleString("en-GB")} kcal
						</dd>
					</div>
					{/* Split where it comes from: staying alive is most of it, which is
					    the part nobody expects. */}
					<div
						aria-hidden="true"
						className="mt-1.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
						style={{ width: `${(tdee / top) * 100}%` }}
					>
						{parts.map((part) => (
							<span
								className={cn(
									"h-full",
									part.key === "resting"
										? "bg-foreground/70"
										: "bg-foreground/30",
								)}
								key={part.key}
								style={{ width: `${(part.value / tdee) * 100}%` }}
							/>
						))}
					</div>
					<p className="mt-1.5 flex gap-3 text-[0.625rem] text-muted-foreground">
						{parts.map((part) => (
							<span className="flex items-center gap-1" key={part.key}>
								<span
									aria-hidden="true"
									className={cn(
										"size-2 rounded-[3px]",
										part.key === "resting"
											? "bg-foreground/70"
											: "bg-foreground/30",
									)}
								/>
								{part.label} {part.value.toLocaleString("en-GB")}
							</span>
						))}
					</p>
				</div>

				<div>
					<div className="flex items-baseline justify-between gap-2">
						<dt className="text-xs">You eat</dt>
						<dd className="font-medium text-sm tabular-nums">
							{calories.toLocaleString("en-GB")} kcal
						</dd>
					</div>
					<div
						aria-hidden="true"
						className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
					>
						<div
							className="h-full rounded-full bg-foreground"
							style={{ width: `${(calories / top) * 100}%` }}
						/>
					</div>
				</div>
			</dl>

			<p className="mt-4 text-pretty text-muted-foreground text-xs">
				{gap === 0
					? "Level with what you burn, which holds your weight where it is."
					: `${Math.abs(gap).toLocaleString("en-GB")} kcal ${gap < 0 ? "less than you burn, so weight comes off" : "more than you burn, so weight goes on"}.`}
			</p>
		</div>
	);
}

/** Where each band starts, and how wide the scale is drawn. */
const BMI_MIN = 15;
const BMI_MAX = 40;
const BMI_BANDS = [
	{ key: "underweight", short: "Under", to: 18.5 },
	{ key: "healthy", short: "Healthy", to: 25 },
	{ key: "overweight", short: "Over", to: 30 },
	{ key: "obese", short: "Obese", to: BMI_MAX },
] as const;

/**
 * BMI on the scale it means anything on. A number on its own says nothing about
 * how far into a band it sits, or how close it is to leaving one — and the
 * distance to the next band is the only actionable thing about it.
 */
function BmiScale({ value, band }: { value: number; band: string }) {
	const span = BMI_MAX - BMI_MIN;
	const at = Math.min(Math.max(((value - BMI_MIN) / span) * 100, 0), 100);
	const healthy = BMI_BANDS[1];

	// How far from the healthy range, in BMI points, which is what someone can
	// actually do something about.
	const away =
		value < 18.5
			? `${(18.5 - value).toFixed(1)} under the healthy range`
			: value > 25
				? `${(value - 25).toFixed(1)} over the healthy range`
				: `${(25 - value).toFixed(1)} from the top of the range`;

	return (
		<div className="rounded-2xl border border-border p-5 text-left">
			<div className="flex items-baseline justify-between gap-3">
				<p className={cn(MICRO, "text-muted-foreground")}>Body mass index</p>
				{/* The band is spelled out beside the figure: a number alone means
				    nothing to most people, and a position alone means nothing to
				    anyone who cannot see it. */}
				<p className="text-muted-foreground text-xs">{away}</p>
			</div>

			<div className="relative mt-8">
				{/* The reading rides the marker, so the number and the place it sits
				    are one thing rather than two. */}
				<span
					className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 font-semibold text-background text-xs tabular-nums"
					style={{ left: `${at}%` }}
				>
					{value} · {BMI_BAND[band]}
				</span>
				<span
					aria-hidden="true"
					className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
					style={{ left: `${at}%` }}
				/>

				<div aria-hidden="true" className="flex h-3 gap-0.5">
					{BMI_BANDS.map((item, index) => {
						const from =
							index === 0 ? BMI_MIN : (BMI_BANDS[index - 1]?.to ?? 0);
						return (
							<span
								className={cn(
									"h-full first:rounded-l-full last:rounded-r-full",
									item.key === healthy.key ? "bg-foreground/45" : "bg-muted",
								)}
								key={item.key}
								style={{ width: `${((item.to - from) / span) * 100}%` }}
							/>
						);
					})}
				</div>

				{/* Named bands, not bare numbers: 18.5 means nothing without the word
				    beside it, and the word is what the scale is read by. */}
				<div aria-hidden="true" className="mt-2 flex gap-0.5">
					{BMI_BANDS.map((item, index) => {
						const from =
							index === 0 ? BMI_MIN : (BMI_BANDS[index - 1]?.to ?? 0);
						return (
							<span
								className={cn(
									"text-[0.625rem] leading-tight",
									item.key === band
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
								key={item.key}
								style={{ width: `${((item.to - from) / span) * 100}%` }}
							>
								{item.short}
							</span>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className={cn(MICRO, "text-muted-foreground")}>{label}</dt>
			<dd className="mt-1.5 font-medium text-sm tabular-nums">{value}</dd>
		</div>
	);
}

/**
 * What the screen shows when a skipped answer means there is nothing honest to
 * put on it. Naming the gaps is the point: "add your height" is a thing someone
 * can act on, where a plan built on a guessed height is not.
 */
function Incomplete({
	missing,
	pending,
	onFinish,
}: {
	missing: string[];
	pending: boolean;
	onFinish: (dailyCalories: number | null) => void;
}) {
	return (
		<div className="flex flex-1 flex-col">
			<div className={SCREEN_BODY}>
				<p className={cn(MICRO, "text-muted-foreground")}>Your starting plan</p>
				{/* `tabIndex` so the flow can move focus here on the screen change; it
			    finds this by tag, which is why every branch has exactly one. */}
				<h1
					className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
					tabIndex={-1}
				>
					A few answers short
				</h1>
				<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
					Mezo works out your calorie and macro targets from {listOf(missing)}.
					Rather than guess at {missing.length === 1 ? "it" : "them"} and hand
					you a number that is wrong, it is leaving the targets unset. Add{" "}
					{missing.length === 1 ? "the answer" : "them"} whenever you like and
					they appear on your dashboard.
				</p>

				<div className="mt-8 w-full max-w-xl rounded-2xl border border-border border-dashed p-5">
					<p className={cn(MICRO, "text-muted-foreground")}>Still needed</p>
					<ul className="mt-3 grid gap-2">
						{missing.map((item) => (
							<li className="text-sm" key={item}>
								{item}
							</li>
						))}
					</ul>
					<Button
						className="mt-4 rounded-full"
						render={<Link href="/settings/body" />}
						variant="outline"
					>
						Fill these in
					</Button>
				</div>
			</div>

			<Finish onFinish={() => onFinish(null)} pending={pending} />
		</div>
	);
}

/** Sentence-friendly list: "a, b and c". */
function listOf(items: string[]) {
	if (items.length <= 1) return items[0] ?? "";
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Finish({
	pending,
	disabled,
	onFinish,
}: {
	pending: boolean;
	disabled?: boolean;
	onFinish: () => void;
}) {
	return (
		// Kept in step with `ACTION_BAR` in `onboarding-flow.tsx`, which explains
		// why the string lives in two places.
		<div className="sticky bottom-0 z-10 -mx-5 border-border/60 border-t bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
			<Button
				className="h-11 w-full rounded-full px-6 sm:w-auto"
				disabled={pending || disabled}
				onClick={onFinish}
				type="button"
			>
				{pending ? "Saving…" : "Open my dashboard"}
				<ArrowRightIcon />
			</Button>
		</div>
	);
}
