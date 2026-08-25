"use client";

import { Button } from "@mezo/ui/button";
import { cn } from "@mezo/ui/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mezo/ui/tooltip";
import { type ComponentPropsWithRef, forwardRef } from "react";

/**
 * A small icon button that says what it does on hover, and to a screen reader
 * whether or not it is hovered.
 *
 * `forwardRef` rather than a plain component: assistant-ui's primitives mount
 * this through `asChild`, which clones the element and hands it a ref.
 */
export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
	tooltip: string;
	side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<
	HTMLButtonElement,
	TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => (
	<Tooltip>
		<TooltipTrigger
			render={
				<Button
					// The name every one of these needs, since the label is an icon and
					// a tooltip only exists on hover. Before the spread, so a caller
					// with a better label than its tooltip can still say so.
					aria-label={tooltip}
					className={cn("size-6 p-1 active:scale-90", className)}
					ref={ref}
					size="icon"
					variant="ghost"
					{...rest}
				/>
			}
		>
			{children}
		</TooltipTrigger>
		<TooltipContent side={side}>{tooltip}</TooltipContent>
	</Tooltip>
));

TooltipIconButton.displayName = "TooltipIconButton";
