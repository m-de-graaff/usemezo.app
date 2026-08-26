/**
 * The starting plan, derived from the profile.
 *
 * Every piece of health arithmetic in Mezo lives here and nowhere else. The
 * numbers are estimates from published population formulas, not measurements
 * and not advice — whatever renders them has to say so, which is why nothing
 * in this file formats anything for display.
 *
 * The rule that shapes the whole module: **it never substitutes a default for
 * an answer the user did not give.** An unanswered activity level makes a
 * total daily expenditure a guess wearing a number's clothes, and a wrong
 * calorie target is worse than an absent one. So `buildPlan` either has what
 * it needs or reports what it is missing.
 *
 * One import, and it is another file with this same rule: called from a Server
 * Component, a Client Component and a test, depending on nothing that would
 * stop it running in any of them.
 */

import { baseTargetMl } from "./hydration.ts";

/**
 * How much a day burns beyond resting, by how the user described their week.
 * The keys are `ACTIVITY_LEVELS` in `./profile-fields`; the two lists have to
 * agree, and `plan.test.ts` is what notices when they do not.
 */
export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	"very-active": 1.9,
};

/**
 * The constant Mifflin-St Jeor adds after the height, weight and age terms.
 *
 * The formula was fitted on two groups and offers only two constants. Rather
 * than assign anyone outside them to one of the two, an unanswered or
 * non-binary answer takes the midpoint: the honest position is that the model
 * does not know, and the midpoint is the smallest error it can make.
 */
const SEX_CONSTANT: Record<string, number> = { male: 5, female: -161 };
const SEX_CONSTANT_UNKNOWN = (5 + -161) / 2;

/**
 * The lowest daily intake worth putting in front of someone. Below this,
 * sustained, is a clinical matter rather than an app's suggestion, so the
 * target is raised to meet it and the screen says that it was.
 */
const CALORIE_FLOOR: Record<string, number> = { male: 1500, female: 1200 };
const CALORIE_FLOOR_UNKNOWN = 1200;

/** Grams of protein per kilogram, by what the user is aiming at. */
const PROTEIN_PER_KG: Record<string, number> = {
	lose: 2.0,
	gain: 1.8,
	maintain: 1.6,
};

