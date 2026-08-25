"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { cn } from "@mezo/ui/lib/utils";
import {
	CheckIcon,
	ChevronRightIcon,
	LoaderIcon,
	XCircleIcon,
} from "lucide-react";

/**
 * What a tool call looks like when it has no card of its own.
 *
 * A line saying what ran, opening on click to the arguments and the result.
 * `<details>` does the disclosure, which is why there is no state, no
 * animation config and no collapsible component behind this — the element
 * already knows how to be one, and keeps working before hydration.
 *
 * `proposeProfileUpdate` renders its own card and never reaches here.
 */
export const ToolFallback: ToolCallMessagePartComponent = ({
	toolName,
	argsText,
	result,
	status,
}) => {
	const running = status?.type === "running";
	const failed = status?.type === "incomplete";
	const Icon = running ? LoaderIcon : failed ? XCircleIcon : CheckIcon;

	return (
		<details className="group my-1.5 text-sm">
			<summary className="flex w-fit cursor-pointer list-none items-center gap-2 py-1 text-muted-foreground transition-colors hover:text-foreground">
				<Icon
					className={cn(
						"size-4 shrink-0",
						running && "animate-spin [animation-duration:0.6s]",
					)}
				/>
				<span>
					{failed ? "Tool failed" : running ? "Running" : "Used"}:{" "}
					<b className="font-medium">{toolName}</b>
				</span>
				<ChevronRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" />
			</summary>

			<div className="flex flex-col gap-2 ps-6 pt-1 pb-2">
				{argsText && (
					<pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-foreground/90 text-xs">
						{argsText}
					</pre>
				)}
				{result !== undefined && (
					<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-foreground/90 text-xs">
						{typeof result === "string"
							? result
							: JSON.stringify(result, null, 2)}
					</pre>
				)}
			</div>
		</details>
	);
};
