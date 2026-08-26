import { type Exercise, exerciseById } from "./exercises.ts";
import {
	type Coefficient,
	loadCoefficient,
	oneRepMax,
	patternCeilingKg,
	predictedOneRepMax,
	type StrengthProfile,
	totalKg,
} from "./strength.ts";
import { isCounted, type PlannedSet } from "./workout-shape.ts";

/**
 * Whether a logged set is a lift that happened.
 *
 * The problem this exists for is one entry: six reps at ten kilos on Tuesday
 * and six reps at a hundred on Thursday. Nothing about that is a training
 * decision, and every number the app derives afterwards is downstream of it.
 * A record is claimed, the strength index recalibrates around it, and the
 * progression puts a weight on the bar next week that nobody can lift.
 *
 * Three things this deliberately is not:
 *
 *   1. **A verdict.** Nothing here says anybody cheated. A fat finger, pounds
 *      typed into a kilogram box and a fabricated lift all look identical from
 *      the log, and the honest answer to all three is the same question: is
 *      that right? Every consumer platform that runs this kind of check says
 *      the same thing about it, which is that the cost of a false positive is
 *      far higher than the cost of a miss, because the false positive lands on
 *      somebody who just did something they were proud of.
 *   2. **A model.** No training, no per-user threshold fitted from history.
 *      Split conformal prediction cannot even return a finite threshold below
 *      about twenty calibration points, and most people have logged an exercise
 *      three times. The two things the app already knows, what this person has
 *      lifted and what the published standards say somebody their size lifts,
 *      are both available on the first ever set and are what this reads.
 *   3. **A block.** A set that fails is still logged, still shown, and still
 *      counts toward the session's volume. What it loses is the right to set a
 *      record and the right to move the estimator, until somebody confirms it.
 *
 * No database, no network. The logging screen runs it the moment a set is
 * ticked, `finish` runs the identical function server-side over what was
 * actually saved, and a test runs it over neither.
 */

/* -------------------------------------------------------------------------- */
/* Thresholds                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How much better than your own best a single set is allowed to be before it
 * is worth asking about, and how fast that allowance grows with time away.
 *
 * The floor is the number that matters and it is set from the novice envelope,
 * which is the widest genuine one there is: 103 untrained women put 28.2% on a
 * bench press one-rep max over twelve weeks, with a standard deviation of
 * 20.9%, so roughly one in six of them gained more than half again (Mayhew et
 * al., J Strength Cond Res 22(5):1570-1577, 2008). Half of that in a single
 * session is a beginner having a very good day. Ten times it is not a day
 * anybody has.
 *
 * The weekly growth handles the two cases the floor would misread: somebody
 * coming back after a layoff, whose first session back can be well above where
 * they left off once the rust is gone, and somebody who trains a movement
 * rarely enough that "last time" was a season ago. Five per cent a week is
 * above the mean rate that study measured and above one standard deviation of
 * it, deliberately: a threshold tuned to the average beginner flags the fast
 * ones, and the fast ones are real.
 *
 * The cap is where the growth stops mattering. Past three times your best,
 * time off is not the explanation.
 */
const JUMP_FLOOR = 1.5;
const JUMP_WEEKLY = 0.05;
const JUMP_MAX = 3;

/**
 * How far above the published standards for somebody's bodyweight, sex, age
 * and training experience a lift can sit before it is worth asking about.
 *
 * `estimateLoad` already draws a line in the same place for the opposite
 * reason: it clamps its calibration at 2.5, on the grounds that outside that
 * the arithmetic is telling you the model is wrong about the person rather
 * than that the person is that much stronger than the tables. Three is outside
 * that clamp on purpose. The standards model carries a rough exercise
 * catalogue, a bodyweight proportion it admits is wrong at the extremes, and
 * an experience answer somebody picked from five options, so it is allowed to
 * be badly wrong about one person before it is allowed to doubt them.
 */
const PROFILE_CEILING = 3;

/** Kilograms in a pound, for the mix-up that produces exactly this failure. */
const KG_PER_POUND = 0.453_592_37;

/** A misplaced decimal point: 22.5 typed as 225. */
const DECIMAL_SLIP = 10;

/* -------------------------------------------------------------------------- */
/* The check                                                                  */
/* -------------------------------------------------------------------------- */

export type SuspicionKind =
	/** Beyond what any human has done in this movement. */
	| "ceiling"
	/** Far above the published standards for this person. */
	| "profile"
	/** Far above what this person has themselves lifted. */
	| "jump"
	/** Any of the above, but the number reads as pounds in a kilogram box. */
	| "pounds"
	/** Any of the above, but the number reads as a misplaced decimal point. */
	| "decimal";

export type Suspicion = {
	kind: SuspicionKind;
	/**
	 * One sentence for the lifter, ending in a question. Never an accusation:
	 * the app does not know what happened and should not pretend it does.
	 */
	message: string;
	/** What the weight would be under the reading that would have passed. */
	suggestedKg?: number;
};

