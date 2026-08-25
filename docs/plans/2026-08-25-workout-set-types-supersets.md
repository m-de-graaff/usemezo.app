# Workout sets: blank on add, supersets, warm-up and failure

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Adding an exercise no longer invents sets or numbers, consecutive exercises can be joined into a superset, and a set can be marked as a warm-up or taken to failure.

**Architecture:** Both exercise lists are single `jsonb` documents validated by `packages/api/src/workout-shape.ts`, so all three features are changes to that Zod schema and the components that render it. No SQL migration: every new field is optional and every existing row stays valid, which also means a browser running the old bundle keeps working after this deploys.

**Tech stack:** Zod 4, Drizzle, tRPC 11, Next.js App Router, React 19, Tailwind v4, `@mezo/ui` (shadcn), `node:test` for unit tests, Biome for lint and format.

## Global Constraints

- Weights are stored in kilograms, always. Inputs hold display units and convert on the way out via `toDisplay` / `fromDisplay` from `~/lib/measure`.
- No new dependency. `lucide-react`, `@mezo/ui/dropdown-menu` and the `--chart-1..5` CSS variables are already in the tree.
- Colour is never the only signal: a superset also carries a text label, and a warm-up or failure set also carries a letter.
- No em dashes in prose or copy. Use a full stop or a comma.
- Every touched file stays formatted for Biome (`pnpm biome check --write <paths>`).
- Warm-up sets do not count toward volume or set count. Failure sets count normally.
- Superset membership is only ever between consecutive entries. Ids are re-issued after any list mutation so this stays true rather than being remembered.

---

### Task 1: The stored shape

**Files:**
- Modify: `packages/api/src/workout-shape.ts`
- Test: `packages/api/src/workout-shape.test.ts`

**Interfaces:**
- Produces: `SET_TYPES` and `SetType = "warmup" | "failure"`; `plannedSet` gains optional `reps`, `weightKg`, `type`; `entry` gains optional `supersetId`; `normaliseSupersets<T extends HasSuperset>(exercises: T[]): T[]`; `supersetRuns<T extends HasSuperset>(exercises: T[]): { id: string | undefined; entries: T[] }[]`; `isCounted(set: PlannedSet): boolean`.
- `volumeKg` and `doneSetCount` keep their signatures and change behaviour only for warm-up sets and absent numbers.

- [ ] **Step 1: Write the failing tests**

Append to `packages/api/src/workout-shape.test.ts`:

```ts
test("an exercise can be added with no sets at all", () => {
	const empty = [{ key: "a", exerciseId: "0001", sets: [] }];
	assert.deepEqual(routineExercises.parse(empty), empty);
});

test("a set can carry no numbers yet", () => {
	const blank = [{ key: "a", exerciseId: "0001", sets: [{}] }];
	assert.deepEqual(routineExercises.parse(blank), blank);
});

test("warm-up sets are logged but count for nothing", () => {
	const session = [
		{
			key: "a",
			exerciseId: "0001",
			sets: [
				{ reps: 10, weightKg: 20, done: true, type: "warmup" as const },
				{ reps: 5, weightKg: 100, done: true, type: "failure" as const },
			],
		},
	];
	assert.equal(volumeKg(session), 500);
	assert.equal(doneSetCount(session), 1);
});

test("a set with no numbers contributes no volume", () => {
	assert.equal(
		volumeKg([{ key: "a", exerciseId: "0001", sets: [{ done: true }] }]),
		0,
	);
});

test("superset ids are re-issued per consecutive run", () => {
	const joined = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b", supersetId: "x" },
		{ key: "c", supersetId: "x" },
	]);
	// One run, one id, all three still together.
	assert.equal(new Set(joined.map((entry) => entry.supersetId)).size, 1);

	// A gap in the middle splits the run in two, and the halves must not share an id.
	const split = normaliseSupersets([
		{ key: "a", supersetId: "x" },
		{ key: "b" },
		{ key: "c", supersetId: "x" },
		{ key: "d", supersetId: "x" },
	]);
	assert.equal(split[0]?.supersetId, undefined, "a run of one is not a superset");
	assert.equal(split[1]?.supersetId, undefined);
	assert.equal(split[2]?.supersetId, split[3]?.supersetId);
	assert.notEqual(split[2]?.supersetId, "x");
});

test("runs group consecutive members and nothing else", () => {
	const runs = supersetRuns([
		{ key: "a" },
		{ key: "b", supersetId: "x" },
		{ key: "c", supersetId: "x" },
		{ key: "d" },
	]);
	assert.deepEqual(
		runs.map((run) => run.entries.map((entry) => entry.key)),
		[["a"], ["b", "c"], ["d"]],
	);
});

test("a session started from a routine keeps set types and supersets", () => {
	const session = startFromRoutine([
		{
			key: "a",
			exerciseId: "0001",
			supersetId: "x",
			sets: [{ reps: 10, weightKg: 20, type: "warmup" }],
		},
		{ key: "b", exerciseId: "0002", supersetId: "x", sets: [] },
	]);
	assert.equal(session[0]?.supersetId, "x");
	assert.equal(session[0]?.sets[0]?.type, "warmup");
	assert.deepEqual(toRoutineExercises(session)[0]?.sets, [
		{ reps: 10, weightKg: 20, type: "warmup" },
	]);
});
```

