"use client";

import { auditVolume } from "@mezo/api/training";
import { cn } from "@mezo/ui/lib/utils";
import { bodyKind, MuscleMap } from "~/components/workouts/muscle-map";
import { api } from "~/trpc/react";

/**
 * What a session trains, on a body.
 *
 * Always computed here from the exercise list, never handed in as a total. On
 * Milo's card that is the point — it is the difference between showing the user
 * the routine's volume and showing them the model's account of it — and on the
 * builder it is the only way the picture can be right while somebody is still
 * adding sets to it.
 *
 * This used to be a list of muscles with a bar each, next to the body. The body
 * on its own turned out to be the half people read: thirteen labelled bars is a
 * table you work through, and a lit shoulder is a thing you see. The numbers did
 * not go anywhere: every muscle carries its own, on the shape it belongs to.
 *
 * It used to carry a line about the parts of a muscle nothing here loads. It
 * read as a complaint about every routine that was not a full-body day, which
 * is most of them, so it is gone. `coverage` is still what Milo reasons with.
 *
 * The verdicts are for one week of training, so a routine that says nothing
 * about how often it is run is read as once. That is the honest reading and it
 * is also the one that makes a single session look light, which it is.
 */
export function VolumeSummary({
	className,
	exercises,
	timesPerWeek = 1,
}: {
	className?: string;
	exercises: { exerciseId: string; sets: number }[];
	timesPerWeek?: number;
}) {
	const profile = api.profile.get.useQuery();

	const rows = auditVolume(exercises, {
		timesPerWeek,
		experience: profile.data?.fitnessExperience,
	});

	// A muscle that gets half a set from one incidental exercise is noise; the
	// sets that carry the session are the ones worth colouring.
	const shown = rows.filter((row) => row.sets >= 1);

	if (shown.length === 0) return null;

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<p className="text-muted-foreground text-xs">
				Trained{timesPerWeek > 1 ? `, run ${timesPerWeek}× a week` : ""}
			</p>

			<MuscleMap kind={bodyKind(profile.data?.gender)} rows={shown} />
		</div>
	);
}
