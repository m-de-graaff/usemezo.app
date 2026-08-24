"use client";

import type { Field, ProfileInput } from "@mezo/api/profile-fields";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { cn } from "@mezo/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useId } from "react";
import type {
	Answer,
	SettingsValues,
} from "~/components/settings/settings-form";
import {
	type UsernameAvailability,
	UsernameStatus,
} from "~/components/username-availability";
import { defaultFor, displayMeasure, type UnitSystem } from "~/lib/measure";

type Props = {
	field: Field;
	value: Answer;
	onChange: (name: keyof ProfileInput, value: Answer) => void;
	system: UnitSystem;
	availability: UsernameAvailability;
	/** Every answer so far, for the questions whose text depends on another. */
	context: SettingsValues;
};

type Wiring = {
	/** The control's `id`, so a sibling `<label for>` names it. */
	id?: string;
	describedBy?: string;
};

/**
 * Shared by every option a finger or a cursor lands on. Press feedback is
 * `motion-safe` only, since a shrinking row is movement rather than the colour
 * change that carries the meaning.
 */
const OPTION = cn(
	"cursor-pointer select-none transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
	"has-focus-visible:ring-3 has-focus-visible:ring-ring/50 motion-safe:active:scale-[0.98]",
	"hover:border-foreground/25 hover:bg-muted/40",
	"has-checked:border-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-foreground",
);

/**
 * One roomy row per choice, for options that carry an explanation. Selected is
 * a heavier border plus a filled marker rather than a wash of colour, so a
 * multiselect with five answers still reads as a list instead of a block.
 */
const OPTION_ROW = cn(
	OPTION,
	"relative flex min-h-14 items-center gap-3.5 rounded-xl border border-border bg-background px-3.5 py-3 text-left",
);

/** The same choice, for options short enough to sit side by side. */
const OPTION_CHIP = cn(
	OPTION,
	"relative flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-left",
);

/**
 * Options this short read as a row of chips; anything longer needs a line of
 * its own. A threshold rather than a flag on each field, so adding an option
 * cannot leave the layout it implies out of date.
 */
const CHIP_LIMIT = 24;

/** Which controls name themselves with a `<legend>` rather than a `<label>`. */
const GROUPED = new Set<Field["type"]>(["select", "multiselect", "toggle"]);

/**
 * One question on a screen that asks several: its own label, its own help text,
 * and its own control, wired together so the name a screen reader reads is the
 * one on the page.
 *
 * Renders nothing when the field does not apply — asking someone who is
 * maintaining their weight what they want to weigh is noise.
 */
export function QuestionField(props: Props) {
	const { field, context } = props;
	const id = useId();
	const helpId = `${id}-help`;

	if (field.when && !field.when(context)) return null;

	const help = field.help && (
		<p className="text-pretty text-muted-foreground text-xs" id={helpId}>
			{field.help}
		</p>
	);
	const wiring: Wiring = { describedBy: field.help ? helpId : undefined, id };

	// A group of radios or checkboxes has no single control to point a `for` at,
	// so it carries the label inside itself as a `<legend>` instead.
	if (GROUPED.has(field.type))
		return (
			<div className="grid gap-2">
				<QuestionControl {...props} {...wiring} help={help} />
			</div>
		);

	return (
		<div className="grid gap-2">
			<Label htmlFor={id}>{labelWithUnit(field, props.system)}</Label>
			{help}
			<QuestionControl {...props} {...wiring} />
		</div>
	);
}

/**
 * A measured quantity is labelled in whichever system the user picked. Feet and
 * inches is not a plain quantity, so it is left off the label there and carried
 * by the slider's `aria-valuetext` instead.
 */
function labelWithUnit(field: Field, system: UnitSystem) {
	if (field.type !== "number") return field.label;
	const unit = field.measure
		? displayMeasure(0, field.measure, system).unit
		: field.unit;
	return unit ? `${field.label} (${unit})` : field.label;
}

/** The control alone. `QuestionField` is what wires a name to it. */
export function QuestionControl(
	props: Props & Wiring & { help?: React.ReactNode },
) {
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

/** The tick or square beside a chosen option. Colour is never the only signal. */
function Marker({ on, multiple }: { on: boolean; multiple: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-5 shrink-0 items-center justify-center border transition-colors",
				// A square reads as "pick several", a circle as "pick one".
				multiple ? "rounded-md" : "rounded-full",
				on
					? "border-foreground bg-foreground text-background"
					: "border-border",
			)}
		>
			{on && <CheckIcon className="size-3" strokeWidth={3} />}
		</span>
	);
}

/**
 * Radio or checkbox semantics under the hood, so keyboard and screen reader
 * behaviour is the platform's rather than a reimplementation of it.
 */
