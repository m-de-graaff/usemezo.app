"use client";

import type { Field, ProfileInput } from "@mezo/api/profile-fields";
import { Input } from "@mezo/ui/input";
import { cn } from "@mezo/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useId } from "react";
import type { Answer } from "~/components/settings/settings-form";
import {
	type UsernameAvailability,
	UsernameStatus,
} from "~/components/username-availability";
import {
	defaultFor,
	displayMeasure,
	type UnitSystem,
	unitLabel,
} from "~/lib/measure";

type Props = {
	field: Field;
	value: Answer;
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	system: UnitSystem;
	availability: UsernameAvailability;
};

/**
 * One question, filling the screen. Settings renders the same fields compactly
 * in `SettingsForm`; this is the first-run version, where a single large target
 * per screen beats a dense form.
 */
export function QuestionControl(props: Props) {
	const { field } = props;

	switch (field.type) {
		case "select":
			return <ChoiceList {...props} field={field} />;
		case "multiselect":
			return <ChoiceList {...props} field={field} multiple />;
		case "toggle":
			return <ToggleChoice {...props} field={field} />;
		case "number":
			return <MeasureInput {...props} field={field} />;
		case "textarea":
			return <LongText {...props} field={field} />;
		case "date":
			return <DateInput {...props} field={field} />;
		default:
			return <ShortText {...props} field={field} />;
	}
}

/**
 * Radio or checkbox semantics under the hood, so keyboard and screen reader
 * behaviour is the platform's. Up to four short options lay out as a row of
 * pills; anything longer stacks, because truncated choices are unreadable.
 */
function ChoiceList({
	field,
	value,
	onChange,
	multiple = false,
}: Props & {
	field: Extract<Field, { type: "select" | "multiselect" }>;
	multiple?: boolean;
}) {
	const name = useId();
	const options = Object.entries(field.options);
	const selected = multiple
		? Array.isArray(value)
			? value
			: []
		: typeof value === "string"
			? [value]
			: [];

	const asRow =
		options.length <= 4 &&
		options.every(([, label]) => label.length <= 24) &&
		!multiple;

	return (
		<fieldset
			className={cn(
				"w-full",
				asRow ? "flex gap-2 rounded-2xl bg-muted p-1" : "grid gap-2.5",
				// Past four, a single column is a lot of scrolling on a wide screen.
				!asRow && options.length > 4 && "sm:grid-cols-2",
			)}
		>
			<legend className="sr-only">{field.question ?? field.label}</legend>
			{options.map(([option, label]) => {
				const isOn = selected.includes(option);
				return (
					<label
						className={cn(
							"group relative flex cursor-pointer items-center gap-3 transition-colors",
							"has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
							asRow
								? "flex-1 justify-center rounded-xl px-4 py-2.5 text-center font-medium text-muted-foreground text-sm has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border"
								: "min-h-14 rounded-2xl border border-border px-4 py-3.5 text-left has-checked:border-primary has-checked:bg-primary/5",
						)}
						key={option}
					>
						<input
							// The visible text sits beside a visually hidden input, and
							// not every tool picks that up as the name. Naming it
							// explicitly with the same words removes the doubt.
							aria-label={label}
							checked={isOn}
							className="sr-only"
							name={multiple ? `${name}-${option}` : name}
							onChange={(event) => {
								if (!multiple) {
									onChange(field.name, option);
									return;
								}
								onChange(
									field.name,
									event.target.checked
										? [...selected, option]
										: selected.filter((item) => item !== option),
								);
							}}
							type={multiple ? "checkbox" : "radio"}
							value={option}
						/>
						<span className="flex-1 text-pretty">{label}</span>
						{!asRow && (
							<span
								aria-hidden="true"
								className={cn(
									"flex size-5 shrink-0 items-center justify-center border transition-colors",
									// A square reads as "pick several", a circle as "pick one".
									multiple ? "rounded-md" : "rounded-full",
									isOn
										? "border-primary bg-primary text-primary-foreground"
										: "border-border",
								)}
							>
								{isOn && <CheckIcon className="size-3.5" />}
							</span>
						)}
					</label>
				);
			})}
		</fieldset>
	);
}

/** The visibility question, as two choices rather than a checkbox. */
function ToggleChoice({
	field,
	value,
	onChange,
}: Props & { field: Extract<Field, { type: "toggle" }> }) {
	const name = useId();
	const options = [
		{ on: true, label: field.onLabel },
		{ on: false, label: field.offLabel },
	];

	return (
		<fieldset className="flex w-full flex-col gap-2.5">
			<legend className="sr-only">{field.question ?? field.label}</legend>
			{options.map((option) => {
				const isOn = value === option.on;
				return (
					<label
						className={cn(
							"flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3.5",
							"transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
							"has-checked:border-primary has-checked:bg-primary/5",
						)}
						key={String(option.on)}
					>
						<input
							aria-label={option.label}
							checked={isOn}
							className="sr-only"
							name={name}
							onChange={() => onChange(field.name, option.on)}
							type="radio"
							value={String(option.on)}
						/>
						<span className="flex-1 text-pretty">{option.label}</span>
						<span
							aria-hidden="true"
							className={cn(
								"flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
								isOn
									? "border-primary bg-primary text-primary-foreground"
									: "border-border",
							)}
						>
							{isOn && <CheckIcon className="size-3.5" />}
						</span>
					</label>
				);
			})}
		</fieldset>
	);
}

