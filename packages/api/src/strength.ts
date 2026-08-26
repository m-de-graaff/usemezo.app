import { type Exercise, exerciseById } from "./exercises.ts";
import { ageFrom } from "./plan.ts";

/**
 * What weight to put on the bar.
 *
 * Three questions, one model behind all of them:
 *
 *   1. Somebody has never logged anything. What should they start with?
 *   2. They have logged a preacher curl and now want a cable curl. What
 *      transfers?
 *   3. They logged 8 reps at 60 kg last week and want 12 today. What is that?
 *
 * The answer to all three is a **strength index**: one number per movement
 * pattern, expressed as the one-rep max of that pattern's reference lift. Every
 * exercise in the catalogue carries a coefficient relative to its pattern's
 * reference, so a load in any exercise converts to an index and back out into
 * any other exercise:
 *
 *     index = logged 1RM / coefficient(A)
 *     load  = index × coefficient(B) × percent of 1RM for the target reps
 *
 * With nothing logged at all the index comes from published strength standards
 * scaled by bodyweight, sex, training age and body composition. With something
 * logged it comes from the log, and anything the log cannot reach is corrected
 * by how far the user sits from the standards on what they *have* logged. So
 * the estimate gets better the more they train, without anybody wiring up a
 * second system for it.
 *
 * Everything here is a heuristic over a thousand-row catalogue that carries no
 * biomechanics of its own. `estimateLoad` says so: it returns what it based the
 * number on and how much to trust it, and whatever renders it has to show that
 * alongside the weight. A confident wrong number is the failure mode that
 * matters, because somebody trains to it.
 *
 * No server-only imports: a Server Component, a tool call and a test all run it.
 */

/* -------------------------------------------------------------------------- */
/* One-rep maxima                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Estimated 1RM from a set taken to (or near) failure.
 *
 * Brzycki up to ten reps and Epley past it, which is where each is known to be
 * least wrong: Brzycki returns the weight itself at a single rep and drifts
 * high on long sets, Epley overstates a heavy single and holds up better at
 * fifteen. Picking one of the two everywhere would buy a shorter function and a
 * worse number at one end of the range.
 */
export function oneRepMax(weightKg: number, reps: number): number {
	if (reps <= 1) return weightKg;
	return reps <= 10
		? (weightKg * 36) / (37 - reps)
		: weightKg * (1 + reps / 30);
}

/** The share of a 1RM a set of `reps` should be loaded at. The inverse of above. */
export function percentOfMax(reps: number): number {
	if (reps <= 1) return 1;
	return reps <= 10 ? (37 - reps) / 36 : 1 / (1 + reps / 30);
}

/**
 * Reps in reserve, folded into the rep count.
 *
 * A set of eight with two left in the tank loads like a set of ten taken to
 * failure. That equivalence is the whole of how RIR enters the arithmetic, and
 * it is why every function here takes reps and RIR rather than a percentage:
 * a percentage is a number a lifter has to work out, and reps at an RIR is what
 * they actually write down.
 */
const effortReps = (reps: number, rir: number) => Math.max(1, reps + rir);

/* -------------------------------------------------------------------------- */
/* Movement patterns                                                          */
/* -------------------------------------------------------------------------- */

export type Pattern =
	| "horizontal-push"
	| "vertical-push"
	| "horizontal-pull"
	| "vertical-pull"
	| "squat"
	| "leg-press"
	| "lunge"
	| "hinge"
	| "hip-thrust"
	| "leg-extension"
	| "leg-curl"
	| "hip-abduction"
	| "calf"
	| "elbow-flexion"
	| "elbow-extension"
	| "lateral-raise"
	| "rear-delt"
	| "chest-fly"
	| "pullover"
	| "shrug"
	| "abs"
	| "wrist"
	| "neck";

type PatternSpec = {
	/** The lift the coefficients are relative to, named for a human. */
	reference: string;
	/**
	 * That lift's 1RM as a multiple of bodyweight, for an intermediate man:
	 * a couple of years of consistent training, not a competitor. The mid
	 * "intermediate" column of the published strength standards, which is where
	 * the tables agree with each other most closely.
	 */
	base: number;
	/**
	 * The same lift for a woman, as a share of the male number. The gap is
	 * widest on upper-body pressing and narrowest on the squat and deadlift,
	 * which is why this is per pattern rather than one constant.
	 */
	female: number;
	/** Load relative to the reference implement. `DEFAULT_EQUIPMENT` fills the gaps. */
	equipment?: Record<string, number>;
};

