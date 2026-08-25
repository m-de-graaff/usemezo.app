"use client";

import type { Exercise } from "@mezo/api/exercises";
import { cn } from "@mezo/ui/lib/utils";
import { GripVerticalIcon, PlusIcon } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { useState } from "react";
import { ExercisePicker } from "~/components/workouts/exercise-picker";

/**
 * The frame around exercises trained back to back, and the tile you put more
 * of them into.
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

/**
 * Our own MIME type, so a tile lights up for an exercise being dragged and for
 * nothing else somebody might drag across the page.
 */
export const DRAG_TYPE = "application/x-mezo-exercise";

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
				aria-label={`Superset ${supersetLabel(index)}, ${size} ${size === 1 ? "exercise" : "exercises"}`}
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

/**
 * What you drag an exercise onto to put it in the superset above.
 *
 * Dragging is the fast way and never the only way (SC 2.5.7): the tile is also
 * a button, and the picker it opens offers the exercises already in the list as
 * a move alongside the catalogue as an add. Both land in the same place.
 */
export function SupersetDropZone({
	label,
	moveable,
	onMove,
	onPick,
}: {
	/** The group's letter, so the tile says which superset it feeds. */
	label: string;
	/** Exercises already in the list, offered as a move rather than an add. */
	moveable: { exerciseId: string; key: string }[];
	onMove: (key: string) => void;
	onPick: (exercise: Exercise) => void;
}) {
	const [over, setOver] = useState(false);

	const accepts = (event: DragEvent) =>
		event.dataTransfer.types.includes(DRAG_TYPE);

	return (
		<li>
			{/* The drop target wraps the trigger rather than being it: the picker
			    clones props onto whatever it is given, and a handler that quietly
			    fails to survive that is a tile that looks live and is not. */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target has
			    no role of its own, and the interaction it wraps is the button below,
			    which is focusable, labelled and does the same job without a pointer. */}
			<div
				className={cn(
					"rounded-xl border border-dashed transition-colors",
					over ? "border-primary bg-primary/5" : "border-muted-foreground/30",
				)}
				onDragLeave={() => setOver(false)}
				onDragOver={(event) => {
					if (!accepts(event)) return;
					// Without this the browser refuses the drop and runs its own
					// animation of the card springing back.
					event.preventDefault();
					event.dataTransfer.dropEffect = "move";
					setOver(true);
				}}
				onDrop={(event) => {
					if (!accepts(event)) return;
					event.preventDefault();
					setOver(false);
					const key = event.dataTransfer.getData(DRAG_TYPE);
					if (key) onMove(key);
				}}
			>
				<ExercisePicker
					moveable={moveable}
					onMove={onMove}
					onPick={onPick}
					trigger={
						<button
							className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-6 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							type="button"
						>
							<PlusIcon aria-hidden="true" className="size-4" />
							Add an exercise to superset {label}
						</button>
					}
				/>
			</div>
		</li>
	);
}

/**
 * One exercise card, as something another card can be dropped onto.
 *
 * Which half you drop on decides which side it lands: above the middle is
 * before, below is after. A line along that edge says so before you let go,
 * because a reorder you cannot predict is one you undo.
 *
 * Dragging is never the only way to reorder. The up and down buttons in the
 * card header do the same job for anyone not using a pointer (SC 2.5.7).
 */
export function Reorderable({
	children,
	entryKey,
	onMove,
}: {
	children: ReactNode;
	entryKey: string;
	onMove: (key: string, after: boolean) => void;
}) {
	const [edge, setEdge] = useState<"above" | "below" | null>(null);

	const below = (event: DragEvent<HTMLLIElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		return event.clientY > box.top + box.height / 2;
	};

	const dragged = (event: DragEvent) =>
		event.dataTransfer.types.includes(DRAG_TYPE);

	return (
		<li
			className={cn(
				"rounded-xl border bg-card p-4 transition-[box-shadow]",
				edge === "above" && "shadow-[inset_0_3px_0_0_var(--color-primary)]",
				edge === "below" && "shadow-[inset_0_-3px_0_0_var(--color-primary)]",
			)}
			onDragLeave={() => setEdge(null)}
			onDragOver={(event) => {
				if (!dragged(event)) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
				setEdge(below(event) ? "below" : "above");
			}}
			onDrop={(event) => {
				if (!dragged(event)) return;
				event.preventDefault();
				const after = below(event);
				setEdge(null);
				const key = event.dataTransfer.getData(DRAG_TYPE);
				if (key && key !== entryKey) onMove(key, after);
			}}
		>
			{children}
		</li>
	);
}

/**
 * The grip that starts a drag.
 *
 * Hidden from assistive tech on purpose. It is a pointer shortcut for something
 * the labelled superset button and the picker both already do, and a control
 * that can only be dragged is one a keyboard user cannot operate at all.
 */
export function DragHandle({
	entryKey,
	name,
}: {
	entryKey: string;
	name: string;
}) {
	return (
		<span
			aria-hidden="true"
			className="-ml-1 shrink-0 cursor-grab text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
			draggable
			onDragStart={(event) => {
				event.dataTransfer.setData(DRAG_TYPE, entryKey);
				event.dataTransfer.effectAllowed = "move";
				// Drag the card, not the eight pixels of grip that started it.
				const card = event.currentTarget.closest("li");
				if (card) event.dataTransfer.setDragImage(card, 24, 24);
			}}
			title={`Drag ${name} into a superset`}
		>
			<GripVerticalIcon className="size-4" />
		</span>
	);
}
