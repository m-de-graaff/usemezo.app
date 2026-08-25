import { z } from "zod";

/**
 * The settings questionnaire, declared once.
 *
 * Three things have to agree: what the form renders, what the API accepts, and
 * what the database stores. This file owns the first two — `SECTIONS` drives
 * every settings screen and `profileInput` validates every write — and the
 * `keyof ProfileInput` on `Field["name"]` makes a field the schema doesn't know
 * about a type error rather than a silently dropped column.
 *
 * Adding a question: a column in `@mezo/db/schema` (plus a migration), a key in
 * `profileInput`, and a row in `SECTIONS`. Adding an *option* to an existing
 * question is this file alone — the columns are `text`, deliberately.
 *
 * No server-only imports belong here; the settings form is a client component
 * and imports it directly.
 */

/** Option value -> human label. Doubles as Base UI Select's `items`. */
export type Options = Record<string, string>;

const today = () => new Date().toISOString().slice(0, 10);

const enumOf = (options: Options) =>
	z.enum(Object.keys(options) as [string, ...string[]]);

export const GOALS: Options = {
	"improve-health": "Improve my general health",
	"lose-weight": "Lose weight",
	"build-muscle": "Build muscle",
	"track-metrics": "Track my metrics",
	"improve-sleep": "Sleep better",
	"eat-better": "Eat better",
	"try-ai-assistant": "Try the AI assistant",
};

/**
 * Display preference. Storage is always metric; see `user_profile.units`.
 */
export const UNITS: Options = {
	metric: "Metric (cm, kg)",
	imperial: "Imperial (ft, lb)",
};

export const GENDERS: Options = {
	female: "Female",
	male: "Male",
	"non-binary": "Non-binary",
	other: "Other",
	"prefer-not-to-say": "Prefer not to say",
};

export const BLOOD_TYPES: Options = {
	"a-pos": "A+",
	"a-neg": "A-",
	"b-pos": "B+",
	"b-neg": "B-",
	"ab-pos": "AB+",
	"ab-neg": "AB-",
	"o-pos": "O+",
	"o-neg": "O-",
	unknown: "I do not know",
};

export const BODY_TYPES: Options = {
	ectomorph: "Ectomorph (lean, hard to gain weight)",
	mesomorph: "Mesomorph (athletic, gains muscle easily)",
	endomorph: "Endomorph (broader, gains weight easily)",
	mixed: "A mix",
	unsure: "Not sure",
};

export const FITNESS_EXPERIENCE: Options = {
	none: "None (starting from scratch)",
	beginner: "Beginner (under a year)",
	intermediate: "Intermediate (a few years, on and off)",
	advanced: "Advanced (training consistently for years)",
	athlete: "Competitive athlete",
};

/**
 * Which way the user wants their weight to go. Separate from `GOALS`, which is
 * about what they came here for: someone can want to sleep better and build
 * muscle at the same time, but the calorie target has to move in one direction.
 */
export const GOAL_DIRECTIONS: Options = {
	lose: "Lose weight",
	maintain: "Stay where I am",
	gain: "Gain weight or muscle",
};

/**
 * Daily movement, which is the input a resting metabolic rate has to be
 * multiplied by to become a daily one. The keys are the keys of
 * `ACTIVITY_MULTIPLIERS` in `./plan`, and `plan.test.ts` holds the two lists
 * together.
 */
export const ACTIVITY_LEVELS: Options = {
	sedentary: "Mostly sitting (desk job, little exercise)",
	light: "Lightly active (light exercise 1 to 3 days a week)",
	moderate: "Moderately active (exercise 3 to 5 days a week)",
	active: "Very active (hard exercise 6 to 7 days a week)",
	"very-active": "Extremely active (physical job, or training twice a day)",
};

export const SLEEP_HOURS: Options = {
	"under-5": "Under 5 hours",
	"5-6": "5 to 6 hours",
	"6-7": "6 to 7 hours",
	"7-8": "7 to 8 hours",
	"over-8": "More than 8 hours",
};

export const ACTIVITIES: Options = {
	"strength-training": "Strength training",
	running: "Running",
	walking: "Walking or hiking",
	cycling: "Cycling",
	swimming: "Swimming",
	"yoga-mobility": "Yoga or mobility",
	"team-sports": "Team sports",
	"combat-sports": "Combat sports",
	cooking: "Cooking and eating well",
};

