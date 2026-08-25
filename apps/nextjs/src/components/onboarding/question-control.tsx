"use client";

import type { Field, ProfileInput } from "@mezo/api/profile-fields";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { cn } from "@mezo/ui/lib/utils";
import {
	ArmchairIcon,
	BeefIcon,
	BikeIcon,
	BotIcon,
	CakeIcon,
	CarrotIcon,
	ChartLineIcon,
	CheckIcon,
	CircleDashedIcon,
	CircleEllipsisIcon,
	DumbbellIcon,
	EggIcon,
	FishIcon,
	FlameIcon,
	FootprintsIcon,
	HeartPulseIcon,
	MarsIcon,
	MoonIcon,
	MoonStarIcon,
	MoveRightIcon,
	NonBinaryIcon,
	SaladIcon,
	ScrollIcon,
	SproutIcon,
	TransgenderIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	UtensilsIcon,
	VenusIcon,
	WheatOffIcon,
	ZapIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type {
	Answer,
	SettingsValues,
} from "~/components/settings/settings-form";
import {
	type UsernameAvailability,
	UsernameStatus,
} from "~/components/username-availability";
import {
	defaultFor,
	displayMeasure,
	formatFeetInches,
	fromDisplay,
	toDisplay,
	type UnitSystem,
} from "~/lib/measure";

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
	/**
	 * The screen's `<h1>` is already asking this question, so the control's own
	 * label goes to screen readers only rather than being printed twice.
	 */
	hideLabel?: boolean;
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
	// Chosen lifts the surface as well as drawing the border, so a selection is
	// visible at a glance rather than only on inspection. `foreground` at low
	// alpha rather than a fixed colour: it lightens the card on a dark theme and
	// darkens it on a light one, which is "raised" in both.
	"has-checked:border-foreground/55 has-checked:bg-foreground/[0.16] has-checked:shadow-sm has-checked:ring-1 has-checked:ring-foreground/55",
	// Named explicitly, because hovering a chosen option matches two rules and
	// leaving the winner to stylesheet order is how a state ends up flickering.
	"has-checked:hover:bg-foreground/[0.22]",
);

/**
 * One roomy row per choice, for options that carry an explanation. Selected is
 * a heavier border plus a filled marker rather than a wash of colour, so a
 * multiselect with five answers still reads as a list instead of a block.
 */
const OPTION_ROW = cn(
	OPTION,
	"relative flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-left",
);

/** The same choice, for options short enough to sit side by side. */
const OPTION_CHIP = cn(
	OPTION,
	"relative flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-left",
);

/** A card: icon over label, for the questions that have a symbol per answer. */
const OPTION_CARD = cn(
	OPTION,
	"flex w-36 flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-muted/40 px-4 py-5 text-center",
);

/**
 * The same card once there are too many to sit centred on one line: a tile in a
 * two-up grid, icon above a left-aligned label, so ten answers still scan as a
 * grid rather than a centred paragraph of them.
 */
const OPTION_TILE = cn(
	OPTION,
	"relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-3xl border border-border bg-muted/40 p-4 text-left",
);

/**
 * Questions whose answers have a symbol worth showing. Kept here rather than on
 * the field: `profile-fields` is the shared spec and has no business importing
 * an icon set, and a question with no entry simply renders as plain rows.
 */
const OPTION_ICONS: Record<string, Record<string, typeof MarsIcon>> = {
	gender: {
		female: VenusIcon,
		male: MarsIcon,
		"non-binary": NonBinaryIcon,
		other: TransgenderIcon,
		"prefer-not-to-say": CircleDashedIcon,
	},
	goalDirection: {
		lose: TrendingDownIcon,
		maintain: MoveRightIcon,
		gain: TrendingUpIcon,
	},
	eatingHabits: {
		balanced: UtensilsIcon,
		"high-protein": BeefIcon,
		"low-carb": EggIcon,
		vegetarian: CarrotIcon,
		vegan: SproutIcon,
		pescatarian: FishIcon,
		halal: MoonStarIcon,
		kosher: ScrollIcon,
		"gluten-free": WheatOffIcon,
		other: CircleEllipsisIcon,
	},
	activityLevel: {
		sedentary: ArmchairIcon,
		light: FootprintsIcon,
		moderate: BikeIcon,
		active: FlameIcon,
		"very-active": ZapIcon,
	},
	goals: {
		"improve-health": HeartPulseIcon,
		"lose-weight": TrendingDownIcon,
		"build-muscle": DumbbellIcon,
		"track-metrics": ChartLineIcon,
		"improve-sleep": MoonIcon,
		"eat-better": SaladIcon,
		"try-ai-assistant": BotIcon,
	},
};

