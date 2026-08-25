"use client";

import { type Exercise, exerciseById } from "@mezo/api/exercises";
import {
	doneSetCount,
	insertIntoSuperset,
	moveExerciseNextTo,
	moveIntoSuperset,
	newKey,
	normaliseSupersets,
	supersetRuns,
	volumeKg,
	type WorkoutExercise,
} from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { CheckIcon, Link2Icon, PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Elapsed } from "~/components/workouts/elapsed";
import { ExercisePicker } from "~/components/workouts/exercise-picker";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { RestFields } from "~/components/workouts/rest-fields";
import { ExercisePlan, SetRows } from "~/components/workouts/set-rows";
import { formatVolume } from "~/components/workouts/summary";
import {
	DragHandle,
	Reorderable,
	SupersetDropZone,
	SupersetGroup,
	supersetLabel,
} from "~/components/workouts/superset";
import { unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/** How long typing has to stop before the session is written back. */
const AUTOSAVE_MS = 1200;

/**
 * A workout in progress.
 *
 * The exercise list is client state and the server holds the last quiet copy of
 * it: every edit schedules a debounced `log`, so a closed tab costs at most the
 * last second of typing and reopening the URL replays whatever was saved.
 *
 * The totals in the header are derived during render rather than tracked. They
 * are a reduction over at most fifty small objects, and a second copy in state
 * is a second copy that can disagree with the rows on screen.
 */
export function LiveWorkout({
	units,
	workout,
}: {
	units: string | null | undefined;
	workout: {
		id: string;
		name: string;
		startedAt: Date;
		exercises: WorkoutExercise[];
	};
}) {
	const router = useRouter();
	const system = unitSystem(units);
	const [exercises, setExercises] = useState(workout.exercises);

	const leave = () => {
		router.push("/workouts");
		router.refresh();
	};

	const log = api.workout.log.useMutation({
		onError: (error) => toast.error(error.message),
	});
	const finish = api.workout.finish.useMutation({
		onSuccess: ({ setCount }) => {
			toast.success(
				setCount
					? `${setCount} ${setCount === 1 ? "set" : "sets"} logged.`
					: "Workout saved, nothing logged.",
			);
			leave();
		},
		onError: (error) => toast.error(error.message),
	});
	const discard = api.workout.discard.useMutation({
		onSuccess: () => {
			toast.success("Workout discarded.");
			leave();
		},
		onError: (error) => toast.error(error.message),
	});

	// Autosave. A genuine effect: it synchronises client state with something
	// outside React, and the timer is cleared on every change so only the last
	// edit in a burst is written.
	//
	// `log` is read through a ref so that the mutation object changing identity
	// mid-burst does not restart the timer, which would mean a fast typist never
	// triggering a save at all.
	const logRef = useRef(log);
	logRef.current = log;
	const settled = useRef(false);
	const first = useRef(true);

	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		const id = setTimeout(() => {
			// Nothing to save into a session that has just been finished or
			// discarded; the write would only bounce off the server's own guard.
			if (settled.current) return;
			logRef.current.mutate({ id: workout.id, exercises });
		}, AUTOSAVE_MS);
		return () => clearTimeout(id);
	}, [exercises, workout.id]);

	const add = (exercise: Exercise) =>
		setExercises((current) => [
			...current,
			// No sets. What you are about to lift is not something this screen
			// knows, and a set of ten at twenty kilos is a number the lifter has to
			// correct rather than one that helps.
			{ key: newKey(), exerciseId: exercise.id, sets: [] },
		]);

	// One exercise on its own is a superset. It is the empty frame you then drop
	// the other half into, and until you do, nothing else on the screen changes.
	const toggleSuperset = (index: number) =>
		setExercises((current) =>
			normaliseSupersets(
				current.map((item, i) =>
					i === index
						? {
								...item,
								supersetId:
									item.supersetId === undefined ? newKey() : undefined,
							}
						: item,
				),
			),
		);

	/** Dragged in, or picked out of the tile's "move one you already have". */
	const moveInto = (supersetId: string, key: string) =>
		setExercises((current) => moveIntoSuperset(current, supersetId, key));

	/** A new exercise, straight into the group whose tile was tapped. */
	const addInto = (supersetId: string, exercise: Exercise) =>
		setExercises((current) =>
			insertIntoSuperset(current, supersetId, {
				key: newKey(),
				exerciseId: exercise.id,
				sets: [],
			}),
		);

	const patch = (key: string, sets: WorkoutExercise["sets"]) =>
		setExercises((current) =>
			current.map((entry) => (entry.key === key ? { ...entry, sets } : entry)),
		);

	const toggle = (key: string, index: number) =>
		setExercises((current) =>
			current.map((entry) =>
				entry.key === key
					? {
							...entry,
							sets: entry.sets.map((set, i) =>
								i === index ? { ...set, done: !set.done } : set,
							),
						}
					: entry,
			),
		);

	/** Anything on the entry that is not its sets: the rest timers, for now. */
	const patchEntry = (key: string, fields: Partial<WorkoutExercise>) =>
		setExercises((current) =>
			current.map((entry) =>
				entry.key === key ? { ...entry, ...fields } : entry,
			),
		);

	/** Dropped onto another card, which is the other half of the same drag. */
	const reorder = (key: string, targetKey: string, after: boolean) =>
		setExercises((current) =>
			moveExerciseNextTo(current, key, targetKey, after),
		);

	const drop = (key: string) =>
		setExercises((current) =>
			// Removing the middle of a superset leaves two exercises that are no
			// longer done back to back, so the ids are re-derived from what is left.
			normaliseSupersets(current.filter((entry) => entry.key !== key)),
		);

	const busy = finish.isPending || discard.isPending;
	const done = doneSetCount(exercises);

	/** One exercise, at its position in the flat list, which is what the buttons act on. */
	const card = (entry: WorkoutExercise, index: number) => {
		const exercise = exerciseById(entry.exerciseId);
		const label = exercise?.name ?? "this exercise";
		const grouped = entry.supersetId !== undefined;

		return (
			<Reorderable
				entryKey={entry.key}
				key={entry.key}
				onMove={(key, after) => reorder(key, entry.key, after)}
			>
				<div className="mb-3 flex items-center gap-2">
					<DragHandle entryKey={entry.key} name={label} />
					<ExerciseThumb exerciseId={entry.exerciseId} />
					<p className="min-w-0 flex-1 truncate font-medium capitalize">
						{exercise?.name ?? "Unknown exercise"}
					</p>
					<Button
						aria-label={
							grouped
								? `Take ${label} out of its superset`
								: `Make ${label} a superset`
						}
						onClick={() => toggleSuperset(index)}
						size="icon-sm"
						variant={grouped ? "secondary" : "ghost"}
					>
						<Link2Icon aria-hidden="true" />
					</Button>
					<Button
						aria-label={`Remove ${label}`}
						onClick={() => drop(entry.key)}
						size="icon-sm"
						variant="ghost"
					>
						<TrashIcon aria-hidden="true" />
					</Button>
				</div>
				<ExercisePlan note={entry.note} />
				<SetRows
					exerciseName={label}
					onChange={(sets) => patch(entry.key, sets)}
					onToggle={(setIndex) => toggle(entry.key, setIndex)}
					sets={entry.sets}
					system={system}
				/>
				<RestFields
					exerciseName={label}
					onChange={(rest) => patchEntry(entry.key, rest)}
					restAfterSec={entry.restAfterSec}
					restSec={entry.restSec}
				/>
			</Reorderable>
		);
	};

	// The runs come from the shape helper, but the buttons act on a position in
	// the flat list, so that index is tracked across runs rather than restarted
	// inside each one.
	let flat = 0;
	let group = 0;
	const rows = supersetRuns(exercises).flatMap((run) => {
		const cards = run.entries.map((entry) => card(entry, flat++));
		const id = run.id;
		if (id === undefined) return cards;

		const label = supersetLabel(group);
		return (
			<SupersetGroup index={group++} key={id} size={run.entries.length}>
				{cards}
				<SupersetDropZone
					label={label}
					moveable={exercises.filter((entry) => entry.supersetId !== id)}
					onMove={(key) => moveInto(id, key)}
					onPick={(exercise) => addInto(id, exercise)}
				/>
			</SupersetGroup>
		);
	});

	return (
		// The bottom padding is what keeps the last row, and anything focused in
		// it, clear of the sticky bar (SC 2.4.11).
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-28">
			<header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 rounded-xl border bg-card p-4">
				<h1 className="font-semibold text-lg tracking-tight">{workout.name}</h1>
				<dl className="flex gap-6 text-sm">
					<div>
						<dt className="text-muted-foreground text-xs">Elapsed</dt>
						<dd>
							<Elapsed startedAt={workout.startedAt} />
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Sets</dt>
						<dd className="tabular-nums">{done}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs">Volume</dt>
						<dd className="tabular-nums">
							{formatVolume(volumeKg(exercises), system)}
						</dd>
					</div>
				</dl>
			</header>

			{exercises.length === 0 ? (
				<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
					Nothing added yet. Pick your first exercise.
				</p>
			) : (
				<ul className="flex flex-col gap-4">{rows}</ul>
			)}

			<ExercisePicker
				onPick={add}
				trigger={
					<Button variant="outline">
						<PlusIcon aria-hidden="true" />
						Add exercise
					</Button>
				}
			/>

			{/* Sticky, so finishing is one tap from anywhere in a long session. */}
			<div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
				<div className="mx-auto flex max-w-3xl gap-2">
					<Button
						className="flex-1"
						disabled={busy}
						onClick={() => {
							settled.current = true;
							finish.mutate({ id: workout.id, exercises });
						}}
						size="lg"
					>
						<CheckIcon aria-hidden="true" />
						{finish.isPending ? "Finishing…" : "Finish workout"}
					</Button>
					<Button
						disabled={busy}
						onClick={() => {
							settled.current = true;
							discard.mutate({ id: workout.id });
						}}
						size="lg"
						variant="ghost"
					>
						<XIcon aria-hidden="true" />
						Discard
					</Button>
				</div>
			</div>
		</div>
	);
}