/** Machine-referenced isolation: the stack is the unit, everything else is less. */
const MACHINE_ISOLATION: Record<string, number> = {
	"leverage machine": 1,
	"sled machine": 1.1,
	cable: 0.85,
	"smith machine": 0.9,
	barbell: 0.8,
	dumbbell: 0.4,
	band: 0.2,
};

/** Dumbbell-referenced isolation, logged per hand rather than per pair. */
const PER_HAND: Record<string, number> = {
	dumbbell: 1,
	kettlebell: 0.95,
	cable: 0.95,
	"leverage machine": 2.2,
	barbell: 2.0,
	"ez barbell": 1.9,
	band: 0.5,
};

/**
 * How much can be moved in each pattern, and with what.
 *
 * The `base` column is the load-bearing one and the one to tune. Everything
 * else in this file is arithmetic over it.
 *
 * ponytail: strength is treated as proportional to bodyweight, which overstates
 * a very heavy lifter and understates a very light one — the real relationship
 * is closer to bodyweight to the two-thirds. Worth fixing when somebody at the
 * ends of the range complains; not worth the exponent before then.
 */
const PATTERNS: Record<Pattern, PatternSpec> = {
	"horizontal-push": {
		reference: "barbell bench press",
		base: 1.0,
		female: 0.6,
	},
	"vertical-push": {
		reference: "barbell overhead press",
		base: 0.6,
		female: 0.6,
	},
	"horizontal-pull": {
		reference: "barbell bent-over row",
		base: 0.9,
		female: 0.65,
		equipment: { cable: 1.05, "leverage machine": 1.05 },
	},
	"vertical-pull": {
		reference: "lat pulldown",
		base: 0.85,
		female: 0.65,
		equipment: {
			cable: 1,
			"leverage machine": 1.05,
			barbell: 1.05,
			"smith machine": 1.05,
			dumbbell: 0.5,
			weighted: 0.35,
			band: 0.3,
		},
	},
	squat: { reference: "barbell back squat", base: 1.5, female: 0.75 },
	"leg-press": {
		reference: "leg press",
		base: 2.4,
		female: 0.8,
		equipment: {
			"leverage machine": 1,
			"sled machine": 1,
			"smith machine": 0.55,
			barbell: 0.55,
		},
	},
	lunge: {
		reference: "barbell lunge",
		base: 0.7,
		female: 0.75,
		equipment: { dumbbell: 0.5, kettlebell: 0.5 },
	},
	hinge: {
		reference: "conventional deadlift",
		base: 2.0,
		female: 0.75,
		equipment: {
			"trap bar": 1.05,
			dumbbell: 0.45,
			kettlebell: 0.45,
			cable: 0.7,
			"leverage machine": 1,
		},
	},
	"hip-thrust": { reference: "barbell hip thrust", base: 1.6, female: 0.85 },
	"leg-extension": {
		reference: "machine leg extension",
		base: 0.75,
		female: 0.75,
		equipment: MACHINE_ISOLATION,
	},
	"leg-curl": {
		reference: "machine leg curl",
		base: 0.5,
		female: 0.8,
		equipment: MACHINE_ISOLATION,
	},
	"hip-abduction": {
		reference: "machine hip abduction",
		base: 0.55,
		female: 0.9,
		equipment: MACHINE_ISOLATION,
	},
	calf: {
		reference: "standing calf raise",
		base: 1.5,
		female: 0.8,
		equipment: MACHINE_ISOLATION,
	},
	"elbow-flexion": {
		reference: "standing barbell curl",
		base: 0.45,
		female: 0.6,
		equipment: { cable: 0.9, "ez barbell": 0.95 },
	},
	"elbow-extension": {
		reference: "cable pushdown",
		base: 0.55,
		female: 0.6,
		equipment: {
			cable: 1,
			barbell: 0.85,
			"ez barbell": 0.8,
			dumbbell: 0.35,
			"leverage machine": 1.1,
			band: 0.3,
			weighted: 0.5,
		},
	},
	"lateral-raise": {
		reference: "dumbbell lateral raise, one hand",
		base: 0.16,
		female: 0.65,
		equipment: PER_HAND,
	},
	"rear-delt": {
		reference: "dumbbell rear delt fly, one hand",
		base: 0.14,
		female: 0.7,
		equipment: PER_HAND,
	},
	"chest-fly": {
		reference: "dumbbell fly, one hand",
		base: 0.28,
		female: 0.6,
		equipment: PER_HAND,
	},
	pullover: {
		reference: "dumbbell pullover",
		base: 0.28,
		female: 0.65,
		equipment: { dumbbell: 1, cable: 1.4, barbell: 1.3, "ez barbell": 1.25 },
	},
	shrug: {
		reference: "barbell shrug",
		base: 1.7,
		female: 0.7,
		equipment: { dumbbell: 0.45, "smith machine": 1.05, cable: 0.85 },
	},
	abs: {
		reference: "cable crunch",
		base: 0.45,
		female: 0.75,
		equipment: {
			cable: 1,
			"leverage machine": 1.1,
			weighted: 0.5,
			dumbbell: 0.5,
			barbell: 0.9,
			"medicine ball": 0.2,
		},
	},
	wrist: {
		reference: "barbell wrist curl",
		base: 0.35,
		female: 0.6,
		equipment: { dumbbell: 0.45, "ez barbell": 0.95, cable: 0.85 },
	},
	neck: {
		reference: "weighted neck extension",
		base: 0.15,
		female: 0.7,
		equipment: { weighted: 1, "leverage machine": 1.1, band: 0.4 },
	},
};