export const EATING_HABITS: Options = {
	balanced: "Balanced (a bit of everything)",
	"high-protein": "High protein",
	"low-carb": "Low carb or keto",
	vegetarian: "Vegetarian",
	vegan: "Vegan",
	pescatarian: "Pescatarian",
	halal: "Halal",
	kosher: "Kosher",
	"gluten-free": "Gluten free",
	other: "Something else",
};

/**
 * What people actually turn up taking, by generic name. Not a formulary: the
 * point is a list someone recognises their own prescription in, not one a
 * pharmacist could dispense from — a brand or a dose would multiply this by ten
 * without telling Mezo anything more about the plan it is building.
 *
 * The first `COMMON_MEDICATIONS` entries are the ones most likely to be picked,
 * and the control shows them first under their own heading. Everything after
 * them is alphabetical.
 */
export const COMMON_MEDICATIONS = 12;

export const MEDICATIONS: Options = {
	paracetamol: "Paracetamol (acetaminophen)",
	ibuprofen: "Ibuprofen",
	omeprazole: "Omeprazole",
	metformin: "Metformin",
	atorvastatin: "Atorvastatin",
	levothyroxine: "Levothyroxine",
	amlodipine: "Amlodipine",
	lisinopril: "Lisinopril",
	sertraline: "Sertraline",
	salbutamol: "Salbutamol (albuterol) inhaler",
	cetirizine: "Cetirizine",
	aspirin: "Aspirin (low dose)",

	allopurinol: "Allopurinol",
	amitriptyline: "Amitriptyline",
	amoxicillin: "Amoxicillin",
	apixaban: "Apixaban",
	atenolol: "Atenolol",
	azithromycin: "Azithromycin",
	bisoprolol: "Bisoprolol",
	budesonide: "Budesonide",
	bupropion: "Bupropion",
	candesartan: "Candesartan",
	carvedilol: "Carvedilol",
	ciprofloxacin: "Ciprofloxacin",
	citalopram: "Citalopram",
	clopidogrel: "Clopidogrel",
	codeine: "Codeine",
	dapagliflozin: "Dapagliflozin",
	desloratadine: "Desloratadine",
	diazepam: "Diazepam",
	diclofenac: "Diclofenac",
	doxycycline: "Doxycycline",
	duloxetine: "Duloxetine",
	empagliflozin: "Empagliflozin",
	escitalopram: "Escitalopram",
	esomeprazole: "Esomeprazole",
	ezetimibe: "Ezetimibe",
	finasteride: "Finasteride",
	fluoxetine: "Fluoxetine",
	fluticasone: "Fluticasone",
	furosemide: "Furosemide",
	gabapentin: "Gabapentin",
	gliclazide: "Gliclazide",
	hydrochlorothiazide: "Hydrochlorothiazide",
	hydroxychloroquine: "Hydroxychloroquine",
	insulin: "Insulin",
	lamotrigine: "Lamotrigine",
	lansoprazole: "Lansoprazole",
	lisdexamfetamine: "Lisdexamfetamine",
	lithium: "Lithium",
	loratadine: "Loratadine",
	losartan: "Losartan",
	methotrexate: "Methotrexate",
	methylphenidate: "Methylphenidate",
	metoprolol: "Metoprolol",
	metronidazole: "Metronidazole",
	mirtazapine: "Mirtazapine",
	montelukast: "Montelukast",
	morphine: "Morphine",
	naproxen: "Naproxen",
	nitrofurantoin: "Nitrofurantoin",
	olanzapine: "Olanzapine",
	ondansetron: "Ondansetron",
	oxycodone: "Oxycodone",
	pantoprazole: "Pantoprazole",
	paroxetine: "Paroxetine",
	prednisolone: "Prednisolone (prednisone)",
	pregabalin: "Pregabalin",
	propranolol: "Propranolol",
	quetiapine: "Quetiapine",
	ramipril: "Ramipril",
	rivaroxaban: "Rivaroxaban",
	rosuvastatin: "Rosuvastatin",
	semaglutide: "Semaglutide",
	sildenafil: "Sildenafil",
	simvastatin: "Simvastatin",
	sumatriptan: "Sumatriptan",
	tamsulosin: "Tamsulosin",
	tramadol: "Tramadol",
	trazodone: "Trazodone",
	valsartan: "Valsartan",
	venlafaxine: "Venlafaxine",
	warfarin: "Warfarin",
	zolpidem: "Zolpidem",
};

