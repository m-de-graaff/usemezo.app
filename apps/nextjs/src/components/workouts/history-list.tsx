"use client";

import { Button } from "@mezo/ui/button";
import Link from "next/link";
import { useState } from "react";
import {
	formatDay,
	formatDuration,
	formatVolume,
} from "~/components/workouts/summary";
import { unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

export type WorkoutSummary = {
	id: string;
	name: string;
	startedAt: Date;
	volumeKg: number;
	setCount: number;
	durationSec: number;
};

/**
 * Past sessions, newest first.
 *
 * The first page is rendered on the server and handed in, so the list is there
 * on first paint. Later pages come from the same procedure by cursor, which is
 * what keeps a session landing mid-scroll from showing twice or not at all.
 */
export function WorkoutHistoryList({
	heading,
	initial,
	linkToAll,
	units,
}: {
	heading: string;
	initial: { items: WorkoutSummary[]; nextCursor: string | null };
	/** Set on the home screen, where this is a preview rather than the list. */
	linkToAll?: boolean;
	units: string | null | undefined;
}) {
	const system = unitSystem(units);
	const [items, setItems] = useState(initial.items);
	const [cursor, setCursor] = useState(initial.nextCursor);
	const [loading, setLoading] = useState(false);
	const utils = api.useUtils();

	const loadMore = async () => {
		if (!cursor) return;
		setLoading(true);
		try {
			const page = await utils.workout.history.fetch({ cursor });
			setItems((current) => [...current, ...page.items]);
			setCursor(page.nextCursor);
		} finally {
			setLoading(false);
		}
	};

	return (
		<section>
			<div className="mb-3 flex items-baseline justify-between gap-4">
				<h2 className="font-medium text-sm">{heading}</h2>
				{linkToAll && items.length > 0 && (
					<Link
						className="text-muted-foreground text-sm underline-offset-4 hover:underline"
						href="/workouts/history"
					>
						All workouts
					</Link>
				)}
			</div>

			{items.length === 0 ? (
				<p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
					Nothing logged yet.
				</p>
			) : (
				<ul className="divide-y overflow-hidden rounded-xl border bg-card">
					{items.map((workout) => (
						<li key={workout.id}>
							<Link
								className="flex items-center gap-4 px-4 py-3 hover:bg-muted"
								href={`/workouts/${workout.id}`}
							>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium">
										{workout.name}
									</span>
									<span className="block text-muted-foreground text-xs">
										{formatDay(workout.startedAt)}
									</span>
								</span>
								<span className="shrink-0 text-right text-sm tabular-nums">
									<span className="block">
										{formatVolume(workout.volumeKg, system)}
									</span>
									<span className="block text-muted-foreground text-xs">
										{workout.setCount} {workout.setCount === 1 ? "set" : "sets"}{" "}
										· {formatDuration(workout.durationSec)}
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}

			{!linkToAll && cursor && (
				<Button
					className="mt-3 w-full"
					disabled={loading}
					onClick={loadMore}
					variant="outline"
				>
					{loading ? "Loading…" : "Load more"}
				</Button>
			)}
		</section>
	);
}
