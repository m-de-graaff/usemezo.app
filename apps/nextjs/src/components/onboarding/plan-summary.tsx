"use client";

import { buildPlan } from "@mezo/api/plan";
import { Button } from "@mezo/ui/button";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { cn } from "@mezo/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import type { SettingsValues } from "~/components/settings/settings-form";
import { displayMeasure, type UnitSystem } from "~/lib/measure";

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
	system,
	pending,
	onFinish,
}: {
	values: SettingsValues;
	system: UnitSystem;
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

	return (
		<Complete
			onFinish={onFinish}
			pending={pending}
			plan={plan}
			system={system}
		/>
	);
}

const asString = (value: unknown) =>
	typeof value === "string" ? value : undefined;
const asNumber = (value: unknown) =>
	typeof value === "number" ? value : undefined;

function Complete({
	plan,
	system,
	pending,
	onFinish,
}: {
	plan: Extract<ReturnType<typeof buildPlan>, { ok: true }>;
	system: UnitSystem;
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

	const pace = displayMeasure(plan.paceKgPerWeek, "mass", system);

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
					Worked out from your answers with the Mifflin-St Jeor equation. It is
					an estimate to adjust from, not medical advice, and no substitute for
					talking to a doctor.
				</p>

				<div className="mt-8 grid w-full gap-3">
					{/* The number the whole flow was for, as an editable field rather
				    than a readout with an edit affordance hidden behind it. */}
					<div className="rounded-2xl border border-border bg-muted/40 p-5">
						<Label className={cn(MICRO, "text-muted-foreground")} htmlFor={id}>
							Daily calories
						</Label>
						<div className="mt-3 flex items-baseline gap-2">
							<Input
								aria-describedby={`${id}-note`}
								className="h-auto w-[5.5ch] border-0 bg-transparent p-0 font-semibold text-5xl tabular-nums tracking-[-0.03em] shadow-none focus-visible:ring-0 md:text-5xl"
								id={id}
								max={10000}
								min={500}
								onChange={(event) => setCalories(event.target.value)}
								step={10}
								type="number"
								value={calories}
							/>
							<span className="font-medium text-lg text-muted-foreground">
								kcal
							</span>
						</div>
						<p
							className="mt-2 text-muted-foreground text-xs"
							id={`${id}-note`}
							// The floor notice is a correction to the number above it, so it
							// has to reach someone who is not looking at the number.
							role={plan.atFloor ? "status" : undefined}
						>
							{plan.atFloor
								? "Raised to a safe minimum. The deficit your goal implied was lower than anyone should eat for long."
								: "Change it if you already know your number. Editable later in Settings."}
						</p>
						{!valid && (
							<p className="mt-2 text-destructive text-xs" role="alert">
								Enter a number between 500 and 10,000 kcal.
							</p>
						)}
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<Macro grams={plan.protein} label="Protein" />
						<Macro grams={plan.carbs} label="Carbs" />
						<Macro grams={plan.fat} label="Fat" />
					</div>

					<dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-border p-5 sm:grid-cols-3">
						<Stat label="Age" value={`${plan.age}`} />
						{/* The band is spelled out beside the figure: a number alone means
					    nothing to most people, and a colour alone means nothing to
					    anyone who cannot see it. */}
						<Stat
							label="BMI"
							value={`${plan.bmi} · ${BMI_BAND[plan.bmiBand]}`}
						/>
						<Stat label="Water" value={`${plan.waterMl / 1000} L`} />
						<Stat label="Resting burn" value={`${plan.bmr} kcal`} />
						<Stat label="Daily burn" value={`${plan.tdee} kcal`} />
						{plan.paceKgPerWeek > 0 && (
							<Stat label="Pace" value={`${pace.text} ${pace.unit} a week`} />
						)}
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

function Macro({ label, grams }: { label: string; grams: number }) {
	return (
		<div className="rounded-xl border border-border p-4">
			<p className={cn(MICRO, "text-muted-foreground")}>{label}</p>
			<p className="mt-2 font-semibold text-2xl tabular-nums tracking-[-0.02em]">
				{grams}
				<span className="ml-0.5 font-medium text-base text-muted-foreground">
					g
				</span>
			</p>
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