/**
 * The same idea for supplements, which is a shorter list because the ones
 * anyone takes daily are a much smaller set than the ones sold.
 */
export const COMMON_SUPPLEMENTS = 12;

export const SUPPLEMENTS: Options = {
	"vitamin-d": "Vitamin D",
	multivitamin: "Multivitamin",
	"omega-3": "Omega-3 (fish oil)",
	magnesium: "Magnesium",
	creatine: "Creatine",
	"whey-protein": "Whey protein",
	"vitamin-c": "Vitamin C",
	"vitamin-b12": "Vitamin B12",
	iron: "Iron",
	zinc: "Zinc",
	probiotics: "Probiotics",
	melatonin: "Melatonin",

	ashwagandha: "Ashwagandha",
	bcaa: "BCAAs",
	"beta-alanine": "Beta-alanine",
	biotin: "Biotin",
	caffeine: "Caffeine tablets",
	calcium: "Calcium",
	"casein-protein": "Casein protein",
	chromium: "Chromium",
	citrulline: "Citrulline malate",
	collagen: "Collagen",
	coq10: "Coenzyme Q10",
	curcumin: "Curcumin (turmeric)",
	eaa: "EAAs",
	electrolytes: "Electrolytes",
	"fibre-psyllium": "Psyllium husk",
	"folic-acid": "Folic acid",
	ginkgo: "Ginkgo biloba",
	ginseng: "Ginseng",
	glucosamine: "Glucosamine",
	glutamine: "Glutamine",
	"green-tea-extract": "Green tea extract",
	hmb: "HMB",
	inositol: "Inositol",
	iodine: "Iodine",
	"l-carnitine": "L-carnitine",
	"l-theanine": "L-theanine",
	"lions-mane": "Lion's mane",
	lutein: "Lutein",
	maca: "Maca",
	"milk-thistle": "Milk thistle",
	msm: "MSM",
	nac: "N-acetylcysteine",
	niacin: "Niacin",
	"nitric-oxide": "Beetroot or nitrate",
	potassium: "Potassium",
	"pre-workout": "Pre-workout blend",
	"protein-plant": "Plant protein",
	rhodiola: "Rhodiola",
	"saw-palmetto": "Saw palmetto",
	selenium: "Selenium",
	spirulina: "Spirulina",
	"st-johns-wort": "St John's wort",
	taurine: "Taurine",
	valerian: "Valerian",
	"vitamin-a": "Vitamin A",
	"vitamin-b-complex": "Vitamin B complex",
	"vitamin-e": "Vitamin E",
	"vitamin-k2": "Vitamin K2",
	zma: "ZMA",
};

/**
 * What a workout has to be built around. Grouped the way someone would say it
 * out loud — the part that hurts, or the thing that limits it — rather than as
 * diagnoses, because this is answered by the person training, not by a clinic.
 *
 * Mezo is not a doctor, and nothing here is treated as one: the list exists so
 * a plan avoids the movement, not so it names the condition.
 */
export const COMMON_PHYSICAL_LIMITATIONS = 12;

