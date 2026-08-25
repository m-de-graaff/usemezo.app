/**
 * The numbers the dashboard still invents.
 *
 * Training is real now: volume, sessions and the recent list come from
 * `workout.stats`. What is left here is sleep, food and steps, none of which
 * anything measures yet. Delete each one as something starts to.
 *
 * The remaining series are literals rather than generated, so the server and
 * the client render the same labels.
 */

/** Noon avoids off-by-one labels when a timezone shifts an ISO date. */
export function parseDay(isoDate: string): Date {
	return new Date(`${isoDate}T12:00:00`);
}

export type DayPoint = { date: string; value: number };

export type Stat = {
	label: string;
	value: string;
	delta: number;
	footnote: string;
	/** Down is good here — resting heart rate, recovery debt, and friends. */
	lowerIsBetter?: boolean;
};

/**
 * The two cards nothing measures yet. Weekly volume and session count are read
 * from `workout.stats`; these two are waiting on something that reads a
 * wearable.
 */
export const fakeStats: Stat[] = [
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
