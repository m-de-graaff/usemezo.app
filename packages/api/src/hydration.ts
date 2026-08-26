/**
 * Hydration: how much a drink is worth, and how much a day needs.
 *
 * Pure arithmetic, no database and no server imports, so the logging screen can
 * show the running total before the mutation lands and the router can trust the
 * same numbers on the way in.
 */

/**
 * How much a drink hydrates, relative to still water.
 *
 * The measured values come from the beverage hydration index trial (Maughan et
 * al., 2016), which fed 1L of each drink to the same people and measured what
 * came back out over four hours. Two results in it are worth knowing because
 * they contradict what most trackers assume:
 *
 *  - Coffee, tea, cola and lager were *not* significantly different from water.
 *    A cup of coffee is a cup of fluid. The diuretic story is real at very high
 *    doses and not at the ones anybody drinks.
 *  - Milk beat water (1.32 full fat, 1.44 skimmed, after adjusting for the water
 *    the drink itself contains), as did an oral rehydration solution (1.50).
 *    Protein, fat and sodium all slow gastric emptying, so the fluid arrives
 *    over hours instead of passing straight through.
 *
 * `wine-spirits` is the one figure here the trial does not cover: it tested a
 * 4% lager, not a 40% spirit. Ethanol suppresses vasopressin in proportion to
 * the dose, so a stiff drink is a net loss rather than a small gain, and 0.6 is
 * a deliberately unfussy stand-in for a curve nobody has measured per-glass.
 */
export type Drink = {
	slug: string;
	label: string;
	/** Millilitres of water this is worth, per millilitre drunk. */
	index: number;
	/** Sensible pour, in millilitres. What the quick-add button offers. */
	serveMl: number;
};

export const DRINKS: Drink[] = [
	{ slug: "water", label: "Water", index: 1, serveMl: 250 },
	{ slug: "sparkling", label: "Sparkling water", index: 1, serveMl: 330 },
	{ slug: "coffee", label: "Coffee", index: 1, serveMl: 150 },
	{ slug: "tea", label: "Tea", index: 1, serveMl: 250 },
	{ slug: "milk", label: "Milk", index: 1.35, serveMl: 250 },
	{ slug: "electrolyte", label: "Electrolyte drink", index: 1.5, serveMl: 500 },
	{ slug: "sports", label: "Sports drink", index: 1, serveMl: 500 },
	{ slug: "juice", label: "Juice", index: 1, serveMl: 200 },
	{ slug: "soft-drink", label: "Soft drink", index: 1, serveMl: 330 },
	{ slug: "beer", label: "Beer", index: 1, serveMl: 330 },
	{ slug: "wine-spirits", label: "Wine or spirits", index: 0.6, serveMl: 150 },
];

export const DRINK_SLUGS = DRINKS.map((drink) => drink.slug) as [
	string,
	...string[],
];

const BY_SLUG = new Map(DRINKS.map((drink) => [drink.slug, drink]));

export const drinkBySlug = (slug: string): Drink | undefined =>
	BY_SLUG.get(slug);

/** Millilitres of water per kilogram of body weight, per day. */
export const WATER_ML_PER_KG = 35;

/**
 * What somebody with no weight on file gets, from EFSA's adequate intake for
 * drinks alone: 2.5L for men, 2.0L for women, at a moderate temperature and a
 * moderate amount of moving about. Anyone who has not answered the gender
 * question gets the lower of the two, because a target that is too high is the
 * one people give up on.
 */
const EFSA_ML: Record<string, number> = { male: 2500, female: 2000 };
const EFSA_ML_UNKNOWN = 2000;

/**
 * Extra fluid per hour of training.
 *
 * Sweat rates run from roughly 0.5 to 2.0 litres an hour and depend on the
 * person, the room and the effort, none of which Mezo measures. 500ml an hour
 * sits at the bottom of that range on purpose: it is the part of the loss that
 * is safe to assume, and guessing high would hand somebody a target they miss
 * every time they train.
 *
 * ponytail: a flat rate. The honest version weighs you before and after a
 * session; add that when the app has a reason to ask for two weights.
 */
const SWEAT_ML_PER_HOUR = 500;

/** Nobody sweats their way to an extra four litres in a day Mezo can see. */
const SWEAT_ML_MAX = 1500;

export const MIN_GOAL_ML = 500;
export const MAX_GOAL_ML = 8000;

/** Targets are shown to the nearest 50ml. Nobody drinks to the millilitre. */
const round50 = (ml: number) => Math.round(ml / 50) * 50;

/**
 * The baseline daily target, before training. Weight is what drives it when
 * there is one; the EFSA figure stands in when there is not.
 */
export function baseTargetMl(
	weightKg: number | null | undefined,
	gender?: string | null,
): number {
	if (weightKg && weightKg > 0) return round50(weightKg * WATER_ML_PER_KG);
	return gender ? (EFSA_ML[gender] ?? EFSA_ML_UNKNOWN) : EFSA_ML_UNKNOWN;
}

