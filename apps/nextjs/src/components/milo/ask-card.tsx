"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@mezo/ui/button";
import { MessageCircleQuestionIcon } from "lucide-react";

/**
 * The card behind `askUser`.
 *
 * A coach that never asks anything builds for a person it invented. This is the
 * cheapest way to let Milo ask: the tool has no `execute`, so the run stops
 * here, and whichever button the user presses comes back as the tool result and
 * resumes it.
 *
 * Buttons rather than a free text prompt, and deliberately so. The run is
 * blocked on a tool result, and a composer message is not one — typing an answer
 * while this is on screen would leave the call unanswered. "Something else"
 * is the escape hatch: it resolves the tool and hands the turn back with an
 * instruction for the model to ask again in words.
 */

type Args = { question: string; options: string[] };
type Result = { answer: string };

export const AskToolUI = makeAssistantToolUI<Args, Result>({
	toolName: "askUser",
	render: function AskCard({ addResult, args, result, status }) {
		const options = Array.isArray(args?.options) ? args.options : [];

		// While the arguments stream there is no stable question to read, and half
		// a question with one button under it is worse than a placeholder.
		if (status.type === "running" || !args?.question || options.length === 0) {
			return (
				<div className="my-2 rounded-xl border bg-card px-4 py-3 text-muted-foreground text-sm">
					Thinking of what to ask…
				</div>
			);
		}

		const answered = result !== undefined;

		return (
			<div className="my-2 overflow-hidden rounded-xl border bg-card text-card-foreground">
				<div className="flex items-start gap-2 px-4 py-3">
					<MessageCircleQuestionIcon
						aria-hidden="true"
						className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
					/>
					<p className="min-w-0 text-sm leading-relaxed">{args.question}</p>
				</div>

				{answered ? (
					<p className="border-t px-4 py-2.5 text-muted-foreground text-xs">
						You answered: {result.answer}
					</p>
				) : (
					<fieldset className="flex flex-wrap gap-2 border-t px-4 py-2.5">
						{/* The question is already above, so the legend would read it
						    twice on screen. It is here for a screen reader moving by
						    control rather than by line. */}
						<legend className="sr-only">{args.question}</legend>
						{options.map((option) => (
							<Button
								className="h-auto rounded-full px-3.5 py-1.5 font-normal"
								key={option}
								onClick={() => addResult({ answer: option })}
								size="sm"
								variant="outline"
							>
								{option}
							</Button>
						))}
						<Button
							className="h-auto rounded-full px-3.5 py-1.5 font-normal text-muted-foreground"
							onClick={() =>
								addResult({
									answer:
										"None of these. Ask the user to say it in their own words, then carry on.",
								})
							}
							size="sm"
							variant="ghost"
						>
							Something else
						</Button>
					</fieldset>
				)}
			</div>
		);
	},
});
