"use client";

import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

/**
 * The control this screen exists for, as one button in the page heading.
 *
 * A live session takes it over rather than sitting next to it. Offering Start
 * beside Resume is offering to lose the sets already logged, and the server
 * would refuse it anyway; the button naming the session is also the only
 * reminder anybody needs that one is running.
 */
export function StartWorkout({
	active,
}: {
	active: { id: string; name: string } | null;
}) {
	const router = useRouter();

	const start = api.workout.start.useMutation({
		onSuccess: ({ id }) => router.push(`/workouts/${id}`),
		onError: (error) => toast.error(error.message),
	});

	if (active) {
		return (
			<Button render={<Link href={`/workouts/${active.id}`} />}>
				<PlayIcon aria-hidden="true" />
				Resume {active.name}
			</Button>
		);
	}

	return (
		<Button
			disabled={start.isPending}
			onClick={() =>
				// Minted here rather than during render: a render-time id would be a
				// different id on every pass.
				start.mutate({ id: crypto.randomUUID(), name: "Workout" })
			}
		>
			<PlayIcon aria-hidden="true" />
			{start.isPending ? "Starting…" : "Start empty workout"}
		</Button>
	);
}
