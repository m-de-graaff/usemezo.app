/**
 * Every number the dashboard shows, faked in one place. Swap these exports for
 * tRPC queries when the real tables land — nothing below this file knows the
 * difference.
 *
 * Dates are anchored to a fixed day rather than `new Date()` so the server and
 * the client render the same labels.
 */

export const ANCHOR_DATE = "2026-08-24";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Noon avoids off-by-one labels when a timezone shifts an ISO date. */
export function parseDay(isoDate: string): Date {
	return new Date(`${isoDate}T12:00:00`);
}

function toIso(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * A repeatable pseudo-random series: same input, same output on both renders.
 * Two sines of unrelated periods look organic enough for a POC without a seed
 * library.
 */
function series(days: number, base: number, swing: number, drift: number) {
	const end = parseDay(ANCHOR_DATE).getTime();
	return Array.from({ length: days }, (_, i) => {
		const wave =
			Math.sin(i / 3.1) * swing + Math.sin(i / 11.7) * swing * 0.6 + i * drift;
		return {
			date: toIso(new Date(end - (days - 1 - i) * DAY_MS)),
			value: Math.round(base + wave),
		};
	});
}

export type DayPoint = { date: string; value: number };

/** Daily training tonnage in kg. 90 days so every range option has data. */
export const trainingVolume: DayPoint[] = series(90, 8200, 900, 14);

export type Stat = {
	label: string;
	value: string;
	delta: number;
	footnote: string;
	/** Down is good here — resting heart rate, recovery debt, and friends. */
	lowerIsBetter?: boolean;
};

export const stats: Stat[] = [
	{
		label: "Weekly volume",
		value: "58,400 kg",
		delta: 6.2,
		footnote: "vs last week",
	},
	{
		label: "Sessions",
		value: "4 of 5",
		delta: 0,
		footnote: "this week",
	},
	{
		label: "Avg sleep",
		value: "7h 12m",
		delta: 3.4,
		footnote: "last 7 nights",
	},
	{
		label: "Resting HR",
		value: "54 bpm",
		delta: -4.1,
		footnote: "vs last month",
		lowerIsBetter: true,
	},
];

export type MacroKey = "protein" | "carbs" | "fat";

/** Share of today's calories. */
export const macroSplit: { macro: MacroKey; share: number; fill: string }[] = [
	{ macro: "protein", share: 34, fill: "var(--color-protein)" },
	{ macro: "carbs", share: 44, fill: "var(--color-carbs)" },
	{ macro: "fat", share: 22, fill: "var(--color-fat)" },
];

export type SleepNight = {
	night: string;
	deep: number;
	rem: number;
	core: number;
};

/** Hours per stage, last 10 nights. Stages sum to total time asleep. */
export const sleepNights: SleepNight[] = [
	{ night: "Aug 15", deep: 1.4, rem: 1.6, core: 4.3 },
	{ night: "Aug 16", deep: 1.1, rem: 1.4, core: 4.0 },
	{ night: "Aug 17", deep: 1.6, rem: 1.9, core: 4.6 },
	{ night: "Aug 18", deep: 1.3, rem: 1.7, core: 4.4 },
	{ night: "Aug 19", deep: 0.9, rem: 1.2, core: 3.8 },
	{ night: "Aug 20", deep: 1.5, rem: 1.8, core: 4.5 },
	{ night: "Aug 21", deep: 1.7, rem: 1.9, core: 4.7 },
	{ night: "Aug 22", deep: 1.2, rem: 1.5, core: 4.1 },
	{ night: "Aug 23", deep: 1.6, rem: 2.0, core: 4.8 },
	{ night: "Aug 24", deep: 1.4, rem: 1.8, core: 4.4 },
];

export type Workout = {
	name: string;
	focus: string;
	date: string;
	durationMinutes: number;
	volumeKg: number;
	state: "completed" | "partial" | "planned";
};

export const recentWorkouts: Workout[] = [
	{
		name: "Upper A",
		focus: "Bench, rows, overhead",
		date: "2026-08-24",
		durationMinutes: 68,
		volumeKg: 9420,
		state: "completed",
	},
	{
		name: "Lower A",
		focus: "Squat, RDL, calves",
		date: "2026-08-22",
		durationMinutes: 74,
		volumeKg: 12_180,
		state: "completed",
	},
	{
		name: "Upper B",
		focus: "Incline, pull-ups, arms",
		date: "2026-08-21",
		durationMinutes: 41,
		volumeKg: 5310,
		state: "partial",
	},
	{
		name: "Lower B",
		focus: "Deadlift, split squat",
		date: "2026-08-25",
		durationMinutes: 75,
		volumeKg: 0,
		state: "planned",
	},
];

export type Target = {
	label: string;
	current: number;
	goal: number;
	unit: string;
};

export const dailyTargets: Target[] = [
	{ label: "Calories", current: 2140, goal: 2600, unit: "kcal" },
	{ label: "Protein", current: 168, goal: 180, unit: "g" },
	{ label: "Water", current: 2.1, goal: 3, unit: "L" },
	{ label: "Steps", current: 9420, goal: 8000, unit: "" },
];
