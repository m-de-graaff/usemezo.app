"use client";

import { type Exercise, exerciseById } from "@mezo/api/exercises";
import { checkSet } from "@mezo/api/plausibility";
import type { StrengthProfile } from "@mezo/api/strength";
import {
	doneSetCount,
	estimatedSec,
	insertIntoSuperset,
	moveExerciseNextTo,
	moveIntoSuperset,
	newKey,
	normaliseSupersets,
	recordSetIndex,
	restAfterSet,
	setVolumeKg,
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
import { ExerciseInfo } from "~/components/workouts/exercise-info";
import { ExercisePicker } from "~/components/workouts/exercise-picker";
import { ExerciseThumb } from "~/components/workouts/exercise-thumb";
import { NoteField } from "~/components/workouts/note-field";
import { RestFields } from "~/components/workouts/rest-fields";
import { type Rest, RestTimer } from "~/components/workouts/rest-timer";
import { SetRows } from "~/components/workouts/set-rows";
import { Stats } from "~/components/workouts/stats";
import { formatDuration, formatVolume } from "~/components/workouts/summary";
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
	profile,
	units,
	workout,
}: {
	/**
	 * Bodyweight, sex, age and experience, for the plausibility check and
	 * nothing else. Every field is optional and most people have filled in some
	 * of them: the check reads what is there and stays quiet about the rest.
	 */
	profile: StrengthProfile;
	units: string | null | undefined;
	workout: {
		id: string;
		name: string;
		note: string | null;
		startedAt: Date;
		exercises: WorkoutExercise[];
	};
}) {
	const router = useRouter();
	const system = unitSystem(units);
	const [exercises, setExercises] = useState(workout.exercises);
	// Separate state from the exercises, because it is a separate write: the note
	// changing must schedule a save without pretending the set list changed.
	const [note, setNote] = useState(workout.note ?? undefined);
	// The rest countdown, or nothing between sets. Not part of the document: a
	// timer is where you are in the session, not what the session was.
	const [rest, setRest] = useState<Rest | null>(null);

	// What every exercise on screen did before today: last time's sets, and the
	// best a single set has ever moved. Read once and left alone for the rest of
	// the session: the record a set is measured against is the one that stood
	// when the session opened, and refetching it mid-workout would take the medal
	// back off the set that had just beaten it.
	const history = api.workout.exerciseHistory.useQuery(undefined, {
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: Number.POSITIVE_INFINITY,
	});

	/**
	 * What this exercise did before today, or null while the query is in flight.
	 *
	 * The null matters. An exercise with no history and an exercise whose history
	 * has not arrived both have no record, and treating the second as a record of
	 * zero would put a medal on the first set of every exercise on the screen.
	 */
	const before = (exerciseId: string) =>
		history.data
			? (history.data[exerciseId] ?? {
					bestSetKg: 0,
					bestOneRepMaxKg: 0,
					previous: [],
					previousAt: null,
				})
			: null;

	const leave = () => {
		router.push("/workouts");
		router.refresh();
	};

	const log = api.workout.log.useMutation({
		onError: (error) => toast.error(error.message),
	});
	const finish = api.workout.finish.useMutation({
		onSuccess: ({ flagged, setCount }) => {
			toast.success(
				setCount
					? `${setCount} ${setCount === 1 ? "set" : "sets"} logged.`
					: "Workout saved, nothing logged.",
				// Said rather than done quietly. A set left out of the records with
				// no explanation is a bug report; a sentence pointing at the session
				// is somebody two taps from putting it back.
				flagged
					? {
							description: `${flagged} ${flagged === 1 ? "set is" : "sets are"} not counting toward records. Open the session to confirm ${flagged === 1 ? "it" : "them"}.`,
						}
					: undefined,
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
			logRef.current.mutate({ id: workout.id, note: note ?? null, exercises });
		}, AUTOSAVE_MS);
		return () => clearTimeout(id);
	}, [exercises, note, workout.id]);

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

	/**
	 * Tick a set off, and everything that follows from having done so.
	 *
	 * The rest timer and the record check are here rather than in an effect
	 * watching `exercises` because they belong to the act of finishing a set, not
	 * to the list having a different shape. An effect would restart the clock
	 * when a weight was corrected afterwards, and hand out a second medal for the
	 * same set.
	 *
	 * Both only fire on the way in. Unticking a set is a correction, and a
	 * correction should not start a countdown.
	 */
	const toggle = (key: string, index: number) => {
		const entry = exercises.find((item) => item.key === key);
		const set = entry?.sets[index];

		setExercises((current) =>
			current.map((item) =>
				item.key === key
					? {
							...item,
							sets: item.sets.map((each, i) =>
								i === index ? { ...each, done: !each.done } : each,
							),
						}
					: item,
			),
		);

		if (!entry || !set || set.done) return;

		const seconds = restAfterSet(exercises, key, index);
		if (seconds) {
			setRest({
				endsAt: Date.now() + seconds * 1000,
				label: exerciseById(entry.exerciseId)?.name ?? "that set",
				totalSec: seconds,
			});
		}

		// Against the sets as they are about to be, so the set just ticked is in
		// the running. `recordSetIndex` picking it is the whole test: it beat the
		// old record and everything else done in this session.
		const past = before(entry.exerciseId);
		if (past === null) return;

		// Asked before the medal is handed out, because these are the same
		// question from two directions: a set big enough to break a record is the
		// only kind of set worth doubting, and congratulating somebody on a number
		// you are about to ask them about is the worst of both.
		const doubt = checkSet({
			bestOneRepMaxKg: past.bestOneRepMaxKg,
			exerciseId: entry.exerciseId,
			lastDoneAt: past.previousAt,
			profile,
			set,
		});
		if (doubt) {
			toast.warning(doubt.message, {
				action: {
					label: "It's right",
					onClick: () => vouch(key, index),
				},
				// Long enough to read a sentence and decide. Leaving it unanswered is
				// a valid answer: the set is logged either way, and `finish` marks it
				// for the record books without anybody having to do anything.
				duration: 15_000,
			});
			return;
		}

		const next = entry.sets.map((each, i) =>
			i === index ? { ...each, done: true } : each,
		);
		if (recordSetIndex(next, past.bestSetKg) === index) {
			toast.success(
				`Personal record: ${formatVolume(setVolumeKg(set), system)} in one set.`,
				{ icon: "🏅" },
			);
		}
	};

	/**
	 * "It's right", from the prompt.
	 *
	 * Written onto the set rather than kept beside it, so the answer travels with
	 * the autosave and `finish` finds it already there. Nothing else changes: the
	 * set was logged the moment it was ticked, and this is only the difference
	 * between a number that can hold a record and one that cannot.
	 */
	const vouch = (key: string, index: number) =>
		setExercises((current) =>
			current.map((entry) =>
				entry.key === key
					? {
							...entry,
							sets: entry.sets.map((set, i) =>
								i === index ? { ...set, flag: "confirmed" as const } : set,
							),
						}
					: entry,
			),
		);

	/** Anything on the entry that is not its sets: its note and the rest timers. */
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
	// What the sets nobody has ticked yet still cost, rest included. It is the
	// number people are actually asking when they look at a session at set nine:
	// not how long this took, how much longer.
	const remaining = estimatedSec(
		exercises.map((entry) => ({
			...entry,
			sets: entry.sets.filter((set) => !set.done),
		})),
	);

	/** One exercise, at its position in the flat list, which is what the buttons act on. */
	const card = (entry: WorkoutExercise, index: number) => {
		const exercise = exerciseById(entry.exerciseId);
		const label = exercise?.name ?? "this exercise";
		const grouped = entry.supersetId !== undefined;
		const past = before(entry.exerciseId);

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
					placeholder="Cue, substitution, how it felt"
					rows={1}
					value={entry.note}
				/>
				<SetRows
					exerciseName={label}
					onChange={(sets) => patch(entry.key, sets)}
					onToggle={(setIndex) => toggle(entry.key, setIndex)}
					// An empty list rather than nothing while the query is in
					// flight: the column is there either way, so it does not appear a
					// second after the page does and shove every row sideways.
					previous={past?.previous ?? []}
					recordIndex={
						past === null
							? undefined
							: recordSetIndex(entry.sets, past.bestSetKg)
					}
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
		// it, clear of the sticky bar (SC 2.4.11). The bar grows when a rest is
		// running, so the padding has to grow with it.
		<div
			className={`mx-auto flex w-full max-w-3xl flex-col gap-6 ${rest ? "pb-52" : "pb-28"}`}
		>
			<header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 rounded-xl border bg-card p-4">
				<h1 className="font-semibold text-lg tracking-tight">{workout.name}</h1>
				<Stats
					items={[
						{
							label: "Elapsed",
							value: <Elapsed startedAt={workout.startedAt} />,
						},
						{ label: "Sets", value: done },
						{
							label: "Volume",
							value: formatVolume(volumeKg(exercises), system),
						},
						// What is left, not what it will have been. A session already
						// half done should say half an hour, and the clock beside it is
						// what turns that into a finishing time.
						{ label: "Left", value: `~${formatDuration(remaining)}` },
					]}
				/>
				<NoteField
					className="basis-full"
					label="Session note"
					onChange={setNote}
					placeholder="How it went, what to change next time"
					value={note}
				/>
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

			{/* Sticky, so finishing is one tap from anywhere in a long session, and
			    so the rest clock is still on screen after the list has scrolled. */}
			<div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
				{rest && (
					<RestTimer
						onAdjust={(deltaSec) =>
							setRest((current) =>
								current
									? { ...current, endsAt: current.endsAt + deltaSec * 1000 }
									: current,
							)
						}
						onDone={() => setRest(null)}
						rest={rest}
					/>
				)}
				<div className="mx-auto flex max-w-3xl gap-2">
					<Button
						className="flex-1"
						disabled={busy}
						onClick={() => {
							settled.current = true;
							finish.mutate({ id: workout.id, note: note ?? null, exercises });
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
