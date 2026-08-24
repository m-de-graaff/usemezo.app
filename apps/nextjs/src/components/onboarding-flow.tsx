"use client";

import {
	type Field,
	type ProfileInput,
	SECTIONS,
} from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "~/components/logo";
import { QuestionControl } from "~/components/onboarding/question-control";
import type {
	Answer,
	SettingsValues,
} from "~/components/settings/settings-form";
import { useUsernameAvailability } from "~/components/username-availability";
import { defaultFor, unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/**
 * One question per screen, in the order the sections declare them. The same
 * spec drives the grouped Settings screens, so a question added there shows up
 * here without another edit.
 */
const QUESTIONS: { section: string; field: Field }[] = SECTIONS.flatMap(
	(section) =>
		section.fields.map((field) => ({ section: section.title, field })),
);

/** Only the handle is required; it is what the profile lives at. */
const isRequired = (field: Field) => field.name === "username";

/**
 * What Continue writes. A slider and a two-way toggle always show a value, so
 * passing one of those screens means accepting what is on it; everything else
 * saves exactly what was typed, or null.
 */
function submittedAnswer(field: Field, answer: Answer): Answer {
	if (answer !== null) return answer;
	if (field.type === "toggle") return false;
	if (field.type === "number" && field.measure)
		return defaultFor(field.measure);
	return null;
}

export function OnboardingFlow({
	values: initial,
}: {
	values: SettingsValues;
}) {
	const router = useRouter();
	const [index, setIndex] = useState(0);
	const [values, setValues] = useState(initial);

	const step = QUESTIONS[index];
	const availability = useUsernameAvailability(values.username);
	const system = unitSystem(values.units);

	const save = api.profile.update.useMutation({
		onSuccess: () => advance(),
		onError: (error) => {
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

	function advance() {
		if (index + 1 < QUESTIONS.length) {
			setIndex(index + 1);
			return;
		}
		finish.mutate();
	}

	function setAnswer(name: keyof ProfileInput, value: Answer) {
		setValues((previous) => ({ ...previous, [name]: value }));
	}

	if (!step) return null;

	const { field } = step;
	const answer = values[field.name] ?? null;
	const pending = save.isPending || finish.isPending;
	const blocked =
		(isRequired(field) && !answer) ||
		(field.name === "username" && availability.taken);

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// Each answer is saved as it is passed, so a closed tab costs this screen
		// and nothing before it. Skip writes nothing at all, which is the whole
		// difference: Continue accepts whatever the screen is showing, including
		// a slider's starting value and an unticked toggle.
		save.mutate({
			[field.name]: submittedAnswer(field, answer),
		} as ProfileInput);
	}

	return (
		// A phone gets the full viewport; anything wider gets a panel centred in
		// it, so the question does not float alone in a wide empty page. The
		// panel keeps a floor height so it does not jump between question types.
		<div className="min-h-svh md:grid md:place-items-center md:p-8">
			<main className="mx-auto flex min-h-svh w-full max-w-xl flex-col px-4 pb-8 sm:px-6 md:min-h-[34rem] md:max-w-2xl md:rounded-3xl md:border md:border-border md:bg-card md:px-10 md:pb-8 md:shadow-lg">
				<header className="flex items-center gap-3 py-4 md:pt-2">
					<Button
						aria-label="Back to the previous question"
						disabled={index === 0 || pending}
						onClick={() => setIndex(index - 1)}
						size="icon"
						type="button"
						variant="ghost"
					>
						<ArrowLeftIcon />
					</Button>

					<div
						aria-label={`Question ${index + 1} of ${QUESTIONS.length}`}
						aria-valuemax={QUESTIONS.length}
						aria-valuemin={0}
						aria-valuenow={index + 1}
						className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
						role="progressbar"
					>
						<div
							className="h-full rounded-full bg-primary transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
							style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }}
						/>
					</div>

					{/* Held in place rather than removed, so the progress bar does not
				    shift width between questions. `invisible` also takes it out of
				    the tab order, which `opacity-0` would not. */}
					<Button
						className={isRequired(field) ? "invisible min-w-16" : "min-w-16"}
						disabled={pending}
						onClick={advance}
						type="button"
						variant="ghost"
					>
						Skip
					</Button>
				</header>

				<form
					className="flex flex-1 flex-col"
					// Remounts per question, so entrance motion replays and controls
					// re-seed instead of keeping the previous question's DOM state.
					key={field.name}
					onSubmit={onSubmit}
				>
					<div className="fade-in slide-in-from-bottom-2 flex flex-1 animate-in flex-col items-center justify-center gap-8 py-8 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none">
						<div className="flex flex-col gap-2 text-center">
							<p className="font-medium text-muted-foreground text-sm">
								{step.section}
							</p>
							<h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl md:text-[2.5rem]/tight">
								{field.question ?? field.label}
							</h1>
							{field.help && (
								<p className="text-pretty text-muted-foreground text-sm">
									{field.help}
								</p>
							)}
						</div>

						<QuestionControl
							availability={availability}
							field={field}
							onChange={setAnswer}
							system={system}
							value={answer}
						/>
					</div>

					<footer className="flex flex-col gap-4">
						<Button
							className="h-12 w-full rounded-2xl text-base"
							disabled={pending || blocked}
							size="lg"
							type="submit"
						>
							{pending
								? "Saving..."
								: index + 1 === QUESTIONS.length
									? "Finish"
									: "Continue"}
							<ArrowRightIcon />
						</Button>
						<Logo className="self-center text-muted-foreground text-sm" />
					</footer>
				</form>
			</main>
		</div>
	);
}
