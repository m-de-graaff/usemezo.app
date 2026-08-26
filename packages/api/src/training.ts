import { type Exercise, exerciseById } from "./exercises.ts";

/**
 * The training science, declared once.
 *
 * This is to programming what `./plan` is to nutrition: the published numbers,
 * in one file, with nothing in them that formats for a screen and nothing that
 * touches a database. A model can read them through a tool, the routine card
 * can render them, and a test can pin them.
 *
 * The numbers are population estimates from the resistance-training
 * literature, not prescriptions for an individual. Every one of them has a
 * range and a source in the comment above it, because the honest version of
 * "10 to 20 sets a week" is "10 to 20 sets a week", not "15".
 *
 * Sources, once, for the whole file:
 *   - Schoenfeld, Ogborn & Krieger (2017), J Sports Sci: dose-response
 *     meta-analysis, ~0.37% extra muscle thickness per weekly set, 10+ sets
 *     clearly beating fewer than 5.
 *   - Schoenfeld, Grgic & Krieger (2019): frequency matters mainly as a way to
 *     distribute volume; twice a week per muscle beats once at matched volume.
 *   - Israetel et al., volume landmarks (MEV / MAV / MRV) as the working
 *     framework for where a muscle's weekly sets should sit.
 *   - Schoenfeld, Grgic, Ogborn & Krieger (2017): loads from roughly 30% to
 *     85% of 1RM grow muscle similarly when sets are taken near failure.
 *   - Grgic et al. (2017), rest intervals: longer rests (2 min+) beat short
 *     ones for hypertrophy on compounds, because they preserve volume load.
 */

/**
 * The muscles Mezo counts volume for.
 *
 * Coarser than an anatomy chart on purpose: these are the groups the volume
 * literature actually reports, and splitting delts into three heads would mean
 * inventing per-head landmarks that no study measured.
 */
export const MUSCLES = [
	"chest",
	"back",
	"traps",
	"shoulders",
	"biceps",
	"triceps",
	"forearms",
	"quads",
	"hamstrings",
	"glutes",
	"calves",
	"abs",
	"neck",
] as const;

export type Muscle = (typeof MUSCLES)[number];

/**
 * The catalogue's own muscle names, mapped onto the list above.
 *
 * One table for both `target` and `secondary`, because the dataset uses
 * different words for the same muscle in the two fields ("quads" in one,
 * "quadriceps" in the other) and a reader should not have to know which.
 * Anything absent contributes nothing rather than being guessed at: "core",
 * "grip muscles" and "ankle stabilizers" are not groups anyone programmes
 * weekly set targets for.
 */
const MUSCLE_ALIASES: Record<string, Muscle> = {
	pectorals: "chest",
	chest: "chest",
	"upper chest": "chest",

	lats: "back",
	"latissimus dorsi": "back",
	"upper back": "back",
	back: "back",
	rhomboids: "back",
	"lower back": "back",
	spine: "back",

	traps: "traps",
	trapezius: "traps",
	"levator scapulae": "traps",

	delts: "shoulders",
	deltoids: "shoulders",
	shoulders: "shoulders",
	"rear deltoids": "shoulders",
	"rotator cuff": "shoulders",

	biceps: "biceps",
	brachialis: "biceps",
	triceps: "triceps",

	forearms: "forearms",
	"wrist flexors": "forearms",
	"wrist extensors": "forearms",

	quads: "quads",
	quadriceps: "quads",
	hamstrings: "hamstrings",
	glutes: "glutes",
	adductors: "quads",
	abductors: "glutes",

	calves: "calves",
	soleus: "calves",

	abs: "abs",
	abdominals: "abs",
	"lower abs": "abs",
	obliques: "abs",
	"serratus anterior": "abs",

	sternocleidomastoid: "neck",
};

export const muscleOf = (name: string): Muscle | null =>
	MUSCLE_ALIASES[name.trim().toLowerCase()] ?? null;

