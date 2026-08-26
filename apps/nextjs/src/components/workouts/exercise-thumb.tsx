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
	const src = exercise ? exerciseImage(exercise) : null;

	// Two cases, one square. An id the catalogue no longer knows still has to
	// render, or one stale routine takes the whole page down on `exercise.name`.
	// And an exercise the user added themselves has no picture, because nobody
	// drew one: it gets its initial rather than a blank tile, so a list of them
	// is still scannable.
	if (!src) {
		return (
			<div
				aria-hidden="true"
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-muted-foreground text-sm uppercase",
					className,
				)}
			>
				{exercise?.name.trim().charAt(0)}
			</div>
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
			src={src}
			unoptimized
			width={80}
		/>
	);
}