function ChoiceList({
	field,
	value,
	onChange,
	describedBy,
	help,
	multiple = false,
}: Props &
	Wiring & {
		field: Extract<Field, { type: "select" | "multiselect" }>;
		help?: React.ReactNode;
		multiple?: boolean;
	}) {
	const name = useId();
	const options = Object.entries(field.options);
	const chips = options.every(([, label]) => label.length <= CHIP_LIMIT);
	const selected = multiple
		? Array.isArray(value)
			? value
			: []
		: typeof value === "string"
			? [value]
			: [];

	return (
		<fieldset aria-describedby={describedBy}>
			<legend className="mb-2 font-medium text-sm leading-none">
				{field.label}
			</legend>
			{help}
			<div
				className={cn(
					"mt-2 gap-2",
					chips ? "flex flex-wrap" : "grid sm:grid-cols-2",
				)}
			>
				{options.map(([option, label]) => {
					const isOn = selected.includes(option);
					return (
						<label className={chips ? OPTION_CHIP : OPTION_ROW} key={option}>
							<input
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
							<Marker multiple={multiple} on={isOn} />
							<span className="flex-1 text-pretty font-medium text-sm">
								{label}
							</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

/** The visibility question, as two choices rather than a bare checkbox. */
function ToggleChoice({
	field,
	value,
	onChange,
	describedBy,
	help,
}: Props &
	Wiring & {
		field: Extract<Field, { type: "toggle" }>;
		help?: React.ReactNode;
	}) {
	const name = useId();
	const options = [
		{ on: true, label: field.onLabel },
		{ on: false, label: field.offLabel },
	];

	return (
		<fieldset aria-describedby={describedBy}>
			<legend className="mb-2 font-medium text-sm leading-none">
				{field.label}
			</legend>
			{help}
			<div className="mt-2 grid gap-2">
				{options.map((option) => {
					const isOn = value === option.on;
					return (
						<label className={OPTION_ROW} key={String(option.on)}>
							<input
								checked={isOn}
								className="sr-only"
								name={name}
								onChange={() => onChange(field.name, option.on)}
								type="radio"
								value={String(option.on)}
							/>
							<Marker multiple={false} on={isOn} />
							<span className="flex-1 text-pretty font-medium text-sm">
								{option.label}
							</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

/**
 * A readout over a slider. The number is the answer, so it is the thing that is
 * big; the slider under it is how the number is changed.
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
	context,
	id,
	describedBy,
}: Props & Wiring & { field: Extract<Field, { type: "number" }> }) {
	const measure = field.measure;
	const current = typeof value === "number" ? value : defaultFor(measure);
	const shown = measure
		? displayMeasure(current, measure, system)
		: { text: String(current), unit: field.unit ?? "" };

	const min = field.sliderMin ?? field.min;
	const max = field.sliderMax ?? field.max;
	const clamped = Math.min(Math.max(current, min), max);
	// Drives the filled part of the WebKit track, which has no `::-moz-range-
	// progress` equivalent and so has to be painted as a gradient.
	const fill = `${((clamped - min) / (max - min)) * 100}%`;

	return (
		<div className="flex w-full flex-col gap-2">
			<p className="flex items-baseline gap-1.5">
				{/* Tabular figures: without them the readout changes width as it
				    counts, and drags the unit beside it back and forth. */}
				<output
					className="font-semibold text-3xl tabular-nums tracking-[-0.03em]"
					htmlFor={id}
				>
					{shown.text}
				</output>
				{shown.unit && (
					<span className="font-medium text-base text-muted-foreground">
						{shown.unit}
					</span>
				)}
				<Remaining
					context={context}
					current={current}
					field={field}
					system={system}
				/>
			</p>

			<div className="w-full">
				<input
					aria-describedby={describedBy}
					aria-valuetext={`${shown.text} ${shown.unit}`.trim()}
					className={cn(
						// The padding is the touch target: the bar itself is 8px, which
						// is under half of what a thumb needs to be grabbable.
						"w-full cursor-pointer appearance-none bg-transparent py-2.5 outline-none",
						"[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full",
						"[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--fill),var(--color-muted)_var(--fill))]",
						"[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted",
						"[&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary",
						// 24px, the WCAG target minimum, pulled up by half its overhang
						// so it sits centred on the 8px track.
						"[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
						"[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm",
						"[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary",
						"focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50",
						"focus-visible:[&::-moz-range-thumb]:ring-3 focus-visible:[&::-moz-range-thumb]:ring-ring/50",
					)}
					id={id}
					max={max}
					min={min}
					onChange={(event) => onChange(field.name, event.target.valueAsNumber)}
					step={field.step ?? 1}
					style={{ "--fill": fill } as React.CSSProperties}
					type="range"
					value={clamped}
				/>
				<div
					aria-hidden="true"
					className="flex justify-between text-muted-foreground text-xs tabular-nums"
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

/**
 * How far the target weight is from today's, beside the target. The distance is
 * the thing anyone actually wants from this question, and making them subtract
 * two numbers to get it is the sort of small tax that adds up to a bad form.
 */
function Remaining({
	field,
	current,
	context,
	system,
}: {
	field: Extract<Field, { type: "number" }>;
	current: number;
	context: SettingsValues;
	system: UnitSystem;
}) {
	if (field.name !== "targetWeightKg") return null;
	// The same fallback the weight slider itself draws, and the same one that
	// gets saved if it is never touched — reading `context.weightKg` raw would
	// leave this blank on every first run, since an untouched slider shows a
	// number it has not stored.
	const from =
		typeof context.weightKg === "number"
			? context.weightKg
			: defaultFor("mass");

	const gap = Math.abs(from - current);
	if (gap < 0.5) return null;

	const shown = displayMeasure(gap, "mass", system);
	return (
		<span className="text-muted-foreground text-sm tabular-nums">
			{shown.text} {shown.unit} {from > current ? "to lose" : "to gain"}
		</span>
	);
}

function LongText({
	field,
	value,
	onChange,
	id,
	describedBy,
}: Props & Wiring & { field: Extract<Field, { type: "textarea" }> }) {
	return (
		<textarea
			aria-describedby={describedBy}
			className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
			id={id}
			maxLength={1000}
			onChange={(event) => onChange(field.name, event.target.value || null)}
			placeholder={field.placeholder}
			rows={4}
			value={typeof value === "string" ? value : ""}
		/>
	);
}

/**
 * The browser's own date field, the same one Settings uses. A calendar grid
 * looks friendlier and is worse for this question specifically: a date of birth
 * is decades back, and typing eight digits beats navigating there.
 */
function DateInput({
	field,
	value,
	onChange,
	id,
	describedBy,
}: Props & Wiring & { field: Extract<Field, { type: "date" }> }) {
	return (
		<div className="flex flex-col gap-1.5">
			<Input
				aria-describedby={describedBy}
				className="h-11 max-w-52 text-base md:text-base"
				id={id}
				max={new Date().toISOString().slice(0, 10)}
				min="1900-01-01"
				onChange={(event) => onChange(field.name, event.target.value || null)}
				type="date"
				value={typeof value === "string" ? value : ""}
			/>
			<Age value={value} />
		</div>
	);
}

/**
 * The age the date works out to, echoed back. It is what the answer is actually
 * for, and seeing it appear is how a typo in the year gets caught here rather
 * than in a calorie target four screens later.
 */
function Age({ value }: { value: Answer }) {
	if (typeof value !== "string" || value === "") return null;

	// Deliberately not `new Date(value)`, which parses `YYYY-MM-DD` as UTC
	// midnight — west of Greenwich that is the day before.
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return null;

	const today = new Date();
	const beforeBirthday =
		today.getMonth() + 1 < month ||
		(today.getMonth() + 1 === month && today.getDate() < day);
	const age = today.getFullYear() - year - (beforeBirthday ? 1 : 0);
	if (age < 0 || age > 120) return null;

	return (
		<p
			aria-live="polite"
			className="text-muted-foreground text-xs tabular-nums"
		>
			{age} years old
		</p>
	);
}

function ShortText({
	field,
	value,
	onChange,
	availability,
	id,
	describedBy,
}: Props & Wiring & { field: Extract<Field, { type: "text" }> }) {
	const isUsername = field.name === "username";
	const statusId = `${id}-status`;

	return (
		<div className="flex w-full flex-col gap-1.5">
			<div className="relative max-w-md">
				{field.prefix && (
					// Inside the field rather than beside it: an `@` floating outside
					// the border reads as a separate thing from what is being typed.
					<span
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted-foreground"
					>
						{field.prefix}
					</span>
				)}
				<Input
					aria-describedby={
						[describedBy, isUsername && statusId].filter(Boolean).join(" ") ||
						undefined
					}
					autoCapitalize={isUsername ? "none" : undefined}
					autoComplete={isUsername ? "off" : "name"}
					className={cn(
						"h-11 w-full rounded-lg text-base md:text-base",
						field.prefix && "pl-7",
					)}
					id={id}
					maxLength={100}
					onBlur={isUsername ? availability.check : undefined}
					onChange={(event) => {
						if (isUsername) availability.reset();
						onChange(field.name, event.target.value || null);
					}}
					placeholder={field.placeholder}
					spellCheck={!isUsername}
					type="text"
					value={typeof value === "string" ? value : ""}
				/>
			</div>
			{isUsername && (
				<UsernameStatus
					availability={availability}
					className="text-xs"
					id={statusId}
				/>
			)}
		</div>
	);
}
