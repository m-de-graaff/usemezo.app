import { exerciseById, exerciseImage } from "@mezo/api/exercises";
import { cn } from "@mezo/ui/lib/utils";
import Image from "next/image";

/**
 * The still, not the animation.
 *
 * A list of forty rows each playing a GIF is a fan spinning up. The animation
 * belongs on a screen that asked for it.
 *
 * `unoptimized` because the source is already a small JPEG on a CDN: running
 * every one of 1324 through the image optimiser costs a transform and saves
 * nothing.
 *
 * `alt=""` on purpose. The exercise name is always next to it, and a screen
 * reader announcing the same name twice is worse than not describing a picture
 * that carries no information the text does not.
 */
export function ExerciseThumb({
	className,
	exerciseId,
}: {
	className?: string;
	exerciseId: string;
}) {
	const exercise = exerciseById(exerciseId);

	// An id the catalogue no longer knows still has to render, or one stale
	// routine takes the whole page down on `exercise.name`.
	if (!exercise) {
		return (
			<div
				aria-hidden="true"
				className={cn("size-10 shrink-0 rounded-md bg-muted", className)}
			/>
		);
	}

	return (
		<Image
			alt=""
			className={cn(
				"size-10 shrink-0 rounded-md bg-muted object-cover",
				className,
			)}
			height={80}
			src={exerciseImage(exercise)}
			unoptimized
			width={80}
		/>
	);
}
