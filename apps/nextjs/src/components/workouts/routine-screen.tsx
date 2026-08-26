"use client";

import type { RoutineExercise } from "@mezo/api/workout-shape";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoutineBuilder } from "~/components/workouts/routine-builder";
import { RoutineView } from "~/components/workouts/routine-view";

type Routine = {
	name: string;
	note: string | null;
	exercises: RoutineExercise[];
};

/**
 * One routine, in the two modes it has.
 *
 * Reading is the default and editing is asked for, which is the whole point of
 * the split: a routine is opened far more often than it is changed, and a
 * screen full of live inputs is one mistap from a rep range nobody meant to
 * change.
 *
 * A routine that does not exist yet opens straight into the builder. There is
 * nothing to read, and making somebody press Edit to fill in an empty screen is
 * a step that exists only because the two modes do.
 */
export function RoutineScreen({
	hasLiveWorkout,
	id,
	editing: startEditing,
	routine,
}: {
	/** Opened from the list's Edit, which skips the read-only stop. */
	editing: boolean;
	hasLiveWorkout: boolean;
	id: string;
	/** Null for an id nothing has been written to, which is how a new one starts. */
	routine: Routine | null;
}) {
	const router = useRouter();
	const [editing, setEditing] = useState(startEditing || routine === null);
	// The saved routine is held here rather than re-read, so leaving edit mode
	// shows what was just saved instead of what the server rendered minutes ago.
	const [saved, setSaved] = useState(routine);

	if (editing || saved === null) {
		return (
			<RoutineBuilder
				id={id}
				// Nothing to go back to for a routine that has never been saved: the
				// builder's own leave-for-the-list is the right exit there.
				onCancel={saved === null ? undefined : () => setEditing(false)}
				onSaved={(next) => {
					setSaved(next);
					setEditing(false);
					// The list behind this screen still has the old name and set count.
					router.refresh();
				}}
				routine={saved}
			/>
		);
	}

	return (
		<RoutineView
			exercises={saved.exercises}
			hasLiveWorkout={hasLiveWorkout}
			id={id}
			name={saved.name}
			note={saved.note}
			onEdit={() => setEditing(true)}
		/>
	);
}