export type SetCheck = {
	exerciseId: string;
	set: PlannedSet;
	/**
	 * The best estimated one-rep max this user has already logged on this exact
	 * exercise, in whole-lift kilograms, or 0 for a movement they have never
	 * done. The strongest signal there is, and the only one that needs no
	 * profile.
	 */
	bestOneRepMaxKg?: number;
	/**
	 * The last time they trained it, which is what widens the allowance. Absent
	 * is treated as no time off rather than as infinite time off: an unknown gap
	 * must not become a way to make anything plausible.
	 */
	lastDoneAt?: Date | string | null;
	/** Bodyweight, sex, age and experience, when they have filled any of it in. */
	profile?: StrengthProfile;
	/** Today, injected so a test is not a function of the day it runs. */
	now?: Date;
	/** The exercises this user added themselves, for a server-side caller. */
	custom?: ReadonlyMap<string, Exercise>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const round = (kg: number) => Math.round(kg * 10) / 10;

/**
 * What to ask about a logged set, or null when there is nothing to ask.
 *
 * Null is the answer for the overwhelming majority of sets and for every set
 * the check cannot speak to at all: a bodyweight movement, an assisted machine
 * whose number is resistance taken off rather than load put on, a warm-up, a
 * blank box, an exercise nothing can resolve. Silence there is the point.
 * Guessing at a movement the model does not understand is how a plausibility
 * check turns into an app that argues with people about their own training.
 */
export function checkSet(input: SetCheck): Suspicion | null {
	const exercise = exerciseById(input.exerciseId, input.custom);
	if (!exercise) return null;

	const { set } = input;
	const reps = set.reps ?? 0;
	const weightKg = set.weightKg ?? 0;

	// A warm-up earns no record and moves no estimate, so there is nothing for a
	// wrong one to spoil and no reason to interrupt a ramp to ask about it.
	if (!isCounted(set) || reps <= 0 || weightKg <= 0) return null;

	const target = loadCoefficient(exercise);
	// Bodyweight and assisted movements: the number in the box is not load
	// lifted, so no arithmetic over it means anything. This is the same carve
	// out Hevy makes for its own records, and for the same reason.
	if (target.bodyweight || target.coefficient <= 0) return null;

	const failed = reason(input, exercise, target, reps, weightKg);
	if (!failed) return null;

	// The two mix-ups that produce a wrong number rather than a wrong lift. Both
	// are tested the same way: would the set have passed if the box had been
	// read the other way? A yes names the mistake in the question, which is the
	// difference between a prompt somebody can act on and one they dismiss.
	for (const [kind, divisor] of [
		["pounds", 1 / KG_PER_POUND],
		["decimal", DECIMAL_SLIP],
	] as const) {
		const asMeant = weightKg / divisor;
		if (asMeant <= 0) continue;
		if (!reason(input, exercise, target, reps, asMeant)) {
			return {
				kind,
				suggestedKg: round(asMeant),
				message:
					kind === "pounds"
						? `${round(weightKg)} kg is a lot more than you usually lift. Did you mean ${round(weightKg)} lb, which is ${round(asMeant)} kg?`
						: `${round(weightKg)} kg is a lot more than you usually lift. Did you mean ${round(asMeant)} kg?`,
			};
		}
	}

	return { kind: failed.kind, message: failed.message };
}

/**
 * The three tests, strongest statement first, run against a candidate weight.
 *
 * Taken as a function of the weight rather than reading `input.set` directly,
 * because `checkSet` runs it more than once: the second and third runs ask what
 * would have happened had the number meant pounds, or had the decimal point
 * been one place to the left.
 */
function reason(
	input: SetCheck,
	exercise: Exercise,
	target: Coefficient,
	reps: number,
	weightKg: number,
): { kind: SuspicionKind; message: string } | null {
	const estimated = oneRepMax(totalKg(exercise, weightKg), reps);
	// The lift restated as its pattern's reference lift, which is the only form
	// in which a curl and a deadlift can be held to the same kind of ceiling.
	const index = estimated / target.coefficient;
	const { pattern } = target;

	// 1. Nobody has done this.
	if (index > patternCeilingKg(pattern)) {
		return {
			kind: "ceiling",
			message: `${round(weightKg)} kg for ${reps} would be a world record. Is that right?`,
		};
	}

	// 2. Far outside what the standards say for this person. Only asked when the
	//    profile carries enough to say; `predictedOneRepMax` returns null
	//    otherwise rather than defaulting, and a default here would be the app
	//    doubting somebody on the strength of a form they never filled in.
	const predicted = predictedOneRepMax(pattern, input.profile ?? {});
	if (predicted !== null && index > predicted * PROFILE_CEILING) {
		return {
			kind: "profile",
			message: `${round(weightKg)} kg for ${reps} is well beyond what your profile suggests. Is that right?`,
		};
	}

	// 3. Far outside what they have themselves done. Skipped for a movement with
	//    no history: a first set is not a jump from anything, and the two tests
	//    above are what cover it.
	const best = input.bestOneRepMaxKg ?? 0;
	if (best > 0 && estimated > best * allowance(input)) {
		return {
			kind: "jump",
			message: `${round(weightKg)} kg for ${reps} is a big jump on your best here. Is that right?`,
		};
	}

	return null;
}

/**
 * How many times their own best a set is allowed to be today.
 *
 * Grows with the gap since they last trained the movement, capped. A negative
 * or unparseable gap counts as none, so a clock skewed forwards on a phone
 * cannot buy anybody a wider allowance.
 */
function allowance(input: SetCheck): number {
	const last = input.lastDoneAt ? new Date(input.lastDoneAt).getTime() : 0;
	const now = (input.now ?? new Date()).getTime();
	const weeks = last > 0 ? Math.max(0, (now - last) / (7 * DAY_MS)) : 0;

	return Math.min(JUMP_MAX, JUMP_FLOOR * (1 + JUMP_WEEKLY) ** weeks);
}
