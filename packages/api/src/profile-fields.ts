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

	eatingHabits: enumOf(EATING_HABITS).nullish(),
	dailyCalories: z.number().int().min(500).max(10000).nullish(),

	medications: z.string().max(1000).nullish(),
	supplements: z.string().max(1000).nullish(),
	physicalLimitations: z.string().max(1000).nullish(),
	checkupFrequency: enumOf(CHECKUP_FREQUENCY).nullish(),
});

export type ProfileInput = z.infer<typeof profileInput>;

type FieldBase = {
	/** Must match a column on `user_profile`, or `name` on `user`. */
	name: keyof ProfileInput;
	label: string;
	help?: string;
	/**
	 * How onboarding asks for this, one question to a screen. Settings uses
	 * `label` instead, because it shows the whole section at once.
	 */
	question?: string;
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
		| { type: "select" | "multiselect"; options: Options }
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
				placeholder: "markdg",
				help: "Letters, numbers and underscores. Your profile lives at mezo.app/@yourname.",
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
				label: "Display name",
				question: "What should we call you?",
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
				label: "Eating habits",
				question: "How do you eat?",
				options: EATING_HABITS,
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
				type: "textarea",
				name: "medications",
				label: "Medications you take",
				question: "Do you take any medications?",
				placeholder: "One per line, e.g. metformin 500mg",
				help: "Leave blank if you take none.",
			},
			{
				type: "textarea",
				name: "supplements",
				label: "Supplements you take",
				question: "Do you take any supplements?",
				placeholder: "One per line, e.g. creatine 5g",
				help: "Leave blank if you take none.",
			},
			{
				type: "textarea",
				name: "physicalLimitations",
				label: "Physical limitations",
				question: "Anything a workout should work around?",
				placeholder: "e.g. lower back pain, reconstructed left knee",
				help: "Anything a workout should work around. Leave blank if none.",
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
];

export const findSection = (slug: string) =>
	SECTIONS.find((section) => section.slug === slug);