export const PHYSICAL_LIMITATIONS: Options = {
	"lower-back-pain": "Lower back pain",
	"knee-pain": "Knee pain",
	"shoulder-pain": "Shoulder pain",
	"neck-pain": "Neck pain",
	"hip-pain": "Hip pain",
	"wrist-pain": "Wrist pain",
	"ankle-pain": "Ankle or foot pain",
	"limited-shoulder-mobility": "Limited shoulder mobility",
	"limited-ankle-mobility": "Limited ankle mobility",
	asthma: "Asthma",
	"recent-surgery": "Recovering from surgery",
	"plantar-fasciitis": "Plantar fasciitis",

	"achilles-tendinopathy": "Achilles tendinopathy",
	"acl-injury": "ACL injury or reconstruction",
	"balance-problems": "Balance problems or vertigo",
	"bulging-disc": "Bulging or herniated disc",
	"carpal-tunnel": "Carpal tunnel syndrome",
	"chronic-fatigue": "Chronic fatigue",
	copd: "COPD or limited lung capacity",
	"elbow-tendinopathy": "Tennis or golfer's elbow",
	epilepsy: "Epilepsy",
	fibromyalgia: "Fibromyalgia",
	"frozen-shoulder": "Frozen shoulder",
	"hearing-impairment": "Hearing impairment",
	"heart-condition": "Heart condition",
	hernia: "Hernia",
	"high-blood-pressure": "High blood pressure",
	"hip-replacement": "Hip replacement",
	hypermobility: "Joint hypermobility",
	"it-band-syndrome": "IT band syndrome",
	"knee-replacement": "Knee replacement",
	"limited-grip-strength": "Limited grip strength",
	"meniscus-tear": "Meniscus tear",
	migraine: "Migraine",
	"multiple-sclerosis": "Multiple sclerosis",
	neuropathy: "Nerve pain or neuropathy",
	osteoarthritis: "Osteoarthritis",
	osteoporosis: "Osteoporosis or low bone density",
	"pelvic-floor": "Pelvic floor problems",
	"post-natal": "Post-natal recovery",
	pregnancy: "Pregnancy",
	prosthesis: "Prosthetic limb",
	"rheumatoid-arthritis": "Rheumatoid arthritis",
	"rotator-cuff": "Rotator cuff injury",
	sciatica: "Sciatica",
	scoliosis: "Scoliosis",
	"shin-splints": "Shin splints",
	"sleep-apnoea": "Sleep apnoea",
	"spinal-fusion": "Spinal fusion",
	"visual-impairment": "Visual impairment",
	"wheelchair-user": "Wheelchair user",
};

export const CHECKUP_FREQUENCY: Options = {
	never: "Never",
	rarely: "Rarely (only when something is wrong)",
	yearly: "Once a year",
	"twice-yearly": "Twice a year",
	quarterly: "Every three months",
	monthly: "Monthly",
	"bi-weekly": "Every two weeks",
};

/**
 * Handles that would let someone pose as Mezo. Short, because the `@` in
 * `/@<name>` already keeps profiles clear of the app's own routes; this list
 * only guards impersonation.
 */
const RESERVED_USERNAMES = new Set([
	"about",
	"admin",
	"administrator",
	"api",
	"billing",
	"help",
	"mezo",
	"moderator",
	"root",
	"security",
	"settings",
	"staff",
	"support",
	"system",
	"team",
	"u",
]);

/**
 * Lower-cased on the way in, so the unique index does the case-insensitive
 * check and `@Mark` and `@mark` cannot be two different people.
 */
export const usernameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		/^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/,
		"3 to 30 characters: letters, numbers and underscores, starting and ending with a letter or number",
	)
	.refine(
		(value) => !RESERVED_USERNAMES.has(value),
		"That username is reserved",
	);

/**
 * `null` clears an answer, `undefined` leaves it untouched — which is what lets
 * one screen save its own fields without wiping the ones it never showed.
 * `name` is the exception: it lives on `user`, which requires it.
 */
export const profileInput = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	username: usernameSchema.optional(),
	isPublic: z.boolean().optional(),
	units: enumOf(UNITS).nullish(),

	goals: z.array(enumOf(GOALS)).max(Object.keys(GOALS).length).nullish(),
	fitnessExperience: enumOf(FITNESS_EXPERIENCE).nullish(),
	preferredActivities: z
		.array(enumOf(ACTIVITIES))
		.max(Object.keys(ACTIVITIES).length)
		.nullish(),
	sleepHours: enumOf(SLEEP_HOURS).nullish(),

	// A birthday in the future, or from before anyone alive, is a typo.
	birthDate: z.iso
		.date()
		.refine(
			(value) => value >= "1900-01-01" && value <= today(),
			"Enter a date of birth between 1900 and today",
		)
		.nullish(),
	gender: enumOf(GENDERS).nullish(),
	bloodType: enumOf(BLOOD_TYPES).nullish(),

	bodyType: enumOf(BODY_TYPES).nullish(),
	heightCm: z.number().int().min(80).max(250).nullish(),
	weightKg: z.number().min(25).max(400).nullish(),
	goalDirection: enumOf(GOAL_DIRECTIONS).nullish(),
	// The same bounds as `weightKg`: it is a weight, and one the plan divides by.
	targetWeightKg: z.number().min(25).max(400).nullish(),
	activityLevel: enumOf(ACTIVITY_LEVELS).nullish(),

	// Body composition. Every one of these is optional: they come off a smart
	// scale or a DEXA, and most people have none of them.
	bodyFatPercent: z.number().min(3).max(70).nullish(),
	bodyFatMassKg: z.number().min(0.5).max(200).nullish(),
	skeletalMuscleMassKg: z.number().min(5).max(100).nullish(),
	totalBodyWaterKg: z.number().min(5).max(120).nullish(),
	boneMassKg: z.number().min(0.5).max(10).nullish(),
	proteinMassKg: z.number().min(1).max(50).nullish(),
	visceralFatLevel: z.number().int().min(1).max(59).nullish(),
	basalMetabolicRateKcal: z.number().int().min(500).max(5000).nullish(),
	waistCm: z.number().min(40).max(200).nullish(),

	eatingHabits: enumOf(EATING_HABITS).nullish(),
	dailyCalories: z.number().int().min(500).max(10000).nullish(),

	medications: z
		.array(enumOf(MEDICATIONS))
		.max(Object.keys(MEDICATIONS).length)
		.nullish(),
	supplements: z
		.array(enumOf(SUPPLEMENTS))
		.max(Object.keys(SUPPLEMENTS).length)
		.nullish(),
	physicalLimitations: z
		.array(enumOf(PHYSICAL_LIMITATIONS))
		.max(Object.keys(PHYSICAL_LIMITATIONS).length)
		.nullish(),
	checkupFrequency: enumOf(CHECKUP_FREQUENCY).nullish(),
});