/** What one set of this exercise trains, and how directly. */
export function musclesWorked(exercise: Exercise): {
	primary: Muscle | null;
	secondary: Muscle[];
} {
	const primary = muscleOf(exercise.target);
	const secondary: Muscle[] = [];

	for (const name of exercise.secondary) {
		const muscle = muscleOf(name);
		if (muscle && muscle !== primary && !secondary.includes(muscle)) {
			secondary.push(muscle);
		}
	}

	return { primary, secondary };
}

/**
 * Weekly working sets per muscle, as three numbers.
 *
 * MEV is the least that still grows anything, MAV the band where most people
 * get most of their growth, MRV the point past which the sets cost more
 * recovery than they buy. Small muscles that recover fast sit higher; muscles
 * that eat systemic fatigue sit lower.
 *
 * These are the landmarks for an intermediate lifter. `scaleLandmarks` moves
 * them for anyone else, which is the only thing that should.
 */
export const VOLUME_LANDMARKS: Record<
	Muscle,
	{ mev: number; mav: number; mrv: number }
> = {
	chest: { mev: 8, mav: 16, mrv: 22 },
	back: { mev: 10, mav: 18, mrv: 25 },
	traps: { mev: 4, mav: 12, mrv: 20 },
	shoulders: { mev: 8, mav: 18, mrv: 26 },
	biceps: { mev: 6, mav: 14, mrv: 22 },
	triceps: { mev: 6, mav: 14, mrv: 22 },
	forearms: { mev: 2, mav: 8, mrv: 16 },
	quads: { mev: 8, mav: 16, mrv: 22 },
	hamstrings: { mev: 6, mav: 14, mrv: 20 },
	glutes: { mev: 4, mav: 12, mrv: 18 },
	calves: { mev: 6, mav: 14, mrv: 20 },
	abs: { mev: 4, mav: 12, mrv: 20 },
	neck: { mev: 2, mav: 6, mrv: 12 },
};

/**
 * How far the landmarks move for someone who is not an intermediate.
 *
 * A beginner grows on a fraction of the volume and cannot yet recover from an
 * intermediate's, and an advanced lifter has spent years raising the ceiling.
 * The keys are `FITNESS_EXPERIENCE` in `./profile-fields`, and
 * `training.test.ts` is what notices when the two lists stop agreeing.
 */
export const EXPERIENCE_VOLUME: Record<string, number> = {
	none: 0.55,
	beginner: 0.7,
	intermediate: 1,
	advanced: 1.2,
	athlete: 1.3,
};

export const scaleLandmarks = (muscle: Muscle, experience?: string | null) => {
	const scale = (experience && EXPERIENCE_VOLUME[experience]) || 1;
	const base = VOLUME_LANDMARKS[muscle];
	return {
		mev: Math.round(base.mev * scale),
		mav: Math.round(base.mav * scale),
		mrv: Math.round(base.mrv * scale),
	};
};

/**
 * A secondary muscle gets half a set.
 *
 * The convention the volume literature uses when it counts indirect work: a
 * row is not a biceps set, but eight rows a week are not nothing either.
 * Counting them as whole sets is how people end up prescribing twenty direct
 * biceps sets on top of a back day and wondering why their elbows hurt.
 */
const SECONDARY_WEIGHT = 0.5;

/** One exercise in a plan: which movement, and how many sets of it per week. */
export type SetEntry = { exerciseId: string; sets: number };

/**
 * The exercises this user added themselves, for the id lookups below.
 *
 * Every function here resolves ids through `exerciseById`, which knows the
 * fixed catalogue and nothing else. Server code has to hand its own user's map
 * in, or a Bayesian curl somebody invented counts for nothing in their volume
 * audit and disappears out of their session order. In the browser it is
 * omitted: `exerciseById` finds the registered list on its own.
 */
export type CustomExercises = ReadonlyMap<string, Exercise>;

