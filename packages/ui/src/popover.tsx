"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "./lib/utils";

/**
 * A panel anchored to the thing that opened it.
 *
 * A tooltip and a popover look alike and are not the same control. A tooltip
 * opens on hover, which a phone has none of, and its content is a label rather
 * than something to read. A popover opens on a tap or a key, takes focus, and
 * closes on Escape, which is what a paragraph of explanation needs.
 */
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
	align = "center",
	alignOffset = 0,
	children,
	className,
	side = "top",
	sideOffset = 6,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<
		PopoverPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset"
	>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				className="isolate z-50"
				side={side}
				sideOffset={sideOffset}
			>
				<PopoverPrimitive.Popup
					className={cn(
						"z-50 w-fit max-w-72 origin-(--transform-origin) rounded-lg border bg-popover p-3 text-popover-foreground text-sm shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					data-slot="popover-content"
					{...props}
				>
					{children}
				</PopoverPrimitive.Popup>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverContent, PopoverTrigger };