export type ProfileInput = z.infer<typeof profileInput>;

type FieldBase = {
	/** Must match a column on `user_profile`, or `name` on `user`. */
	name: keyof ProfileInput;
	label: string;
	help?: string;
	/**
	 * The heading onboarding puts above a screen that asks only this. Kept for
	 * the fields that are still the whole point of their screen; a grouped
	 * screen uses `label` per field and its own heading above them.
	 */
	question?: string;
	/**
	 * Whether the question applies at all, given the answers so far. A field
	 * whose predicate is false is not rendered and not saved — asking someone
	 * who is maintaining their weight what they want to weigh is noise, and
	 * writing a target they never set is worse than noise.
	 *
	 * Takes the whole answer set rather than one field, so a rule can depend on
	 * two answers without the caller knowing which.
	 */
	when?: (values: Partial<Record<keyof ProfileInput, unknown>>) => boolean;
};

export type Field = FieldBase &
	// Split rather than `"text" | "textarea"` on one member, so that
	// `Extract<Field, { type: "textarea" }>` resolves to something.
	(
		| { type: "text"; placeholder?: string; prefix?: string }
		| { type: "textarea"; placeholder?: string }
		| { type: "date" }
		| {
				type: "number";
				min: number;
				max: number;
				step?: number;
				/** Fixed unit, for quantities that do not convert. */
				unit?: string;
				/**
				 * Converts for display. The stored value is always the metric one:
				 * centimetres for length, kilograms for mass.
				 */
				measure?: "length" | "mass";
				/** Narrower than min/max, for the onboarding slider. */
				sliderMin?: number;
				sliderMax?: number;
		  }
		| { type: "select"; options: Options }
		| {
				type: "multiselect";
				options: Options;
				/**
				 * How many of the leading options are the common ones. Its presence
				 * says the list is long enough to be searched rather than read: the
				 * control puts these first under their own heading and gives the rest
				 * a search box, instead of printing two hundred checkboxes.
				 */
				common?: number;
		  }
		| { type: "toggle"; onLabel: string; offLabel: string }
	);

export type Section = {
	slug: string;
	title: string;
	description: string;
	fields: readonly Field[];
};

