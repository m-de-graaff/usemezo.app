import type { Muscle, VolumeRow } from "@mezo/api/training";
import { cn } from "@mezo/ui/lib/utils";
import {
	type BodyModel,
	type BodyPart,
	FEMALE,
	MALE,
} from "~/components/workouts/body-paths";

/**
 * What a session trains, drawn on a body.
 *
 * The same numbers as the bars beside it, in the one encoding nobody has to
 * learn: a list of muscle names is a thing you read, and a body is a thing you
 * recognise. It is what makes "this is a push day with nothing on the rear
 * delts" a glance rather than a comparison of thirteen rows.
 *
 * Both views are always drawn. A front-only map hides the half of the body
 * people most often under-train, and a map that hides what is missing is the
 * opposite of the point.
 *
 * Colour is graded by the same verdict as the bars, so the two agree by
 * construction. It is never the only channel: every part carries its own
 * `<title>`, and the bars carry the words.
 */

/**
 * Which body to draw.
 *
 * Two models exist upstream, and the profile offers five answers. `neutral` is
 * what the other three get: the same figure with the hair left off, which is
 * the one part of these drawings that reads as a gender rather than as anatomy.
 * Guessing somebody into one of two silhouettes because they said "prefer not
 * to say" is a worse answer than not drawing the hair.
 */
export type BodyKind = "female" | "male" | "neutral";

export const bodyKind = (gender: string | null | undefined): BodyKind =>
	gender === "female" ? "female" : gender === "male" ? "male" : "neutral";

export function MuscleMap({
	className,
	kind,
	rows,
}: {
	className?: string;
	kind: BodyKind;
	/** Straight from `auditVolume`, so the map cannot disagree with the list. */
	rows: VolumeRow[];
}) {
	const model: BodyModel = kind === "female" ? FEMALE : MALE;
	const byMuscle = new Map(rows.map((row) => [row.muscle, row]));

	return (
		<div className={cn("flex items-start justify-center gap-2", className)}>
			<Body
				hair={kind !== "neutral"}
				rows={byMuscle}
				title="Front"
				view={model.front}
			/>
			<Body
				hair={kind !== "neutral"}
				rows={byMuscle}
				title="Back"
				view={model.back}
			/>
		</div>
	);
}

function Body({
	hair,
	rows,
	title,
	view,
}: {
	hair: boolean;
	rows: Map<Muscle, VolumeRow>;
	title: string;
	view: { viewBox: string; parts: BodyPart[] };
}) {
	return (
		<svg
			aria-label={`${title} of the body, with the muscles this session trains shaded`}
			className="h-auto w-full max-w-[11rem] shrink"
			// The whole body is one image with one meaning; the parts inside it are
			// described by their own titles for a pointer, not walked one at a time.
			role="img"
			viewBox={view.viewBox}
			xmlns="http://www.w3.org/2000/svg"
		>
			{view.parts.map((part, index) => {
				if (!hair && part.slug === "hair") return null;
				const row = part.muscle ? rows.get(part.muscle) : undefined;

				return (
					<path
						className={fillClass(row)}
						d={part.d}
						// The body is a fixed list in a fixed order. Nothing is added,
						// removed or reordered, only recoloured.
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={index}
					>
						{row && <title>{describe(row)}</title>}
					</path>
				);
			})}
		</svg>
	);
}

/**
 * The whole reading, in words, on the shape it belongs to.
 *
 * This is the only place the verdict is not a colour. There is no list of bars
 * beside the body any more, so without this an amber shoulder would mean
 * "past your ceiling" to a reader who can tell amber from white and nothing at
 * all to one who cannot (SC 1.4.1).
 */
const describe = (row: VolumeRow) =>
	`${row.muscle}: ${row.sets} weekly sets, ${
		row.verdict === "productive"
			? "in"
			: row.verdict === "over"
				? "above"
				: "below"
	} the productive range of ${row.mev} to ${row.mav}, ceiling ${row.mrv}`;

/**
 * Untrained muscle is the same colour as a hand or a knee, on purpose. The
 * question the map answers is "what is this session hitting", and anything it
 * is not hitting is just body.
 */
const fillClass = (row: VolumeRow | undefined) =>
	!row || row.sets < 1
		? "fill-muted-foreground/20"
		: row.verdict === "over"
			? "fill-amber-500"
			: row.verdict === "under"
				? "fill-muted-foreground/50"
				: "fill-foreground";
