import {
	type Field,
	type ProfileInput,
	SECTIONS,
} from "@mezo/api/profile-fields";
import { z } from "zod";
import {
	displayMeasure,
	toDisplay,
	type UnitSystem,
	unitLabel,
} from "./measure.ts";

/**
 * What Milo is allowed to see and propose changes to.
 *
 * The questionnaire is already declared once in `@mezo/api/profile-fields`, so
 * this is a filter over it rather than a second list: a question added there
 * reaches the assistant without anyone remembering to come back here.
 *
 * The three exclusions are not health answers. A username is claimed once and
 * is permanent, `isPublic` is a privacy decision that should be taken on a
 * screen that says so, and a display name is not something to negotiate with a
 * chatbot.
 */
const NOT_MILOS_BUSINESS = new Set<keyof ProfileInput>([
	"name",
	"username",
	"isPublic",
]);

export const MILO_FIELDS: readonly Field[] = SECTIONS.flatMap(
	(section) => section.fields,
).filter((field) => !NOT_MILOS_BUSINESS.has(field.name));

const FIELDS_BY_NAME = new Map(MILO_FIELDS.map((field) => [field.name, field]));

export const miloField = (name: string) => FIELDS_BY_NAME.get(name as never);

/** The field names Milo may write, as a Zod enum for the tool schema. */
const writableNames = MILO_FIELDS.map((field) => field.name) as [
	string,
	...string[],
];

/**
 * One proposed change. The value is deliberately loose here: which of these
 * types a given field takes is checked by `profileInput` when the user presses
 * Apply, which is the boundary that has to hold anyway. Duplicating the
 * per-field types into the tool schema would give the model a longer schema to
 * get wrong and buy no extra safety.
 */
export const profileChange = z.object({
	field: z.enum(writableNames).describe("The setting to change."),
	value: z
		.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
		.describe(
			"The new value, in stored units: kilograms for mass, centimetres for length. `null` clears the answer.",
		),
	reason: z
		.string()
		.describe("One short sentence on why, shown to the user on the card."),
});

export type ProfileChange = z.infer<typeof profileChange>;

/**
 * A stored answer as a human reads it: the option's label rather than its key,
 * and a measurement in whichever system the user picked.
 *
 * Storage is always metric, so this is the only place the imperial preference
 * shows up — the same rule `~/lib/measure` states for the settings form.
 */
export function formatAnswer(
	field: Field,
	value: unknown,
	system: UnitSystem,
): string {
	if (value === null || value === undefined) return "not set";

	switch (field.type) {
		case "number": {
			if (typeof value !== "number") return String(value);
			if (field.measure) {
				const { text, unit } = displayMeasure(value, field.measure, system);
				return unit ? `${text} ${unit}` : text;
			}
			return field.unit ? `${value} ${field.unit}` : String(value);
		}
		case "select":
			return field.options[String(value)] ?? String(value);
		case "multiselect":
			return Array.isArray(value) && value.length > 0
				? value
						.map((key) => field.options[String(key)] ?? String(key))
						.join(", ")
				: "none";
		case "toggle":
			return value ? field.onLabel : field.offLabel;
		default:
			return String(value);
	}
}

/**
 * The number a change card should show, already converted for display. Split
 * from `formatAnswer` because the card animates the digits and needs the unit
 * on its own.
 */
export function displayParts(
	field: Field,
	value: unknown,
	system: UnitSystem,
): { text: string; unit: string } {
	if (value === null || value === undefined)
		return { text: "not set", unit: "" };
	if (field.type !== "number" || typeof value !== "number") {
		return { text: formatAnswer(field, value, system), unit: "" };
	}
	if (field.measure) return displayMeasure(value, field.measure, system);
	return {
		text: String(toDisplay(value, undefined, system)),
		unit: field.unit ?? unitLabel(undefined, system) ?? "",
	};
}

/**
 * What a field accepts, written for a model rather than for a form: the bounds
 * a number has to fall inside, or the exact option keys a select will take.
 * Without the keys the model guesses `"Male"` where the column stores `"male"`,
 * and the write bounces off `profileInput` for no good reason.
 */
export function describeField(field: Field): string {
	const help = field.help ? ` ${field.help}` : "";

	switch (field.type) {
		case "number": {
			const unit = field.measure
				? field.measure === "mass"
					? "kg"
					: "cm"
				: (field.unit ?? "");
			const range = `${field.min} to ${field.max}${unit ? ` ${unit}` : ""}`;
			return `${field.name} (${field.label}): number, ${range}.${help}`;
		}
		case "select":
			return `${field.name} (${field.label}): one of ${Object.keys(field.options).join(", ")}.${help}`;
		case "multiselect":
			return `${field.name} (${field.label}): any of ${Object.keys(field.options).join(", ")}.${help}`;
		case "toggle":
			return `${field.name} (${field.label}): true or false.${help}`;
		case "date":
			return `${field.name} (${field.label}): a date, YYYY-MM-DD.${help}`;
		default:
			return `${field.name} (${field.label}): text.${help}`;
	}
}
