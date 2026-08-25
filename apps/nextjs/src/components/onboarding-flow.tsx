"use client";

import {
	type Field,
	ONBOARDING_QUESTIONS,
	ONBOARDING_REQUIRED,
	ONBOARDING_STEPS,
	type OnboardingStep,
	type ProfileInput,
} from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import { cn } from "@mezo/ui/lib/utils";
import { toast } from "@mezo/ui/sonner";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	FlameIcon,
	SaladIcon,
	ScaleIcon,
	SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Backdrop } from "~/components/backdrop";
import { LogoMark } from "~/components/logo";
import { PlanSummary } from "~/components/onboarding/plan-summary";
import { QuestionField } from "~/components/onboarding/question-control";
import type {
	Answer,
	SettingsValues,
} from "~/components/settings/settings-form";
import { useUsernameAvailability } from "~/components/username-availability";
import { defaultFor, unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/** The small tracked capitals used for every label that is not a heading. */
const MICRO =
	"font-medium text-[0.6875rem] uppercase leading-none tracking-[0.16em]";

/**
 * The bar every screen's primary action sits in. Sticky at the foot of the
 * scrolling column, with negative margins cancelling that column's padding so
 * the top rule spans it fully.
 *
 * `plan-summary.tsx` repeats this string rather than importing it: the import
 * runs the other way, and one shared className is not worth a module to hold
 * it. Change one, change both.
 */
const ACTION_BAR =
	"sticky bottom-0 z-10 -mx-5 border-border/60 border-t bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12";

/**
 * The body of a screen, between the progress bar and the action bar. Takes the
 * space those two leave and centres itself in it, so a one-line question sits
 * in the middle of the column rather than clinging to the top of a mostly empty
 * one.
 *
 * `flex-1` rather than an auto margin: a flex item keeps `min-height: auto`, so
 * a screen taller than the column still grows and scrolls instead of having its
 * top centred out of reach.
 */
const SCREEN_BODY =
	"flex flex-1 flex-col items-center justify-center py-8 text-center";

/** Before the first question. */
const WELCOME = -1;

/**
 * Question types where the answer is typed, so the field takes focus and the
 * keyboard is up before the user reaches for it. Every other type sends focus
 * to the heading instead, so the new screen gets announced.
 */
const TYPED = new Set<Field["type"]>(["text", "textarea"]);

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Whether an answer counts as given. A slider always reads something even
 * untouched, which is why a number is answered by definition; a select is not.
 */
const isAnswered = (answer: Answer) => {
	if (Array.isArray(answer)) return answer.length > 0;
	if (typeof answer === "string") return answer.trim() !== "";
	return answer !== null && answer !== undefined;
};

/** A slider that was never touched still saves the value it was showing. */
function submitted(field: Field, answer: Answer): Answer {
	if (answer !== null && answer !== undefined) return answer;
	if (field.type === "number") return defaultFor(field.measure);
	if (field.type === "toggle") return false;
	return null;
}

export function OnboardingFlow({
	values: initial,
}: {
	values: SettingsValues;
}) {
	const router = useRouter();
	const [values, setValues] = useState(initial);
	// Where the last move went, so a screen comes in from the side it came from
	// rather than always from the same one.
	const [forwards, setForwards] = useState(true);

	// Answers are saved per screen, so a run that was abandoned halfway comes
	// back to where it stopped instead of to question one.
	const [index, setIndex] = useState(() => {
		const answered = ({ field }: { field: Field }) =>
			isAnswered(initial[field.name] ?? null);
		if (!ONBOARDING_QUESTIONS.some(answered)) return WELCOME;
		const next = ONBOARDING_QUESTIONS.findIndex(
			(candidate) => !answered(candidate),
		);
		return next === -1 ? ONBOARDING_QUESTIONS.length : next;
	});

	const availability = useUsernameAvailability(values.username);
	const system = unitSystem(values.units);

	// A question whose `when` is false is not a screen the user steps through
	// and skips: it is not asked at all, so it leaves the list entirely. Only
	// answers from earlier screens can change this, so the indices behind the
	// current one never move under it.
	const questions = ONBOARDING_QUESTIONS.filter(
		({ field }) => !field.when || field.when(values),
	);
	const plan = questions.length;

	const question = questions[index];
	const field = question?.field;
	const step = question && ONBOARDING_STEPS[question.step];

	// Decided out here rather than inside the effect, so the effect depends on a
	// boolean instead of on `questions` — which is rebuilt every render, and
	// would have the effect stealing focus back on every keystroke.
	const typed = field ? TYPED.has(field.type) : false;

	/**
	 * Moves focus onto each screen as it mounts. A callback ref rather than an
	 * effect: the screen below is keyed by `index`, so it remounts on every
	 * change and this fires exactly then, with no dependency list to keep honest.
	 *
	 * Nothing else moves focus between screens, so a screen reader would
	 * otherwise sit on the button that was just pressed and never read out the
	 * screen that replaced it. The target is found in the DOM rather than held in
	 * a ref, because every branch renders one `<h1 tabIndex={-1}>` and querying
	 * for it means the welcome and plan screens need no wiring of their own.
	 */
	const focusScreen = useCallback(
		(node: HTMLDivElement | null) => {
			if (!node) return;
			if (typed) {
				node
					.querySelector<HTMLElement>(
						"input:not([type=radio]):not([type=checkbox]):not([type=range]), textarea",
					)
					?.focus();
				return;
			}
			node.querySelector<HTMLElement>("h1")?.focus();
		},
		[typed],
	);

	const save = api.profile.update.useMutation({
		onSuccess: () => advance(),
		onError: (error) => {
			// A validation failure arrives as a JSON-encoded issue array in
			// `message`; the flattened field errors are the readable half.
			const first = Object.values(error.data?.zodError?.fieldErrors ?? {})
				.flat()
				.find((message): message is string => typeof message === "string");
			toast.error(first ?? error.message);
		},
	});

	const finish = api.profile.completeOnboarding.useMutation({
		onSuccess: () => {
			router.replace("/dashboard");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const pending = save.isPending || finish.isPending;

	function advance() {
		setForwards(true);
		setIndex((current) => current + 1);
	}

	function goBack() {
		setForwards(false);
		setIndex((current) => current - 1);
	}

	function setAnswer(name: keyof ProfileInput, value: Answer) {
		if (name === "username") availability.reset();
		setValues((previous) => ({ ...previous, [name]: value }));
	}

	const answered = field ? isAnswered(values[field.name] ?? null) : true;
	const required = field ? ONBOARDING_REQUIRED.has(field.name) : false;

	const blocked =
		(required && !answered) ||
		(field?.name === "username" && availability.taken);

	// Nothing here that has to be answered, and nothing answered yet, so there
	// is a Skip worth offering.
	const skippable = !required && !answered;

	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!field) return;
		// One field, so one key: everything the flow never asked about on this
		// screen has to survive untouched, which is what `update` taking a
		// partial is for.
		save.mutate({
			[field.name]: submitted(field, values[field.name] ?? null),
		} as ProfileInput);
	};

	return (
		// Full bleed: the whole viewport, no mat and no inset slab. First run owns
		// the screen, so the only frame is the edge of it.
		//
		// `h-svh` with `overflow-hidden` rather than `min-h-svh`, because the two
		// columns scroll independently below — the panel stays put while the
		// questions move, which is what stops a long list dragging the brand off
		// the top of the page.
		<div className="grid h-svh overflow-hidden bg-background lg:grid-cols-[minmax(20rem,26%)_minmax(0,1fr)]">
			<BrandPanel atPlan={index >= plan} step={step} />

			<div className="flex min-h-0 flex-col overflow-y-auto">
				{/* One padded column, capped and centred: full width is right for
				    the chrome, and wrong for a line of text — on a wide monitor an
				    uncapped question column strands the answer far from the label. */}
				<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
					<div className="flex items-center justify-between gap-4 lg:hidden">
						<p
							className={cn(
								MICRO,
								"flex items-center gap-2 text-muted-foreground",
							)}
						>
							mezo
							<span
								aria-hidden="true"
								className="size-1 rounded-full bg-muted-foreground/50"
							/>
							Set up your profile
						</p>
						{question && (
							<p className={cn(MICRO, "text-muted-foreground tabular-nums")}>
								{pad(index + 1)} <span aria-hidden="true">/</span> {pad(plan)}
							</p>
						)}
					</div>

					{question && (
						<div className="mt-6 lg:mt-0">
							<StepBar current={question.step} />
						</div>
					)}

					{/* Keyed so the screen remounts: entrance motion replays and the
					    controls re-seed, while the panel and stepper stay put and
					    transition between states. */}
					<div
						className={cn(
							"fade-in flex flex-1 animate-in flex-col duration-300 ease-out-quint motion-reduce:animate-none",
							forwards ? "slide-in-from-end-4" : "slide-in-from-start-4",
						)}
						key={index}
						ref={focusScreen}
					>
						{index === WELCOME && <Welcome onStart={advance} />}

						{field && (
							<form className="flex flex-1 flex-col" onSubmit={onSubmit}>
								<div className={SCREEN_BODY}>
									<p className={cn(MICRO, "text-muted-foreground")}>
										{pad(index + 1)} <span aria-hidden="true">/</span>{" "}
										{step?.title}
									</p>
									{/* The question is the heading. `QuestionField` still
									    renders its label, hidden, so the control keeps a name
									    of its own rather than borrowing this one. */}
									<h1
										className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
										tabIndex={-1}
									>
										{field.question ?? field.label}
									</h1>

									<div className="mt-8 w-full max-w-xl">
										<QuestionField
											availability={availability}
											context={values}
											field={field}
											hideLabel
											onChange={setAnswer}
											system={system}
											value={values[field.name] ?? null}
										/>
									</div>
								</div>

								{/* Pinned at every width now that the column scrolls inside
								    itself: a long list of options must never be able to push
								    Continue out of reach. The negative margins cancel the
								    column's padding so the rule runs edge to edge. */}
								<div className={cn(ACTION_BAR, "flex items-center gap-3")}>
									<Button
										className="h-11 rounded-full px-4"
										disabled={pending}
										onClick={goBack}
										type="button"
										variant="ghost"
									>
										<ArrowLeftIcon />
										Back
									</Button>
									{skippable && (
										<Button
											className="h-11 rounded-full px-4"
											disabled={pending}
											onClick={advance}
											type="button"
											variant="ghost"
										>
											Skip for now
										</Button>
									)}
									<Button
										className="ml-auto h-11 flex-1 rounded-full px-6 sm:flex-none"
										disabled={pending || blocked}
										type="submit"
									>
										{pending ? "Saving…" : "Continue"}
										<ArrowRightIcon />
									</Button>
								</div>
							</form>
						)}

						{index >= plan && (
							<PlanSummary
								// One round trip: the target the user just approved and the
								// flag that stops the app redirecting back here.
								onFinish={(dailyCalories) => finish.mutate({ dailyCalories })}
								pending={pending}
								system={system}
								values={values}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The screen before the questions. It exists to answer the two things anyone
 * opening a setup flow wants to know — how long this takes, and what they get
 * for it — before they have committed to a single answer.
 */
function Welcome({ onStart }: { onStart: () => void }) {
	// The first three are what the plan screen puts on the page at the end of
	// this flow, in the order it puts them. The fourth is not built yet and says
	// so: it is the reason the flow asks how you eat, and leaving it unsaid
	// makes that question look like idle curiosity.
	const gets = [
		{
			icon: FlameIcon,
			title: "A daily calorie target",
			body: "From your height, weight, date of birth, gender and how active you are.",
		},
		{
			icon: SparklesIcon,
			title: "Protein, carbs and fat",
			body: "How to split those calories across the day.",
		},
		{
			icon: ScaleIcon,
			title: "A realistic timeline",
			body: "What to expect each week, and when you would reach your goal.",
		},
		{
			icon: SaladIcon,
			title: "Meal plans that fit how you eat",
			body: "High protein, low carb, vegetarian, and so on. Coming soon.",
		},
	];

	return (
		<div className="flex flex-1 flex-col">
			<div className={SCREEN_BODY}>
				<p className={cn(MICRO, "text-muted-foreground")}>Welcome</p>
				<h1
					className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
					tabIndex={-1}
				>
					Let&rsquo;s set up your profile
				</h1>
				<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
					Skip anything you would rather not answer. We will tell you what we
					could not work out without it.
				</p>

				<ul className="mt-8 grid w-full max-w-xl gap-3 text-left">
					{gets.map((item) => (
						<li
							className="flex gap-4 rounded-2xl border border-border p-4"
							key={item.title}
						>
							<span
								aria-hidden="true"
								className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
							>
								<item.icon className="size-4" />
							</span>
							<span className="grid gap-1">
								<span className="font-medium text-sm">{item.title}</span>
								<span className="text-pretty text-muted-foreground text-sm leading-relaxed">
									{item.body}
								</span>
							</span>
						</li>
					))}
				</ul>
			</div>

			<div className={ACTION_BAR}>
				<Button
					className="h-11 w-full rounded-full px-6 sm:w-auto"
					onClick={onStart}
					type="button"
				>
					Get started
					<ArrowRightIcon />
				</Button>
			</div>
		</div>
	);
}

/**
 * The dark half. It carries the brand and a line about where the user is, which
 * is what keeps a form from reading as an interrogation.
 *
 * Its colours are `foreground`/`background` inverted rather than a fixed black,
 * so the panel stays the high-contrast one in either theme instead of turning
 * into a second dark surface on a dark page.
 */
function BrandPanel({
	step,
	atPlan,
}: {
	/** The chapter the current question belongs to, absent off the questions. */
	step: OnboardingStep | undefined;
	atPlan: boolean;
}) {
	const copy = step
		? { headline: step.title, blurb: step.aside }
		: atPlan
			? {
					headline: "Done",
					blurb:
						"These targets are a starting point. Mezo adjusts them as it learns what you actually do.",
				}
			: {
					headline: "Onboarding",
					blurb: "Everything here is editable later.",
				};

	return (
		<aside className="relative hidden overflow-hidden bg-foreground p-10 text-background lg:flex lg:flex-col xl:p-12">
			{/* The same dither field as the auth pages, so signing up and setting up
			    read as one flow — but clipped to this panel rather than running the
			    width of the page, which would put ambient motion under the
			    questions. `overflow-hidden` above is what does the clipping. */}
			<Backdrop className="absolute inset-0" inverted />

			{/* The field runs behind the copy at the foot of the panel and takes
			    its contrast down with it. This fades it back into the panel colour
			    over the bottom half, so the text keeps its full ratio and the
			    texture survives everywhere it is not competing with words. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground via-foreground/85 to-transparent"
			/>

			<div className="relative flex items-center gap-2.5">
				<span className="flex size-8 items-center justify-center rounded-lg bg-background text-foreground">
					<LogoMark className="size-4" />
				</span>
				<span className="font-semibold tracking-tight">mezo</span>
			</div>

			{/* `mb-2` because the footer line that used to sit under this is gone,
			    and `mt-auto` alone leaves the last line flush with the padding. */}
			<div className="relative mt-auto mb-2">
				{step && (
					<p className={cn(MICRO, "mb-5 text-background/50")}>
						{/* The chapter, not the question: a "Step 07 / 13" beside a
						    one-question screen reads as a queue to get through. */}
						Step {ONBOARDING_STEPS.indexOf(step) + 1} of{" "}
						{ONBOARDING_STEPS.length}
					</p>
				)}
				<p className="text-balance font-semibold text-5xl leading-[1.05] tracking-[-0.03em]">
					{copy.headline}
				</p>
				<p className="mt-5 max-w-[26ch] text-pretty text-background/70 text-sm leading-relaxed">
					{copy.blurb}
				</p>
			</div>
		</aside>
	);
}

/**
 * One node per chapter rather than per screen. Thirteen dots is a queue; four
 * named ones is a shape, and the count of questions inside each is the flow's
 * business rather than the reader's.
 */
function StepBar({ current }: { current: number }) {
	return (
		<ol className="flex items-center gap-2 sm:gap-3">
			{ONBOARDING_STEPS.map((screen, position) => {
				const done = position < current;
				const active = position === current;
				const lastNode = position === ONBOARDING_STEPS.length - 1;
				return (
					<li
						aria-current={active ? "step" : undefined}
						className={cn(
							"flex items-center gap-2 sm:gap-3",
							!lastNode && "flex-1",
						)}
						key={screen.title}
					>
						<span
							aria-hidden="true"
							className={cn(
								"flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-xs tabular-nums transition-colors",
								done || active
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-muted-foreground",
							)}
						>
							{done ? (
								<CheckIcon className="size-3.5" strokeWidth={3} />
							) : (
								position + 1
							)}
						</span>
						<span
							className={cn(
								"text-xs max-sm:sr-only",
								active
									? "font-medium text-foreground"
									: "text-muted-foreground",
							)}
						>
							{screen.title}
						</span>
						{!lastNode && (
							<span
								aria-hidden="true"
								className={cn(
									"h-px flex-1 transition-colors",
									done ? "bg-primary" : "bg-border",
								)}
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}
