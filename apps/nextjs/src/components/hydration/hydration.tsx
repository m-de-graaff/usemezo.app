"use client";

import { DRINKS, MAX_GOAL_ML, MIN_GOAL_ML } from "@mezo/api/hydration";
import { isoDay } from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { Input } from "@mezo/ui/input";
import { cn } from "@mezo/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@mezo/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mezo/ui/select";
import { Skeleton } from "@mezo/ui/skeleton";
import { toast } from "@mezo/ui/sonner";
import { FlameIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { DrinkLog } from "~/components/hydration/drink-log";
import { HydrationChart } from "~/components/hydration/hydration-chart";
import { formatVolume, QUICK_ADD_ML, unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/** How many days the chart reads back. The chart itself offers a shorter view. */
const DAYS = 30;

const DRINK_ITEMS = DRINKS.map((drink) => ({
	value: drink.slug,
	label: drink.label,
}));

/**
 * The hydration screen.
 *
 * A Client Component all the way down, and deliberately: the day a drink
 * belongs to is the browser's local day, and a server has no way to know what
 * day it is where the person drinking is standing. Reading the clock in an
 * effect rather than during render keeps the first paint identical on both
 * sides. See `day` below.
 */
export function Hydration({ units }: { units?: string | null }) {
	const system = unitSystem(units);
	const utils = api.useUtils();

	// Read once, after mount. Once, because a page left open over midnight
	// silently moving to a new day would empty the list somebody is looking at;
	// after mount, because the server's idea of today is not this user's.
	const [day, setDay] = useState<string | null>(null);
	useEffect(() => setDay(isoDay(new Date())), []);

	const [drink, setDrink] = useState("water");
	const [custom, setCustom] = useState("");
	const customId = useId();

	const query = api.hydration.overview.useQuery(
		{ day: day ?? "", days: DAYS },
		{ enabled: day !== null },
	);

	const log = api.hydration.log.useMutation({
		onError: (error) => toast.error(error.message),
		onSettled: () => utils.hydration.overview.invalidate(),
	});

	if (!day || !query.data) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-56 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
			</div>
		);
	}

	const {
		totalMl,
		targetMl,
		baseMl,
		sweatMl,
		sweatFrom,
		goalMl,
		streak,
		trainingDays,
		days,
		entries,
	} = query.data;
	const pct = targetMl ? Math.round((totalMl / targetMl) * 100) : 0;
	const remaining = Math.max(0, targetMl - totalMl);

	// Where the extra came from, said plainly. An estimate and a measurement are
	// not the same claim, and a target that quietly rose on a Wednesday with no
	// explanation is a target people stop believing.
	const extra =
		sweatMl > 0
			? `${formatVolume(baseMl, system)} plus ${formatVolume(sweatMl, system)} ${
					sweatFrom === "logged"
						? "for the training you logged today."
						: "because today is one of your training days."
				}`
			: goalMl
				? "Your own target."
				: `${DRINKS.length} drink types, each counted at what it is actually worth.`;

	const add = (amountMl: number) => {
		// Minted here rather than during render: a render-time id would be a
		// different id on every pass, and this one is what makes a double-fired
		// tap one drink instead of two.
		log.mutate({ id: crypto.randomUUID(), day, amountMl, drink });
	};

	const addCustom = () => {
		const amount = Math.round(Number(custom));
		if (!Number.isFinite(amount) || amount < 1) return;
		add(amount);
		setCustom("");
	};

	return (
		<div className="flex flex-col gap-4">
			<Card className="shadow-none dark:ring-0">
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
					<Ring hit={totalMl >= targetMl} label="Today's hydration" pct={pct} />
					<div className="min-w-0 flex-1 space-y-1">
						<CardTitle className="text-2xl tabular-nums">
							{formatVolume(totalMl, system)}
							<span className="font-normal text-base text-muted-foreground">
								{" / "}
								{formatVolume(targetMl, system)}
							</span>
						</CardTitle>
						<CardDescription>
							{remaining > 0
								? `${formatVolume(remaining, system)} to go.`
								: "Target met."}{" "}
							{extra}
						</CardDescription>
						{streak > 0 && (
							<p className="flex items-center gap-1.5 pt-1 text-muted-foreground text-sm">
								<FlameIcon
									aria-hidden="true"
									className="size-4 text-amber-500"
								/>
								{streak} day{streak === 1 ? "" : "s"} on target
							</p>
						)}
						{/* Discoverability, and only while there is nothing to discover:
						    the target quietly rising on a Wednesday is a better feature
						    than a permanent line explaining that it could. */}
						{trainingDays.length === 0 && (
							<p className="pt-1 text-muted-foreground text-sm">
								<Link
									className="underline underline-offset-4 hover:text-foreground"
									href="/settings/goals"
								>
									Tell Mezo which days you train
								</Link>{" "}
								and this target rises on those mornings, not after the session.
							</p>
						)}
					</div>
					<GoalEditor
						computedMl={baseMl}
						goalMl={goalMl}
						onSaved={() => utils.hydration.overview.invalidate()}
						system={system}
					/>
				</CardHeader>

				<CardContent className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<Select
							items={DRINK_ITEMS}
							onValueChange={(value) => setDrink(String(value ?? "water"))}
							value={drink}
						>
							<SelectTrigger aria-label="Drink" className="w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DRINK_ITEMS.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{QUICK_ADD_ML(system).map((ml) => (
							<Button
								disabled={log.isPending}
								key={ml}
								onClick={() => add(ml)}
								variant="outline"
							>
								<PlusIcon aria-hidden="true" />
								{formatVolume(ml, system)}
							</Button>
						))}
					</div>

					<form
						className="flex items-center gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							addCustom();
						}}
					>
						<label className="sr-only" htmlFor={customId}>
							Custom amount in millilitres
						</label>
						<Input
							className="w-32"
							id={customId}
							inputMode="numeric"
							max={3000}
							min={1}
							onChange={(event) => setCustom(event.target.value)}
							placeholder="Other (ml)"
							type="number"
							value={custom}
						/>
						<Button disabled={!custom || log.isPending} type="submit">
							Add
						</Button>
					</form>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<DrinkLog entries={entries} system={system} />
				<HydrationChart days={days} system={system} />
			</div>
		</div>
	);
}

