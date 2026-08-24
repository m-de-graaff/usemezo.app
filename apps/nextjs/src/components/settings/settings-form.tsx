"use client";

import type { Field, ProfileInput, Section } from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mezo/ui/select";
import { toast } from "@mezo/ui/sonner";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
	UsernameStatus,
	useUsernameAvailability,
} from "~/components/username-availability";
import {
	fromDisplay,
	toDisplay,
	type UnitSystem,
	unitLabel,
	unitSystem,
} from "~/lib/measure";
import { api } from "~/trpc/react";

/**
 * Every answer, keyed by field name. The spec cannot tell TypeScript which
 * field carries which of these types — that correlation is checked at the API
 * boundary by `profileInput` instead, which is the one that has to hold.
 */
export type Answer = string | number | boolean | string[] | null;
export type SettingsValues = Partial<Record<keyof ProfileInput, Answer>>;

const sameAnswer = (a: unknown, b: unknown) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function SettingsForm({
	section,
	values: initial,
	submitLabel = "Save changes",
	extraActions,
	onSaved,
}: {
	section: Section;
	values: SettingsValues;
	/** Onboarding says "Continue"; settings says "Save changes". */
	submitLabel?: string;
	/** Rendered left of the submit button — onboarding's "Skip for now". */
	extraActions?: React.ReactNode;
	/** Onboarding advances a step here. Settings leaves it out. */
	onSaved?: () => void;
}) {
	const router = useRouter();
	const [values, setValues] = useState(initial);
	// The handle whose availability we last asked about. Set on blur, so the
	// check fires once the field is finished rather than on every keystroke.
	// What the server last confirmed, so Save can stay disabled until something
	// actually changed — including right after a successful save.
	const [saved, setSaved] = useState(initial);

	const update = api.profile.update.useMutation({
		onSuccess: (_data, submitted) => {
			setSaved((previous) => ({ ...previous, ...submitted }));
			toast.success(`${section.title} saved.`);
			// The page is a Server Component and the header renders the display
			// name, so both need re-reading.
			router.refresh();
			onSaved?.();
		},
		onError: (error) => {
			// A validation failure arrives as a JSON-encoded issue array in
			// `message`; the flattened field errors are the readable half.
			const first = Object.values(error.data?.zodError?.fieldErrors ?? {})
				.flat()
				.find((message): message is string => typeof message === "string");
			toast.error(first ?? error.message);
		},
	});

	const availability = useUsernameAvailability(values.username);
	const system = unitSystem(values.units);

	const dirty = section.fields.some(
		(field) => !sameAnswer(values[field.name], saved[field.name]),
	);

	function setAnswer(name: keyof ProfileInput, value: Answer) {
		// A handle that changed is no longer the one that was checked.
		if (name === "username") availability.reset();
		setValues((previous) => ({ ...previous, [name]: value }));
	}

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// Only this screen's fields: anything absent has to survive untouched,
		// and an emptied field is `null`, which clears it.
		// A toggle is false when off, never null — the column is NOT NULL.
		const payload = Object.fromEntries(
			section.fields.map((field) => [
				field.name,
				values[field.name] ?? (field.type === "toggle" ? false : null),
			]),
		);
		update.mutate(payload as ProfileInput);
	}

	return (
		<form className="contents" onSubmit={onSubmit}>
			<Card>
				<CardHeader>
					<CardTitle>{section.title}</CardTitle>
					<CardDescription>{section.description}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col">
					{section.fields.map((field) => (
						<FieldRow
							field={field}
							key={field.name}
							onBlur={
								field.name === "username" ? availability.check : undefined
							}
							onChange={setAnswer}
							status={
								field.name === "username" ? (
									<UsernameStatus availability={availability} />
								) : undefined
							}
							system={system}
							value={values[field.name] ?? null}
						/>
					))}
				</CardContent>
			</Card>
			<div className="flex items-center justify-end gap-3">
				<p aria-live="polite" className="mr-auto text-muted-foreground text-sm">
					{dirty ? "Unsaved changes" : ""}
				</p>
				{extraActions}
				<Button
					disabled={
						(!dirty && !onSaved) || update.isPending || availability.taken
					}
					type="submit"
				>
					{update.isPending ? "Saving…" : submitLabel}
				</Button>
			</div>
		</form>
	);
}