/**
 * Weekly sets per muscle for a list of exercises.
 *
 * `timesPerWeek` is how often the whole list is performed, so one routine can
 * be asked "and what if I run this three times a week?" without the caller
 * duplicating the array.
 */
export function weeklySets(
	entries: SetEntry[],
	timesPerWeek = 1,
	custom?: CustomExercises,
): Partial<Record<Muscle, number>> {
	const totals: Partial<Record<Muscle, number>> = {};

	const add = (muscle: Muscle, sets: number) => {
		totals[muscle] = (totals[muscle] ?? 0) + sets;
	};

	for (const entry of entries) {
		const exercise = exerciseById(entry.exerciseId, custom);
		if (!exercise) continue;

		const { primary, secondary } = musclesWorked(exercise);
		const sets = entry.sets * timesPerWeek;

		if (primary) add(primary, sets);
		for (const muscle of secondary) add(muscle, sets * SECONDARY_WEIGHT);
	}

	for (const muscle of Object.keys(totals) as Muscle[]) {
		totals[muscle] = Math.round((totals[muscle] as number) * 10) / 10;
	}

	return totals;
}

export type VolumeVerdict = "none" | "under" | "productive" | "over";

export type VolumeRow = {
	muscle: Muscle;
	sets: number;
	mev: number;
	mav: number;
	mrv: number;
	verdict: VolumeVerdict;
};

/**
 * Every muscle a plan touches, against where its sets should sit.
 *
 * Only the muscles with sets on them, plus any the caller explicitly asks
 * about. A push day is not "missing" hamstrings, and reporting eleven zeroes
 * under a chest session is noise that trains a reader to skip the table.
 */
export function auditVolume(
	entries: SetEntry[],
	options: {
		timesPerWeek?: number;
		experience?: string | null;
		include?: Muscle[];
		custom?: CustomExercises;
	} = {},
): VolumeRow[] {
	const totals = weeklySets(entries, options.timesPerWeek ?? 1, options.custom);
	const muscles = new Set<Muscle>([
		...(Object.keys(totals) as Muscle[]),
		...(options.include ?? []),
	]);

	return MUSCLES.filter((muscle) => muscles.has(muscle)).map((muscle) => {
		const sets = totals[muscle] ?? 0;
		const { mev, mav, mrv } = scaleLandmarks(muscle, options.experience);

		return {
			muscle,
			sets,
			mev,
			mav,
			mrv,
			verdict:
				sets === 0
					? "none"
					: sets < mev
						? "under"
						: sets > mrv
							? "over"
							: "productive",
		};
	});
}

/**
 * How to load a set, by what the user is training for.
 *
 * The rep ranges are wider than the ones people expect because the evidence is
 * wider than the folklore: anything from roughly 30% to 85% of 1RM grows
 * muscle at a similar rate when the set is taken close enough to failure, so
 * `hypertrophy` is a band to distribute work across rather than a magic ten.
 *
 * `rir` is reps in reserve at the end of a working set. Zero belongs to
 * neither end of this table: training every set to failure raises fatigue far
 * faster than it raises growth, and it is where joints and adherence go.
 */
export const REP_SCHEMES: Record<
	string,
	{
		label: string;
		compound: { reps: [number, number]; rir: [number, number] };
		isolation: { reps: [number, number]; rir: [number, number] };
	}
> = {
	strength: {
		label: "Strength",
		compound: { reps: [3, 6], rir: [1, 3] },
		isolation: { reps: [6, 10], rir: [1, 3] },
	},
	hypertrophy: {
		label: "Muscle",
		compound: { reps: [5, 10], rir: [1, 3] },
		isolation: { reps: [8, 15], rir: [0, 2] },
	},
	endurance: {
		label: "Endurance",
		compound: { reps: [12, 20], rir: [1, 3] },
		isolation: { reps: [15, 25], rir: [0, 2] },
	},
};