/** How far the calorie target moves off maintenance, as a share of it. */
const CALORIE_ADJUSTMENT: Record<string, number> = {
	lose: -0.2,
	gain: 0.12,
	maintain: 0,
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
/** Share of the daily target that comes from fat. */
const FAT_SHARE = 0.25;
/** Roughly what a kilogram of body mass is worth, for turning a gap into time. */
const KCAL_PER_KG = 7700;
/** The upper end of the healthy BMI band, used to cap the protein target. */
const HEALTHY_BMI_MAX = 25;

/** Nobody's date of birth makes them this old; a date like it is a typo. */
const MAX_AGE = 120;

export type PlanInput = {
	birthDate?: string | null;
	gender?: string | null;
	heightCm?: number | null;
	weightKg?: number | null;
	activityLevel?: string | null;
	goalDirection?: string | null;
	targetWeightKg?: number | null;
};

export type BmiBand = "underweight" | "healthy" | "overweight" | "obese";

/**
 * A union rather than a bag of nullable numbers, so a screen cannot render
 * half a plan by forgetting one check: reading `calories` requires having
 * narrowed on `ok` first.
 */
export type Plan =
	| { ok: false; missing: string[] }
	| {
			ok: true;
			age: number;
			bmi: number;
			bmiBand: BmiBand;
			/** Basal metabolic rate, kcal/day. */
			bmr: number;
			/** Total daily energy expenditure, kcal/day. */
			tdee: number;
			/** The daily target, after the goal adjustment and the floor. */
			calories: number;
			/** True when the floor raised the target above what the goal asked for. */
			atFloor: boolean;
			protein: number;
			carbs: number;
			fat: number;
			waterMl: number;
			/** Magnitude of the weekly change the target implies; 0 when maintaining. */
			paceKgPerWeek: number;
			/** Weeks to `targetWeightKg` at that pace, when one was given and is ahead. */
			weeksToTarget: number | null;
	  };

/* -------------------------------------------------------------------------- */
/* Body composition                                                           */
/* -------------------------------------------------------------------------- */

export type BodyCompositionInput = {
	weightKg?: number | null;
	bodyFatMassKg?: number | null;
	bodyFatPercent?: number | null;
	boneMassKg?: number | null;
	totalBodyWaterKg?: number | null;
	extracellularWaterKg?: number | null;
};

export type BodyComposition = {
	/** Everything that is not fat. Weight less fat mass, by definition. */
	fatFreeMassKg: number | null;
	/** Fat free mass less bone. What a scan calls soft lean mass. */
	softLeanMassKg: number | null;
	/** The water inside the cells: whatever the total is not outside them. */
	intracellularWaterKg: number | null;
	/**
	 * Extracellular water as a share of the total, 0 to 1.
	 *
	 * The number a clinician reads rather than either water figure on its own.
	 * Roughly 0.36 to 0.39 is ordinary; higher tends to mean fluid retention,
	 * inflammation or a bad reading, and none of those are training news.
	 */
	extracellularRatio: number | null;
};

/**
 * The parts of a body composition scan that are arithmetic on the rest.
 *
 * A scan prints a dozen numbers and most of them are the same four measurements
 * rearranged: fat free mass *is* weight minus fat mass, soft lean mass *is*
 * fat free mass minus bone, intracellular water *is* the total minus the
 * extracellular part. Storing those alongside their own inputs would mean four
 * columns that can disagree with each other the first time somebody updates
 * their weight and not the rest, and a profile that contradicts itself is worse
 * than one that is missing a row.
 *
 * So they are computed here, from whatever is stored, every time they are read.
 * `null` where the inputs are not there — the rule the whole module follows.
 *
 * Fat mass is taken from the stored mass where there is one and from the
 * percentage otherwise, because a scale reports one, the other, or both.
 */
export function bodyComposition(input: BodyCompositionInput): BodyComposition {
	const weight = input.weightKg ?? null;

	const fatMass =
		input.bodyFatMassKg ??
		(weight && input.bodyFatPercent
			? (weight * input.bodyFatPercent) / 100
			: null);

	const fatFreeMassKg = weight && fatMass ? round1(weight - fatMass) : null;

	const softLeanMassKg =
		fatFreeMassKg && input.boneMassKg
			? round1(fatFreeMassKg - input.boneMassKg)
			: null;

	const total = input.totalBodyWaterKg ?? null;
	const outside = input.extracellularWaterKg ?? null;

	// A guard, not a formality: an extracellular figure above the total is a
	// mistyped or mismatched reading, and the subtraction would report negative
	// water rather than saying so.
	const consistent = total !== null && outside !== null && outside <= total;

	return {
		fatFreeMassKg,
		softLeanMassKg,
		intracellularWaterKg: consistent ? round1(total - outside) : null,
		extracellularRatio:
			consistent && total > 0 ? round2(outside / total) : null,
	};
}

/**
 * Whole years, counted the way a person counts them: the birthday itself
 * already counts.
 *
 * The date is split by hand rather than passed to `new Date`, which parses
 * `YYYY-MM-DD` as UTC midnight — west of Greenwich that is the previous day,
 * and an age that is wrong for a third of the world is worse than no age.
 */
export function ageFrom(birthDate: string, today = new Date()): number {
	const [year, month, day] = birthDate.split("-").map(Number);
	if (!year || !month || !day) return Number.NaN;

	const beforeBirthday =
		today.getMonth() + 1 < month ||
		(today.getMonth() + 1 === month && today.getDate() < day);

	return today.getFullYear() - year - (beforeBirthday ? 1 : 0);
}

const round = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

function bandFor(bmi: number): BmiBand {
	if (bmi < 18.5) return "underweight";
	if (bmi < 25) return "healthy";
	if (bmi < 30) return "overweight";
	return "obese";
}

/**
 * Everything the plan screen shows, or the list of answers it still needs.
 *
 * `today` is a parameter so the tests can pin it; nothing else should pass it.
 */
export function buildPlan(input: PlanInput, today = new Date()): Plan {
	const { heightCm, weightKg, gender, targetWeightKg } = input;

	const age = input.birthDate ? ageFrom(input.birthDate, today) : Number.NaN;
	const multiplier = input.activityLevel
		? ACTIVITY_MULTIPLIERS[input.activityLevel]
		: undefined;

	// Named in the order the flow asks for them, so the sentence the screen
	// builds from this reads as a walk back through the questions.
	const missing: string[] = [];
	if (!Number.isFinite(age) || age < 0 || age > MAX_AGE)
		missing.push("your date of birth");
	if (!heightCm) missing.push("your height");
	if (!weightKg) missing.push("your weight");
	if (!multiplier) missing.push("how active you are");

	if (missing.length > 0) return { ok: false, missing };
	// Narrowing the four checks above buys nothing TypeScript can see, so the
	// non-nulls stand in for it — each is guarded one line up.
	const height = heightCm as number;
	const weight = weightKg as number;
	const activity = multiplier as number;

	const goal = input.goalDirection ?? "maintain";
	const bmi = round1(weight / (height / 100) ** 2);

	// Mifflin-St Jeor. Kept unrounded through the chain so the rounding happens
	// once, at the end, rather than compounding at every step.
	const bmr =
		10 * weight +
		6.25 * height +
		-5 * age +
		(gender
			? (SEX_CONSTANT[gender] ?? SEX_CONSTANT_UNKNOWN)
			: SEX_CONSTANT_UNKNOWN);
	const tdee = bmr * activity;

	const asked = tdee * (1 + (CALORIE_ADJUSTMENT[goal] ?? 0));
	const floor = Math.max(
		bmr,
		gender
			? (CALORIE_FLOOR[gender] ?? CALORIE_FLOOR_UNKNOWN)
			: CALORIE_FLOOR_UNKNOWN,
	);
	const calories = round(Math.max(asked, floor));
	const atFloor = floor > asked;

	// Protein is set against the weight the target is aiming at, not the weight
	// on the scale: 2g per kilogram is a sound number at a healthy weight and an
	// unreachable one well above it.
	const proteinReference = Math.min(
		weight,
		HEALTHY_BMI_MAX * (height / 100) ** 2,
	);
	const protein = round((PROTEIN_PER_KG[goal] ?? 1.6) * proteinReference);
	const fat = round((calories * FAT_SHARE) / KCAL_PER_G.fat);
	const carbs = Math.max(
		0,
		round(
			(calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) /
				KCAL_PER_G.carbs,
		),
	);

	// The gap between what is burned and what is eaten, as a rate. Positive
	// whichever way it points; the direction is `goalDirection`.
	const paceKgPerWeek = round2((Math.abs(tdee - calories) * 7) / KCAL_PER_KG);

	return {
		ok: true,
		age,
		bmi,
		bmiBand: bandFor(bmi),
		bmr: round(bmr),
		tdee: round(tdee),
		calories,
		atFloor,
		protein,
		carbs,
		fat,
		// The same figure the Hydration screen counts against, so the plan and
		// the tracker cannot drift into quoting two different targets.
		waterMl: baseTargetMl(weight, gender),
		paceKgPerWeek,
		weeksToTarget: weeksToTarget(weight, targetWeightKg, goal, paceKgPerWeek),
	};
}

/**
 * How long the gap takes to close, or `null` when the question does not apply:
 * no target, no movement, a target already reached, or one that sits the wrong
 * side of the current weight for the chosen direction.
 *
 * The half-kilogram threshold is there because a target within noise of today's
 * weight produces an arbitrarily large number of weeks, which reads as a
 * prediction rather than the rounding artefact it is.
 */
function weeksToTarget(
	weightKg: number,
	targetWeightKg: number | null | undefined,
	goal: string,
	paceKgPerWeek: number,
): number | null {
	if (!targetWeightKg || paceKgPerWeek <= 0) return null;

	const gap = weightKg - targetWeightKg;
	if (Math.abs(gap) < 0.5) return null;
	if (goal === "lose" && gap < 0) return null;
	if (goal === "gain" && gap > 0) return null;

	return Math.ceil(Math.abs(gap) / paceKgPerWeek);
}
