import { toast } from "@mezo/ui/sonner";

/**
 * Say what the progression did, on the way into the session.
 *
 * The weights on the screen are about to disagree with the routine the user
 * wrote, and an app that changes somebody's programme without saying so is one
 * they stop trusting the numbers of. Silence is only correct when nothing
 * moved, which is what the empty list means.
 *
 * Named exercises rather than a count. "Weights updated on 4 exercises" is the
 * sentence that makes people open every card to find out which.
 */

/** How many fit in a toast before it is a wall rather than a note. */
const NAMED = 3;

export function toastProgressed(progressed: string[]) {
	if (progressed.length === 0) return;

	const shown = progressed.slice(0, NAMED);
	const rest = progressed.length - shown.length;

	toast.success(
		`Weights set from your history on ${progressed.length} ${
			progressed.length === 1 ? "exercise" : "exercises"
		}.`,
		{
			description:
				rest > 0 ? `${shown.join(" · ")} · +${rest} more` : shown.join(" · "),
			// Longer than the default. This is a sentence to read, not an
			// acknowledgement to glance at.
			duration: 8000,
		},
	);
}