/**
 * Rest between working sets, in seconds.
 *
 * Short rests were sold for years as the hypertrophy option. They are not:
 * cutting rest cuts the load you can hold across a set, and volume load is
 * what drives the adaptation. Two to three minutes on anything systemic, and
 * a minute is only enough on something small and local.
 */
export const REST_SEC = {
	heavyCompound: 180,
	compound: 150,
	isolation: 75,
	/** Past this nobody is resting, they have left. */
	max: 300,
} as const;

/**
 * A compound moves more than one joint and taxes more than one muscle. Read
 * off the catalogue rather than a list of names, so a movement nobody thought
 * of is still classified.
 */
export function isCompound(exercise: Exercise): boolean {
	const { secondary } = musclesWorked(exercise);
	return secondary.length >= 2;
}

/**
 * How long to rest after a set of this exercise, in seconds.
 *
 * Two things move it. What the movement costs — legs and back move the most
 * tissue and settle slowest — and how long the set was: a set of twenty is
 * limited by how much burning somebody will tolerate, a set of four by whether
 * the nervous system has come back, and those recover at different rates.
 *
 * The rep adjustment is deliberately small. The evidence for the *direction*
 * is good and the evidence for a precise figure is not, so this nudges rather
 * than prescribes, and stays inside the two-to-three minute band the reviews
 * keep landing on for anything systemic.
 */
/**
 * Muscles whose compounds cost the whole body, not just themselves.
 *
 * The catalogue files a back squat under the glutes and a deadlift under the
 * back, so this is keyed on the muscle rather than on a list of lift names.
 */
const SYSTEMIC = new Set<Muscle>(["quads", "hamstrings", "glutes", "back"]);

export function restFor(exercise: Exercise, reps?: number): number {
	const { primary } = musclesWorked(exercise);

	const base = !isCompound(exercise)
		? REST_SEC.isolation
		: primary !== null && SYSTEMIC.has(primary)
			? REST_SEC.heavyCompound
			: REST_SEC.compound;

	if (!reps) return base;
	const scale = reps <= 5 ? 1.2 : reps >= 15 ? 0.75 : 1;
	return Math.min(REST_SEC.max, Math.round((base * scale) / 15) * 15);
}

/**
 * Warm-up sets, as fractions of the working weight.
 *
 * A ramp does two jobs and neither is training: it gets blood and synovial
 * fluid into the joint, and it lets somebody rehearse the groove at a weight
 * that forgives a bad rep. So it climbs towards the working set without ever
 * reaching it, and it stops short enough to leave the first working set intact.
 *
 * Evenly spaced between `LOW` and the working weight, with the top rung left
 * empty: that is the working set, and a warm-up single at 95% is a working set
 * somebody has decided not to count. One warm-up lands around two thirds, which
 * is what people actually do when they only take one.
 *
 * Nothing here is precise, because the evidence is not. What matters is that
 * the ramp exists and gets shorter as the weight gets lighter.
 */
const WARMUP_LOW = 0.35;

/** More than this is a session of warm-ups. Four covers a heavy barbell squat. */
export const WARMUP_MAX = 4;

export function warmupRamp(count: number): number[] {
	const rungs = Math.max(0, Math.min(WARMUP_MAX, Math.round(count)));
	return Array.from(
		{ length: rungs },
		(_, index) => WARMUP_LOW + (1 - WARMUP_LOW) * ((index + 1) / (rungs + 1)),
	);
}

/**
 * How many reps a warm-up at this fraction of the working weight is worth.
 *
 * Fewer as it gets heavier: the point of the last rung is to feel the weight,
 * not to accumulate fatigue before the set that counts. It falls from a bit
 * under the working reps at the lightest rung to a triple at the heaviest,
 * which is why the slope starts above 1 rather than at it. Never fewer than
 * three, which is too few to warm anything, and never more than twelve, which
 * is a working set with a light weight on it.
 */
export const warmupReps = (reps: number, fraction: number): number =>
	Math.max(3, Math.min(12, Math.round(reps * (1.2 - fraction))));