Update the existing `"a routine rejects impossible numbers"` test: delete its third `assert.throws`, the one asserting an entry with `sets: []` is rejected. That is now the opening state of every added exercise. Add `normaliseSupersets` and `supersetRuns` to the import list at the top of the file.

- [ ] **Step 2: Run them, confirm they fail**

Run: `pnpm --filter @mezo/api test`
Expect: FAIL. `normaliseSupersets is not a function`, and the empty-sets and warm-up cases throwing or returning the old totals.

- [ ] **Step 3: Change the shape**

In `packages/api/src/workout-shape.ts`, replace `plannedSet`, `entry`, `routineExercise`, `workoutExercise` and the two totals:

```ts
/**
 * What a set is, when it is not a working set.
 *
 * Mutually exclusive rather than two flags: a warm-up carried to failure is not
 * a thing anyone logs, and one field is one control on screen instead of two.
 */
export const SET_TYPES = ["warmup", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

const plannedSet = z.object({
	/** Absent until somebody types one. A blank box is not the same claim as zero reps. */
	reps: z.number().int().min(0).max(REPS_MAX).optional(),
	/** Kilograms, always. 0 is a bodyweight set; absent is an unanswered one. */
	weightKg: z.number().min(0).max(WEIGHT_MAX_KG).optional(),
	/** Absent is a working set, which is almost all of them. */
	type: z.enum(SET_TYPES).optional(),
});

const entry = {
	key: z.string().min(1).max(32),
	exerciseId: z.string().min(1).max(32),
	note: z.string().max(500).optional(),
	restSec: z.number().int().min(0).max(3600).optional(),
	/**
	 * Shared by consecutive entries trained back to back. Held per entry rather
	 * than as a list of groups so that a reorder cannot leave a group pointing at
	 * a position that has moved. `normaliseSupersets` re-issues these after every
	 * mutation, which is what keeps a group contiguous.
	 */
	supersetId: z.string().min(1).max(32).optional(),
};

export const routineExercise = z.object({
	...entry,
	// No minimum. An exercise you have just added has no sets yet, and inventing
	// three of ten reps is the guess this whole change exists to stop making.
	sets: z.array(plannedSet).max(SETS_MAX),
});
```

Apply the same `.max(SETS_MAX)` with no `.min(1)` to `workoutExercise`.

Then the arithmetic:

```ts
/** A warm-up is training, not tonnage. It is logged and it counts for nothing. */
export const isCounted = (set: { type?: SetType }) => set.type !== "warmup";

export const volumeKg = (exercises: WorkoutExercise[]) =>
	Math.round(
		exercises.reduce(
			(total, exercise) =>
				total +
				exercise.sets.reduce(
					(sum, set) =>
						sum +
						(set.done && isCounted(set)
							? (set.reps ?? 0) * (set.weightKg ?? 0)
							: 0),
					0,
				),
			0,
		),
	);

export const doneSetCount = (exercises: WorkoutExercise[]) =>
	exercises.reduce(
		(total, exercise) =>
			total + exercise.sets.filter((set) => set.done && isCounted(set)).length,
		0,
	);
```

Add the two superset helpers at the end of the file:

```ts
type HasSuperset = { supersetId?: string };

/**
 * Consecutive entries that share a `supersetId`, in list order.
 *
 * Everything else comes back as a run of one, so a caller renders one loop
 * rather than branching on whether an entry is grouped.
 */
export function supersetRuns<T extends HasSuperset>(exercises: T[]) {
	const runs: { id: string | undefined; entries: T[] }[] = [];
	for (const exercise of exercises) {
		const last = runs.at(-1);
		if (last && exercise.supersetId && last.id === exercise.supersetId) {
			last.entries.push(exercise);
		} else {
			runs.push({ id: exercise.supersetId, entries: [exercise] });
		}
	}
	return runs;
}

/**
 * Re-issue every `supersetId` from the runs actually on screen.
 *
 * Run after any reorder, removal or join. Two members separated by a third
 * exercise are two groups that happen to share a stale id, and a member left on
 * its own is not a superset at all. Deriving the ids from position rather than
 * patching them per mutation makes every one of those the same case.
 */
export function normaliseSupersets<T extends HasSuperset>(exercises: T[]): T[] {
	return supersetRuns(exercises).flatMap((run) => {
		if (run.entries.length < 2 || !run.id) {
			return run.entries.map((entry) =>
				entry.supersetId === undefined
					? entry
					: { ...entry, supersetId: undefined },
			);
		}
		const id = newKey();
		return run.entries.map((entry) => ({ ...entry, supersetId: id }));
	});
}
```

`startFromRoutine` and `toRoutineExercises` need no change: both spread the entry, so `supersetId` and `type` ride along already. The new test asserts that rather than assuming it.

- [ ] **Step 4: Run them, confirm they pass**

Run: `pnpm --filter @mezo/api test && pnpm --filter @mezo/api typecheck`

- [ ] **Step 5: Commit**

`feat(api): optional set numbers, set types, and superset ids`

---

### Task 2: The set grid

**Files:**
- Modify: `apps/nextjs/src/components/workouts/set-rows.tsx`

**Interfaces:**
- Consumes: `SET_TYPES`, `SetType`, `isCounted` from `@mezo/api/workout-shape`; `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from `@mezo/ui/dropdown-menu`.
- Produces: `SetRows` keeps its props. `Stepper` takes `value: number | undefined` and gains `onClear: () => void`.

- [ ] **Step 1: Blank inputs**

Change `Stepper` to accept `value: number | undefined` and render an empty box for `undefined`:

```tsx
<Input
	aria-label={label}
	className="min-w-0 text-center tabular-nums"
	inputMode={integer ? "numeric" : "decimal"}
	onChange={(event) => {
		// An empty box stays empty. Coercing it to 0 would put a number in the
		// document that nobody typed, which is the thing this screen stopped doing.
		if (event.target.value === "") return onClear();
		const next = Number(event.target.value);
		if (!Number.isNaN(next)) onChange(clamp(next));
	}}
	placeholder="0"
	value={value === undefined ? "" : String(value)}
/>
```

The buttons step from zero: `onChange(clamp((value ?? 0) - step))` and `onChange(clamp((value ?? 0) + step))`.

In `SetRows`, `patch` takes `number | undefined`:

```tsx
const patch = (
	index: number,
	field: "reps" | "weightKg",
	value: number | undefined,
) =>
	onChange(
		sets.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
	);
```

and the weight cell converts only when there is something to convert:

```tsx
<Stepper
	label={`Set ${index + 1} weight for ${exerciseName}, in ${unit}`}
	onChange={(value) => patch(index, "weightKg", fromDisplay(value, "mass", system))}
	onClear={() => patch(index, "weightKg", undefined)}
	step={step}
	value={
		set.weightKg === undefined
			? undefined
			: toDisplay(set.weightKg, "mass", system)
	}
/>
```

The reps cell gets `onClear={() => patch(index, "reps", undefined)}` and passes `set.reps` straight through.

- [ ] **Step 2: A new set copies numbers, not intent**

```tsx
// A new set copies the last one's numbers, because the second set of an
// exercise is almost always the first set again. It does not copy the type: a
// set added after a warm-up is a working set, not another warm-up.
const addSet = () => {
	const last = sets.at(-1);
	onChange([
		...sets,
		{
			reps: last?.reps,
			weightKg: last?.weightKg,
			...(onToggle ? { done: false } : {}),
		} as T,
	]);
};
```

- [ ] **Step 3: The set type control**

Widen the first grid column so the trigger is a real target:

```tsx
const columns = onToggle
	? "2.25rem minmax(0,1fr) minmax(0,1fr) 1.75rem"
	: "2.25rem minmax(0,1fr) minmax(0,1fr)";