/** What a day of training adds to the target. */
export const sweatMl = (trainingSec: number): number =>
	Math.min(round50((trainingSec / 3600) * SWEAT_ML_PER_HOUR), SWEAT_ML_MAX);

/**
 * How long a session is assumed to run when there is no history to read.
 *
 * Only ever used for a session that has not happened yet. A logged session
 * reports its own duration and this number never touches it.
 */
export const DEFAULT_SESSION_SEC = 60 * 60;

/** Anything shorter than this is somebody starting a session by accident. */
const REAL_SESSION_SEC = 10 * 60;

/**
 * How long this person's sessions actually run, as a median.
 *
 * A median rather than a mean, because one three-hour Saturday would otherwise
 * raise every Tuesday's target. Sessions too short to be sessions are dropped
 * first: a mistaken start followed by a discard is a zero that would drag the
 * middle of the list down for weeks.
 */
export function typicalSessionSec(durationsSec: readonly number[]): number {
	const real = durationsSec
		.filter((seconds) => seconds >= REAL_SESSION_SEC)
		.sort((a, b) => a - b);
	if (real.length === 0) return DEFAULT_SESSION_SEC;
	const middle = Math.floor(real.length / 2);
	return real.length % 2 === 0
		? Math.round(((real[middle - 1] as number) + (real[middle] as number)) / 2)
		: (real[middle] as number);
}

const WEEKDAY_SLUGS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * `2026-08-26` -> `wed`. Keys match `WEEKDAYS` in `./profile-fields`.
 *
 * Parsed at noon rather than midnight, so an hour of daylight saving cannot
 * push the date onto the day before and report the wrong weekday.
 */
export function weekdayOf(isoDate: string): string {
	const at = new Date(`${isoDate}T12:00:00`);
	return WEEKDAY_SLUGS[at.getDay()] as string;
}

/** Where a day's sweat allowance came from, so a screen can say which. */
export type SweatSource = "none" | "logged" | "planned";

export type TargetInput = {
	weightKg?: number | null;
	gender?: string | null;
	/** The user's own figure, when they have overridden the computed one. */
	goalMl?: number | null;
	/** Seconds trained on the day in question. Zero means nothing logged yet. */
	trainingSec?: number;
	/** Whether the schedule says this is a training day. */
	plannedTraining?: boolean;
	/** This person's usual session length, for a day they have not trained yet. */
	typicalTrainingSec?: number;
};

/**
 * The target for one day: a base plus whatever the day's training cost.
 *
 * An override replaces the base and not the sweat allowance. Somebody who sets
 * their own number is telling Mezo what a normal day looks like for them, which
 * is not a claim that a two-hour session changes nothing.
 *
 * A scheduled training day earns the allowance from the morning rather than
 * from the moment a session is finished, which is the whole point of keeping a
 * schedule: a target that only rises after training is right for the hours you
 * no longer need it. A logged session always wins over the estimate, including
 * when it was shorter. The plan is a guess and the session is a fact.
 *
 * A day with no training logged and no schedule gets nothing added. Mezo does
 * not assume training nobody mentioned.
 */
export function dailyTargetMl(input: TargetInput): {
	baseMl: number;
	sweatMl: number;
	targetMl: number;
	sweatFrom: SweatSource;
} {
	const base =
		input.goalMl && input.goalMl > 0
			? input.goalMl
			: baseTargetMl(input.weightKg, input.gender);

	const trained = input.trainingSec ?? 0;
	const sweatFrom: SweatSource =
		trained > 0 ? "logged" : input.plannedTraining ? "planned" : "none";

	const sweat =
		sweatFrom === "logged"
			? sweatMl(trained)
			: sweatFrom === "planned"
				? sweatMl(input.typicalTrainingSec ?? DEFAULT_SESSION_SEC)
				: 0;

	return { baseMl: base, sweatMl: sweat, targetMl: base + sweat, sweatFrom };
}

/** What a drink is worth against the target, after its hydration index. */
export const effectiveMl = (amountMl: number, drink: string): number =>
	Math.round(amountMl * (BY_SLUG.get(drink)?.index ?? 1));

export type DayTotal = { date: string; ml: number; targetMl: number };

/**
 * Consecutive days ending today on which the target was met.
 *
 * Today only counts once it is hit, and never breaks the run before then: a
 * streak that reads zero every morning is a streak nobody trusts. Days arrive
 * oldest first.
 */
export function streakDays(days: DayTotal[]): number {
	let streak = 0;
	for (let index = days.length - 1; index >= 0; index -= 1) {
		const day = days[index];
		if (!day) break;
		if (day.ml >= day.targetMl) {
			streak += 1;
			continue;
		}
		// The last day is still in progress, so a miss there is not yet a miss.
		if (index === days.length - 1) continue;
		break;
	}
	return streak;
}
