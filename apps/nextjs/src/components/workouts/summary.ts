import { exerciseById } from "@mezo/api/exercises";
import {
	isCounted,
	type PlannedSet,
	type RoutineExercise,
} from "@mezo/api/workout-shape";
// Relative, not the `~` alias, so `node --test` can load this file: the alias
// is a bundler's, and the test runner is not one.
import {
	formatRest,
	toDisplay,
	type UnitSystem,
	unitLabel,
} from "../../lib/measure.ts";

// Re-exported so every workout screen keeps reading its formatters from one
// place. They live in `measure` because they are arithmetic on a number and
// nothing about a workout, and because a test can import that file.
export { formatDuration, formatRest } from "../../lib/measure.ts";

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

/** `6` for one value, `6-10` for a spread. A range nobody has to decode. */
function span(values: number[], round: (value: number) => number): string {
	const low = round(Math.min(...values));
	const high = round(Math.max(...values));
	return low === high ? `${low}` : `${low}-${high}`;
}

/**
 * What one exercise plans, in the two lines a routine reads as.
 *
 * The first line is the shape of the work: how many sets, what rep range, how
 * long to rest. The second is the load, which is a separate line because it is
 * the one that changes week to week and the one people scan for.
 *
 * Warm-ups are counted apart from the sets, the same way they are excluded from
 * volume everywhere else: three working sets and a warm-up is not four sets,
 * and reading it as four is how a session gets planned a set short.
 */
export function describeSets(
	entry: RoutineExercise,
	system: UnitSystem,
): string[] {
	const working = entry.sets.filter((set) => set.type !== "warmup");
	const warmups = entry.sets.length - working.length;

	const plan: string[] = [];
	if (working.length > 0) {
		plan.push(`${working.length} ${working.length === 1 ? "set" : "sets"}`);
	}
	if (warmups > 0) plan.push(`${warmups} warm-up${warmups === 1 ? "" : "s"}`);

	// Both ends of every set, flattened into one list, so three sets of eight to
	// twelve read as "8-12 reps" rather than as "8 reps". `span` takes the
	// extremes of whatever it is given, which is the same answer whether the
	// range is one set's or the exercise's.
	//
	// `flatMap` rather than `filter`, which does not narrow away the `undefined`
	// a blank box leaves behind.
	const reps = working.flatMap((set) =>
		[set.reps, set.repsMax].flatMap((value) =>
			value === undefined ? [] : [value],
		),
	);
	if (reps.length > 0) plan.push(`${span(reps, Math.round)} reps`);

	// Zero is the one interval worth spelling out in words. "Rest 0s" reads as a
	// number somebody forgot to fill in; "No rest" reads as the choice it is.
	if (entry.restSec !== undefined) {
		plan.push(
			entry.restSec === 0 ? "No rest" : `Rest ${formatRest(entry.restSec)}`,
		);
	}

	// Bodyweight sets are stored as 0 kg and saying "0 kg" is worse than saying
	// nothing: the number is real, it just is not a load anybody sets.
	const weights = working.flatMap((set) =>
		set.weightKg === undefined || set.weightKg === 0 ? [] : [set.weightKg],
	);

	const lines = [plan.join(" · ")];
	if (weights.length > 0) {
		const shown = weights.map((kg) => toDisplay(kg, "mass", system));
		lines.push(
			`${span(shown, (value) => Math.round(value * 10) / 10)} ${unitLabel("mass", system)}`,
		);
	}

	return lines.filter((line) => line.length > 0);
}

/**
 * Which of last time's sets belongs beside this row, if any.
 *
 * By working-set ordinal, not by position in the list. Last time's sets are
 * only the ones that got ticked, so a session where three warm-ups were skipped
 * and three working sets were done arrives as three sets — and lining those up
 * by index would print them against today's *warm-up* rows, which is precisely
 * backwards. Today's second working set looks for last time's second working
 * set, and nothing else is consulted.
 *
 * Warm-ups have no previous at all. A ramp is whatever gets you to the first
 * work set on the day, so what you ramped with last time is not a number worth
 * a column, and nothing here goes looking for one.
 */
export function previousFor<T extends PlannedSet>(
	sets: T[],
	previous: PlannedSet[],
	index: number,
): PlannedSet | undefined {
	const set = sets[index];
	if (!set || !isCounted(set)) return undefined;

	const ordinal = sets.slice(0, index + 1).filter(isCounted).length;
	return previous.filter(isCounted)[ordinal - 1];
}

/**
 * One set from last time, as `60 kg × 10`.
 *
 * Null rather than a dash when there is nothing, so the caller draws the dash
 * and the column is never an empty cell.
 *
 * A bodyweight set is stored as 0 kg and reads as reps alone. "0 kg × 10" is a
 * true statement that nobody wants to see.
 */
export function lastTime(
	set: PlannedSet | undefined,
	system: UnitSystem,
): string | null {
	if (!set || set.reps === undefined) return null;
	if (!set.weightKg) return `${set.reps} reps`;

	const weight = Math.round(toDisplay(set.weightKg, "mass", system) * 10) / 10;
	return `${weight} ${unitLabel("mass", system)} × ${set.reps}`;
}