```

Add above the component:

```tsx
/**
 * What each set type shows in the number column, and what it is called.
 *
 * The letter is the signal and the colour is decoration, so a warm-up is still
 * a warm-up in greyscale and to a screen reader (SC 1.4.1).
 */
const SET_TYPE = {
	warmup: {
		className: "text-amber-600 dark:text-amber-500",
		label: "Warm-up",
		letter: "W",
	},
	failure: { className: "text-destructive", label: "Failure", letter: "F" },
} as const satisfies Record<
	SetType,
	{ className: string; label: string; letter: string }
>;

/**
 * Working sets are numbered 1, 2, 3 among themselves. A warm-up sitting first
 * must not push the first working set to "2": that is the number the lifter is
 * counting, and the one their last session is compared against.
 */
const workingNumber = (sets: { type?: SetType }[], index: number) =>
	sets.slice(0, index + 1).filter(isCounted).length;
```

Replace the `<span>{index + 1}</span>` cell with:

```tsx
<DropdownMenu>
	<DropdownMenuTrigger
		aria-label={`Set ${index + 1} of ${exerciseName} is ${
			set.type ? SET_TYPE[set.type].label : "a working set"
		}. Change its type.`}
		className={cn(
			"flex h-7 w-8 items-center justify-center rounded-md font-medium text-sm tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
			set.type ? SET_TYPE[set.type].className : "text-muted-foreground",
			done && !set.type && "text-foreground",
		)}
		type="button"
	>
		{set.type ? SET_TYPE[set.type].letter : workingNumber(sets, index)}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start">
		<DropdownMenuItem onSelect={() => patchType(index, undefined)}>
			Working set
		</DropdownMenuItem>
		{SET_TYPES.map((type) => (
			<DropdownMenuItem key={type} onSelect={() => patchType(index, type)}>
				{SET_TYPE[type].label}
			</DropdownMenuItem>
		))}
	</DropdownMenuContent>
</DropdownMenu>
```

with, in the component body:

```tsx
const patchType = (index: number, type: SetType | undefined) =>
	onChange(sets.map((set, i) => (i === index ? { ...set, type } : set)));
```

Update the header cell from `<span>#</span>` to `<span>Set</span>`. Keep the `sr-only` labels on the checkbox and the aria-labels on the steppers as they are.

- [ ] **Step 4: Check it renders**

Run: `pnpm --filter @mezo/nextjs typecheck`, then load `/workouts/routines/new` in the dev server and confirm: an added exercise shows no set rows, "Add set" gives a row with two empty boxes, and the number cell opens a three-item menu whose choice changes the letter.

- [ ] **Step 5: Commit**

`feat(nextjs): blank set inputs and a warm-up or failure type per set`

---

### Task 3: Supersets in the routine builder

**Files:**
- Create: `apps/nextjs/src/components/workouts/superset.tsx`
- Modify: `apps/nextjs/src/components/workouts/routine-builder.tsx`

**Interfaces:**
- Produces: `SupersetGroup({ children, index, size })` and `supersetLabel(index): string` from `~/components/workouts/superset`, used by the builder, the live session and history.
- Consumes: `newKey`, `normaliseSupersets`, `supersetRuns` from `@mezo/api/workout-shape`.

- [ ] **Step 1: The group wrapper**

Create `apps/nextjs/src/components/workouts/superset.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The frame around exercises trained back to back.
 *
 * A tinted rail down the left is the signal people recognise from every other
 * training app, and the heading above it is what makes the grouping survive
 * greyscale, a colour vision deficiency, and a screen reader (SC 1.4.1). The
 * palette is the chart variables, so it is already tuned for both themes.
 */
const RAIL = [
	"border-l-[var(--chart-1)]",
	"border-l-[var(--chart-2)]",
	"border-l-[var(--chart-3)]",
	"border-l-[var(--chart-4)]",
	"border-l-[var(--chart-5)]",
] as const;

/** A, B, C. Enough for any session, and it wraps rather than running out. */
export const supersetLabel = (index: number) =>
	String.fromCharCode(65 + (index % 26));

export function SupersetGroup({
	children,
	index,
	size,
}: {
	children: ReactNode;
	/** Which superset this is within the list, counted from zero. */
	index: number;
	size: number;
}) {
	return (
		<li>
			<section
				aria-label={`Superset ${supersetLabel(index)}, ${size} exercises`}
				className={`flex flex-col gap-2 border-l-4 pl-3 ${RAIL[index % RAIL.length]}`}
			>
				<h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Superset {supersetLabel(index)}
				</h2>
				<ul className="flex flex-col gap-2">{children}</ul>
			</section>
		</li>
	);
}
```

