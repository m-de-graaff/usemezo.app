import {
	isCounted,
	isTrusted,
	type LoggedSet,
	type PlannedSet,
} from "./workout-shape.ts";

/**
 * Deciding what to put on the bar this week from what went on it last week.
 *
 * The model is **double progression**, which is what most people mean when they
 * say progressive overload and what almost every written programme actually
 * runs. A set has a rep range: three of eight to twelve. You keep the weight
 * and climb the range until every working set is at the top of it, and only
 * then does the weight go up and the reps go back to the bottom. Adding weight
 * every session instead is linear progression, and linear progression works for
 * about six weeks and then stops working for the rest of your life.
 *
 * Two things stop it from being arithmetic:
 *
 *   1. **The bar has a resolution.** You cannot add 1.7 kg to a dumbbell rack.
 *      The jump has to be one the equipment can make, and it has to scale: 2.5
 *      kg is a sensible week on a 40 kg bench and a rounding error on a 220 kg
 *      deadlift.
 *   2. **Effort is not the only input.** Somebody who trained an exercise once
 *      last month has not been overloading anything, and telling them to add
 *      weight because their one session hit the top of the range is the
 *      algorithm inventing a trend from a single point. Gaps hold the weight
 *      where it is; long gaps repeat the session outright.
 *
 * Nothing here decides *whether* to run: the toggle lives on the profile, and a
 * caller that never asks gets the routine exactly as it was written. The
 * failure this guards against is not a weight that is slightly wrong, it is an
 * app that quietly rewrote somebody's programme without being asked.
 *
 * No database, no network, no catalogue import: equipment arrives as the string
 * it already is on the exercise, so a test runs this against a made-up movement
 * without loading eight hundred real ones.
 */

/* -------------------------------------------------------------------------- */
/* What the equipment can actually do                                         */
/* -------------------------------------------------------------------------- */

/**
 * The smallest honest jump, per equipment, in kilograms.
 *
 * These are rack and stack realities rather than preferences. A dumbbell rack
 * goes up in twos, so 1 kg is not a number you can act on; plates on a dipping
 * belt go far finer than that. Anything not listed gets the barbell's 2.5,
 * which is a pair of the smallest plates most gyms own.
 */
const STEP: Record<string, number> = {
	barbell: 2.5,
	"olympic barbell": 2.5,
	"ez barbell": 2.5,
	"trap bar": 2.5,
	"smith machine": 2.5,
	"sled machine": 5,
	"leverage machine": 2.5,
	hammer: 2.5,
	cable: 2.5,
	dumbbell: 2,
	kettlebell: 4,
	assisted: 2.5,
	weighted: 1.25,
	"medicine ball": 1,
};

const STEP_DEFAULT = 2.5;

/**
 * Equipment where the number is resistance taken *off* you, so progress runs
 * downwards. An assisted pull-up at 30 kg of help is worse than one at 20, and
 * an algorithm that adds weight here is walking somebody backwards.
 */
const ASSISTED = new Set(["assisted"]);

/**
 * Equipment with no weight to move. Bodyweight, bands and the cardio machines
 * progress on reps alone, and writing a kilogram figure onto any of them is
 * writing down a number that means nothing.
 */
const NO_LOAD = new Set([
	"body weight",
	"band",
	"resistance band",
	"stationary bike",
	"elliptical machine",
	"skierg machine",
	"stepmill machine",
	"upper body ergometer",
]);

/**
 * How much of the working weight a good week is worth, before the equipment
 * rounds it. Two and a half per cent is the low end of what the literature
 * treats as a meaningful weekly increase, and the low end is the right end: an
 * increment that is too small costs a week, one that is too big costs the next
 * four sessions.
 */
const RELATIVE = 0.025;

/** How far the weight comes down when an exercise has stalled twice. */
const DELOAD = 0.1;

/** Days since the last time, past which the session is repeated rather than raised. */
const STALE_DAYS = 21;

/** Days between the last two sessions, past which a good week does not earn a jump. */
const CONSISTENT_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The jump this equipment can make at this load, in kilograms.
 *
 * The floor is what the rack can do and the scaling is what the lifter can
 * absorb, so the answer is the larger of the two rounded down onto the
 * equipment's own grid. A 220 kg deadlift gets 5 kg; a 40 kg bench gets 2.5;
 * a bodyweight dip gets nothing, because there is nothing to add it to.
 */
export function loadStep(equipment: string, loadKg: number): number {
	if (NO_LOAD.has(equipment)) return 0;

	const base = STEP[equipment] ?? STEP_DEFAULT;
	const scaled = Math.floor((loadKg * RELATIVE) / base) * base;
	return Math.max(base, scaled);
}

/** Onto the equipment's grid, and never below nothing. */
const toGrid = (kg: number, base: number) =>
	Math.max(0, Math.round(kg / base) * base);

/* -------------------------------------------------------------------------- */
/* Reading a session                                                          */
/* -------------------------------------------------------------------------- */

