"use client";

import { cn } from "@mezo/ui/lib/utils";
import { useId } from "react";

/**
 * A note somebody types: on a session, on a routine, or on one exercise inside
 * either.
 *
 * A plain `textarea` rather than a control from the UI package. Notes are the
 * only multi-line thing anyone writes in Mezo, and a component whose entire job
 * is to carry the same border as `Input` is a file to keep in step with `Input`
 * forever. `field-sizing-content` grows it as you type, and `rows` is what the
 * browsers that do not have it fall back to.
 *
 * Blank is absent, not empty. A note nobody wrote and a note somebody cleared
 * are the same fact, and storing "" would put an empty line where the plan used
 * to be on every screen that renders one.
 */
export function NoteField({
	className,
	label,
	maxLength = 500,
	onChange,
	placeholder,
	rows = 2,
	value,
}: {
	className?: string;
	/** Shown above the box, so it is not an unlabelled field once focus moves on. */
	label: string;
	maxLength?: number;
	onChange: (note: string | undefined) => void;
	placeholder?: string;
	rows?: number;
	value: string | undefined;
}) {
	const id = useId();

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<label className="font-medium text-muted-foreground text-xs" htmlFor={id}>
				{label}
			</label>
			<textarea
				className="field-sizing-content w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
				id={id}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value || undefined)}
				placeholder={placeholder}
				rows={rows}
				value={value ?? ""}
			/>
		</div>
	);
}