- [ ] **Step 2: Join and leave**

In `routine-builder.tsx`, add beside `move` and `drop`:

```tsx
// Joining is always with the exercise above, because a superset is exercises
// done back to back and that is the only pair a flat list can express. The
// button is absent on the first row for the same reason.
const toggleSuperset = (index: number) =>
	setExercises((current) => {
		const entry = current[index];
		const previous = current[index - 1];
		if (!entry || !previous) return current;
		const joined =
			entry.supersetId !== undefined && entry.supersetId === previous.supersetId;
		const id = joined ? undefined : (previous.supersetId ?? newKey());
		return normaliseSupersets(
			current.map((item, i) => {
				if (i === index) return { ...item, supersetId: id };
				if (i === index - 1 && !joined) return { ...item, supersetId: id };
				return item;
			}),
		);
	});
```

Wrap `move` and `drop` in `normaliseSupersets` so a reorder or a deletion can never strand a group:

```tsx
const drop = (key: string) =>
	setExercises((current) =>
		normaliseSupersets(current.filter((entry) => entry.key !== key)),
	);
```

and in `move`, the final line becomes `return normaliseSupersets(next);`.

- [ ] **Step 3: Add with no sets, and render by run**

`DEFAULT_SETS`, `DEFAULT_REPS`, `DEFAULT_WEIGHT_KG` and their comment are deleted. `add` becomes:

```tsx
const add = (exercise: Exercise) =>
	setExercises((current) => [
		...current,
		// No sets. What you are about to lift is not something this screen knows,
		// and three sets of ten at twenty kilos is a number the lifter has to
		// correct rather than one that helps.
		{ key: newKey(), exerciseId: exercise.id, sets: [] },
	]);
```

Lift the existing `<li>` into a `card(entry, index)` function in the component body, unchanged except for one more button before the trash:

```tsx
<Button
	aria-label={
		exercises[index - 1]?.supersetId !== undefined &&
		exercises[index - 1]?.supersetId === entry.supersetId
			? `Take ${label} out of its superset`
			: `Superset ${label} with the exercise above`
	}
	disabled={index === 0}
	onClick={() => toggleSuperset(index)}
	size="icon-sm"
	variant="ghost"
>
	<Link2Icon aria-hidden="true" />
</Button>
```

Then replace the `<ul>` body. The runs come from the shape helper, and the index within the flat list is still what `move` and `toggleSuperset` need, so it is tracked across runs:

```tsx
<ul className="flex flex-col gap-4">
	{(() => {
		let flat = -1;
		let group = -1;
		return supersetRuns(exercises).map((run) => {
			const cards = run.entries.map((entry) => {
				flat += 1;
				return card(entry, flat);
			});
			if (run.entries.length < 2) return cards;
			group += 1;
			return (
				<SupersetGroup index={group} key={run.id} size={run.entries.length}>
					{cards}
				</SupersetGroup>
			);
		});
	})()}
</ul>
```

Import `Link2Icon` from `lucide-react`, `newKey`, `normaliseSupersets` and `supersetRuns` from `@mezo/api/workout-shape`, and `SupersetGroup` from `~/components/workouts/superset`.

- [ ] **Step 4: Check it**

Run: `pnpm --filter @mezo/nextjs typecheck`. Then in the dev server build a routine of four exercises, superset the second into the first, confirm the pair renders inside one labelled rail, move the third above the pair and confirm the pair stays a pair, then delete one member and confirm the other loses its rail.

- [ ] **Step 5: Commit**

`feat(nextjs): supersets in the routine builder, and no invented sets on add`

---

### Task 4: Supersets in the live session