/** One past session of one exercise: when it was, and what got ticked off. */
export type PastSession = { at: Date; sets: LoggedSet[] };

/** What to do with the exercise, and the one line that says why. */
export type Progression = {
	sets: PlannedSet[];
	/** For the lifter, not the log: "Up 2.5 kg", "Held: 24 days off". */
	reason: string;
};

const days = (from: Date, to: Date) =>
	Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);

/**
 * The weight the exercise was actually worked at, or null if that is not a
 * question this session answers.
 *
 * The mode, because a session is usually three sets at one weight plus a
 * heavier single somebody worked up to, and progressing from the single would
 * add weight to a top set that was already a top set.
 *
 * Null when nothing is corroborated: every working set at a different weight is
 * a ramp, or a session somebody kept changing their mind during, and it has no
 * single working weight to add to. A tie-break would have to invent one, and
 * inventing one is how a lifter working at 32.5 kg gets handed 215 — the
 * heaviest number in a session that never repeated anything. One working set is
 * its own corroboration: there was nothing for it to disagree with.
 *
 * ponytail: a deliberate ramp (60, 70, 80 across three sets) therefore
 * progresses nothing. Double progression has no opinion about ramps; give them
 * their own rule if anyone programmes them seriously.
 */
function workingLoad(sets: LoggedSet[]): number | null {
	if (sets.length === 1) return sets[0]?.weightKg ?? 0;

	const counts = new Map<number, number>();
	for (const set of sets) {
		const load = set.weightKg ?? 0;
		counts.set(load, (counts.get(load) ?? 0) + 1);
	}

	let best: number | null = null;
	let bestCount = 1;
	for (const [load, count] of counts) {
		if (
			count > bestCount ||
			(count === bestCount && best !== null && load > best)
		) {
			best = load;
			bestCount = count;
		}
	}
	return best;
}

/**
 * The working sets somebody actually did: ticked, not a warm-up, and not under
 * an unanswered plausibility question.
 *
 * The last of the three is what stops one mistyped number becoming next week's
 * programme. A set logged at ten times the working weight would otherwise be
 * read as a hit, and the weight it hands back is a weight nobody can lift.
 */
const workingSets = (sets: LoggedSet[]) =>
	sets.filter((set) => set.done && isCounted(set) && isTrusted(set));

/**
 * What one session did against a rep target, at one weight.
 *
 * `hit` needs every planned working set to reach the top of the range. Three of
 * eight to twelve with two sets at twelve and one at nine is not a session that
 * has earned more weight, and calling it one is how the fourth week of a
 * programme becomes a week of failed sets.
 */
function judge(
	sets: LoggedSet[],
	load: number,
	bottom: number,
	top: number,
	plannedSets: number,
): "hit" | "partial" | "missed" {
	const atLoad = sets.filter((set) => (set.weightKg ?? 0) === load);
	if (atLoad.length === 0) return "missed";

	const bestReps = Math.max(...atLoad.map((set) => set.reps ?? 0));
	if (bestReps < bottom) return "missed";

	const full =
		atLoad.length >= plannedSets &&
		atLoad.every((set) => (set.reps ?? 0) >= top);

	return full ? "hit" : "partial";
}

/* -------------------------------------------------------------------------- */
/* The decision                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What this exercise should be seeded with today, or null to leave it alone.
 *
 * Null is the honest answer more often than it looks. An exercise with no
 * history has nothing to progress from, and an exercise whose last session was
 * never ticked off has nothing that happened. Both come back untouched rather
 * than with a number this function made up.
 *
 * `planned` is the routine as written: it owns the set count and the rep range,
 * and this only ever rewrites the load and the rep target inside it. Warm-ups
 * are carried along in proportion rather than progressed in their own right —
 * see `rampTo`, which is where the reasoning for that lives.
 */
