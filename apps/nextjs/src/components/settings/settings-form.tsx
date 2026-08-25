"use client";

import {
	type Field,
	findSection,
	type ProfileInput,
} from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import {
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
} from "@mezo/ui/combobox";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { cn } from "@mezo/ui/lib/utils";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mezo/ui/select";
import { toast } from "@mezo/ui/sonner";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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

/**
 * The small tracked capitals every label that is not a heading uses.
 * `onboarding-flow.tsx` declares the same string — the two screens are meant to
 * look like one product, and one className is not worth a module to hold it.
 * Change one, change both.
 */
const MICRO =
	"font-medium text-[0.6875rem] uppercase leading-none tracking-[0.16em]";

/**
 * Answers that are claimed once and then shown rather than asked. A handle is
 * what every profile link points at; `profile.update` refuses to change one, so
 * this is the reason the form has no control for it rather than the rule.
 */
const LOCKED = new Set<Field["name"]>(["username"]);

const sameAnswer = (a: unknown, b: unknown) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function SettingsForm({
	slug,
	values: initial,
}: {
	/**
	 * The section's slug rather than the section itself: the spec carries `when`
	 * predicates, and functions cannot cross a Server Component boundary. The
	 * lookup is a plain module read, so it is free here.
	 */
	slug: string;
	values: SettingsValues;
}) {
	const section = findSection(slug);
	if (!section) throw new Error(`Unknown settings section: ${slug}`);

	const router = useRouter();
	const [values, setValues] = useState(initial);
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

	const system = unitSystem(values.units);

	// The fields this section's own answers say still apply. Onboarding filters
	// the same way; both have to, or Settings writes a target weight for someone
	// who told it they are not aiming at one.
	const asked = section.fields.filter(
		(field) => !field.when || field.when(values),
	);
	const editable = asked.filter((field) => !LOCKED.has(field.name));

	const dirty = editable.some(
		(field) => !sameAnswer(values[field.name], saved[field.name]),
	);

	function setAnswer(name: keyof ProfileInput, value: Answer) {
		setValues((previous) => ({ ...previous, [name]: value }));
	}

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// Only this screen's fields: anything absent has to survive untouched,
		// and an emptied field is `null`, which clears it.
		// A toggle is false when off, never null — the column is NOT NULL.
		const payload = Object.fromEntries(
			editable.map((field) => [
				field.name,
				values[field.name] ?? (field.type === "toggle" ? false : null),
			]),
		);
		update.mutate(payload as ProfileInput);
	}

	return (
		<form
			className="mx-auto flex w-full max-w-3xl flex-1 flex-col"
			onSubmit={onSubmit}
		>
			<header>
				<p className={cn(MICRO, "text-muted-foreground")}>Settings</p>
				<h1 className="mt-3 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em]">
					{section.title}
				</h1>
				<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
					{section.description}
				</p>
			</header>

			{/* One question to a row, divided rather than boxed: a card around each
			    of six answers is five borders that say nothing. */}
			<div className="mt-4 flex flex-col divide-y divide-border/60">
				{asked.map((field) => (
					<FieldRow
						field={field}
						key={field.name}
						locked={LOCKED.has(field.name)}
						onChange={setAnswer}
						system={system}
						value={values[field.name] ?? null}
					/>
				))}
			</div>

			{/* Sticky, so Save is reachable from the middle of a long section
			    rather than only from the bottom of one. */}
			<div className="sticky bottom-0 z-10 mt-auto flex items-center gap-3 border-border/60 border-t bg-background/95 py-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
				<p aria-live="polite" className="mr-auto text-muted-foreground text-sm">
					{dirty ? "Unsaved changes" : ""}
				</p>
				<Button disabled={!dirty || update.isPending} type="submit">
					{update.isPending ? "Saving…" : "Save changes"}
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
	locked,
}: {
	field: Field;
	value: Answer;
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	system: UnitSystem;
	/** Shown rather than asked. The handle is the only one. */
	locked?: boolean;
}) {
	const id = useId();
	const labelId = `${id}-label`;
	const helpId = `${id}-help`;
	// A measured quantity is labelled in whichever system the user picked; the
	// value underneath stays metric either way.
	const unit =
		field.type === "number"
			? (unitLabel(field.measure, system) ?? field.unit)
			: undefined;
	const label = unit ? `${field.label} (${unit})` : field.label;

	// A group of checkboxes has no single control to point a `for` at, so it
	// renders its label as plain text and the fieldset points back at it.
	const labelledByText = locked || field.type === "multiselect";

	return (
		<div className="grid gap-x-8 gap-y-2 py-6 first:pt-2 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
			<div className="flex flex-col gap-1.5">
				{labelledByText ? (
					<span className="font-medium text-sm" id={labelId}>
						{label}
					</span>
				) : (
					<Label htmlFor={id}>{label}</Label>
				)}
				{field.help && (
					<p
						className="text-pretty text-muted-foreground text-xs leading-relaxed"
						id={helpId}
					>
						{field.help}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				{locked ? (
					<LockedAnswer field={field} value={value} />
				) : (
					<FieldControl
						describedBy={field.help ? helpId : undefined}
						field={field}
						id={id}
						labelId={labelId}
						onChange={onChange}
						system={system}
						value={value}
					/>
				)}
			</div>
		</div>
	);
}

/**
 * An answer that is shown rather than asked. The value still has to be on the
 * screen — "you cannot change this" is only useful next to what it is.
 */
function LockedAnswer({ field, value }: { field: Field; value: Answer }) {
	const prefix = field.type === "text" ? field.prefix : undefined;

	return (
		<div className="flex max-w-md items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
			<span className="flex-1 truncate font-medium text-sm">
				{typeof value === "string" && value !== "" ? (
					`${prefix ?? ""}${value}`
				) : (
					<span className="text-muted-foreground">Not set</span>
				)}
			</span>
			<LockIcon
				aria-hidden="true"
				className="size-3.5 shrink-0 text-muted-foreground"
			/>
		</div>
	);
}

function FieldControl({
	field,
	value,
	onChange,
	system,
	id,
	labelId,
	describedBy,
}: {
	field: Field;
	value: Answer;
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	system: UnitSystem;
	id: string;
	labelId: string;
	describedBy?: string;
}) {
	switch (field.type) {
		case "toggle":
			return (
				<label className="flex min-h-9 items-center gap-2.5 text-sm">
					<input
						aria-describedby={describedBy}
						checked={value === true}
						className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						id={id}
						onChange={(event) => onChange(field.name, event.target.checked)}
						type="checkbox"
					/>
					<span className="text-pretty">
						{value === true ? field.onLabel : field.offLabel}
					</span>
				</label>
			);

		case "multiselect": {
			const selected = Array.isArray(value) ? value : [];
			// A list this long is searched, not read.
			if (field.common !== undefined)
				return (
					<SearchableMultiselect
						common={field.common}
						describedBy={describedBy}
						field={field}
						id={id}
						onChange={onChange}
						selected={selected}
					/>
				);
			return (
				<fieldset
					aria-describedby={describedBy}
					aria-labelledby={labelId}
					className="grid gap-1 sm:grid-cols-2"
				>
					{Object.entries(field.options).map(([option, optionLabel]) => (
						<label
							className="flex min-h-8 items-center gap-2.5 text-sm"
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
							<span className="text-pretty">{optionLabel}</span>
						</label>
					))}
				</fieldset>
			);
		}

		case "select":
			return (
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
			);

		case "textarea":
			return (
				<textarea
					aria-describedby={describedBy}
					className="min-h-20 w-full max-w-md rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
					id={id}
					maxLength={1000}
					onChange={(event) => onChange(field.name, event.target.value || null)}
					placeholder={field.placeholder}
					rows={3}
					value={typeof value === "string" ? value : ""}
				/>
			);

		case "number":
			// The stored value is metric; this shows and accepts whichever system
			// the user picked, converting on the way in and out.
			return (
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
					placeholder="Not set"
					step={field.step ?? 1}
					type="number"
					value={
						typeof value === "number"
							? toDisplay(value, field.measure, system)
							: ""
					}
				/>
			);

		case "date":
			return (
				<Input
					aria-describedby={describedBy}
					className="max-w-52"
					id={id}
					max={new Date().toISOString().slice(0, 10)}
					min="1900-01-01"
					onChange={(event) => onChange(field.name, event.target.value || null)}
					type="date"
					value={typeof value === "string" ? value : ""}
				/>
			);

		default:
			return (
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
						onChange={(event) =>
							onChange(field.name, event.target.value || null)
						}
						placeholder={field.placeholder}
						type="text"
						value={typeof value === "string" ? value : ""}
					/>
				</div>
			);
	}
}

/**
 * One option and the words it is found by. The combobox filters on the label,
 * so the value it carries has to be the object rather than the slug — the slug
 * is what comes back out at the edges.
 */
type Choice = { value: string; label: string };

/**
 * A long list of answers, searched rather than read. Two groups: the handful
 * most people pick, then everything else — which is the whole reason a hundred
 * medication names are usable at all.
 */
function SearchableMultiselect({
	field,
	selected,
	onChange,
	common,
	id,
	describedBy,
}: {
	field: Extract<Field, { type: "multiselect" }>;
	selected: string[];
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	common: number;
	id: string;
	describedBy?: string;
}) {
	const choices: Choice[] = Object.entries(field.options).map(
		([value, label]) => ({ label, value }),
	);
	const groups = [
		{ items: choices.slice(0, common), label: "Common" },
		{ items: choices.slice(common), label: "Everything else" },
	].filter((group) => group.items.length > 0);

	const chosen = choices.filter((choice) => selected.includes(choice.value));

	return (
		<Combobox
			items={groups}
			itemToStringLabel={(choice: Choice) => choice.label}
			multiple
			onValueChange={(next: Choice[]) =>
				onChange(
					field.name,
					next.map((choice) => choice.value),
				)
			}
			value={chosen}
		>
			<ComboboxInputGroup className="max-w-md">
				<ComboboxChips>
					<ComboboxValue>
						{(picked: Choice[]) => (
							<>
								{picked.map((choice) => (
									<ComboboxChip aria-label={choice.label} key={choice.value}>
										{choice.label}
										<ComboboxChipRemove aria-label={`Remove ${choice.label}`} />
									</ComboboxChip>
								))}
								<ComboboxInput
									aria-describedby={describedBy}
									id={id}
									placeholder={picked.length > 0 ? "" : "Search and pick"}
								/>
								<ComboboxTrigger aria-label="Open the list" />
							</>
						)}
					</ComboboxValue>
				</ComboboxChips>
			</ComboboxInputGroup>

			<ComboboxContent>
				<ComboboxEmpty>Nothing matches that.</ComboboxEmpty>
				<ComboboxList>
					{(group: { label: string; items: Choice[] }) => (
						<ComboboxGroup items={group.items} key={group.label}>
							<ComboboxGroupLabel>{group.label}</ComboboxGroupLabel>
							<ComboboxCollection>
								{(choice: Choice) => (
									<ComboboxItem key={choice.value} value={choice}>
										{choice.label}
									</ComboboxItem>
								)}
							</ComboboxCollection>
						</ComboboxGroup>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