/* -------------------------------------------------------------------------- */
/* Regions: the part of a muscle an exercise actually reaches                  */
/* -------------------------------------------------------------------------- */

/**
 * Muscles that need more than one movement to be trained whole.
 *
 * This is the difference between a session that lists chest work and a session
 * that trains the chest. An incline press grows the clavicular head that flat
 * pressing barely reaches; a flat or decline press covers the sternal head that
 * an incline only partly loads. Two presses at the same angle are one press
 * done twice, and no amount of extra sets fixes a region nothing loaded.
 *
 * Only the muscles where the split is real and the fix is a different exercise
 * are in here. Splitting the quads or the glutes into regions would be
 * inventing distinctions no ordinary programme acts on.
 */
export const REGIONS: Partial<
	Record<Muscle, { key: string; label: string; why: string }[]>
> = {
	chest: [
		{
			key: "upper",
			label: "upper chest",
			why: "the clavicular head, which only an incline press loads properly",
		},
		{
			key: "mid",
			label: "mid and lower chest",
			why: "the sternal head, from flat and decline pressing",
		},
	],
	back: [
		{
			key: "vertical",
			label: "lats",
			why: "pulling down from overhead: pull-ups and pulldowns",
		},
		{
			key: "horizontal",
			label: "mid back",
			why: "pulling towards you: rows",
		},
	],
	shoulders: [
		{
			key: "front",
			label: "front delts",
			why: "overhead and incline pressing",
		},
		{
			key: "side",
			label: "side delts",
			why: "lateral raises; no press covers them, and they are what makes shoulders look wide",
		},
		{
			key: "rear",
			label: "rear delts",
			why: "reverse flyes and face pulls, the head everybody skips",
		},
	],
	biceps: [
		{
			key: "long",
			label: "the long head",
			why: "curls with the arms behind the torso, like an incline curl",
		},
		{
			key: "short",
			label: "the short head",
			why: "curls with the arms in front, like a preacher curl",
		},
	],
	triceps: [
		{
			key: "long",
			label: "the long head",
			why: "overhead extensions, the only position that lengthens it, and two thirds of the muscle",
		},
		{
			key: "lateral",
			label: "the lateral and medial heads",
			why: "pushdowns and close-grip pressing",
		},
	],
	hamstrings: [
		{
			key: "hinge",
			label: "the hip end",
			why: "Romanian deadlifts and good mornings",
		},
		{ key: "knee", label: "the knee end", why: "leg curls" },
	],
	calves: [
		{
			key: "gastroc",
			label: "the gastrocnemius",
			why: "raises with the leg straight",
		},
		{
			key: "soleus",
			label: "the soleus",
			why: "raises with the knee bent, seated",
		},
	],
};

/** Hinges the catalogue files under the glutes. The hamstrings do the work. */
const HINGE = /deadlift|good morning|hyperextension|back extension/;

export type RegionHit = { muscle: Muscle; regions: string[] };

/**
 * Which regions of which muscles an exercise reaches.
 *
 * Usually one entry, for its primary muscle. A movement that loads a muscle
 * whole returns every region of it, which is what stops a standing barbell curl
 * being reported as missing both heads of the biceps.
 *
 * The second entry exists for one case the catalogue gets wrong for this
 * purpose: it files a Romanian deadlift under the glutes, and the hip end of
 * the hamstrings is what the movement is for. Left uncorrected, a leg day of
 * Romanian deadlifts and leg curls reports the hip end as untrained.
 */
