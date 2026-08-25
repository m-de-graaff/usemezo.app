"use client";

import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { PlayIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

/**
 * The control this screen exists for.
 *
 * A live session takes the whole card over. Offering Start next to Resume is
 * offering to lose the sets already logged, and the server would refuse it
 * anyway.
 */
export function StartWorkout({
	active,
	hasRoutines,
}: {
	active: { id: string; name: string } | null;
	hasRoutines: boolean;
}) {
	const router = useRouter();

	const start = api.workout.start.useMutation({
		onSuccess: ({ id }) => router.push(`/workouts/${id}`),
		onError: (error) => toast.error(error.message),
	});

	if (active) {
		return (
			<div className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-semibold text-lg tracking-tight">
						{active.name} is in progress
					</h1>
					<p className="text-muted-foreground text-sm">
						Pick up where you left off.
					</p>
				</div>
				<Button render={<Link href={`/workouts/${active.id}`} />} size="lg">
					<PlayIcon aria-hidden="true" />
					Resume
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
			<div>
				<h1 className="font-semibold text-lg tracking-tight">Workouts</h1>
				<p className="text-muted-foreground text-sm">
					{hasRoutines
						? "Start from a routine below, or log as you go."
						: "Log as you go, or build a routine first."}
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={start.isPending}
					onClick={() =>
						// Minted here rather than during render: a render-time id would
						// be a different id on every pass.
						start.mutate({ id: crypto.randomUUID(), name: "Workout" })
					}
					size="lg"
				>
					<PlayIcon aria-hidden="true" />
					{start.isPending ? "Starting…" : "Start empty workout"}
				</Button>
				<Button
					onClick={() =>
						router.push(`/workouts/routines/${crypto.randomUUID()}`)
					}
					size="lg"
					variant="outline"
				>
					<PlusIcon aria-hidden="true" />
					New routine
				</Button>
			</div>
		</div>
	);
}
