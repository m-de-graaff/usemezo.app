"use client";

import { exerciseById, loggingHint } from "@mezo/api/exercises";
import { Popover, PopoverContent, PopoverTrigger } from "@mezo/ui/popover";
import { InfoIcon } from "lucide-react";

/**
 * How to fill in the weight column for this movement, if it is not obvious.
 *
 * Nothing at all for most of the catalogue. A barbell row is the weight on the
 * barbell and an icon saying so beside eight hundred exercises teaches people
 * to stop looking at icons, which is the one thing that would make the dumbbell
 * on the next row useless.
 *
 * A popover rather than a tooltip, because this is a sentence to read on a
 * phone in a gym. Tooltips open on hover, and a phone has none.
 */
export function ExerciseInfo({ exerciseId }: { exerciseId: string }) {
	const exercise = exerciseById(exerciseId);
	const hint = exercise ? loggingHint(exercise) : null;
	if (!exercise || !hint) return null;

	return (
		<Popover>
			<PopoverTrigger
				// Named for the exercise: a screen of these all called "How to log
				// this" is a screen of controls a screen reader cannot tell apart.
				aria-label={`How to log ${exercise.name}`}
				className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<InfoIcon aria-hidden="true" className="size-4" />
			</PopoverTrigger>
			<PopoverContent align="end">
				<p className="mb-1 font-medium capitalize">{exercise.name}</p>
				<p className="text-muted-foreground">{hint}</p>
			</PopoverContent>
		</Popover>
	);
}