export const SECTIONS: readonly Section[] = [
	{
		slug: "account",
		title: "Account",
		description:
			"Your handle and who can see your profile. Health answers are never public, whichever way this is set.",
		fields: [
			{
				type: "select",
				name: "units",
				label: "Units",
				question: "Which units do you think in?",
				options: UNITS,
				help: "Changes how heights and weights are shown. You can switch at any time.",
			},
			{
				type: "text",
				name: "username",
				label: "Username",
				question: "Pick your username",
				prefix: "@",
				placeholder: "username",
				help: "Letters, numbers and underscores. Your profile lives at mezo.app/@yourname, and the handle is permanent once claimed.",
			},
			{
				type: "toggle",
				name: "isPublic",
				label: "Profile visibility",
				question: "Who can see your profile?",
				onLabel: "Public (anyone with the link can see it)",
				offLabel: "Private (only you can see it)",
			},
		],
	},
	{
		slug: "profile",
		title: "Profile",
		description:
			"Who you are. Age and sex change what most health ranges mean.",
		fields: [
			{
				type: "text",
				name: "name",
				label: "Full name",
				question: "What is your full name?",
			},
			{
				type: "date",
				name: "birthDate",
				label: "Date of birth",
				question: "When were you born?",
				help: "Used for age-adjusted targets. Never shown to anyone else.",
			},
			{
				type: "select",
				name: "gender",
				label: "Gender",
				question: "What is your gender?",
				options: GENDERS,
				// The reference design says "please specify truthfully", which asks
				// for compliance without giving a reason. This gives the reason.
				help: "Resting metabolism is estimated differently for each, so this changes your calorie target.",
			},
			{
				type: "select",
				name: "bloodType",
				label: "Blood type",
				question: "What is your blood type?",
				options: BLOOD_TYPES,
			},
		],
	},
	{
		slug: "goals",
		title: "Goals & activity",
		description: "What you want out of Mezo, and how you like to move.",
		fields: [
			{
				type: "multiselect",
				name: "goals",
				label: "What brings you here?",
				question: "What brings you to Mezo?",
				options: GOALS,
				help: "Pick as many as apply.",
			},
			{
				type: "select",
				name: "goalDirection",
				label: "Where you want your weight to go",
				question: "Where do you want your weight to go?",
				options: GOAL_DIRECTIONS,
				help: "This is the one thing that decides whether your calorie target sits above or below maintenance.",
			},
			{
				type: "number",
				name: "targetWeightKg",
				label: "Weight you are aiming for",
				question: "What weight are you aiming for?",
				min: 25,
				max: 400,
				step: 0.1,
				measure: "mass",
				sliderMin: 40,
				sliderMax: 180,
				help: "A destination, not a deadline. It turns your target into a rough pace.",
				// Nothing to aim at when the answer is "stay where I am", and no
				// honest value to store either.
				when: (values) =>
					values.goalDirection === "lose" || values.goalDirection === "gain",
			},
			{
				type: "select",
				name: "fitnessExperience",
				label: "Previous fitness experience",
				question: "How much training have you done?",
				options: FITNESS_EXPERIENCE,
			},
			{
				type: "multiselect",
				name: "preferredActivities",
				label: "Activities you enjoy",
				question: "What do you enjoy doing?",
				options: ACTIVITIES,
			},
			{
				type: "select",
				name: "sleepHours",
				label: "Sleep on a typical night",
				question: "How long do you sleep on a typical night?",
				options: SLEEP_HOURS,
			},
		],
	},
	{
		slug: "body",
		title: "Body",
		description: "The measurements every calculation starts from.",
		fields: [
			{
				type: "select",
				name: "bodyType",
				label: "Body type",
				question: "Which body type is closest to yours?",
				options: BODY_TYPES,
				help: "A rough starting point, not a diagnosis.",
			},
			{
				type: "number",
				name: "heightCm",
				label: "Height",
				question: "How tall are you?",
				min: 80,
				max: 250,
				measure: "length",
				sliderMin: 140,
				sliderMax: 210,
			},
			{
				type: "number",
				name: "weightKg",
				label: "Weight",
				question: "What is your weight?",
				min: 25,
				max: 400,
				step: 0.1,
				measure: "mass",
				sliderMin: 40,
				sliderMax: 180,
			},
			{
				type: "select",
				name: "activityLevel",
				label: "How active your week is",
				question: "How active is a typical week?",
				options: ACTIVITY_LEVELS,
				help: "Everything you do in a day, not just training. Without it, a daily calorie figure is a guess.",
			},
		],
	},
	{
		slug: "nutrition",
		title: "Nutrition",
		description: "How you eat, so targets are ones you would actually follow.",
		fields: [
			{
				type: "select",
				name: "eatingHabits",
				label: "How you eat",
				question: "How do you eat?",
				options: EATING_HABITS,
				help: "What your meal plans get built around. It does not change your calorie target.",
			},
			{
				type: "number",
				name: "dailyCalories",
				label: "Daily calorie intake",
				question: "How many calories do you eat a day?",
				min: 500,
				max: 10000,
				unit: "kcal",
				help: "Leave this blank if you do not know and Mezo will estimate it.",
			},
		],
	},
	{
		slug: "health",
		title: "Health",
		description:
			"Context Mezo needs before it suggests anything. Mezo is not a doctor, and none of this replaces one.",
		fields: [
			{
				type: "multiselect",
				name: "medications",
				label: "Medications you take",
				question: "Do you take any medications?",
				options: MEDICATIONS,
				common: COMMON_MEDICATIONS,
				help: "Search by generic name. Leave empty if you take none.",
			},
			{
				type: "multiselect",
				name: "supplements",
				label: "Supplements you take",
				question: "Do you take any supplements?",
				options: SUPPLEMENTS,
				common: COMMON_SUPPLEMENTS,
				help: "Leave empty if you take none.",
			},
			{
				type: "multiselect",
				name: "physicalLimitations",
				label: "Physical limitations",
				question: "Anything a workout should work around?",
				options: PHYSICAL_LIMITATIONS,
				common: COMMON_PHYSICAL_LIMITATIONS,
				help: "Anything a workout should work around. Leave empty if none.",
			},
			{
				type: "select",
				name: "checkupFrequency",
				label: "How often you get a health checkup",
				question: "How often do you get a health checkup?",
				options: CHECKUP_FREQUENCY,
			},
		],
	},
	{
		slug: "advanced",
		title: "Advanced",
		description:
			"Body composition, if you have it. A smart scale, a DEXA scan or a caliper reading all answer these; leave any of them empty and Mezo works without it.",
		fields: [
			{
				type: "number",
				name: "bodyFatPercent",
				label: "Body fat",
				question: "What is your body fat percentage?",
				min: 3,
				max: 70,
				step: 0.1,
				unit: "%",
				help: "The single most useful one here. It splits your weight into the part a plan can change quickly and the part it cannot.",
			},
			{
				type: "number",
				name: "skeletalMuscleMassKg",
				label: "Skeletal muscle mass",
				question: "What is your skeletal muscle mass?",
				min: 5,
				max: 100,
				step: 0.1,
				measure: "mass",
				help: "Muscle you can train, rather than all lean tissue. Holding this steady is what makes a cut worth doing.",
			},
			{
				type: "number",
				name: "bodyFatMassKg",
				label: "Body fat mass",
				question: "What is your body fat mass?",
				min: 0.5,
				max: 200,
				step: 0.1,
				measure: "mass",
			},
			{
				type: "number",
				name: "totalBodyWaterKg",
				label: "Total body water",
				question: "What is your total body water?",
				min: 5,
				max: 120,
				step: 0.1,
				measure: "mass",
				help: "Moves with hydration and salt, so read it as a trend rather than as a number for one morning.",
			},
			{
				type: "number",
				name: "proteinMassKg",
				label: "Protein mass",
				question: "What is your protein mass?",
				min: 1,
				max: 50,
				step: 0.1,
				measure: "mass",
			},
			{
				type: "number",
				name: "boneMassKg",
				label: "Bone mass",
				question: "What is your bone mass?",
				min: 0.5,
				max: 10,
				step: 0.1,
				measure: "mass",
			},
			{
				type: "number",
				name: "visceralFatLevel",
				label: "Visceral fat level",
				question: "What is your visceral fat level?",
				min: 1,
				max: 59,
				help: "The 1 to 59 index a scale reports, not a weight. Under 13 is the usual healthy range.",
			},
			{
				type: "number",
				name: "basalMetabolicRateKcal",
				label: "Measured BMR",
				question: "What is your measured BMR?",
				min: 500,
				max: 5000,
				unit: "kcal",
				help: "Only if a device measured it. A measured figure replaces the one Mezo estimates from your height, weight and age.",
			},
			{
				type: "number",
				name: "waistCm",
				label: "Waist circumference",
				question: "What is your waist circumference?",
				min: 40,
				max: 200,
				measure: "length",
				help: "Measured at the navel. It tracks the fat that matters most for health, and it needs nothing but a tape.",
			},
		],
	},
];

