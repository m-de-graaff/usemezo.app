"use client";

import { type Exercise, exerciseById } from "@mezo/api/exercises";
import {
	newKey,
	normaliseSupersets,
	type RoutineExercise,
	supersetRuns,
} from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import { Input } from "@mezo/ui/input";
import { toast } from "@mezo/ui/sonner";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	Link2Icon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "~/components/workouts/exercise-picker";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { SetRows } from "~/components/workouts/set-rows";
import { SupersetGroup } from "~/components/workouts/superset";
import { unitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

/**
 * Build or edit one routine.
 *
 * The whole routine is client state and is sent whole on save. It is small, it
 * is all on screen at once, and a per-field autosave would leave a routine
 * half-edited in the database while somebody is still deciding.
 */
export function RoutineBuilder({
	id,
	routine,
}: {
	id: string;
	/** Null for an id nothing has been written to, which is how a new one starts. */
	routine: {
		name: string;
		note: string | null;
		exercises: RoutineExercise[];
	} | null;
}) {
	const router = useRouter();
	const profile = api.profile.get.useQuery();
	const system = unitSystem(profile.data?.units);

	const [name, setName] = useState(routine?.name ?? "New routine");
	const [exercises, setExercises] = useState<RoutineExercise[]>(
		routine?.exercises ?? [],
	);

	const done = () => {
		router.push("/workouts");
		router.refresh();
	};

	const save = api.workout.saveRoutine.useMutation({
		onSuccess: () => {
			toast.success("Routine saved.");
			done();
		},
		onError: (error) => toast.error(error.message),
	});

	const remove = api.workout.removeRoutine.useMutation({
		onSuccess: () => {
			toast.success("Routine deleted.");
			done();
		},
		onError: (error) => toast.error(error.message),
	});

	const add = (exercise: Exercise) =>
		setExercises((current) => [
			...current,
			// No sets. What you are about to lift is not something this screen
			// knows, and three sets of ten at twenty kilos is a number the lifter
			// has to correct rather than one that helps.
			{ key: newKey(), exerciseId: exercise.id, sets: [] },
		]);

	// Buttons rather than drag: WCAG 2.2 SC 2.5.7 wants a single-pointer path,
	// and this way there is no drag-and-drop dependency to carry either.
	const move = (index: number, by: 1 | -1) =>
		setExercises((current) => {
			const next = [...current];
			const a = next[index];
			const b = next[index + by];
			if (!a || !b) return current;
			next[index] = b;
			next[index + by] = a;
			// Moving an exercise out of a superset, or into the middle of one, is
			// how a group ends up meaning something the list no longer shows.
			return normaliseSupersets(next);
		});

	// Joining is always with the exercise above, because a superset is exercises
	// done back to back and a pair of neighbours is the only thing a flat list
	// can express. The button is absent on the first row for the same reason.
	const toggleSuperset = (index: number) =>
		setExercises((current) => {
			const entry = current[index];
			const previous = current[index - 1];
			if (!entry || !previous) return current;
			const joined =
				entry.supersetId !== undefined &&
				entry.supersetId === previous.supersetId;
			const supersetId = joined ? undefined : (previous.supersetId ?? newKey());
			return normaliseSupersets(
				current.map((item, i) => {
					if (i === index) return { ...item, supersetId };
					if (i === index - 1 && !joined) return { ...item, supersetId };
					return item;
				}),
			);
		});

	const patch = (key: string, sets: RoutineExercise["sets"]) =>
		setExercises((current) =>
			current.map((entry) => (entry.key === key ? { ...entry, sets } : entry)),
		);

	const drop = (key: string) =>
		setExercises((current) =>
			normaliseSupersets(current.filter((entry) => entry.key !== key)),
		);

	/** One exercise, at its position in the flat list, which is what the buttons act on. */
	const card = (entry: RoutineExercise, index: number) => {
		const exercise = exerciseById(entry.exerciseId);
		const label = exercise?.name ?? "this exercise";
		const previous = exercises[index - 1];
		const joined =
			entry.supersetId !== undefined &&
			entry.supersetId === previous?.supersetId;

		return (
			<li className="rounded-xl border bg-card p-4" key={entry.key}>
				<div className="mb-3 flex items-center gap-2">
					<ExerciseThumb exerciseId={entry.exerciseId} />
					<p className="min-w-0 flex-1 truncate font-medium capitalize">
						{exercise?.name ?? "Unknown exercise"}
					</p>
					<Button
						aria-label={`Move ${label} up`}
						disabled={index === 0}
						onClick={() => move(index, -1)}
						size="icon-sm"
						variant="ghost"
					>
						<ChevronUpIcon aria-hidden="true" />
					</Button>
					<Button
						aria-label={`Move ${label} down`}
						disabled={index === exercises.length - 1}
						onClick={() => move(index, 1)}
						size="icon-sm"
						variant="ghost"
					>
						<ChevronDownIcon aria-hidden="true" />
					</Button>
					<Button
						aria-label={
							joined
								? `Take ${label} out of its superset`
								: `Superset ${label} with the exercise above`
						}
						disabled={index === 0}
						onClick={() => toggleSuperset(index)}
						size="icon-sm"
						variant={joined ? "secondary" : "ghost"}
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
				<SetRows
					exerciseName={label}
					onChange={(sets) => patch(entry.key, sets)}
					sets={entry.sets}
					system={system}
				/>
			</li>
		);
	};

	// The runs come from the shape helper, but the buttons act on a position in
	// the flat list, so that index is tracked across runs rather than restarted
	// inside each one.
	let flat = 0;
	let group = 0;
	const rows = supersetRuns(exercises).flatMap((run) => {
		const cards = run.entries.map((entry) => card(entry, flat++));
		if (run.entries.length < 2) return cards;
		return (
			<SupersetGroup index={group++} key={run.id} size={run.entries.length}>
				{cards}
			</SupersetGroup>
		);
	});

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-48 flex-1">
					<label
						className="mb-1.5 block font-medium text-sm"
						htmlFor="routine-name"
					>
						Routine name
					</label>
					<Input
						id="routine-name"
						maxLength={80}
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</div>
				<Button
					disabled={save.isPending || !name.trim() || exercises.length === 0}
					onClick={() => save.mutate({ id, name: name.trim(), exercises })}
					size="lg"
				>
					{save.isPending ? "Saving…" : "Save routine"}
				</Button>
			</div>

			{exercises.length === 0 ? (
				<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
					No exercises yet. Add the first one.
				</p>
			) : (
				<ul className="flex flex-col gap-4">{rows}</ul>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<ExercisePicker
					onPick={add}
					trigger={
						<Button variant="outline">
							<PlusIcon aria-hidden="true" />
							Add exercise
						</Button>
					}
				/>
				{routine && (
					<Button
						className="ml-auto"
						disabled={remove.isPending}
						onClick={() => remove.mutate({ id })}
						variant="destructive"
					>
						<TrashIcon aria-hidden="true" />
						Delete routine
					</Button>
				)}
			</div>
		</div>
	);
}