/**
 * Load an implement carries relative to a barbell, when the pattern says
 * nothing more specific.
 *
 * A dumbbell entry is the weight of *one* dumbbell, because that is the number
 * a lifter writes in the app: 0.42 means a pair of 40s presses about like a
 * 95 kg barbell, which is the 80-ish percent that the barbell-to-dumbbell
 * comparisons keep landing on once both hands are counted.
 *
 * A zero is not a missing entry. It means the implement adds no external load,
 * so the exercise is scored by reps and the estimate says as much.
 */
const DEFAULT_EQUIPMENT: Record<string, number> = {
	barbell: 1,
	"olympic barbell": 1,
	"ez barbell": 0.95,
	"trap bar": 1.05,
	"smith machine": 1.05,
	"leverage machine": 1.15,
	"sled machine": 1.7,
	cable: 0.8,
	dumbbell: 0.42,
	kettlebell: 0.4,
	weighted: 0.3,
	band: 0.25,
	"resistance band": 0.25,
	rope: 0.3,
	hammer: 0.3,
	tire: 0.5,
	"medicine ball": 0.1,

	// Nothing external to load, or nothing a weight field means anything for.
	"body weight": 0,
	assisted: 0,
	"stability ball": 0,
	"bosu ball": 0,
	roller: 0,
	"wheel roller": 0,
	"upper body ergometer": 0,
	"skierg machine": 0,
	"stationary bike": 0,
	"elliptical machine": 0,
	"stepmill machine": 0,
};

/**
 * Name fragments that change what a movement is worth, matched in order.
 *
 * ponytail: one table for every pattern, so "incline" costs a press 18% and
 * costs a curl the same 18% when the real figures are 20% and 25%. Within the
 * error the rest of this file already carries. Split it per pattern if a
 * specific variation starts reading wrong.
 */
