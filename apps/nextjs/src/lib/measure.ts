import type { Field } from "@mezo/api/profile-fields";

/**
 * Heights are stored in centimetres and weights in kilograms, always. The unit
 * system is a display preference, so switching it never rewrites a stored value
 * and never loses precision to a round trip.
 */
export type UnitSystem = "metric" | "imperial";

export const unitSystem = (value: unknown): UnitSystem =>
	value === "imperial" ? "imperial" : "metric";

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.453_592_37;

export const cmToInches = (cm: number) => cm / CM_PER_INCH;
export const kgToPounds = (kg: number) => kg / KG_PER_POUND;

/** `180` -> `5' 11"`. Rounds to the nearest inch, carrying 12in into a foot. */
export function formatFeetInches(cm: number) {
	const totalInches = Math.round(cmToInches(cm));
	const feet = Math.floor(totalInches / 12);
	const inches = totalInches % 12;
	return `${feet}' ${inches}"`;
}

type Measure = NonNullable<Extract<Field, { type: "number" }>["measure"]>;

/**
 * What to show for a stored value: the number, its unit, and whether the number
 * is already formatted (feet and inches is not a plain quantity).
 */
export function displayMeasure(
	value: number,
	measure: Measure | undefined,
	system: UnitSystem,
): { text: string; unit: string } {
	if (measure === "length") {
		return system === "imperial"
			? { text: formatFeetInches(value), unit: "" }
			: { text: String(Math.round(value)), unit: "cm" };
	}

	if (measure === "mass") {
		return system === "imperial"
			? { text: String(Math.round(kgToPounds(value))), unit: "lb" }
			: { text: (Math.round(value * 10) / 10).toString(), unit: "kg" };
	}

	return { text: String(value), unit: "" };
}

/**
 * The unit a plain number input is labelled with. Length in imperial is total
 * inches rather than feet and inches, because one input holds one number; the
 * onboarding screen shows the friendlier `5' 9"` because it is a readout.
 */
export function unitLabel(
	measure: Measure | undefined,
	system: UnitSystem,
): string | undefined {
	if (measure === "length") return system === "imperial" ? "in" : "cm";
	if (measure === "mass") return system === "imperial" ? "lb" : "kg";
	return undefined;
}

/** Stored (metric) -> what a number input shows. */
export function toDisplay(
	value: number,
	measure: Measure | undefined,
	system: UnitSystem,
): number {
	if (system !== "imperial" || !measure) return round(value, measure);
	return round(
		measure === "length" ? cmToInches(value) : kgToPounds(value),
		measure,
	);
}

/** What a number input holds -> stored (metric). */
export function fromDisplay(
	value: number,
	measure: Measure | undefined,
	system: UnitSystem,
): number {
	if (system !== "imperial" || !measure) return value;
	return measure === "length" ? value * CM_PER_INCH : value * KG_PER_POUND;
}

/** Heights are whole units; weights keep one decimal. */
const round = (value: number, measure: Measure | undefined) =>
	measure === "length" ? Math.round(value) : Math.round(value * 10) / 10;

/**
 * A sensible default so the slider does not open pinned to its minimum, which
 * reads as an answer the user did not give.
 */
export const defaultFor = (measure: Measure | undefined) =>
	measure === "length" ? 175 : measure === "mass" ? 75 : 0;
