"use client";

import {
	type Field,
	ONBOARDING_REQUIRED,
	ONBOARDING_SCREENS,
	type ProfileInput,
} from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import { cn } from "@mezo/ui/lib/utils";
import { toast } from "@mezo/ui/sonner";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	ScaleIcon,
	SparklesIcon,
	UtensilsIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

/** Before the first question. */
const WELCOME = -1;
/** After the last one. */
const PLAN = ONBOARDING_SCREENS.length;

/**
 * Question types where the answer is typed, so the field takes focus and the
 * keyboard is up before the user reaches for it. Every other type sends focus
 * to the heading instead, so the new screen gets announced.
 */
const TYPED = new Set<Field["type"]>(["text", "textarea", "date"]);

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
	const screenRef = useRef<HTMLDivElement>(null);

	// Answers are saved per screen, so a run that was abandoned halfway comes
	// back to where it stopped instead of to question one.
	const [index, setIndex] = useState(() => {
		const answered = (field: Field) => isAnswered(initial[field.name] ?? null);
		if (!ONBOARDING_SCREENS.some((screen) => screen.fields.some(answered)))
			return WELCOME;
		const next = ONBOARDING_SCREENS.findIndex(
			(screen) => !screen.fields.every(answered),
		);
		return next === -1 ? PLAN : next;
	});

	const screen = ONBOARDING_SCREENS[index];
	const availability = useUsernameAvailability(values.username);
	const system = unitSystem(values.units);

	useEffect(() => {
		// Nothing moves focus on its own between screens, so a screen reader
		// would otherwise sit on the button that was just pressed and never read
		// out the screen that replaced it.
		//
		// Found in the DOM rather than held in refs: every branch renders one
		// `<h1 tabIndex={-1}>`, and querying for it means the plan screen and the
		// welcome screen need no wiring of their own to be reachable.
		const first = ONBOARDING_SCREENS[index]?.fields[0];
		if (first && TYPED.has(first.type)) {
			screenRef.current
				?.querySelector<HTMLElement>(
					"input:not([type=radio]):not([type=checkbox]):not([type=range]), textarea",
				)
				?.focus();
			return;
		}
		screenRef.current?.querySelector<HTMLElement>("h1")?.focus();
	}, [index]);

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

	/** The fields on this screen that the answers so far say still apply. */
	const asked = (screen?.fields ?? []).filter(
		(field) => !field.when || field.when(values),
	);

	const blocked =
		asked.some(
			(field) =>
				ONBOARDING_REQUIRED.has(field.name) &&
				!isAnswered(values[field.name] ?? null),
		) ||
		(asked.some((field) => field.name === "username") && availability.taken);

	// Nothing left on this screen that has to be answered, and something on it
	// that has not been — so there is a Skip worth offering.
	const skippable =
		!blocked &&
		asked.some(
			(field) =>
				!ONBOARDING_REQUIRED.has(field.name) &&
				!isAnswered(values[field.name] ?? null),
		);

	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		// Only this screen's fields, and only the ones it actually asked: a
		// hidden target weight must never be written, and an answer from an
		// earlier screen must survive untouched.
		save.mutate(
			Object.fromEntries(
				asked.map((field) => [
					field.name,
					submitted(field, values[field.name] ?? null),
				]),
			) as ProfileInput,
		);
	};

	return (
		// A muted mat with one inset slab on it — the same frame the landing page
		// uses, which is the register this belongs to: a standalone first-run
		// page rather than a screen inside the app shell.
		<div className="flex min-h-svh flex-col bg-muted/60 p-3 sm:p-5">
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-2 py-3 sm:px-4">
				<p
					className={cn(MICRO, "flex items-center gap-2 text-muted-foreground")}
				>
					mezo
					<span
						aria-hidden="true"
						className="size-1 rounded-full bg-muted-foreground/50"
					/>
					Set up your profile
				</p>
				{screen && (
					<p
						className={cn(
							MICRO,
							"text-muted-foreground tabular-nums sm:hidden",
						)}
					>
						{pad(index + 1)} <span aria-hidden="true">/</span>{" "}
						{pad(ONBOARDING_SCREENS.length)}
					</p>
				)}
			</div>

			<div className="mx-auto grid w-full max-w-6xl flex-1 rounded-3xl bg-background shadow-sm lg:min-h-[40rem] lg:grid-cols-[21rem_minmax(0,1fr)]">
				<BrandPanel index={index} />

				<div className="flex flex-col p-5 sm:p-8 lg:p-10">
					{screen && <StepBar current={index} />}

					{/* Keyed so the screen remounts: entrance motion replays and the
					    controls re-seed, while the panel and stepper stay put and
					    transition between states. */}
					<div
						className={cn(
							"fade-in mt-8 flex flex-1 animate-in flex-col duration-300 ease-out-quint motion-reduce:animate-none",
							forwards ? "slide-in-from-end-4" : "slide-in-from-start-4",
						)}
						key={index}
						ref={screenRef}
					>
						{index === WELCOME && <Welcome onStart={advance} />}

						{screen && (
							<form className="flex flex-1 flex-col" onSubmit={onSubmit}>
								<p className={cn(MICRO, "text-muted-foreground")}>
									{pad(index + 1)} <span aria-hidden="true">/</span>{" "}
									{screen.title}
								</p>
								<h1
									className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
									tabIndex={-1}
								>
									{screen.heading}
								</h1>
								<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
									{screen.blurb}
								</p>

								<div className="mt-8 grid max-w-xl gap-7">
									{screen.fields.map((field) => (
										<QuestionField
											availability={availability}
											context={values}
											field={field}
											key={field.name}
											onChange={setAnswer}
											system={system}
											value={values[field.name] ?? null}
										/>
									))}
								</div>

								{/* Pinned to the bottom of the pane on a wide screen, so
								    Continue sits in the same place on every screen. On a
								    phone it sticks to the viewport instead, so a long list
								    cannot push it out of reach. */}
								<div className="sticky bottom-0 z-10 -mx-5 mt-auto flex items-center gap-3 border-border/60 border-t bg-background px-5 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-10 sm:px-0 sm:pb-0">
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

						{index === PLAN && (
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

			<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-2 py-3 sm:px-4">
				<p className={cn(MICRO, "text-muted-foreground")}>
					Mezo — training, food and sleep in one place
				</p>
				<p
					className={cn(
						MICRO,
						"flex items-center gap-2 text-muted-foreground max-sm:hidden",
					)}
				>
					<span
						aria-hidden="true"
						className="size-1 rounded-full bg-muted-foreground/50"
					/>
					Health answers stay private
				</p>
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
	const gets = [
		{
			icon: UtensilsIcon,
			title: "A calorie and macro target",
			body: "Worked out from your body and your week, not copied off a chart.",
		},
		{
			icon: ScaleIcon,
			title: "A pace towards your goal",
			body: "What a week of it looks like, and roughly how long it runs for.",
		},
		{
			icon: SparklesIcon,
			title: "Numbers that mean something",
			body: "Every range Mezo shows you is adjusted for your age and build.",
		},
	];

	return (
		<div className="flex flex-1 flex-col">
			<p className={cn(MICRO, "text-muted-foreground")}>Welcome</p>
			<h1
				className="mt-4 text-balance font-semibold text-3xl leading-[1.05] tracking-[-0.03em] outline-none sm:text-4xl"
				tabIndex={-1}
			>
				Four screens, about a minute
			</h1>
			<p className="mt-3 max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed">
				Mezo asks for the handful of things it cannot work without, then shows
				you what they add up to. Skip anything you would rather not answer — it
				will tell you what that leaves out rather than guessing.
			</p>

			<ul className="mt-8 grid max-w-xl gap-3">
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

			<div className="sticky bottom-0 z-10 -mx-5 mt-auto border-border/60 border-t bg-background px-5 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-10 sm:border-t-0 sm:px-0 sm:pb-0">
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
function BrandPanel({ index }: { index: number }) {
	const screen = ONBOARDING_SCREENS[index];
	const copy =
		index === WELCOME
			? {
					headline: "Set up",
					blurb:
						"Everything here is editable later, and none of it is shared unless you say so.",
				}
			: index === PLAN
				? {
						headline: "Done",
						blurb:
							"These targets are a starting point. Mezo adjusts them as it learns what you actually do.",
					}
				: {
						headline: screen?.title ?? "",
						blurb: screen?.aside ?? "",
					};

	return (
		<aside className="relative hidden overflow-hidden rounded-l-3xl bg-foreground p-10 text-background lg:flex lg:flex-col">
			{/* Two faint rings, as texture rather than decoration to look at. */}
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				<span className="absolute -top-24 -right-28 size-72 rounded-full border border-background/10" />
				<span className="absolute -top-8 -right-16 size-52 rounded-full border border-background/10" />
			</div>

			<div className="relative flex items-center justify-between gap-4">
				<span className="flex items-center gap-2.5">
					<span className="flex size-8 items-center justify-center rounded-lg bg-background text-foreground">
						<LogoMark className="size-4" />
					</span>
					<span className="font-semibold tracking-tight">mezo</span>
				</span>
				<span className={cn(MICRO, "text-background/50")}>First run</span>
			</div>

			<div className="relative mt-auto">
				{screen && (
					<p className={cn(MICRO, "mb-5 text-background/50 tabular-nums")}>
						Step {pad(index + 1)} <span aria-hidden="true">/</span>{" "}
						{pad(ONBOARDING_SCREENS.length)}
					</p>
				)}
				<p className="text-balance font-semibold text-5xl leading-[1.05] tracking-[-0.03em]">
					{copy.headline}
				</p>
				<p className="mt-5 max-w-[26ch] text-pretty text-background/70 text-sm leading-relaxed">
					{copy.blurb}
				</p>
			</div>

			<div className="relative mt-12 border-background/15 border-t pt-5">
				<p className={cn(MICRO, "flex items-center gap-2 text-background/50")}>
					<span
						aria-hidden="true"
						className="size-1 rounded-full bg-background/50"
					/>
					Answer once, change any time
				</p>
			</div>
		</aside>
	);
}

/** One node per screen, so progress reads as shape rather than as a count. */
function StepBar({ current }: { current: number }) {
	return (
		<ol className="flex items-center gap-2 sm:gap-3">
			{ONBOARDING_SCREENS.map((screen, position) => {
				const done = position < current;
				const active = position === current;
				const lastNode = position === ONBOARDING_SCREENS.length - 1;
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