const MODIFIERS: [RegExp, number][] = [
	[/\bdecline\b/, 1.05],
	[/\bincline\b|\bprone\b/, 0.82],
	[/\bclose[ -]?grip\b/, 0.92],
	[/\bwide\b/, 0.95],
	[/\breverse\b/, 0.85],
	[/behind (the )?neck/, 0.8],
	[/\boverhead\b/, 0.75],
	[/\bpause\b|\bpaused\b/, 0.9],
	[/\bdeficit\b/, 0.9],
	[/\bsumo\b/, 1.05],
	[/\bromanian\b|\bstiff[ -]?leg|\bstraight[ -]?leg/, 0.7],
	[/\bfront\b/, 0.8],
	[/\bgoblet\b/, 0.45],
	[/\bpreacher\b/, 0.85],
	[/\bconcentration\b/, 0.6],
	[/\bspider\b/, 0.78],
	[/\bdrag\b/, 0.8],
	[/\bhammer\b/, 1.05],
	[/\bzottman\b/, 0.7],
	[/\bbulgarian\b|\bsplit squat\b/, 0.5],
	[/\bpin\b|\brack\b|\bblock\b/, 1.1],
	[/\bpulse\b|\bpartial\b|\btempo\b|\bslow\b/, 0.9],
	[/\bjump\b|\bplyo\b|\bexplosive\b/, 0.4],
	[/\bsissy\b/, 0.3],
	[/\bstraight[ -]?arm\b|\bstiff[ -]?arm\b/, 0.5],
	[/\bupright\b/, 0.4],
	// A face pull is filed as a rear-delt movement, and the rear-delt
	// reference is one dumbbell. Both hands on one stack is several times that.
	[/face pull/, 3],
	[/seated calf/, 0.55],
];

/** Fragments that say the logged number is what one limb moved. */
const UNILATERAL =
	/\bone[ -]arm\b|\bsingle[ -]arm\b|\bone[ -]leg\b|\bsingle[ -]leg\b|\balternat|\bunilateral\b|\bone[ -]hand\b/;

/** Implements whose logged number is already per limb. */
const PER_HAND_EQUIPMENT = new Set(["dumbbell", "kettlebell"]);

const name = (exercise: Exercise) => exercise.name.toLowerCase();

/**
 * Which pattern an exercise belongs to.
 *
 * The catalogue's `target` decides the neighbourhood and the name decides the
 * street. Order matters: "leg press" has to be caught before the quads default
 * sends it to the squat, and a "close-grip bench press" is a triceps movement
 * by target but a horizontal press by load.
 */
export function patternOf(exercise: Exercise): Pattern {
	const text = name(exercise);
	const target = exercise.target;

	// Named movements first, wherever the dataset files them.
	if (/calf|toe raise|donkey raise/.test(text)) return "calf";
	if (/leg press|hack squat/.test(text)) return "leg-press";
	if (/lunge|split squat|step[ -]?up/.test(text)) return "lunge";
	if (/hip thrust|glute bridge|\bbridge\b/.test(text)) return "hip-thrust";
	if (/shrug/.test(text)) return "shrug";
	if (/pullover/.test(text)) return "pullover";
	if (/leg extension/.test(text)) return "leg-extension";
	if (/leg curl/.test(text)) return "leg-curl";
	if (/abduct|adduct|thigh/.test(text)) return "hip-abduction";
	if (/wrist curl|wrist extension/.test(text)) return "wrist";
	if (
		/bench press|chest press|push[ -]?up|\bdip\b|floor press|\bpress[ -]?up/.test(
			text,
		)
	)
		return "horizontal-push";
	if (
		/deadlift|good morning|hyperextension|back extension|\bpull[ -]through/.test(
			text,
		)
	)
		return "hinge";
	if (/pull[ -]?down|pull[ -]?up|chin[ -]?up|\bpullup\b|\bchinup\b/.test(text))
		return "vertical-pull";
	if (/\brow\b|\brows\b/.test(text)) return "horizontal-pull";
	if (/lateral raise|side raise|\blateral\b/.test(text)) return "lateral-raise";
	if (/rear delt|reverse fly|rear lateral|face pull/.test(text))
		return "rear-delt";
	if (/\bfly\b|\bflye\b|pec deck|\bcrossover\b/.test(text)) return "chest-fly";
	if (
		/overhead press|shoulder press|military press|arnold press|\bpush press\b|upright row/.test(
			text,
		)
	)
		return "vertical-push";
	if (/squat/.test(text)) return "squat";

	// Then whatever the target says, which is right for the isolation work that
	// makes up most of the catalogue.
	switch (target) {
		case "pectorals":
			return "horizontal-push";
		case "delts":
			return "vertical-push";
		case "lats":
			return "vertical-pull";
		case "upper back":
			return "horizontal-pull";
		case "traps":
		case "levator scapulae":
			return "shrug";
		case "biceps":
			return "elbow-flexion";
		case "triceps":
			return "elbow-extension";
		case "forearms":
			return "wrist";
		case "quads":
			return "squat";
		case "hamstrings":
			return "leg-curl";
		case "glutes":
			return "hip-thrust";
		case "calves":
			return "calf";
		case "adductors":
		case "abductors":
			return "hip-abduction";
		case "spine":
			return "hinge";
		default:
			return "abs";
	}
}

