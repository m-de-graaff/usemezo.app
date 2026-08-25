import { exerciseById } from "@mezo/api/exercises";
import type { RoutineExercise } from "@mezo/api/workout-shape";
import { toDisplay, type UnitSystem, unitLabel } from "~/lib/measure";

/** How many exercise names fit on a card before the line stops being readable. */
const NAMED = 3;

/**
 * What a routine card says under its name.
 *
 * Names rather than a count, because "Bench press, Row, Overhead press" tells
 * you whether it is the session you meant and "6 exercises" does not.
 */
export function summariseRoutine(exercises: RoutineExercise[]): string {
	if (exercises.length === 0) return "No exercises yet";

	const names = exercises
		.slice(0, NAMED)
		.map((entry) => exerciseById(entry.exerciseId)?.name ?? "Unknown exercise");
	const rest = exercises.length - names.length;

	return rest > 0 ? `${names.join(", ")} +${rest} more` : names.join(", ");
}

/** `4080` -> `1h 08m`. Minutes alone read badly past an hour. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds / 60));
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	return hours
		? `${hours}h ${String(minutes).padStart(2, "0")}m`
		: `${minutes}m`;
}

/**
 * Stored kilograms, shown in whatever the reader uses. The same rule as every
 * other measurement in the app: storage is metric, display is a preference.
 */
export function formatVolume(kg: number, system: UnitSystem): string {
	const value = Math.round(toDisplay(kg, "mass", system));
	return `${value.toLocaleString("en-GB")} ${unitLabel("mass", system)}`;
}

/** `2026-08-25T…` -> `25 Aug`, the label a list row wants. */
export function formatDay(date: Date): string {
	return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
