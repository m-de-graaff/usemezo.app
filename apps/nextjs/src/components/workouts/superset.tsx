import type { ReactNode } from "react";

/**
 * The frame around exercises trained back to back.
 *
 * A tinted rail down the left is the signal people recognise from every other
 * training app, and the heading above it is what makes the grouping survive
 * greyscale, a colour vision deficiency, and a screen reader (SC 1.4.1). The
 * palette is the chart variables, so it is already tuned for both themes.
 */
const RAIL = [
	"border-l-[var(--chart-1)]",
	"border-l-[var(--chart-2)]",
	"border-l-[var(--chart-3)]",
	"border-l-[var(--chart-4)]",
	"border-l-[var(--chart-5)]",
] as const;

/** A, B, C. Enough for any session, and it wraps rather than running out. */
export const supersetLabel = (index: number) =>
	String.fromCharCode(65 + (index % 26));

export function SupersetGroup({
	children,
	index,
	size,
}: {
	children: ReactNode;
	/** Which superset this is within the list, counted from zero. */
	index: number;
	size: number;
}) {
	return (
		<li>
			<section
				aria-label={`Superset ${supersetLabel(index)}, ${size} exercises`}
				className={`flex flex-col gap-2 border-l-4 pl-3 ${RAIL[index % RAIL.length]}`}
			>
				<h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Superset {supersetLabel(index)}
				</h2>
				<ul className="flex flex-col gap-2">{children}</ul>
			</section>
		</li>
	);
}