export type Coefficient = {
	pattern: Pattern;
	/** Logged load as a share of the pattern's reference lift. 0 means bodyweight. */
	coefficient: number;
	/** True when no weight field can describe the set. */
	bodyweight: boolean;
};

/**
 * What one unit of load in this exercise is worth, against its pattern's
 * reference lift.
 *
 * This is the number the whole file turns on: `1.0` is the reference itself,
 * `0.42` is one dumbbell of a pair, `0.85` is a preacher curl against a
 * standing one.
 */
export function loadCoefficient(exercise: Exercise): Coefficient {
	const pattern = patternOf(exercise);
	const spec = PATTERNS[pattern];
	const text = name(exercise);

	const implement =
		spec.equipment?.[exercise.equipment] ??
		DEFAULT_EQUIPMENT[exercise.equipment] ??
		0.5;

	// An assisted machine's number is how much of the lifter is taken away, so
	// it is not a load at all, and a heavier number means a weaker set. Nothing
	// downstream can use that, so it is reported as bodyweight and left alone.
	//
	// "weighted" pull-ups, dips and crunches are the same problem from the other
	// side: a plate on a dip belt is added load, not the load, and this model
	// cannot turn it into a curl.
	if (implement === 0 || /\bassisted\b/.test(text)) {
		return { pattern, coefficient: 0, bodyweight: true };
	}

	let coefficient = implement;
	for (const [token, factor] of MODIFIERS) {
		if (token.test(text)) coefficient *= factor;
	}

	if (UNILATERAL.test(text)) {
		// A one-arm dumbbell row is not half a two-dumbbell row: the number is
		// already per hand, and bracing against a bench buys a little more. A
		// one-arm cable row is half the cable, because the cable was the whole.
		coefficient *= PER_HAND_EQUIPMENT.has(exercise.equipment) ? 1.15 : 0.5;
	}

	return { pattern, coefficient, bodyweight: false };
}

/* -------------------------------------------------------------------------- */
/* The strength index                                                          */
/* -------------------------------------------------------------------------- */

export type StrengthProfile = {
	weightKg?: number | null;
	heightCm?: number | null;
	gender?: string | null;
	birthDate?: string | null;
	fitnessExperience?: string | null;
	bodyFatPercent?: number | null;
};

/**
 * Where each experience answer sits against the intermediate standards the
 * `base` column is written in. The keys are `FITNESS_EXPERIENCE` in
 * `./profile-fields`; `strength.test.ts` holds the two lists together.
 */
const EXPERIENCE_STRENGTH: Record<string, number> = {
	none: 0.45,
	beginner: 0.68,
	intermediate: 1,
	advanced: 1.32,
	athlete: 1.55,
};

/**
 * Body fat the standards implicitly assume. Strength tracks lean mass far more
 * closely than it tracks the scale, so two people at 90 kg and 12% and 32% body
 * fat are not the same lifter, and pretending otherwise hands the heavier one a
 * first session they cannot finish.
 */
const REFERENCE_BODY_FAT: Record<string, number> = { male: 18, female: 28 };
const REFERENCE_BODY_FAT_UNKNOWN = 23;

/** Past the mid-thirties, roughly three-quarters of a percent a year. */
function ageFactor(birthDate: string | null | undefined): number {
	if (!birthDate) return 1;
	const age = ageFrom(birthDate);
	if (!Number.isFinite(age) || age <= 0 || age > 120) return 1;
	if (age < 18) return 0.8;
	if (age <= 35) return 1;
	return Math.max(0.55, 1 - 0.0075 * (age - 35));
}

/**
 * The bodyweight the standards should be read against: the user's own, moved
 * towards what they would weigh at the reference body composition.
 */
