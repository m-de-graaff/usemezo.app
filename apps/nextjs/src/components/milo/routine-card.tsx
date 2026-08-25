"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { exerciseById } from "@mezo/api/exercises";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { CheckIcon, DumbbellIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
	type ProposedRoutine,
	proposalToExercises,
} from "~/lib/routine-proposal";
import { api } from "~/trpc/react";

/**
 * The card behind `proposeRoutine`.
 *
 * The same shape as the profile change card: the tool has no `execute`, so the
 * run stops here and waits for this component to hand back a result. Save goes
 * through `workout.saveRoutine` exactly as the builder does, which means the
 * model's exercise ids are checked against the catalogue by the same code that
 * checks a human's.
 */

type Result = { saved: true; id: string } | { saved: false; reason: string };

export const RoutineToolUI = makeAssistantToolUI<ProposedRoutine, Result>({
	toolName: "proposeRoutine",
	render: function RoutineCard({ addResult, args, result, status }) {
		const router = useRouter();

		const save = api.workout.saveRoutine.useMutation({
			onSuccess: ({ id }) => {
				toast.success(`${args.name} saved.`);
				// The Workouts screen is server-rendered and now out of date.
				router.refresh();
				addResult({ saved: true, id });
			},
			onError: (error) => {
				toast.error(error.message);
				// Told to the model too, so it can correct itself rather than
				// insisting the routine was saved.
				addResult({ saved: false, reason: `Rejected: ${error.message}` });
			},
		});

		// While the arguments are still streaming there is nothing stable to show,
		// and a half-built exercise list reads as a different routine.
		const exercises = Array.isArray(args?.exercises) ? args.exercises : [];
		if (status.type === "running" || exercises.length === 0) {
			return <CardShell>Putting a session together…</CardShell>;
		}

		const settled = result !== undefined;
		const saved = settled && result.saved;

		return (
			<CardShell>
				<div className="flex items-center gap-2 border-b px-4 py-2.5">
					<DumbbellIcon
						aria-hidden="true"
						className="size-3.5 text-muted-foreground"
					/>
					<h3 className="min-w-0 truncate font-medium text-sm">
						{saved ? `${args.name} saved` : settled ? "Not saved" : args.name}
					</h3>
					<span className="ml-auto shrink-0 text-muted-foreground text-xs">
						{exercises.length} exercises
					</span>
				</div>

				{args.note && (
					<p className="border-b px-4 py-2 text-muted-foreground text-xs leading-relaxed">
						{args.note}
					</p>
				)}

				<ul className="divide-y">
					{exercises.map((entry, index) => {
						const exercise = exerciseById(entry.exerciseId);
						return (
							<li
								className="flex items-baseline gap-2 px-4 py-2"
								// The proposal carries no keys of its own, and this list is
								// rendered once and never reordered: by the time it is on
								// screen it is a record of what was suggested.
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={`${entry.exerciseId}-${index}`}
							>
								<span className="min-w-0 flex-1 truncate text-sm capitalize">
									{exercise?.name ?? `Unknown exercise (${entry.exerciseId})`}
								</span>
								<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
									{entry.sets} × {entry.reps}
									{entry.weightKg ? ` @ ${entry.weightKg} kg` : ""}
								</span>
							</li>
						);
					})}
				</ul>

				{settled ? (
					<p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-muted-foreground text-xs">
						{saved ? (
							<CheckIcon aria-hidden="true" className="size-3.5" />
						) : (
							<XIcon aria-hidden="true" className="size-3.5" />
						)}
						{saved ? (
							<>
								In your{" "}
								<Link className="underline underline-offset-4" href="/workouts">
									routines
								</Link>
								.
							</>
						) : (
							"Discarded, nothing was written."
						)}
					</p>
				) : (
					<div className="flex items-center justify-end gap-2 border-t px-4 py-2.5">
						<Button
							disabled={save.isPending}
							onClick={() =>
								addResult({
									saved: false,
									reason: "The user discarded this routine.",
								})
							}
							size="sm"
							variant="ghost"
						>
							Discard
						</Button>
						<Button
							disabled={save.isPending}
							onClick={() =>
								save.mutate({
									id: crypto.randomUUID(),
									name: args.name,
									note: args.note ?? null,
									exercises: proposalToExercises(args),
								})
							}
							size="sm"
						>
							{save.isPending ? "Saving…" : "Save routine"}
						</Button>
					</div>
				)}
			</CardShell>
		);
	},
});

const CardShell = ({ children }: { children: ReactNode }) => (
	<div className="my-2 overflow-hidden rounded-xl border bg-card text-card-foreground">
		{typeof children === "string" ? (
			<p className="px-4 py-3 text-muted-foreground text-sm">{children}</p>
		) : (
			children
		)}
	</div>
);