export function regionsOf(exercise: Exercise): RegionHit[] {
	const { primary } = musclesWorked(exercise);
	const text = exercise.name.toLowerCase();

	const hinge: RegionHit[] =
		primary !== "hamstrings" &&
		HINGE.test(text) &&
		musclesWorked(exercise).secondary.includes("hamstrings")
			? [{ muscle: "hamstrings", regions: ["hinge"] }]
			: [];

	if (!primary || !REGIONS[primary]) return hinge;

	const all = (REGIONS[primary] ?? []).map((region) => region.key);
	const hit = (regions: string[]) => [{ muscle: primary, regions }, ...hinge];

	switch (primary) {
		case "chest":
			if (/\bincline\b|\bprone\b|low to high/.test(text)) return hit(["upper"]);
			if (/\bdecline\b|high to low/.test(text)) return hit(["mid"]);
			// A flat press or fly is a sternal-head movement. It does something for
			// the clavicular head and not enough to count as covering it.
			return /press|fly|flye|dip|push[ -]?up|pec deck|crossover/.test(text)
				? hit(["mid"])
				: hit(all);

		case "back":
			if (/pull[ -]?down|pull[ -]?up|chin[ -]?up|pullover/.test(text))
				return hit(["vertical"]);
			if (/\brow\b|\brows\b|face pull/.test(text)) return hit(["horizontal"]);
			return hit(all);

		case "shoulders":
			if (/rear|reverse fly|face pull/.test(text)) return hit(["rear"]);
			if (/lateral|side raise|upright/.test(text)) return hit(["side"]);
			if (/press|front raise/.test(text)) return hit(["front"]);
			return hit(all);

		case "biceps":
			if (/incline|behind|drag/.test(text)) return hit(["long"]);
			if (/preacher|spider|concentration/.test(text)) return hit(["short"]);
			return hit(all);

		case "triceps":
			if (/overhead|skull|french|\bextension\b/.test(text))
				return hit(["long"]);
			if (/pushdown|push[ -]down|kickback|\bdip\b|close[ -]?grip/.test(text))
				return hit(["lateral"]);
			return hit(all);

		case "hamstrings":
			if (/curl/.test(text)) return hit(["knee"]);
			if (/deadlift|good morning|hyperextension|swing/.test(text))
				return hit(["hinge"]);
			return hit(all);

		case "calves":
			if (/seated|bent[ -]knee/.test(text)) return hit(["soleus"]);
			if (/standing|donkey|\bjump\b/.test(text)) return hit(["gastroc"]);
			return hit(all);

		default:
			return hit(all);
	}
}

export type CoverageRow = {
	muscle: Muscle;
	covered: { region: string; label: string; sets: number }[];
	missing: { region: string; label: string; why: string }[];
};

/**
 * How many direct sets a muscle needs before a gap in it is worth naming.
 *
 * Below this the answer is "train it at all", not "you are missing the long
 * head", and a coach who leads with the second one is not being helpful.
 */
const COVERAGE_FLOOR = 3;

/**
 * Which parts of the muscles a plan trains are actually getting loaded.
 *
 * Volume answers "how much"; this answers "of what". They fail in different
 * ways, and the one this catches — twelve chest sets, none of them at an
 * incline — is invisible to a set count.
 */
export function coverage(
	entries: SetEntry[],
	custom?: CustomExercises,
): CoverageRow[] {
	const sets = new Map<string, number>();
	const direct = new Map<Muscle, number>();

	for (const entry of entries) {
		const exercise = exerciseById(entry.exerciseId, custom);
		if (!exercise) continue;

		for (const found of regionsOf(exercise)) {
			direct.set(found.muscle, (direct.get(found.muscle) ?? 0) + entry.sets);
			for (const region of found.regions) {
				// Whole, not shared. A standing curl trains both heads; it is not
				// half a set for each of them.
				const key = `${found.muscle}|${region}`;
				sets.set(key, (sets.get(key) ?? 0) + entry.sets);
			}
		}
	}

	const rows: CoverageRow[] = [];

	for (const [muscle, total] of direct) {
		if (total < COVERAGE_FLOOR) continue;

		const covered: CoverageRow["covered"] = [];
		const missing: CoverageRow["missing"] = [];

		for (const region of REGIONS[muscle] ?? []) {
			const count = sets.get(`${muscle}|${region.key}`) ?? 0;
			if (count > 0) {
				covered.push({ region: region.key, label: region.label, sets: count });
			} else {
				missing.push({
					region: region.key,
					label: region.label,
					why: region.why,
				});
			}
		}

		rows.push({ muscle, covered, missing });
	}

	return rows.sort((a, b) => b.missing.length - a.missing.length);
}