/** The circumference the dash array is measured in. */
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({
	hit,
	label,
	pct,
}: {
	hit: boolean;
	label: string;
	pct: number;
}) {
	// The arc caps at a full circle so overshooting a target does not wind the
	// ring round a second time and read as having drunk almost nothing.
	const drawn = Math.min(Math.max(pct, 0), 100) / 100;

	return (
		<div
			aria-label={`${label}: ${pct}% of target`}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={pct}
			className="relative size-28 shrink-0"
			role="progressbar"
		>
			<svg
				aria-hidden="true"
				className="size-28 -rotate-90"
				viewBox="0 0 120 120"
			>
				<circle
					className="stroke-muted"
					cx="60"
					cy="60"
					fill="none"
					r={RADIUS}
					strokeWidth="10"
				/>
				<circle
					className={cn(
						"transition-[stroke-dashoffset] duration-500 ease-out",
						hit ? "stroke-emerald-500" : "stroke-sky-500",
					)}
					cx="60"
					cy="60"
					fill="none"
					r={RADIUS}
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={CIRCUMFERENCE * (1 - drawn)}
					strokeLinecap="round"
					strokeWidth="10"
				/>
			</svg>
			<span className="absolute inset-0 flex items-center justify-center font-semibold text-lg tabular-nums">
				{pct}%
			</span>
		</div>
	);
}

/**
 * The target, as a number the user can take over.
 *
 * The computed one is 35ml per kilogram of body weight, which is a population
 * average and not a measurement of anybody. Somebody who has weighed themselves
 * before and after a session knows better than the formula does, and this is
 * where they say so.
 */
function GoalEditor({
	computedMl,
	goalMl,
	onSaved,
	system,
}: {
	computedMl: number;
	goalMl: number | null;
	onSaved: () => void;
	system: ReturnType<typeof unitSystem>;
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(String(goalMl ?? computedMl));
	const fieldId = useId();

	const setGoal = api.hydration.setGoal.useMutation({
		onError: (error) => toast.error(error.message),
		onSuccess: () => {
			setOpen(false);
			onSaved();
		},
	});

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<Button size="sm" variant="outline">
						{goalMl ? "Your target" : "Edit target"}
					</Button>
				}
			/>
			<PopoverContent align="end" className="w-72 space-y-3" side="bottom">
				<div className="space-y-1">
					<label className="font-medium text-sm" htmlFor={fieldId}>
						Daily target, in millilitres
					</label>
					<p className="text-muted-foreground text-xs">
						Mezo works out {formatVolume(computedMl, system)} from your weight.
						Training on top of that is added on the day, whichever number
						stands.
					</p>
				</div>
				<Input
					id={fieldId}
					inputMode="numeric"
					max={MAX_GOAL_ML}
					min={MIN_GOAL_ML}
					onChange={(event) => setValue(event.target.value)}
					type="number"
					value={value}
				/>
				<div className="flex items-center justify-between gap-2">
					<Button
						disabled={setGoal.isPending || !goalMl}
						onClick={() => setGoal.mutate({ ml: null })}
						size="sm"
						variant="ghost"
					>
						Use the computed one
					</Button>
					<Button
						disabled={setGoal.isPending}
						onClick={() => {
							const ml = Math.round(Number(value));
							if (!Number.isFinite(ml)) return;
							setGoal.mutate({ ml });
						}}
						size="sm"
					>
						Save
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