/**
 * Which iconned questions read as a grid of cards rather than a list of rows.
 * Cards suit a handful of one-word answers; anything longer needs a line.
 */
const CARD_FIELDS = new Set([
	"gender",
	"goalDirection",
	"eatingHabits",
	"goals",
	"activityLevel",
]);

/**
 * Above this many cards, centred and wrapped stops reading as rows and the grid
 * of tiles takes over. A threshold rather than another set to keep in step — as
 * is the other half of the rule: an answer that carries a line of explanation
 * needs a tile whatever the count, since a centred word-per-card has nowhere to
 * put it.
 */
const TILE_FROM = 6;

/**
 * Options this short read as a row of chips; anything longer needs a line of
 * its own. A threshold rather than a flag on each field, so adding an option
 * cannot leave the layout it implies out of date.
 */
const CHIP_LIMIT = 24;

/**
 * Which controls name themselves with a `<legend>` rather than a `<label>`.
 * Each is several elements with no single one for a `for` to point at.
 */
const GROUPED = new Set<Field["type"]>([
	"select",
	"multiselect",
	"toggle",
	"date",
]);

/**
 * One question on a screen that asks several: its own label, its own help text,
 * and its own control, wired together so the name a screen reader reads is the
 * one on the page.
 *
 * Renders nothing when the field does not apply — asking someone who is
 * maintaining their weight what they want to weigh is noise.
 */