/**
 * Pairs of exercises that are the same movement twice.
 *
 * Same muscle, same regions, same class of implement: a barbell incline press
 * and a dumbbell incline press in one session are one exercise with the sets
 * split across two rows. That is not always wrong — a heavy press and a machine
 * press at the same angle is a real choice — so this is reported rather than
 * refused, and the note says which way it leans.
 */
export function redundancies(
	entries: SetEntry[],
	custom?: CustomExercises,
): { exerciseIds: [string, string]; names: [string, string]; why: string }[] {
	const seen: {
		id: string;
		name: string;
		key: string;
		free: boolean;
	}[] = [];
	const found: ReturnType<typeof redundancies> = [];

	for (const entry of entries) {
		const exercise = exerciseById(entry.exerciseId, custom);
		if (!exercise) continue;

		// The first hit is the movement's own muscle; a hinge's borrowed hamstring
		// entry is not what makes two exercises the same exercise.
		const regions = regionsOf(exercise)[0];
		if (!regions) continue;

		const key = `${regions.muscle}|${regions.regions.join(",")}`;
		const free = FREE_WEIGHT.has(exercise.equipment);
		const clash = seen.find((other) => other.key === key);

		if (clash) {
			found.push({
				exerciseIds: [clash.id, exercise.id],
				names: [clash.name, exercise.name],
				why:
					clash.free === free
						? "Same muscle, same region, same kind of implement. Pick one and give it the sets, or change the angle on one of them."
						: "Same muscle and region, but one is free weight and one is not. Keep both only if the second one is there for the stability, not for more of the same.",
			});
		}

		seen.push({ id: exercise.id, name: exercise.name, key, free });
	}

	return found;
}

const FREE_WEIGHT = new Set([
	"barbell",
	"olympic barbell",
	"ez barbell",
	"trap bar",
	"dumbbell",
	"kettlebell",
	"body weight",
	"weighted",
]);

/* -------------------------------------------------------------------------- */
/* Order                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What an exercise costs to perform, which is what decides where it goes.
 *
 * Lower runs earlier. The scale is about fatigue and technical demand, not
 * about importance: a barbell squat done last is a worse squat and a slightly
 * more dangerous one, while a cable lateral raise done last is a cable lateral
 * raise.
 */
function fatigueCost(exercise: Exercise): number {
	const { primary } = musclesWorked(exercise);
	const heavy = primary !== null && SYSTEMIC.has(primary);
	const free = FREE_WEIGHT.has(exercise.equipment);

	if (isCompound(exercise)) {
		if (free && heavy) return 0;
		if (free) return 1;
		return 2;
	}
	return heavy ? 3 : 4;
}

/**
 * How far a priority moves an exercise up the session.
 *
 * Two rungs: enough to put a prioritised isolation movement ahead of the
 * machines and the accessories, never enough to put it ahead of a squat. A
 * lateral raise done before a heavy compound costs the compound more than the
 * raise gains.
 */
const PRIORITY_BONUS = 2;

export type OrderedEntry = SetEntry & {
	name: string;
	restSec: number;
	/** Absent on the last exercise, which has nothing after it. */
	restAfterSec?: number;
	reason: string;
};

/**
 * The order to run a session in.
 *
 * Worth being honest about how much this buys. The meta-analysis on exercise
 * order found a clear effect on **strength** in whatever is performed first,
 * and no meaningful effect on **hypertrophy** anywhere in the session. So this
 * is not an optimisation, it is two smaller things: the movements that are
 * dangerous or technical when tired go while somebody is fresh, and whatever
 * they most want to improve goes early enough to be trained properly.
 *
 * `prioritise` is what makes the second half of that work. Naming a muscle
 * pulls its exercises forward, which is the priority principle and the only
 * part of exercise order the evidence actually supports acting on.
 */