/**
 * A big readout over a slider, with a unit switch when the quantity converts.
 *
 * ponytail: the slider covers the ordinary range, not the full validated one,
 * so an outlier has to be typed in Settings. Give the readout an input here if
 * that turns out to matter.
 */
function MeasureInput({
	field,
	value,
	onChange,
	system,
}: Props & { field: Extract<Field, { type: "number" }> }) {
	const id = useId();
	const measure = field.measure;
	const current = typeof value === "number" ? value : defaultFor(measure);
	const shown = measure
		? displayMeasure(current, measure, system)
		: { text: String(current), unit: field.unit ?? "" };

	const min = field.sliderMin ?? field.min;
	const max = field.sliderMax ?? field.max;

	return (
		<div className="flex w-full flex-col items-center gap-8">
			{measure && (
				<UnitSwitch
					measure={measure}
					onChange={(next) => onChange("units", next)}
					system={system}
				/>
			)}

			<p className="flex items-baseline justify-center gap-2">
				<output
					className="font-semibold text-6xl tabular-nums tracking-tight sm:text-7xl md:text-8xl"
					htmlFor={id}
				>
					{shown.text}
				</output>
				{shown.unit && (
					<span className="font-medium text-2xl text-muted-foreground">
						{shown.unit}
					</span>
				)}
			</p>

			<div className="w-full">
				<input
					aria-label={`${field.label}${unitLabel(measure, system) ? ` in ${unitLabel(measure, system)}` : ""}`}
					aria-valuetext={`${shown.text} ${shown.unit}`.trim()}
					className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
					id={id}
					max={max}
					min={min}
					onChange={(event) => onChange(field.name, event.target.valueAsNumber)}
					step={field.step ?? 1}
					type="range"
					value={Math.min(Math.max(current, min), max)}
				/>
				<div
					aria-hidden="true"
					className="mt-2 flex justify-between text-muted-foreground text-xs tabular-nums"
				>
					{[min, (min + max) / 2, max].map((tick) => (
						<span key={tick}>
							{measure ? displayMeasure(tick, measure, system).text : tick}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

/** The lbs/kg switch from the reference, writing straight to the preference. */
function UnitSwitch({
	measure,
	system,
	onChange,
}: {
	measure: "length" | "mass";
	system: UnitSystem;
	onChange: (system: UnitSystem) => void;
}) {
	const name = useId();
	const options: { system: UnitSystem; label: string }[] = [
		{ system: "imperial", label: measure === "mass" ? "lb" : "ft, in" },
		{ system: "metric", label: measure === "mass" ? "kg" : "cm" },
	];

	return (
		<fieldset className="flex gap-1 rounded-2xl bg-muted p-1">
			<legend className="sr-only">Units</legend>
			{options.map((option) => (
				<label
					className={cn(
						"min-w-24 cursor-pointer rounded-xl px-5 py-2 text-center font-medium text-muted-foreground text-sm transition-colors",
						"has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
						"has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border",
					)}
					key={option.system}
				>
					<input
						aria-label={option.label}
						checked={system === option.system}
						className="sr-only"
						name={name}
						onChange={() => onChange(option.system)}
						type="radio"
						value={option.system}
					/>
					{option.label}
				</label>
			))}
		</fieldset>
	);
}

function LongText({
	field,
	value,
	onChange,
}: Props & { field: Extract<Field, { type: "textarea" }> }) {
	return (
		<textarea
			className="min-h-32 w-full rounded-2xl border border-input bg-transparent px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
			maxLength={1000}
			onChange={(event) => onChange(field.name, event.target.value || null)}
			placeholder={field.placeholder}
			rows={4}
			value={typeof value === "string" ? value : ""}
		/>
	);
}

function DateInput({
	field,
	value,
	onChange,
}: Props & { field: Extract<Field, { type: "date" }> }) {
	return (
		<Input
			className="h-14 rounded-2xl text-center text-lg"
			max={new Date().toISOString().slice(0, 10)}
			min="1900-01-01"
			onChange={(event) => onChange(field.name, event.target.value || null)}
			type="date"
			value={typeof value === "string" ? value : ""}
		/>
	);
}

function ShortText({
	field,
	value,
	onChange,
	availability,
}: Props & { field: Extract<Field, { type: "text" }> }) {
	const isUsername = field.name === "username";

	return (
		<div className="flex w-full flex-col gap-2">
			<div className="flex items-center gap-2">
				{field.prefix && (
					<span className="shrink-0 text-lg text-muted-foreground">
						{field.prefix}
					</span>
				)}
				<Input
					autoCapitalize={isUsername ? "none" : undefined}
					autoComplete={isUsername ? "off" : "name"}
					className="h-14 rounded-2xl text-lg"
					maxLength={100}
					onBlur={isUsername ? availability.check : undefined}
					onChange={(event) => {
						if (isUsername) availability.reset();
						onChange(field.name, event.target.value || null);
					}}
					placeholder={field.placeholder}
					required
					type="text"
					value={typeof value === "string" ? value : ""}
				/>
			</div>
			{isUsername && (
				<UsernameStatus availability={availability} className="text-sm" />
			)}
		</div>
	);
}