export function progressExercise({
	equipment,
	now,
	past,
	planned,
}: {
	equipment: string;
	/** Today, injected so a test is not a function of the day it runs. */
	now: Date;
	/** The exercise's own recent sessions, newest first. */
	past: PastSession[];
	/** The routine's sets for this exercise, warm-ups included. */
	planned: PlannedSet[];
}): Progression | null {
	const last = past[0];
	if (!last) return null;

	const done = workingSets(last.sets);
	if (done.length === 0) return null;

	const plannedWorking = planned.filter(isCounted);
	if (plannedWorking.length === 0) return null;

	// The range comes from the routine when it has one, and from what was done
	// last time when it does not. A routine that says "8" is a target of eight,
	// not a range of eight to eight that can never be beaten.
	const target = plannedWorking[0];
	const top = target?.repsMax ?? target?.reps;
	const bottom = target?.reps ?? top;
	if (top === undefined || bottom === undefined) return null;

	const load = workingLoad(done);
	if (load === null) return null;

	// A movement logged at no weight is a movement with no weight to add,
	// whatever its equipment claims. This is also what keeps an exercise
	// somebody added themselves, whose equipment nothing here knows, from having
	// a first kilogram invented for it.
	const step = load > 0 ? loadStep(equipment, load) : 0;
	const base = STEP[equipment] ?? STEP_DEFAULT;
	const direction = ASSISTED.has(equipment) ? -1 : 1;

	/** What the routine's own ramp was written against. */
	const plannedLoad = plannedWorking[0]?.weightKg;

	/**
	 * A warm-up, moved with the working weight it ramps to.
	 *
	 * Held as a fraction of the work set rather than as the number somebody
	 * typed, because that is what a warm-up actually is: forty per cent, sixty,
	 * eighty. Leaving them fixed reads harmless for one session and rots over a
	 * block — twenty sessions of adding 2.5 kg takes a 60 kg bench to 110 while
	 * the ramp still tops out at 40, and a 70 kg jump into the first work set is
	 * not a warm-up, it is the thing warming up exists to prevent.
	 *
	 * Floored onto the equipment's grid, never rounded up. That is what keeps a
	 * single 2.5 kg step from jittering a ramp of 20, 30, 40 into 20, 32.5, 42.5
	 * for no reason: a four per cent move floors straight back to where it was,
	 * so warm-ups only shift once the work set has genuinely travelled.
	 */
	const rampTo = (working: number, set: PlannedSet): PlannedSet => {
		if (
			step === 0 ||
			set.weightKg === undefined ||
			plannedLoad === undefined ||
			plannedLoad <= 0
		) {
			return set;
		}

		const scaled =
			Math.floor((working * (set.weightKg / plannedLoad)) / base) * base;
		// A warm-up at or above the work set is not a warm-up. Only meaningful in
		// the loading direction; on assisted equipment more is easier, so a higher
		// number there is the ramp working as intended.
		const ceiling =
			direction > 0 ? Math.max(0, working - base) : Number.POSITIVE_INFINITY;

		return { ...set, weightKg: Math.max(0, Math.min(scaled, ceiling)) };
	};

	const seed = (weightKg: number, reps: number, reason: string) => ({
		reason,
		sets: planned.map((set) =>
			isCounted(set)
				? {
						...set,
						reps,
						// A target above the routine's own ceiling is not a range any
						// more. Bodyweight climbs past it by design, and the two screens
						// that render a pair sort it, so leaving both would prescribe
						// "12-13" for a set whose target is thirteen.
						...(set.repsMax !== undefined && reps > set.repsMax
							? { repsMax: undefined }
							: {}),
						// Zero stays zero. A bodyweight movement is logged at 0 kg and
						// writing a load onto it would make the history say otherwise.
						...(step === 0 ? {} : { weightKg }),
					}
				: rampTo(weightKg, set),
		),
	});

	// Back after a long time off. Strength comes back fast but it does not come
	// back on the walk from the car park, and the session that starts a return
	// is the one you already know you can do.
	const off = days(last.at, now);
	if (off > STALE_DAYS) {
		return seed(
			load,
			bottom,
			`Repeating your last session after ${Math.round(off)} days off.`,
		);
	}

	const verdict = judge(done, load, bottom, top, plannedWorking.length);

	if (verdict === "hit") {
		// One good session after a three week gap is one good session. The weight
		// holds and the range gets confirmed before anything is added to the bar.
		const gap = past[1] ? days(past[1].at, last.at) : 0;
		if (gap > CONSISTENT_DAYS) {
			return seed(
				load,
				top,
				`Holding the weight until this lands twice: ${Math.round(gap)} days between the last two.`,
			);
		}

		if (step === 0) {
			// Nothing to load, so the range itself moves. This is how a bodyweight
			// movement progresses, and it is the only way it can.
			//
			// Counted from what was actually done rather than from the routine's
			// ceiling: the routine is written once and the climb passes it in a
			// week, so reading `top` here parks every bodyweight movement at
			// twelve reps for ever.
			const best = Math.max(
				top,
				...done
					.filter((set) => (set.weightKg ?? 0) === load)
					.map((set) => set.reps ?? 0),
			);
			return seed(load, best + 1, `Up to ${best + 1} reps.`);
		}

		const next = toGrid(load + step * direction, base);
		return seed(
			next,
			bottom,
			direction < 0
				? `Down to ${next} kg of assistance.`
				: `Up ${step} kg, back to ${bottom} reps.`,
		);
	}

	if (verdict === "missed") {
		// Twice at the same weight is a stall, not a bad night. The deload is the
		// thing that turns a stall into a run at it rather than a month of
		// grinding the same failed session.
		const before = past[1];
		const stalled =
			before !== undefined &&
			workingLoad(workingSets(before.sets)) === load &&
			judge(
				workingSets(before.sets),
				load,
				bottom,
				top,
				plannedWorking.length,
			) === "missed";

		if (stalled && step > 0) {
			const next = toGrid(load * (1 - DELOAD * direction), base);
			return seed(
				next,
				bottom,
				`Stalled twice. Back to ${next} kg to rebuild.`,
			);
		}

		return seed(load, bottom, "Same again. One session is not a trend.");
	}

	return seed(load, top, `Same weight, working up to ${top} reps.`);
}
