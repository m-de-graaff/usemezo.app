"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "~/components/workouts/summary";

/**
 * Time since the session started, ticking.
 *
 * Its own component deliberately: a clock inside the workout tree would
 * re-render every set row once a second while somebody is typing into one.
 *
 * `suppressHydrationWarning` because the server renders the value at request
 * time and the browser a moment later, and a one second difference is not a bug
 * worth a console error.
 */
export function Elapsed({ startedAt }: { startedAt: Date }) {
	const [seconds, setSeconds] = useState(() =>
		Math.max(0, (Date.now() - startedAt.getTime()) / 1000),
	);

	useEffect(() => {
		const id = setInterval(
			() => setSeconds(Math.max(0, (Date.now() - startedAt.getTime()) / 1000)),
			1000,
		);
		return () => clearInterval(id);
	}, [startedAt]);

	return (
		<span className="tabular-nums" suppressHydrationWarning>
			{formatDuration(seconds)}
		</span>
	);
}