function effectiveBodyweight(profile: StrengthProfile): number | null {
	const weight = profile.weightKg;
	if (!weight) return null;
	if (!profile.bodyFatPercent) return weight;

	const reference = profile.gender
		? (REFERENCE_BODY_FAT[profile.gender] ?? REFERENCE_BODY_FAT_UNKNOWN)
		: REFERENCE_BODY_FAT_UNKNOWN;

	const lean = weight * (1 - profile.bodyFatPercent / 100);
	const adjusted = lean / (1 - reference / 100);

	// Clamped, because a body fat reading is the least reliable number in the
	// profile and a mistyped one should not double somebody's first squat.
	return Math.min(weight * 1.25, Math.max(weight * 0.7, adjusted));
}

/**
 * The 1RM the published standards predict for this pattern, before anything
 * the user has actually lifted is taken into account. `null` when the profile
 * does not carry enough to say — the same rule `./plan` follows, and for the
 * same reason: a default dressed as an answer is worse than no answer.
 */
export function predictedOneRepMax(
	pattern: Pattern,
	profile: StrengthProfile,
): number | null {
	const bodyweight = effectiveBodyweight(profile);
	if (!bodyweight) return null;

	const spec = PATTERNS[pattern];
	const female = spec.female;
	// Neither of the two columns fits everyone, so anything that is not male or
	// female takes the midpoint rather than being assigned to one of them.
	const sex =
		profile.gender === "male"
			? 1
			: profile.gender === "female"
				? female
				: (1 + female) / 2;

	const experience = profile.fitnessExperience
		? (EXPERIENCE_STRENGTH[profile.fitnessExperience] ?? 1)
		: // Nobody who has not answered gets an intermediate's numbers on a first
			// session. Between beginner and intermediate, closer to beginner.
			0.8;

	return (
		bodyweight * spec.base * sex * experience * ageFactor(profile.birthDate)
	);
}

/* -------------------------------------------------------------------------- */
/* Estimating a working weight                                                */
/* -------------------------------------------------------------------------- */

/** A set the user actually did. The best one of these per exercise is enough. */
export type LiftRecord = {
	exerciseId: string;
	weightKg: number;
	reps: number;
	/** When it was done. Only used to prefer a recent lift over an old one. */
	at?: Date | string | null;
};

export type LoadEstimate = {
	exerciseId: string;
	reps: number;
	rir: number;
	/**
	 * Kilograms, rounded to something the gym actually has. 0 for bodyweight.
	 *
	 * Plates only on a barbell, EZ bar or trap bar, which is how this app logs
	 * them: this is the number to load, not the number the lift weighs.
	 */
	weightKg: number;
	/** The estimated one-rep max behind it, in the same plates-only terms. */
	oneRepMaxKg: number;
	basis: "logged" | "transferred" | "calibrated" | "profile" | "bodyweight";
	confidence: "high" | "medium" | "low";
	/** The exercise a transfer came from, when it came from one. */
	fromExerciseId?: string;
	/** One sentence, for a card or a chat reply to quote verbatim. */
	why: string;
};

/**
 * What the bar itself weighs, for the equipment this app logs as plates only.
 *
 * The logging convention (see `loggingHint`) is that a barbell set is the
 * plates on the sleeves, because nobody should be adding 20 kg in their head
 * between sets. Published strength standards are the whole lift, so the two
 * have to be reconciled somewhere, and this is that somewhere: the bar is added
 * on the way into the model and taken off again on the way out.
 *
 * Get this backwards and the failure is not cosmetic. A standards-derived 60 kg
 * bench read as plates is 80 kg on the bar, handed to somebody who has logged
 * nothing — which is exactly the person least able to bail out of it.
 *
 * Only real bars. A Smith carriage and a leverage arm are also logged as plates
 * and their own weight is unknowable, so there is nothing honest to add.
 */
const BAR_KG: Record<string, number> = {
	barbell: 20,
	"olympic barbell": 20,
	"ez barbell": 8,
	"trap bar": 25,
};

const barKg = (exercise: Exercise) => BAR_KG[exercise.equipment] ?? 0;

/**
 * The whole lift, from what was logged. Plates plus the bar they went on.
 *
 * Everything that compares a lift against the standards, or carries one across
 * to another movement, has to run on this rather than on the logged number:
 * a 60 kg bench and a 60 kg dumbbell row are not 60 kg of the same thing.
 */