export function QuestionField(props: Props & { hideLabel?: boolean }) {
	const { field, context, hideLabel } = props;
	const id = useId();
	const helpId = `${id}-help`;

	if (field.when && !field.when(context)) return null;

	const help = field.help && (
		<p className="text-pretty text-muted-foreground text-sm" id={helpId}>
			{field.help}
		</p>
	);
	const wiring: Wiring = {
		describedBy: field.help ? helpId : undefined,
		hideLabel,
		id,
	};

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
			{/* Hidden rather than dropped when the screen's `<h1>` already asks the
			    question: the control still needs a name of its own, and one that
			    says "Height (cm)" beats one that says "How tall are you?". */}
			<Label className={cn(hideLabel && "sr-only")} htmlFor={id}>
				{labelWithUnit(field, props.system)}
			</Label>
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

/**
 * `"Lightly active (light exercise 1 to 3 days a week)"` -> a name and the line
 * under it. The parenthetical in an option label is always an explanation, and
 * a row has the space to show it as one rather than as a longer name.
 */
function splitLabel(label: string) {
	const match = /^(.*?)\s*\((.*)\)$/.exec(label);
	if (!match?.[1] || !match[2]) return { detail: undefined, title: label };
	// Sentence case: it reads as its own line now, not as an aside.
	const detail = match[2][0]?.toUpperCase() + match[2].slice(1);
	return { detail, title: match[1] };
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
	hideLabel,
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
	const icons = OPTION_ICONS[field.name];
	const cards = Boolean(icons) && CARD_FIELDS.has(field.name);
	const many = options.length > TILE_FROM;
	// Ten tiles with a line of explanation each is the long list again, so the
	// second line is a luxury of the shorter questions.
	const details =
		!many && options.some(([, label]) => splitLabel(label).detail);
	const tiles = cards && (details || many);
	const chips =
		!cards &&
		!icons &&
		options.every(([, label]) => label.length <= CHIP_LIMIT);
	const selected = multiple
		? Array.isArray(value)
			? value
			: []
		: typeof value === "string"
			? [value]
			: [];

	return (
		<fieldset aria-describedby={describedBy}>
			<legend
				className={cn(
					"mb-2 font-medium text-sm leading-none",
					hideLabel && "sr-only",
				)}
			>
				{field.label}
			</legend>
			{help}
			<div
				className={cn(
					"mt-6 gap-3",
					tiles
						? cn(
								"mx-auto grid gap-2",
								// A tile with a second line needs a column it can breathe
								// in; a one-word tile does not.
								details
									? "max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"
									: "max-w-lg grid-cols-2 sm:grid-cols-3",
							)
						: cards
							? // Capped so five cards break three and two rather than four and
								// one, which is what the width alone would give.
								"mx-auto flex max-w-lg flex-wrap justify-center"
							: chips
								? "flex flex-wrap justify-center gap-2"
								: icons
									? // One column for a list read by its symbols: an icon row
										// is wide, and two of them side by side turn a scan into
										// a search.
										"mx-auto grid max-w-md gap-2 text-left"
									: "grid gap-2 text-left sm:grid-cols-2",
				)}
			>
				{options.map(([option, label]) => {
					const isOn = selected.includes(option);
					const Icon = icons?.[option];
					const { title, detail } = splitLabel(label);
					return (
						<label
							className={
								tiles
									? OPTION_TILE
									: cards
										? OPTION_CARD
										: chips
											? OPTION_CHIP
											: OPTION_ROW
							}
							key={option}
						>
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
							{cards && Icon ? (
								<>
									<Icon
										aria-hidden="true"
										className={tiles ? "size-6" : "size-8"}
										strokeWidth={1.5}
									/>
									{/* A tile has no room for a row's trailing marker, so on a
									    "pick as many as you like" question it sits in the
									    corner: the tick is what says several are on. */}
									{tiles && multiple && (
										<span className="absolute top-3 right-3">
											<Marker multiple on={isOn} />
										</span>
									)}
									<span
										className={cn(
											"text-pretty font-semibold leading-tight",
											tiles ? "w-full text-sm" : "text-sm",
										)}
									>
										{title}
									</span>
									{details && detail && (
										<span className="text-pretty text-muted-foreground text-xs leading-snug">
											{detail}
										</span>
									)}
								</>
							) : (
								<>
									{/* Icon leads, marker trails: the symbol is what the eye
									    runs down the list, and the tick answers "is this one
									    on", which belongs at the end of the row. */}
									{Icon && (
										<Icon
											aria-hidden="true"
											className={cn(
												"size-6 shrink-0 transition-colors",
												// Comes forward with the label rather than staying
												// muted, so a chosen row reads as one thing.
												isOn ? "text-foreground" : "text-muted-foreground",
											)}
											strokeWidth={1.75}
										/>
									)}
									<span className="flex flex-1 flex-col gap-0.5">
										<span
											className={cn(
												"text-pretty text-sm",
												isOn ? "font-semibold" : "font-medium",
											)}
										>
											{title}
										</span>
										{detail && (
											<span className="text-pretty text-muted-foreground text-xs">
												{detail}
											</span>
										)}
									</span>
									<Marker multiple={multiple} on={isOn} />
								</>
							)}
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
	hideLabel,
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
			<legend
				className={cn(
					"mb-2 font-medium text-sm leading-none",
					hideLabel && "sr-only",
				)}
			>
				{field.label}
			</legend>
			{help}
			<div className="mt-2 grid gap-2 text-left">
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
 * kg or lb, cm or ft, above the number they label. The unit preference is not a
 * question of its own: the only moment it matters is the moment a measurement
 * is being read, and whatever is picked here is what gets saved.
 */
function UnitTabs({
	measure,
	system,
	onChange,
}: {
	measure: NonNullable<Extract<Field, { type: "number" }>["measure"]>;
	system: UnitSystem;
	onChange: Props["onChange"];
}) {
	const name = useId();
	const labels =
		measure === "length"
			? { metric: "cm", imperial: "ft" }
			: { metric: "kg", imperial: "lb" };

	return (
		<fieldset className="mx-auto flex w-full max-w-56 rounded-2xl bg-muted p-1">
			<legend className="sr-only">Units</legend>
			{(["metric", "imperial"] as const).map((option) => (
				<label
					className={cn(
						"flex-1 cursor-pointer select-none rounded-xl px-4 py-2 text-center font-semibold text-sm transition-colors",
						"has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
						system === option
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					key={option}
				>
					<input
						checked={system === option}
						className="sr-only"
						name={name}
						onChange={() => onChange("units", option)}
						type="radio"
						value={option}
					/>
					{labels[option]}
				</label>
			))}
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

	// A height is a number people know exactly, and a wheel lands on it exactly
	// where a slider track a few hundred pixels wide has to be nudged into it.
	// The wheel counts in whatever is being shown — centimetres or inches — so
	// every stop on it is a height someone would actually say out loud.
	if (measure === "length") {
		const toShown = (value: number) =>
			Math.round(toDisplay(value, measure, system));
		const options = range(toShown(min), toShown(max));

		return (
			<div className="flex w-full flex-col gap-4">
				<UnitTabs measure={measure} onChange={onChange} system={system} />
				<WheelWindow row={BIG_ROW}>
					<Wheel
						emphasis
						label={field.label}
						onChange={(next) =>
							onChange(field.name, fromDisplay(next, measure, system))
						}
						optionLabel={(next) =>
							system === "imperial"
								? formatFeetInches(fromDisplay(next, measure, system))
								: `${next} cm`
						}
						options={options}
						value={Math.min(
							Math.max(toShown(current), options[0] ?? 0),
							options[options.length - 1] ?? 0,
						)}
					/>
				</WheelWindow>
			</div>
		);
	}
	// A weight is read off a scale to the pound or the half kilo, so it gets the
	// ruler it is used to: the number stays put and the scale runs under it.
	if (measure === "mass") {
		const toShown = (value: number) =>
			Math.round(toDisplay(value, measure, system));
		const options = range(toShown(min), toShown(max));

		return (
			<div className="flex w-full min-w-0 flex-col gap-4">
				<UnitTabs measure={measure} onChange={onChange} system={system} />
				<Readout
					big
					context={context}
					current={current}
					field={field}
					id={id}
					shown={shown}
					system={system}
				/>
				<Ruler
					label={field.label}
					onChange={(next) =>
						onChange(field.name, fromDisplay(next, measure, system))
					}
					options={options}
					value={Math.min(
						Math.max(toShown(current), options[0] ?? 0),
						options[options.length - 1] ?? 0,
					)}
				/>
			</div>
		);
	}

	// Drives the filled part of the WebKit track, which has no `::-moz-range-
	// progress` equivalent and so has to be painted as a gradient.
	const fill = `${((clamped - min) / (max - min)) * 100}%`;

	return (
		<div className="flex w-full flex-col gap-2">
			{measure && (
				<UnitTabs measure={measure} onChange={onChange} system={system} />
			)}
			<Readout
				context={context}
				current={current}
				field={field}
				id={id}
				shown={shown}
				system={system}
			/>

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
 * `YYYY-MM-DD` from a local date. Deliberately not `toISOString`, which is UTC:
 * for anyone east of Greenwich, a date picked at local midnight comes back as
 * the day before.
 */
function isoDate(date: Date) {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** The same trap in reverse: `new Date("1990-05-04")` parses as UTC midnight. */
function fromIsoDate(value: unknown) {
	if (typeof value !== "string") return undefined;
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

const EARLIEST_BIRTH = new Date(1900, 0, 1);

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/** Row height in pixels. Doubles as the touch target, so it clears 44. */
const ROW = 44;

/** Space between two ruler ticks. Wide enough to land a finger between them. */
const TICK = 12;

/** The same row, on a screen whose only question is this one wheel. */
const BIG_ROW = 64;
/** Rows visible at once. Odd, so one of them is the middle. */
const ROWS = 5;

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** February, and the months that are not thirty-one days long. */
const daysInMonth = (year: number, month: number) =>
	new Date(year, month + 1, 0).getDate();

/**
 * Three wheels, one each for month, day and year.
 *
 * A birthday is the one date question where a calendar is the wrong control:
 * the answer is decades back and nobody navigates to it, they know it. Three
 * wheels put every part of it one gesture away.
 *
 * Like the option groups, it has no single element for a `for` to point at, so
 * it names itself with a `<legend>` and is listed in `GROUPED` above.
 */
function DateInput({
	field,
	value,
	onChange,
	hideLabel,
	describedBy,
	help,
}: Props &
	Wiring & {
		field: Extract<Field, { type: "date" }>;
		help?: React.ReactNode;
	}) {
	const today = new Date();
	const selected = fromIsoDate(value);

	// What the wheels sit on before anything is picked. Deliberately not written
	// to the answer: a fabricated birthday would feed a real calorie target, so
	// an untouched picker has to stay unanswered however settled it looks.
	const shown = selected ?? new Date(today.getFullYear() - 30, 0, 1);
	const year = shown.getFullYear();
	const month = shown.getMonth();
	const day = shown.getDate();

	const commit = (nextYear: number, nextMonth: number, nextDay: number) => {
		// 31 January to February has to land somewhere real.
		const clamped = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
		const next = new Date(nextYear, nextMonth, clamped);
		// A date in the future is not a birthday. Ignore rather than correct, so
		// the wheel does not fight a finger mid-scroll.
		if (next > today) return;
		onChange(field.name, isoDate(next));
	};

	return (
		<fieldset aria-describedby={describedBy}>
			<legend
				className={cn(
					"mb-2 font-medium text-sm leading-none",
					hideLabel && "sr-only",
				)}
			>
				{field.label}
			</legend>
			{help}

			{/* `mx-auto`, not `self-center`: the parent is the `<fieldset>`, which is
			    a block, so an alignment property would have nothing to align to. */}
			<div className="mx-auto mt-2 flex w-full max-w-sm flex-col gap-3">
				{/* One pill across all three wheels, marking the row they read from. */}
				<WheelWindow>
					<Wheel
						label="Month"
						onChange={(next) => commit(year, next, day)}
						optionLabel={(index) => MONTHS[index] ?? ""}
						options={range(0, 11)}
						value={month}
					/>
					<Wheel
						label="Day"
						onChange={(next) => commit(year, month, next)}
						optionLabel={(next) => String(next).padStart(2, "0")}
						options={range(1, daysInMonth(year, month))}
						value={day}
					/>
					<Wheel
						label="Year"
						onChange={(next) => commit(next, month, day)}
						optionLabel={String}
						options={range(EARLIEST_BIRTH.getFullYear(), today.getFullYear())}
						value={year}
					/>
				</WheelWindow>

				<Age value={value} />
			</div>
		</fieldset>
	);
}

/**
 * The answer itself, over whatever is used to change it.
 */
function Readout({
	shown,
	field,
	current,
	context,
	system,
	id,
	big = false,
}: {
	shown: { text: string; unit: string };
	field: Extract<Field, { type: "number" }>;
	current: number;
	context: SettingsValues;
	system: UnitSystem;
	id?: string;
	/** The readout is the screen, rather than a caption over a slider. */
	big?: boolean;
}) {
	return (
		<p className="flex items-baseline justify-center gap-1.5">
			{/* Tabular figures: without them the readout changes width as it
			    counts, and drags the unit beside it back and forth. */}
			<output
				className={cn(
					"tabular-nums tracking-[-0.03em]",
					big ? "font-bold text-6xl" : "font-semibold text-3xl",
				)}
				htmlFor={id}
			>
				{shown.text}
			</output>
			{shown.unit && (
				<span
					className={cn(
						"font-medium text-muted-foreground",
						big ? "text-2xl" : "text-base",
					)}
				>
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
	);
}

/**
 * A ruler, read against a fixed mark rather than dragged along a track: the
 * scale moves under the answer, the way a weight is read off a scale. The same
 * bones as `Wheel` turned on its side, snapping for the pointer and arrow keys
 * for the keyboard, both writing through one `onChange`.
 */
function Ruler({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: number[];
	value: number;
	onChange: (value: number) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const index = Math.max(0, options.indexOf(value));
	const drag = useRef<{ x: number; left: number } | null>(null);
	const [dragging, setDragging] = useState(false);

	// Keep the ruler under the mark when the value changes from outside — the
	// unit switching, or the first render. Guarded so it never yanks the scale
	// back while a finger is still on it.
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const target = index * TICK;
		if (Math.abs(element.scrollLeft - target) < TICK / 2) return;
		element.scrollTo({ left: target });
	}, [index]);

	return (
		// `min-w-0`: this sits in a flex column, where a min-width of auto would
		// let the full length of the scale set the width of the screen instead of
		// scrolling inside it.
		<div className="relative w-full min-w-0 overflow-hidden">
			<div
				aria-label={label}
				aria-valuemax={options[options.length - 1]}
				aria-valuemin={options[0]}
				aria-valuenow={value}
				className={cn(
					"touch-pan-x overflow-x-scroll outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden",
					// Snapping is suspended for the length of a drag, or the browser
					// keeps yanking the scale to the nearest tick mid-gesture.
					dragging ? "cursor-grabbing" : "cursor-grab snap-x snap-mandatory",
				)}
				onKeyDown={(event) => {
					const by =
						event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
					if (!by) return;
					event.preventDefault();
					const next =
						options[Math.min(options.length - 1, Math.max(0, index + by))];
					if (next !== undefined) onChange(next);
				}}
				onLostPointerCapture={() => {
					drag.current = null;
					setDragging(false);
				}}
				onPointerDown={(event) => {
					// Touch already drags a scroll container, with momentum and
					// rubber-banding this cannot match. Only a mouse needs the help.
					if (event.pointerType !== "mouse") return;
					event.currentTarget.setPointerCapture(event.pointerId);
					drag.current = {
						left: event.currentTarget.scrollLeft,
						x: event.clientX,
					};
					setDragging(true);
				}}
				onPointerMove={(event) => {
					const from = drag.current;
					if (!from) return;
					event.currentTarget.scrollLeft = from.left - (event.clientX - from.x);
				}}
				onPointerUp={(event) => {
					const from = drag.current;
					drag.current = null;
					setDragging(false);
					if (!from) return;
					// Snapping was off through the drag, so nothing has landed on a
					// tick yet. Turning it back on does not scroll, so put it there.
					const target =
						Math.round(event.currentTarget.scrollLeft / TICK) * TICK;
					event.currentTarget.scrollTo({ behavior: "smooth", left: target });
				}}
				onScroll={(event) => {
					const next =
						options[Math.round(event.currentTarget.scrollLeft / TICK)];
					if (next !== undefined && next !== value) onChange(next);
				}}
				ref={ref}
				role="spinbutton"
				// Half a window either side, so the first and last values can still
				// reach the mark in the middle.
				style={{ paddingInline: `calc(50% - ${TICK / 2}px)` }}
				tabIndex={0}
			>
				<div className="flex items-end">
					{options.map((option) => {
						// Every fifth tick is taller and carries its number, which is
						// what makes a run of lines readable as a scale.
						const major = option % 5 === 0;
						return (
							<div
								className="flex shrink-0 snap-center flex-col items-center gap-2"
								key={option}
								style={{ width: TICK }}
							>
								<span
									className={cn(
										"w-px rounded-full",
										major ? "h-12 bg-foreground/45" : "h-7 bg-border",
									)}
								/>
								<span className="h-4 text-[10px] text-muted-foreground tabular-nums">
									{major ? option : ""}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* The mark the scale is read against. Over the ticks and untouchable,
			    so a drag that starts on it still moves the ruler underneath. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-0 bottom-6 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-primary"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent"
			/>
		</div>
	);
}

/**
 * The pill that marks the row a wheel reads from, and the fades that turn a
 * cropped list into something that looks like it keeps turning.
 */
function WheelWindow({
	children,
	row = ROW,
}: {
	children: React.ReactNode;
	row?: number;
}) {
	return (
		<div className="relative mx-auto w-full max-w-sm">
			{/* Behind the numbers and untouchable, so a drag that starts on it
			    still scrolls the wheel underneath. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-xl border border-foreground/55 bg-muted/60"
				style={{ height: row }}
			/>
			<div className="relative z-10 flex gap-2">{children}</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-background to-transparent"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-background to-transparent"
			/>
		</div>
	);
}

/**
 * One column. A `spinbutton` rather than a listbox: the values are an ordered
 * range and the interaction is up and down, which is exactly what the role
 * describes and a fraction of what a listbox would need to implement.
 *
 * Scroll snapping does the pointer half, arrow keys the keyboard half, and both
 * write through the same `onChange`.
 */
function Wheel({
	label,
	options,
	value,
	optionLabel,
	onChange,
	emphasis = false,
}: {
	label: string;
	options: number[];
	value: number;
	optionLabel: (value: number) => string;
	onChange: (value: number) => void;
	/** A wheel that is the whole answer, rather than one of three. */
	emphasis?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const index = Math.max(0, options.indexOf(value));
	const row = emphasis ? BIG_ROW : ROW;

	// Where a drag started, and how far it has travelled. Refs rather than
	// state: this changes on every pointer event, and none of it should cost a
	// render — only the value crossing a row does, and `onScroll` does that.
	const drag = useRef<{ y: number; top: number } | null>(null);
	/** How far the last gesture travelled, so a drag does not also click a row. */
	const dragged = useRef(0);
	const [dragging, setDragging] = useState(false);

	// Keep the wheel under the pill when the value changes from outside — a
	// month with fewer days clamping the day, or the first render. Guarded so it
	// never yanks the wheel back while a finger is still on it.
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const target = index * row;
		if (Math.abs(element.scrollTop - target) < row / 2) return;
		element.scrollTo({ top: target });
	}, [index, row]);

	const step = (by: number) => {
		const next = options[Math.min(options.length - 1, Math.max(0, index + by))];
		if (next !== undefined) onChange(next);
	};

	return (
		<div
			aria-label={label}
			aria-valuemax={options[options.length - 1]}
			aria-valuemin={options[0]}
			aria-valuenow={value}
			aria-valuetext={optionLabel(value)}
			className={cn(
				"h-(--wheel-height) flex-1 touch-pan-y overflow-y-scroll rounded-xl outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden",
				// Snapping is suspended for the length of a drag. Left on, the
				// browser keeps yanking the wheel to the nearest row while the
				// pointer is still moving it, which feels like a fight.
				dragging ? "cursor-grabbing" : "cursor-grab snap-y snap-mandatory",
			)}
			onKeyDown={(event) => {
				const by =
					event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
				if (!by) return;
				// Otherwise the browser scrolls the column and the page both.
				event.preventDefault();
				step(by);
			}}
			onLostPointerCapture={() => {
				drag.current = null;
				setDragging(false);
			}}
			onPointerDown={(event) => {
				// Touch already drags a scroll container, with momentum and
				// rubber-banding this cannot match. Only a mouse needs the help.
				if (event.pointerType !== "mouse") return;
				event.currentTarget.setPointerCapture(event.pointerId);
				drag.current = { top: event.currentTarget.scrollTop, y: event.clientY };
				dragged.current = 0;
				setDragging(true);
			}}
			onPointerMove={(event) => {
				const from = drag.current;
				if (!from) return;
				const by = event.clientY - from.y;
				dragged.current = Math.max(dragged.current, Math.abs(by));
				// Downward drag reveals earlier values, the way a physical wheel
				// turns under a thumb.
				event.currentTarget.scrollTop = from.top - by;
			}}
			onPointerUp={(event) => {
				const from = drag.current;
				drag.current = null;
				setDragging(false);
				if (!from) return;
				// Snapping was off through the drag, so nothing has landed on a row
				// yet. Turning it back on does not scroll, so put it there.
				const target = Math.round(event.currentTarget.scrollTop / row) * row;
				event.currentTarget.scrollTo({ behavior: "smooth", top: target });
			}}
			onScroll={(event) => {
				const next = options[Math.round(event.currentTarget.scrollTop / row)];
				if (next !== undefined && next !== value) onChange(next);
			}}
			ref={ref}
			role="spinbutton"
			style={
				{
					"--wheel-height": `${row * ROWS}px`,
					// Half the window above and below, so the first and last values
					// can still reach the middle.
					paddingBlock: (row * (ROWS - 1)) / 2,
				} as React.CSSProperties
			}
			tabIndex={0}
		>
			{options.map((option, position) => {
				const distance = Math.abs(position - index);
				return (
					<button
						className={cn(
							"flex w-full snap-center items-center justify-center text-center tabular-nums transition-colors",
							emphasis ? "text-4xl" : "text-lg",
							distance === 0
								? cn("text-foreground", emphasis ? "font-bold" : "font-medium")
								: distance === 1
									? "text-muted-foreground"
									: "text-muted-foreground/45",
						)}
						key={option}
						onClick={() => {
							// A drag that ends over a row still fires a click. Anything
							// past a few pixels was a drag, and the wheel has already
							// picked the value it landed on.
							if (dragged.current > 4) return;
							onChange(option);
						}}
						style={{ height: row }}
						// Each row is reachable by pointer but not by tab: the wheel
						// itself is the one stop, and arrow keys move within it.
						tabIndex={-1}
						type="button"
					>
						{optionLabel(option)}
					</button>
				);
			})}
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
			className="flex items-center justify-center gap-2 text-muted-foreground text-sm"
		>
			<CakeIcon aria-hidden="true" className="size-4" />
			<span className="tabular-nums">
				{age} year{age === 1 ? "" : "s"} of age
			</span>
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
			<div className="relative mx-auto w-full max-w-md">
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