export const findSection = (slug: string) =>
	SECTIONS.find((section) => section.slug === slug);

/**
 * What first run asks, as four screens of related questions.
 *
 * Everything else in `SECTIONS` is answerable later in Settings, and the gap
 * between the two lists is the gap between an onboarding people finish and one
 * they abandon. The bar for being here: without it, Mezo cannot address you,
 * host your profile, pick a unit, or put a single honest number on the plan
 * screen. Blood type, training history, sleep, diet and medications all fail
 * that bar — they make answers better, they are not what makes one possible.
 *
 * Grouped rather than one question per screen, because the questions on a
 * screen are the same question: a name, a birthday and a gender are "who are
 * you", and splitting them across three screens makes the flow feel four times
 * as long without making any single answer easier to give.
 *
 * The copy lives here rather than in the component for the same reason a
 * question's `help` does: it belongs to the spec, not to the layout.
 */
const ONBOARDING_PLAN = [
	{
		title: "You",
		heading: "Start with you",
		blurb:
			"Age and build decide what a healthy range even means. This is what keeps every number after it from being a guess.",
		aside:
			"None of this appears on your profile. Your birthday is used to age-adjust ranges and for nothing else.",
		fields: ["name", "birthDate", "gender"],
	},
	{
		title: "Goals",
		heading: "Aim at something",
		blurb:
			"Training, food and sleep all get pulled towards whatever you pick here. Change it whenever it changes.",
		aside:
			"Pick as many as you like. Mezo weighs them against each other rather than making you commit to one.",
		fields: ["goals", "goalDirection", "eatingHabits"],
	},
	{
		title: "Body",
		heading: "Your numbers",
		blurb:
			"Stored in metric, shown however you think. These are the whole input to your starting plan.",
		aside:
			"Rough is fine. A number you can correct beats a blank Mezo has to work around.",
		// No units question: the kg/lb switch sits on the measurements themselves,
		// which is the only place the answer means anything. No target weight
		// either — first run asks what is true today, not what is being aimed at.
		fields: ["heightCm", "weightKg", "activityLevel"],
	},
	{
		title: "Handle",
		heading: "Claim your handle",
		blurb:
			"Your profile lives at mezo.app/@yourname. Health answers stay private whichever way you set the switch.",
		aside:
			"The only screen with anything on it other people can see, and only if you say so.",
		fields: ["username", "isPublic"],
	},
] as const satisfies readonly {
	title: string;
	heading: string;
	blurb: string;
	aside: string;
	fields: readonly Field["name"][];
}[];

