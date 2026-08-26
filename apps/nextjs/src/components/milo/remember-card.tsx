"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { BrainIcon } from "lucide-react";
import { api } from "~/trpc/react";

/**
 * The card behind `remember`.
 *
 * Unlike the profile and routine cards, this one reports rather than asks: the
 * tool has already written the note by the time this renders. That is the
 * trade, and the Forget button is the other half of it. A note is a sentence
 * the user can read in full and undo in one tap, so a confirmation step in
 * front of every one would buy nothing and would teach the model to stop
 * writing them.
 */

type Args = { kind: string; text: string; replaces?: string };
type Result = { id: string; status: string } | { error: string };

export const RememberToolUI = makeAssistantToolUI<Args, Result>({
	toolName: "remember",
	render: function RememberCard({ args, result, status }) {
		const utils = api.useUtils();

		const forget = api.milo.forget.useMutation({
			onSuccess: () => {
				void utils.milo.notes.invalidate();
				toast.success("Forgotten.");
			},
			onError: (error) => toast.error(error.message),
		});

		if (status.type === "running" || !args?.text) {
			return <Line>Making a note…</Line>;
		}

		if (result && "error" in result) {
			return <Line>Could not make a note: {result.error}</Line>;
		}

		// Nothing was written, so there is nothing to offer to unwrite.
		if (!result) return <Line>Noted: {args.text}</Line>;

		return (
			<div className="my-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
				<BrainIcon aria-hidden="true" className="size-4 shrink-0" />
				<span>
					{result.status === "replaced"
						? "Updated what I remember:"
						: result.status === "already known"
							? "Already remembered:"
							: "I'll remember:"}{" "}
					<span className="text-foreground">{args.text}</span>
				</span>
				<Button
					className="h-auto px-1.5 py-0.5 font-normal text-xs"
					disabled={forget.isPending || forget.isSuccess}
					onClick={() => forget.mutate({ id: result.id })}
					size="sm"
					variant="ghost"
				>
					{forget.isSuccess ? "Forgotten" : "Forget"}
				</Button>
			</div>
		);
	},
});

const Line = ({ children }: { children: React.ReactNode }) => (
	<p className="my-1.5 flex items-center gap-2 text-muted-foreground text-sm">
		<BrainIcon aria-hidden="true" className="size-4 shrink-0" />
		{children}
	</p>
);