export const totalKg = (exercise: Exercise, loggedKg: number) =>
	loggedKg + barKg(exercise);

/**
 * The number to put on screen: what goes on the sleeves, floored.
 *
 * Floored to 2.5 kg because plates come in pairs and 1.25 either side is the
 * finest most gyms stock. Zero is a real answer — it is an empty bar, and for
 * somebody whose estimate lands under 20 kg it is the right one.
 */
const platesFor = (exercise: Exercise, totalLoadKg: number) => {
	const bar = barKg(exercise);
	if (bar === 0) return roundLoad(exercise, totalLoadKg);
	return Math.max(0, Math.floor((totalLoadKg - bar) / 2.5) * 2.5);
};

/** Half a stall's worth of load, by what the gym stocks. */
function increment(exercise: Exercise, weightKg: number): number {
	if (weightKg < 10) return 1;
	if (PER_HAND_EQUIPMENT.has(exercise.equipment))
		return weightKg < 24 ? 2 : 2.5;
	return 2.5;
}

/** Rounded down, never up: the first set of something new should be too easy. */
function roundLoad(exercise: Exercise, weightKg: number): number {
	const step = increment(exercise, weightKg);
	return Math.max(step, Math.floor(weightKg / step) * step);
}

const timeOf = (at: LiftRecord["at"]) => (at ? new Date(at).getTime() || 0 : 0);

/**
 * What to load, and how much to believe it.
 *
 * The ladder, best rung first:
 *
 *   1. **logged** — they have done this exact exercise. Their own number.
 *   2. **transferred** — they have done something in the same pattern. The
 *      coefficient ratio carries it across, which is the case the user asks
 *      for by name: preacher curl to cable curl.
 *   3. **calibrated** — they have logged something, but nothing near. How far
 *      they sit above or below the standards on what they *have* logged is
 *      applied to the standards for this pattern.
 *   4. **profile** — nothing logged. Bodyweight, sex, age, experience and body
 *      composition against the published standards.
 *
 * `history` should be the user's best set per exercise, not every set they have
 * ever done: this reads all of it, and one row per movement is what makes that
 * cheap.
 */