/**
 * One of the four chapters the progress bar shows. Several questions belong to
 * each; the questions are what get a screen.
 */
export type OnboardingStep = {
	/** The node on the progress bar, and the panel's chapter heading. */
	title: string;
	heading: string;
	blurb: string;
	/**
	 * What the panel beside the question says. Deliberately not the question's
	 * own copy: the two are on screen together, and repeating one paragraph in
	 * two places is how a layout stops being read at all.
	 */
	aside: string;
};

/** One question, filling one screen, knowing which chapter it belongs to. */
export type OnboardingQuestion = { field: Field; step: number };

/**
 * The fields that hold the Continue button. Everything else on a screen can be
 * left empty and filled in later from Settings — the plan screen says what it
 * could not work out rather than the flow refusing to move.
 *
 * These two are here because the app cannot function without them: a name to
 * address you by and a handle for the profile route. Units are not among them —
 * the kg/lb switch sits on the measurement screens and defaults to metric.
 */
export const ONBOARDING_REQUIRED: ReadonlySet<Field["name"]> = new Set([
	"name",
	"username",
]);

const fieldNamed = (name: Field["name"]) => {
	const field = SECTIONS.flatMap((section) => section.fields).find(
		(candidate) => candidate.name === name,
	);
	// Renaming a field in `SECTIONS` without fixing the plan above would
	// otherwise drop a question silently.
	if (!field) throw new Error(`Onboarding asks for unknown field "${name}"`);
	return field;
};

/** The four progress nodes, in order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ONBOARDING_PLAN;

/**
 * The plan flattened to one question per screen, each still knowing which step
 * it belongs to. Resolved against `SECTIONS`, so a question is specified in
 * exactly one place and asking for one that does not exist is a crash at import
 * rather than a screen that quietly renders nothing.
 *
 * One question to a screen rather than a chapter to a screen: a single question
 * with room around it is answered, and a column of five is skimmed.
 */
export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] =
	ONBOARDING_PLAN.flatMap((plan, step) =>
		plan.fields.map((name) => ({ field: fieldNamed(name), step })),
	);