function FieldRow({
	field,
	value,
	onChange,
	system,
	onBlur,
	status,
}: {
	field: Field;
	value: Answer;
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	system: UnitSystem;
	/** Only the username field uses these two. */
	onBlur?: () => void;
	status?: React.ReactNode;
}) {
	const id = useId();
	const labelId = `${id}-label`;
	const helpId = `${id}-help`;
	const statusId = `${id}-status`;
	const describedBy =
		[field.help && helpId, status && statusId].filter(Boolean).join(" ") ||
		undefined;
	// A measured quantity is labelled in whichever system the user picked; the
	// value underneath stays metric either way.
	const unit =
		field.type === "number"
			? (unitLabel(field.measure, system) ?? field.unit)
			: undefined;
	const label = unit ? `${field.label} (${unit})` : field.label;

	// A group of checkboxes has no single control to point a `for` at, so it
	// renders its label as plain text and the fieldset points back at it.
	const labelledByText = field.type === "multiselect";

	return (
		<div className="grid gap-x-8 gap-y-2 border-border/60 border-t py-5 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
			<div className="flex flex-col gap-1">
				{labelledByText ? (
					<span className="font-medium text-sm" id={labelId}>
						{label}
					</span>
				) : (
					<Label htmlFor={id}>{label}</Label>
				)}
				{field.help && (
					<p className="text-muted-foreground text-xs" id={helpId}>
						{field.help}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				{field.type === "toggle" ? (
					<label className="flex min-h-6 items-start gap-2 py-1 text-sm">
						<input
							aria-describedby={describedBy}
							checked={value === true}
							className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
							id={id}
							onChange={(event) => onChange(field.name, event.target.checked)}
							type="checkbox"
						/>
						{value === true ? field.onLabel : field.offLabel}
					</label>
				) : field.type === "multiselect" ? (
					<fieldset
						aria-describedby={describedBy}
						aria-labelledby={labelId}
						className="grid gap-1 sm:grid-cols-2"
					>
						{Object.entries(field.options).map(([option, optionLabel]) => {
							const selected = Array.isArray(value) ? value : [];
							return (
								<label
									className="flex min-h-6 items-center gap-2 py-1 text-sm"
									key={option}
								>
									<input
										checked={selected.includes(option)}
										className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
										onChange={(event) =>
											onChange(
												field.name,
												event.target.checked
													? [...selected, option]
													: selected.filter((item) => item !== option),
											)
										}
										type="checkbox"
										value={option}
									/>
									{optionLabel}
								</label>
							);
						})}
					</fieldset>
				) : field.type === "select" ? (
					<Select
						items={field.options}
						onValueChange={(next) => onChange(field.name, next)}
						value={typeof value === "string" ? value : null}
					>
						{/* Base UI computes the trigger's `aria-labelledby` itself and
					    overrides the prop, so the name has to come from a native
					    `<label for>` — the trigger renders a labelable `<button>`. */}
						<SelectTrigger
							aria-describedby={describedBy}
							className="w-full max-w-md"
							id={id}
						>
							<SelectValue placeholder="Not set" />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(field.options).map(([option, optionLabel]) => (
								<SelectItem key={option} value={option}>
									{optionLabel}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : field.type === "textarea" ? (
					<textarea
						aria-describedby={describedBy}
						className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
						id={id}
						maxLength={1000}
						onChange={(event) =>
							onChange(field.name, event.target.value || null)
						}
						placeholder={field.placeholder}
						rows={3}
						value={typeof value === "string" ? value : ""}
					/>
				) : field.type === "number" ? (
					// The stored value is metric; this shows and accepts whichever
					// system the user picked, converting on the way in and out.
					<Input
						aria-describedby={describedBy}
						className="max-w-40"
						id={id}
						max={toDisplay(field.max, field.measure, system)}
						min={toDisplay(field.min, field.measure, system)}
						onChange={(event) =>
							onChange(
								field.name,
								event.target.value === ""
									? null
									: fromDisplay(
											event.target.valueAsNumber,
											field.measure,
											system,
										),
							)
						}
						step={field.step ?? 1}
						type="number"
						value={
							typeof value === "number"
								? toDisplay(value, field.measure, system)
								: ""
						}
					/>
				) : field.type === "date" ? (
					<Input
						aria-describedby={describedBy}
						className="max-w-52"
						id={id}
						max={new Date().toISOString().slice(0, 10)}
						min="1900-01-01"
						onChange={(event) =>
							onChange(field.name, event.target.value || null)
						}
						type="date"
						value={typeof value === "string" ? value : ""}
					/>
				) : field.type === "text" ? (
					<div className="flex max-w-md items-center gap-1.5">
						{field.prefix && (
							<span className="shrink-0 text-muted-foreground text-sm">
								{field.prefix}
							</span>
						)}
						<Input
							aria-describedby={describedBy}
							id={id}
							maxLength={100}
							onBlur={onBlur}
							onChange={(event) =>
								onChange(field.name, event.target.value || null)
							}
							placeholder={field.placeholder}
							required
							type="text"
							value={typeof value === "string" ? value : ""}
						/>
					</div>
				) : null}
				{status && (
					<p aria-live="polite" className="text-xs" id={statusId}>
						{status}
					</p>
				)}
			</div>
		</div>
	);
}
