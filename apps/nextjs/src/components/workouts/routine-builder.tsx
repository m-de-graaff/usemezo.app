"use client";

import { type Exercise, exerciseById } from "@mezo/api/exercises";
import {
	estimatedSec,
	insertIntoSuperset,
	moveExerciseNextTo,
	moveIntoSuperset,
	newKey,
	normaliseSupersets,
	type RoutineExercise,
	setCount,
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
import { ExerciseInfo } from "~/components/workouts/exercise-info";
import { ExercisePicker } from "~/components/workouts/exercise-picker";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { NoteField } from "~/components/workouts/note-field";
import { RestFields } from "~/components/workouts/rest-fields";
import { SetRows } from "~/components/workouts/set-rows";
import { Stats } from "~/components/workouts/stats";
import { formatDuration } from "~/components/workouts/summary";
import {
	DragHandle,
	Reorderable,
	SupersetDropZone,
	SupersetGroup,
	supersetLabel,
} from "~/components/workouts/superset";
import { VolumeSummary } from "~/components/workouts/volume-summary";
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
	onCancel,
	onSaved,
	routine,
}: {
	id: string;
	/**
	 * Given when the builder is a mode of the routine screen rather than the
	 * whole of it. Without them a save leaves for the list, which is still what
	 * a routine created from nothing does.
	 */
	onCancel?: () => void;
	onSaved?: (saved: {
		name: string;
		note: string | null;
		exercises: RoutineExercise[];
	}) => void;
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
	const [note, setNote] = useState(routine?.note ?? undefined);
	const [exercises, setExercises] = useState<RoutineExercise[]>(
		routine?.exercises ?? [],
	);

	const done = () => {
		router.push("/workouts");
		router.refresh();
	};

	const save = api.workout.saveRoutine.useMutation({
		// What was sent, not what came back: the server returns the id and nothing
		// else, and this is the same document it just validated.
		onSuccess: (_result, sent) => {
			toast.success("Routine saved.");
			if (onSaved) {
				onSaved({
					name: sent.name,
					note: sent.note ?? null,
					exercises: sent.exercises,
				});
				return;
			}
			done();
		},
		onError: (error) => toast.error(error.message),
	});

	const utils = api.useUtils();
	// The setting lives on the profile, not the routine: one answer for every
	// routine there is. This is a second door onto it, not a second copy.
	const overload = profile.data?.progressiveOverload ?? false;
	const setOverload = api.profile.update.useMutation({
		// Written straight into the cache so the box moves when it is clicked;
		// a failed write puts the server's answer back.
		onMutate: ({ progressiveOverload }) => {
			utils.profile.get.setData(undefined, (current) =>
				current ? { ...current, progressiveOverload } : current,
			);
		},
		onError: (error) => {
			toast.error(error.message);
			void utils.profile.get.invalidate();
		},
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

	const patch = (key: string, sets: RoutineExercise["sets"]) =>
		setExercises((current) =>
			current.map((entry) => (entry.key === key ? { ...entry, sets } : entry)),
		);

	/** Anything on the entry that is not its sets: the rest timers, for now. */
	const patchEntry = (key: string, fields: Partial<RoutineExercise>) =>
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
			normaliseSupersets(current.filter((entry) => entry.key !== key)),
		);

	/** One exercise, at its position in the flat list, which is what the buttons act on. */
	const card = (entry: RoutineExercise, index: number) => {
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
					{/* Only on the movements whose weight column means something other
					    than what it says. It renders nothing for the rest. */}
					<ExerciseInfo exerciseId={entry.exerciseId} />
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
				<NoteField
					className="mb-3"
					label={`Note on ${label}`}
					maxLength={200}
					onChange={(text) => patchEntry(entry.key, { note: text })}
					placeholder="Cue, substitution, rep range"
					rows={1}
					value={entry.note}
				/>
				<SetRows
					exerciseName={label}
					onChange={(sets) => patch(entry.key, sets)}
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
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
					onClick={() =>
						save.mutate({
							id,
							name: name.trim(),
							// Always sent. Left out, it saves as null, which is how
							// editing a routine Milo wrote used to erase its note.
							note: note ?? null,
							exercises,
						})
					}
					size="lg"
				>
					{save.isPending ? "Saving…" : "Save routine"}
				</Button>
				{onCancel && (
					<Button onClick={onCancel} size="lg" variant="ghost">
						Cancel
					</Button>
				)}
			</div>

			<NoteField
				label="Routine note"
				onChange={setNote}
				placeholder="What this session is for, and how to progress it"
				value={note}
			/>

			<label className="flex items-start gap-2.5 text-sm">
				<input
					checked={overload}
					className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
					disabled={profile.isPending}
					onChange={(event) =>
						setOverload.mutate({ progressiveOverload: event.target.checked })
					}
					type="checkbox"
				/>
				<span className="text-pretty">
					Automatic progressive overload
					<span className="block text-muted-foreground text-xs">
						{overload
							? "Weights are raised from your own history when you start any routine."
							: "Every routine starts with the weights you wrote down."}
					</span>
				</span>
			</label>

			{exercises.length > 0 && (
				<Stats
					items={[
						{ label: "Exercises", value: exercises.length },
						{ label: "Sets", value: setCount(exercises) },
						// Rest is most of a session, so a routine that looks like six
						// exercises is an hour. Better to find that out here than at the
						// gym with somewhere to be.
						{
							label: "Estimated",
							value: `~${formatDuration(estimatedSec(exercises))}`,
						},
					]}
				/>
			)}

			{/* The body sits beside the exercises so the two are read together: a
			    slot you are still filling and the shoulder that is already amber
			    are one thought, and a summary you have to scroll back to is not.
			    It is DOM-first so that on a narrow screen it lands above the list
			    rather than six exercises below it, and ordered last from `lg` so
			    it reads as a rail. Nothing in it is focusable, so moving it does
			    not move anything in the tab order. */}
			{/* No `items-start`: the rail has to stretch to the row's height or the
			    sticky card inside it has nowhere to travel and scrolls away. */}
			<div className="flex flex-col gap-6 lg:flex-row">
				{exercises.length > 0 && (
					<aside className="lg:order-last lg:w-60 lg:shrink-0">
						{/* Sticky, so it is still answering the question while you are
						    forty exercises down. `top-18` is the app header's own `h-14`
						    plus the page's gap: the header is sticky too, and anything
						    that stops short of it gets its own top sliced off (SC 2.4.11,
						    though nothing in here is focusable). */}
						<div className="rounded-xl border bg-card p-4 lg:sticky lg:top-18">
							<VolumeSummary
								exercises={exercises.map((entry) => ({
									exerciseId: entry.exerciseId,
									// Warm-ups are training, not volume, exactly as they are
									// everywhere else the app counts a set.
									sets: entry.sets.filter((set) => set.type !== "warmup")
										.length,
								}))}
							/>
						</div>
					</aside>
				)}

				<div className="flex min-w-0 flex-1 flex-col gap-6">
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
			</div>
		</div>
	);
}
