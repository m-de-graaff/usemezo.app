"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import type { Exercise } from "@mezo/api/exercises";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { DumbbellIcon, EyeOffIcon } from "lucide-react";
import { useEffect } from "react";
import { api } from "~/trpc/react";

/**
 * The two cards behind `createExercise` and `hideExercise`.
 *
 * Both report rather than ask, the same trade `remember` makes and for the same
 * reason: each is one row the user can see in full and undo in one tap, and a
 * confirmation in front of every one would put two extra presses between "I do
 * Bayesian curls" and a routine with one in it. The undo button beside the
 * sentence is the other half of that bargain.
 *
 * `proposeRoutine` still asks, because a routine is a page of numbers somebody
 * will train to. The line is what the user has to read before they can judge
 * it, not how permanent it is.
 */

/* -------------------------------------------------------------------------- */
/* Adding one                                                                 */
/* -------------------------------------------------------------------------- */

type CreateArgs = { name?: string; target?: string; equipment?: string };
type CreateResult =
	| {
			exercise: Exercise;
			status: "created" | "already yours" | "already known";
	  }
	| { error: string };

export const CreateExerciseToolUI = makeAssistantToolUI<
	CreateArgs,
	CreateResult
>({
	toolName: "createExercise",
	render: function CreateExerciseCard({ args, result, status }) {
		const utils = api.useUtils();

		const remove = api.exercise.remove.useMutation({
			onSuccess: () => {
				void utils.exercise.catalogue.invalidate();
				toast.success("Deleted.");
			},
			onError: (error) => toast.error(error.message),
		});

		// The tool wrote to the database, and the copy of the catalogue the rest
		// of the page is rendering from was read before that. Without this, a
		// routine proposed in the same turn shows the exercise Milo just added as
		// "Unknown exercise".
		const created =
			result && !("error" in result) && result.status !== "already known";
		useEffect(() => {
			if (created) void utils.exercise.catalogue.invalidate();
		}, [created, utils]);

		if (status.type === "running" || !args?.name) {
			return <Line icon="dumbbell">Adding an exercise…</Line>;
		}

		if (result && "error" in result) {
			return (
				<Line icon="dumbbell">Could not add that exercise: {result.error}</Line>
			);
		}

		if (!result) return <Line icon="dumbbell">Adding {args.name}…</Line>;

		// Nothing was written, so there is nothing to offer to unwrite.
		if (result.status !== "created") {
			return (
				<Line icon="dumbbell">
					{result.status === "already known"
						? "Already in the catalogue:"
						: "You already have this one:"}{" "}
					<span className="text-foreground capitalize">
						{result.exercise.name}
					</span>
				</Line>
			);
		}

		return (
			<div className="my-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
				<DumbbellIcon aria-hidden="true" className="size-4 shrink-0" />
				<span>
					Added to your exercises:{" "}
					<span className="text-foreground capitalize">
						{result.exercise.name}
					</span>{" "}
					({result.exercise.target})
				</span>
				<Button
					className="h-auto px-1.5 py-0.5 font-normal text-xs"
					disabled={remove.isPending || remove.isSuccess}
					onClick={() => remove.mutate({ id: result.exercise.id })}
					size="sm"
					variant="ghost"
				>
					{remove.isSuccess ? "Deleted" : "Delete"}
				</Button>
			</div>
		);
	},
});

/* -------------------------------------------------------------------------- */
/* Taking one away                                                            */
/* -------------------------------------------------------------------------- */

type HideArgs = { exerciseId?: string; reason?: string };
type HideResult = { exerciseId: string; name: string } | { error: string };

export const HideExerciseToolUI = makeAssistantToolUI<HideArgs, HideResult>({
	toolName: "hideExercise",
	render: function HideExerciseCard({ result, status }) {
		const utils = api.useUtils();

		const unhide = api.exercise.unhide.useMutation({
			onSuccess: () => {
				void utils.exercise.catalogue.invalidate();
				void utils.exercise.hidden.invalidate();
				toast.success("Back in the catalogue.");
			},
			onError: (error) => toast.error(error.message),
		});

		if (status.type === "running") return <Line icon="hide">Hiding it…</Line>;
		if (!result) return null;
		if ("error" in result) {
			return <Line icon="hide">Could not hide that: {result.error}</Line>;
		}

		return (
			<div className="my-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
				<EyeOffIcon aria-hidden="true" className="size-4 shrink-0" />
				<span>
					I won't offer{" "}
					<span className="text-foreground capitalize">{result.name}</span>{" "}
					again
				</span>
				<Button
					className="h-auto px-1.5 py-0.5 font-normal text-xs"
					disabled={unhide.isPending || unhide.isSuccess}
					onClick={() => unhide.mutate({ exerciseId: result.exerciseId })}
					size="sm"
					variant="ghost"
				>
					{unhide.isSuccess ? "Restored" : "Undo"}
				</Button>
			</div>
		);
	},
});

const Line = ({
	children,
	icon,
}: {
	children: React.ReactNode;
	icon: "dumbbell" | "hide";
}) => (
	<p className="my-1.5 flex items-center gap-2 text-muted-foreground text-sm">
		{icon === "dumbbell" ? (
			<DumbbellIcon aria-hidden="true" className="size-4 shrink-0" />
		) : (
			<EyeOffIcon aria-hidden="true" className="size-4 shrink-0" />
		)}
		{children}
	</p>
);