export function orderSession(
	entries: SetEntry[],
	options: {
		prioritise?: Muscle[];
		reps?: number;
		custom?: CustomExercises;
	} = {},
): OrderedEntry[] {
	const prioritise = new Set(options.prioritise ?? []);

	return entries
		.flatMap((entry, index) => {
			const exercise = exerciseById(entry.exerciseId, options.custom);
			if (!exercise) return [];

			const { primary } = musclesWorked(exercise);
			const first = primary !== null && prioritise.has(primary);
			const cost = fatigueCost(exercise) - (first ? PRIORITY_BONUS : 0);

			return [{ entry, exercise, cost, index, first, primary }];
		})
		.sort((a, b) => a.cost - b.cost || a.index - b.index)
		.map(({ entry, exercise, first, primary }, position, ordered) => {
			const next = ordered[position + 1]?.exercise;
			const restSec = restFor(exercise, options.reps);

			return {
				...entry,
				name: exercise.name,
				restSec,
				// The rest before the next exercise, which is the larger of what the
				// two of them ask for. Nobody is recovered for a leg curl forty seconds
				// after a squat set, and taking the next movement's figure alone is how
				// a session ends up sprinting out of the heaviest thing in it. Absent on
				// the last exercise: there is nothing after it to be ready for.
				restAfterSec: next
					? Math.max(restSec, restFor(next, options.reps))
					: undefined,
				reason: first
					? `${primary} is a priority, so this runs before the work that is not.`
					: isCompound(exercise)
						? "Compound: it needs the most from you and the best technique, so it goes while you are fresh."
						: "Isolation: it is safe and repeatable tired, so it goes after the heavy work.",
			};
		});
}

/**
 * What to train on which day, by how many days a week someone actually has.
 *
 * Frequency is in here rather than in a rule of thumb because the frequency
 * research says something narrower than "more is better": twice a week per
 * muscle beats once when weekly volume is equal, and past twice the evidence
 * runs out. So every split below hits each muscle about twice, and the extra
 * days buy shorter sessions rather than a third pass.
 */
export type Split = { name: string; days: string[] };

export const SPLITS: Record<number, Split> = {
	1: { name: "Full body", days: ["Full body"] },
	2: { name: "Full body twice", days: ["Full body A", "Full body B"] },
	3: {
		name: "Full body three times",
		days: ["Full body A", "Full body B", "Full body C"],
	},
	4: {
		name: "Upper / lower",
		days: ["Upper A", "Lower A", "Upper B", "Lower B"],
	},
	5: {
		name: "Upper / lower plus a push-pull-legs day",
		days: ["Upper A", "Lower A", "Push", "Pull", "Legs"],
	},
	6: {
		name: "Push / pull / legs twice",
		days: ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"],
	},
	7: {
		name: "Push / pull / legs twice, plus a light day",
		days: [
			"Push A",
			"Pull A",
			"Legs A",
			"Push B",
			"Pull B",
			"Legs B",
			"Arms and weak points",
		],
	},
};

export const splitFor = (daysPerWeek: number): Split =>
	SPLITS[Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1))] as Split;

/**
 * How much to add, and when.
 *
 * Double progression, because it is the scheme that survives contact with a
 * gym: work up the rep range at a fixed load, and only when the top of the
 * range is hit on every set does the weight move. A percentage-based jump
 * every session outruns a beginner within a month and an intermediate within
 * a week.
 */
export const PROGRESSION = {
	/** Smallest jump worth making, by how big the movement is. */
	incrementKg: { compound: 2.5, isolation: 1.25 },
	/**
	 * Sessions of no progress at all before something other than the weight
	 * has to change: a deload, more sleep, or fewer sets.
	 */
	stallSessions: 3,
} as const;