**Files:**
- Modify: `apps/nextjs/src/components/workouts/live-workout.tsx`

**Interfaces:**
- Consumes: `SupersetGroup` from `~/components/workouts/superset`; `newKey`, `normaliseSupersets`, `supersetRuns` from `@mezo/api/workout-shape`.

- [ ] **Step 1: The same three changes, one screen along**

`add` starts empty:

```tsx
const add = (exercise: Exercise) =>
	setExercises((current) => [
		...current,
		{ key: newKey(), exerciseId: exercise.id, sets: [] },
	]);
```

`drop` normalises:

```tsx
const drop = (key: string) =>
	setExercises((current) =>
		normaliseSupersets(current.filter((entry) => entry.key !== key)),
	);
```

Add the same `toggleSuperset` as Task 3 Step 2, verbatim. The live screen has no reorder buttons, so there is no `move` to normalise.

- [ ] **Step 2: Render by run**

Lift the existing `<li>` into a `card(entry, index)` function and replace the `<ul>` body with the same run loop as Task 3 Step 3. Add the same superset `Button` to the card's header row, before the trash button, with the same `aria-label` logic.

Autosave needs no change: it already fires on any `exercises` change, and `supersetId` is part of the document `workoutExercises` validates.

- [ ] **Step 3: Check it**

Run: `pnpm --filter @mezo/nextjs typecheck`. Then start a workout, add two exercises, superset them, wait for the autosave and reload the page, and confirm the group came back from the server rather than only living in client state.

- [ ] **Step 4: Commit**

`feat(nextjs): supersets and empty exercises in a live session`

---

### Task 5: What history shows

**Files:**
- Modify: `apps/nextjs/src/components/workouts/finished-workout.tsx`

**Interfaces:**
- Consumes: `supersetRuns` from `@mezo/api/workout-shape`; `supersetLabel` from `~/components/workouts/superset`.

- [ ] **Step 1: Set lines that say what the set was**

Replace the set summary line so a warm-up and a set to failure are legible, and an absent number does not read as a lie:

```tsx
<p className="text-muted-foreground text-sm tabular-nums">
	{entry.sets
		.map((set) => {
			const weight =
				set.weightKg === undefined
					? "-"
					: `${toDisplay(set.weightKg, "mass", system)} ${unit}`;
			const line = `${weight} x ${set.reps ?? "-"}`;
			// Spelled out rather than the W and F of the logging screen. This is
			// prose being read back, not a control being operated.
			if (set.type === "warmup") return `${line} warm-up`;
			if (set.type === "failure") return `${line} to failure`;
			return line;
		})
		.join(", ")}
</p>
```

- [ ] **Step 2: Say which exercises were paired**

A finished session is read-only, so it needs the fact rather than the frame. Iterate with `supersetRuns(workout.exercises)`, keeping a `group` counter, and render above the exercise name when the entry is in a run of two or more:

```tsx
{run.entries.length > 1 && (
	<p className="text-muted-foreground text-xs uppercase tracking-wide">
		Superset {supersetLabel(group)}
	</p>
)}
```

- [ ] **Step 3: Check it**

Finish a session containing a warm-up, a failure set and a superset, then open it from `/workouts/history` and read the summary back.

- [ ] **Step 4: Commit**

`feat(nextjs): show warm-ups, failure sets and supersets in history`

---

### Task 6: Verify the whole thing

**Files:** none

- [ ] **Step 1: The suites**

Run: `pnpm test` and `pnpm typecheck` from the repo root. Expect both green.

- [ ] **Step 2: Lint and format**

Run: `pnpm biome check --write packages/api/src apps/nextjs/src/components/workouts`

- [ ] **Step 3: The one path that spans everything**

In the dev server: build a routine with a superset and a warm-up set, start it, tick every set including the warm-up, finish, and confirm the summary's volume and set count exclude the warm-up while the history entry still lists it.

- [ ] **Step 4: Commit**

`chore: format and verify the workout set changes`

---

## Open questions

- **Milo cannot propose warm-ups or supersets.** `apps/nextjs/src/lib/routine-proposal.ts` still emits plain working sets, which stay valid under the new schema. Extending its tool schema is a separate change and is deliberately not in this plan.
- **Drop sets and RPE** exist in Hevy and are not here. `SET_TYPES` is the one place a third type would be added.
