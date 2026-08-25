"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { cn } from "./lib/utils";

/**
 * A select you can type into. Same surfaces as `select.tsx` — the two sit next
 * to each other in a form and have to look like one control with two lengths of
 * list behind it.
 */
const Combobox = ComboboxPrimitive.Root;
const ComboboxCollection = ComboboxPrimitive.Collection;
const ComboboxValue = ComboboxPrimitive.Value;

function ComboboxInputGroup({
	className,
	...props
}: ComboboxPrimitive.InputGroup.Props) {
	return (
		<ComboboxPrimitive.InputGroup
			className={cn(
				"flex w-full cursor-text flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
				className,
			)}
			data-slot="combobox-input-group"
			{...props}
		/>
	);
}

function ComboboxChips({ className, ...props }: ComboboxPrimitive.Chips.Props) {
	return (
		<ComboboxPrimitive.Chips
			className={cn("flex w-full flex-wrap items-center gap-1", className)}
			data-slot="combobox-chips"
			{...props}
		/>
	);
}

function ComboboxChip({ className, ...props }: ComboboxPrimitive.Chip.Props) {
	return (
		<ComboboxPrimitive.Chip
			className={cn(
				"flex min-h-6 cursor-default items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-sm leading-none focus-within:bg-accent focus-within:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
				className,
			)}
			data-slot="combobox-chip"
			{...props}
		/>
	);
}

function ComboboxChipRemove({
	className,
	...props
}: ComboboxPrimitive.ChipRemove.Props) {
	return (
		<ComboboxPrimitive.ChipRemove
			className={cn(
				"flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground",
				className,
			)}
			data-slot="combobox-chip-remove"
			{...props}
		>
			<XIcon className="size-3" />
		</ComboboxPrimitive.ChipRemove>
	);
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
	return (
		<ComboboxPrimitive.Input
			className={cn(
				"h-6 min-w-24 flex-1 border-0 bg-transparent p-0 text-base outline-none placeholder:text-muted-foreground md:text-sm",
				className,
			)}
			data-slot="combobox-input"
			{...props}
		/>
	);
}

function ComboboxTrigger({
	className,
	...props
}: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			className={cn(
				"flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground",
				className,
			)}
			data-slot="combobox-trigger"
			{...props}
		>
			<ChevronDownIcon className="size-4" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxContent({
	className,
	children,
	sideOffset = 4,
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<ComboboxPrimitive.Positioner.Props, "sideOffset">) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				className="isolate z-50 outline-none"
				sideOffset={sideOffset}
			>
				<ComboboxPrimitive.Popup
					className={cn(
						"cn-menu-target cn-menu-translucent relative isolate z-50 max-h-[min(24rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					data-slot="combobox-content"
					{...props}
				>
					{children}
				</ComboboxPrimitive.Popup>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
	return (
		<ComboboxPrimitive.List
			className={cn(
				"max-h-[min(23rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain px-1 outline-none",
				className,
			)}
			data-slot="combobox-list"
			{...props}
		/>
	);
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			className={cn("px-2 py-3 text-muted-foreground text-sm", className)}
			data-slot="combobox-empty"
			{...props}
		/>
	);
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
	return (
		<ComboboxPrimitive.Group
			className={cn("block pb-1 last:pb-0", className)}
			data-slot="combobox-group"
			{...props}
		/>
	);
}

function ComboboxGroupLabel({
	className,
	...props
}: ComboboxPrimitive.GroupLabel.Props) {
	return (
		<ComboboxPrimitive.GroupLabel
			className={cn(
				"px-1.5 py-1.5 text-muted-foreground text-xs select-none",
				className,
			)}
			data-slot="combobox-group-label"
			{...props}
		/>
	);
}

function ComboboxItem({
	className,
	children,
	...props
}: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			className={cn(
				"relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
				className,
			)}
			data-slot="combobox-item"
			{...props}
		>
			<span className="flex-1">{children}</span>
			<ComboboxPrimitive.ItemIndicator
				render={
					<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
				}
			>
				<CheckIcon className="pointer-events-none size-4" />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
}

export {
	Combobox,
	ComboboxChip,
	ComboboxChipRemove,
	ComboboxChips,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxGroupLabel,
	ComboboxInput,
	ComboboxInputGroup,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
};