export function estimateLoad(input: {
	exerciseId: string;
	reps: number;
	rir?: number;
	history?: LiftRecord[];
	profile?: StrengthProfile;
	/**
	 * The exercises this user added themselves. Server callers pass their own
	 * user's map; in the browser `exerciseById` finds the registered list.
	 */
	custom?: ReadonlyMap<string, Exercise>;
}): LoadEstimate | null {
	const exercise = exerciseById(input.exerciseId, input.custom);
	if (!exercise) return null;

	const reps = Math.max(1, Math.round(input.reps));
	const rir = Math.max(0, Math.round(input.rir ?? 2));
	const target = loadCoefficient(exercise);
	const history = (input.history ?? []).filter(
		(record) => record.weightKg > 0 && record.reps > 0,
	);
	const profile = input.profile ?? {};

	const done = (
		oneRepMaxKg: number,
		basis: LoadEstimate["basis"],
		confidence: LoadEstimate["confidence"],
		why: string,
		fromExerciseId?: string,
	): LoadEstimate => ({
		exerciseId: exercise.id,
		reps,
		rir,
		// The model works in whole lifts; the lifter works in plates.
		weightKg: platesFor(
			exercise,
			oneRepMaxKg * percentOfMax(effortReps(reps, rir)),
		),
		oneRepMaxKg: Math.round(platesFor(exercise, oneRepMaxKg) * 10) / 10,
		basis,
		confidence,
		why,
		...(fromExerciseId ? { fromExerciseId } : {}),
	});

	if (target.bodyweight) {
		return {
			exerciseId: exercise.id,
			reps,
			rir,
			weightKg: 0,
			oneRepMaxKg: 0,
			basis: "bodyweight",
			confidence: "high",
			why: `${exercise.name} carries no external load, so ${reps} reps at ${rir} in reserve is the whole prescription.`,
		};
	}

	// 1. Their own log for this exact movement.
	const own = history.find((record) => record.exerciseId === exercise.id);
	if (own) {
		return done(
			// The bar goes on here and comes off again in `done`, so the round trip
			// is invisible: what they logged is what they get back.
			oneRepMax(totalKg(exercise, own.weightKg), own.reps),
			"logged",
			"high",
			`From your own ${own.weightKg} kg × ${own.reps} on this exercise.`,
		);
	}

	// The coefficient and the observed 1RM of everything they have logged, so
	// both of the next two rungs read the same prepared list.
	const donors = history
		.map((record) => {
			const source = exerciseById(record.exerciseId, input.custom);
			if (!source) return null;
			const coefficient = loadCoefficient(source);
			if (coefficient.bodyweight || coefficient.coefficient <= 0) return null;
			return {
				record,
				source,
				coefficient,
				observed: oneRepMax(totalKg(source, record.weightKg), record.reps),
			};
		})
		.filter((donor) => donor !== null)
		.sort((a, b) => timeOf(b.record.at) - timeOf(a.record.at));

	// 2. Same pattern: a straight ratio of coefficients, no standards involved.
	const sibling = donors.find(
		(donor) => donor.coefficient.pattern === target.pattern,
	);
	if (sibling) {
		const index = sibling.observed / sibling.coefficient.coefficient;
		return done(
			index * target.coefficient,
			"transferred",
			"medium",
			`Carried across from your ${sibling.source.name}: ${sibling.record.weightKg} kg × ${sibling.record.reps}, adjusted for how the two movements load.`,
			sibling.source.id,
		);
	}

	const predicted = predictedOneRepMax(target.pattern, profile);

	// 3. Something logged, but nothing near. Move the standards by however far
	//    they sit from them elsewhere, taking the median so one freakish lift
	//    does not drag every other estimate with it.
	if (predicted && donors.length > 0) {
		const ratios = donors
			.flatMap((donor) => {
				const donorPredicted = predictedOneRepMax(
					donor.coefficient.pattern,
					profile,
				);
				if (!donorPredicted) return [];
				const ratio =
					donor.observed / (donorPredicted * donor.coefficient.coefficient);
				return Number.isFinite(ratio) && ratio > 0 ? [ratio] : [];
			})
			.sort((a, b) => a - b);

		if (ratios.length > 0) {
			const middle = ratios[Math.floor(ratios.length / 2)] as number;
			// Clamped: outside this the arithmetic is telling you the model is
			// wrong about the person, not that the person is four times stronger
			// than the standards.
			const calibration = Math.min(2.5, Math.max(0.4, middle));
			return done(
				predicted * target.coefficient * calibration,
				"calibrated",
				"low",
				`You have not logged anything in this pattern, so this is scaled from your other lifts, which run ${Math.round(calibration * 100)}% of the standards for your profile.`,
			);
		}
	}

	// 4. Nothing logged at all.
	if (predicted) {
		return done(
			predicted * target.coefficient,
			"profile",
			"low",
			`A first guess from your bodyweight, age and training experience, since you have not logged anything yet. Treat it as a warm-up and adjust on set one.`,
		);
	}

	return null;
}

/** The pattern's reference lift, for a tool result that has to explain itself. */
export const referenceLift = (pattern: Pattern) => PATTERNS[pattern].reference;

/**
 * The bodyweight and the multiple of the intermediate standards that together
 * describe the strongest human being who has ever lived.
 *
 * A superheavyweight competitor is around 160 kg, and the world record in a
 * lift is roughly twice what the `base` column calls intermediate for somebody
 * that size. Checked against the raw records: squat comes out at 480 against a
 * real 490-ish, bench at 320 against 355, and the deadlift at 640 against 500,
 * which is loose in the safe direction.
 *
 * This is not a threshold, it is the end of the number line. Nothing that fails
 * it is a lift; it is a typo, a unit mix-up, or somebody testing the app.
 */
const CEILING_BODYWEIGHT_KG = 160;
const CEILING_MULTIPLE = 2;

/**
 * The heaviest this pattern's reference lift has ever been done, near enough,
 * in kilograms.
 *
 * Expressed in reference-lift terms because that is the currency the strength
 * index is already in: divide a logged one-rep max by the exercise's
 * coefficient and it can be compared against this whatever the movement was.
 */
export const patternCeilingKg = (pattern: Pattern) =>
	PATTERNS[pattern].base * CEILING_BODYWEIGHT_KG * CEILING_MULTIPLE;
