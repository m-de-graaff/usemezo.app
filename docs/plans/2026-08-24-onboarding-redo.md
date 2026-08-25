# Onboarding Redo — Implementation Plan

> **To execute:** use the `executing-plans` skill. Steps use `- [ ]` for tracking.

**Goal:** Turn first run from eight extraction screens into a short grouped flow that ends by giving the user a computed starting plan.

**Architecture:** `ONBOARDING_PLAN` in `@mezo/api/profile-fields` stops being one field per screen and becomes groups of fields, so related answers are given together. A new pure module, `@mezo/api/plan`, turns a profile into age, BMI, BMR, TDEE, a calorie target and a macro split; it is the only place any health arithmetic lives, and it reports what it could not compute rather than guessing. The flow component renders a welcome screen, the grouped question screens, and a final plan screen that writes the computed calorie target back to the profile.

**Tech stack:** Next.js (see `apps/nextjs/AGENTS.md` — read the bundled docs before writing route or component code), tRPC 11, Drizzle 0.45, Zod 4, Tailwind 4, Base UI, `node:test` with `node:assert/strict`.

## Global Constraints

- Storage stays metric. `heightCm` in centimetres, `weightKg` and `targetWeightKg` in kilograms. `units` is a display preference only.
- No health arithmetic outside `packages/api/src/plan.ts`.
- The plan screen must never present an estimate as medical advice, and must never recommend a calorie target below the clinical floor.
- Every form control needs its own accessible name. Grouped screens can no longer borrow the screen `<h1>`.
- Only `name`, `units` and `username` block progress. Every other question is skippable.
- Answers save per screen, so a closed tab costs one screen at most.
- Migrations are numbered SQL files in `packages/db/migrations`, generated with `pnpm db:generate`.
- Formatting is Biome: tabs, double quotes, sorted props. Run `pnpm check:write` before finishing.

---

### Task 1: Profile columns for the plan inputs

**Files:**
- Modify: `packages/db/src/schema.ts` (the Body block of `userProfile`, around line 328)
- Create: `packages/db/migrations/0006_profile_plan_inputs.sql` (generated)

**Interfaces:**
- Produces: `userProfile.goalDirection` (`text("goal_direction")`), `userProfile.targetWeightKg` (`real("target_weight_kg")`), `userProfile.activityLevel` (`text("activity_level")`). All nullable — an existing user has none of them.

- [ ] **Step 1: Add the three columns**

In the Body block, after `weightKg`:

```ts
/** Where the user wants their weight to go; drives the calorie adjustment. */
goalDirection: text("goal_direction"),
targetWeightKg: real("target_weight_kg"),
/** Daily movement outside training. The TDEE multiplier keys off this. */
activityLevel: text("activity_level"),
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`

Expect: a new `packages/db/migrations/0006_*.sql` holding three `ALTER TABLE "user_profile" ADD COLUMN` statements and nothing else.

- [ ] **Step 3: Confirm the migration is additive only**

Run: `cat packages/db/migrations/0006_*.sql`

Expect: only `ADD COLUMN`. Any `DROP` or `ALTER COLUMN` means the schema drifted and the migration must not be applied — stop and report.

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @mezo/db typecheck`

---

### Task 2: The plan calculation

**Files:**
- Create: `packages/api/src/plan.ts`
- Create: `packages/api/src/plan.test.ts`
- Modify: `packages/api/package.json` (add `"./plan": "./src/plan.ts"` to `exports`)

**Interfaces:**
- Consumes: nothing from Task 1 at the type level; it takes a plain object.
- Produces:

```ts
export type PlanInput = {
  birthDate?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: string | null;
  goalDirection?: string | null;
  targetWeightKg?: number | null;
};

export type Plan =
  | { ok: false; missing: string[] }
  | {
      ok: true;
      age: number;
      bmi: number;
      bmiBand: "underweight" | "healthy" | "overweight" | "obese";
      bmr: number;
      tdee: number;
      calories: number;
      /** True when the target was raised to the safe floor. */
      atFloor: boolean;
      protein: number;
      carbs: number;
      fat: number;
      waterMl: number;
      /** kg per week at the chosen deficit or surplus; 0 when maintaining. */
      paceKgPerWeek: number;
      /** Weeks to `targetWeightKg` at that pace, when a target was given. */
      weeksToTarget: number | null;
    };

export function ageFrom(birthDate: string, today?: Date): number;
export function buildPlan(input: PlanInput, today?: Date): Plan;
export const ACTIVITY_MULTIPLIERS: Record<string, number>;
```

`missing` names the human-readable labels of the inputs that blocked the calculation, in this order: `"your date of birth"`, `"your height"`, `"your weight"`, `"how active you are"`.

- [ ] **Step 1: Write the failing tests**

`packages/api/src/plan.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { ageFrom, buildPlan } from "./plan.ts";

const AT = new Date(2026, 7, 24); // 2026-08-24, local

const BASE = {
	birthDate: "1990-05-04",
	gender: "male",
	heightCm: 180,
	weightKg: 80,
	activityLevel: "moderate",
	goalDirection: "maintain",
};

test("age counts whole years and does not tick over early", () => {
	assert.equal(ageFrom("1990-05-04", AT), 36);
	assert.equal(ageFrom("1990-08-24", AT), 36);
	assert.equal(ageFrom("1990-08-25", AT), 35);
});

test("a plan missing an input says which one rather than guessing", () => {
	const plan = buildPlan({ ...BASE, weightKg: null }, AT);
	assert.equal(plan.ok, false);
	assert.deepEqual(plan.missing, ["your weight"]);
});

test("Mifflin-St Jeor, then the activity multiplier", () => {
	const plan = buildPlan(BASE, AT);
	assert.ok(plan.ok);
	// 10*80 + 6.25*180 - 5*36 + 5 = 1750
	assert.equal(plan.bmr, 1750);
	assert.equal(plan.tdee, Math.round(1750 * 1.55));
	assert.equal(plan.calories, plan.tdee); // maintaining
});

test("gender the model has no constant for uses the midpoint, not male", () => {
	const male = buildPlan(BASE, AT);
	const nb = buildPlan({ ...BASE, gender: "non-binary" }, AT);
	assert.ok(male.ok && nb.ok);
	assert.equal(male.bmr - nb.bmr, 83); // +5 vs -78
});

test("losing weight cuts a share of TDEE, never below the safe floor", () => {
	const plan = buildPlan({ ...BASE, goalDirection: "lose" }, AT);
	assert.ok(plan.ok);
	assert.ok(plan.calories < plan.tdee);
	assert.equal(plan.atFloor, false);

	// Small, sedentary, and losing: the arithmetic wants a dangerous number.
	const tiny = buildPlan(
		{
			...BASE,
			gender: "female",
			heightCm: 150,
			weightKg: 45,
			activityLevel: "sedentary",
			goalDirection: "lose",
		},
		AT,
	);
	assert.ok(tiny.ok);
	assert.equal(tiny.atFloor, true);
	assert.ok(tiny.calories >= 1200);
});

test("macros add up to the calorie target", () => {
	const plan = buildPlan({ ...BASE, goalDirection: "gain" }, AT);
	assert.ok(plan.ok);
	const fromMacros = plan.protein * 4 + plan.carbs * 4 + plan.fat * 9;
	assert.ok(Math.abs(fromMacros - plan.calories) <= 12);
});

test("BMI bands follow WHO cut-offs", () => {
	const band = (weightKg: number) => {
		const plan = buildPlan({ ...BASE, weightKg }, AT);
		assert.ok(plan.ok);
		return plan.bmiBand;
	};
	assert.equal(band(59), "underweight"); // 18.2
	assert.equal(band(70), "healthy"); // 21.6
	assert.equal(band(85), "overweight"); // 26.2
	assert.equal(band(100), "obese"); // 30.9
});

test("a weight target becomes a pace and a number of weeks", () => {
	const plan = buildPlan(
		{ ...BASE, goalDirection: "lose", targetWeightKg: 72 },
		AT,
	);
	assert.ok(plan.ok);
	assert.ok(plan.paceKgPerWeek > 0);
	assert.ok(plan.weeksToTarget !== null && plan.weeksToTarget > 0);
});

test("maintaining has no pace and no finish line", () => {
	const plan = buildPlan(BASE, AT);
	assert.ok(plan.ok);
	assert.equal(plan.paceKgPerWeek, 0);
	assert.equal(plan.weeksToTarget, null);
});
```

- [ ] **Step 2: Run them, confirm they fail**

Run: `pnpm -F @mezo/api test`

Expect: FAIL, `Cannot find module './plan.ts'`.

- [ ] **Step 3: Implement `plan.ts`**

The constants, fixed here so no other file re-derives them:

- `ACTIVITY_MULTIPLIERS`: `sedentary` 1.2, `light` 1.375, `moderate` 1.55, `active` 1.725, `very-active` 1.9.
- Mifflin-St Jeor: `10 * kg + 6.25 * cm - 5 * age + c`, where `c` is `+5` for `male`, `-161` for `female`, and `-78` (their midpoint) for every other or absent answer.
- Calorie adjustment: `lose` is −20% of TDEE, `gain` is +12%, `maintain` is 0.
- Floor: `Math.max(target, bmr, gender === "male" ? 1500 : 1200)`, rounded. `atFloor` is true when that raised the number.
- Protein: `2.0 g/kg` losing, `1.8` gaining, `1.6` maintaining, on current weight.
- Fat: 25% of the calorie target, at 9 kcal/g. Carbs: whatever is left, at 4 kcal/g, never below 0.
- Water: `35 ml/kg`, rounded to the nearest 50 ml.
- Pace: `(tdee - calories) * 7 / 7700` kg per week, as a positive magnitude. 7700 kcal is roughly 1 kg of body mass.
- `weeksToTarget`: `|weightKg - targetWeightKg| / paceKgPerWeek`, rounded up; `null` when there is no target, no pace, or the target is already met.

Round `bmr`, `tdee`, `calories`, `protein`, `carbs`, `fat` to whole numbers, `bmi` to one decimal, `paceKgPerWeek` to two.

- [ ] **Step 4: Run them, confirm they pass**

Run: `pnpm -F @mezo/api test`

- [ ] **Step 5: Export the module**

Add `"./plan": "./src/plan.ts"` to `exports` in `packages/api/package.json`, keeping the keys sorted.

Run: `pnpm -F @mezo/api typecheck`

---

### Task 3: Questions grouped into screens

**Files:**
- Modify: `packages/api/src/profile-fields.ts` (new option maps, new `Field` entries, `when` on `FieldBase`, `ONBOARDING_PLAN` rewritten)

**Interfaces:**
- Consumes: `ACTIVITY_MULTIPLIERS` keys from Task 2 — `ACTIVITY_LEVELS` must have exactly those keys.
- Produces:

```ts
export const ACTIVITY_LEVELS: Options;
export const GOAL_DIRECTIONS: Options;

/** On `FieldBase`. A field whose predicate is false is not rendered and not saved. */
when?: (values: Partial<Record<keyof ProfileInput, unknown>>) => boolean;

export type OnboardingScreen = {
  title: string;   // the step-bar node
  heading: string; // the <h1> on the screen
  blurb: string;   // one line under the heading
  fields: readonly Field["name"][];
};
export const ONBOARDING_SCREENS: readonly OnboardingScreen[];
/** The fields that block Continue when empty. */
export const ONBOARDING_REQUIRED: ReadonlySet<Field["name"]>;
```

`ONBOARDING_QUESTIONS` and `ONBOARDING_STEPS` are deleted — nothing outside `onboarding-flow.tsx` reads them. Confirm with `grep -rn "ONBOARDING_QUESTIONS\|ONBOARDING_STEPS" --include=*.ts --include=*.tsx .` before removing.

- [ ] **Step 1: Add the option maps**

```ts
export const ACTIVITY_LEVELS: Options = {
	sedentary: "Mostly sitting (desk job, little exercise)",
	light: "Lightly active (light exercise 1 to 3 days a week)",
	moderate: "Moderately active (exercise 3 to 5 days a week)",
	active: "Very active (hard exercise 6 to 7 days a week)",
	"very-active": "Extremely active (physical job, or training twice a day)",
};

export const GOAL_DIRECTIONS: Options = {
	lose: "Lose weight",
	maintain: "Stay where I am",
	gain: "Gain weight or muscle",
};
```

- [ ] **Step 2: Extend `profileInput`**

```ts
goalDirection: enumOf(GOAL_DIRECTIONS).nullish(),
targetWeightKg: z.number().min(25).max(400).nullish(),
activityLevel: enumOf(ACTIVITY_LEVELS).nullish(),
```

- [ ] **Step 3: Add `when` to `FieldBase` and the three fields to `SECTIONS`**

`goalDirection` and `targetWeightKg` join the `goals` section; `activityLevel` joins the `body` section, so Settings gains all three for free. `targetWeightKg` carries:

```ts
when: (values) =>
	values.goalDirection === "lose" || values.goalDirection === "gain",
```

- [ ] **Step 4: Replace `ONBOARDING_PLAN` with the four question screens**

| title | fields |
|---|---|
| You | `name`, `birthDate`, `gender` |
| Goals | `goals`, `goalDirection`, `targetWeightKg` |
| Body | `units`, `heightCm`, `weightKg`, `activityLevel` |
| Handle | `username`, `isPublic` |

`ONBOARDING_REQUIRED` is `new Set(["name", "units", "username"])`. Keep the `fieldNamed` lookup and its throw: a renamed field must stay a build error.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm -F @mezo/api typecheck && pnpm -F @mezo/api test`

Expect: pass. `profile-fields.test.ts` must still be green — the new fields must not have broken `profileInput`.

---

### Task 4: Controls that carry their own labels

**Files:**
- Modify: `apps/nextjs/src/components/onboarding/question-control.tsx`

**Interfaces:**
- Consumes: `Field`, `ProfileInput`, `when` from Task 3.
- Produces: `QuestionControl` unchanged in shape, plus a new export that wraps one control in its own label:

```tsx
export function QuestionField(
  props: Props & { autoFocus?: boolean; context: SettingsValues },
): React.ReactNode;
```

It renders nothing when `field.when?.(context)` is false.

- [ ] **Step 1: Add `QuestionField`**

It renders, in order: a `<Label>` carrying `field.label`, `field.help` as a muted `<p>`, and the control. The label's `htmlFor` and the control's `id` come from one `useId`, so the accessible name is the platform's rather than an `aria-label` guess. Controls built on `fieldset` (`ChoiceList`, `ToggleChoice`) take the label as a visible `<legend>` instead of a wrapping `<Label>`, and `QuestionField` must not double-label them.

- [ ] **Step 2: Stop the controls hard-coding `aria-label` from `field.question`**

Every `aria-label={field.question ?? field.label}` becomes a real label association through Step 1. Keep `aria-label` only where there is genuinely no visible text: the slider in `MeasureInput` and the unit pills in `UnitSwitch`.

- [ ] **Step 3: Make the number control usable in a group**

`MeasureInput` keeps the readout and slider, but the readout drops from `text-5xl` to `text-3xl` — three of them stacked on one screen at 5xl is a wall. The tick row under the slider stays.

- [ ] **Step 4: Give the target weight a live readout**

When `field.name === "targetWeightKg"` and `context.weightKg` is a number, the readout gains a muted suffix reading how far there is to go, in the display unit. No new query, no new state.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @mezo/nextjs typecheck`

---

### Task 5: The flow

**Files:**
- Modify: `apps/nextjs/src/components/onboarding-flow.tsx` (rewrite)
- Modify: `apps/nextjs/src/app/onboarding/page.tsx` (confirm it still compiles; no new props)

**Interfaces:**
- Consumes: `ONBOARDING_SCREENS`, `ONBOARDING_REQUIRED` (Task 3); `QuestionField` (Task 4); `PlanSummary` (Task 6).
- Produces: nothing other components read.

- [ ] **Step 1: Screen index covering welcome and plan**

`index` runs `-1` for the welcome screen, `0..ONBOARDING_SCREENS.length - 1` for questions, and `ONBOARDING_SCREENS.length` for the plan. Three render branches, one shared frame.

- [ ] **Step 2: Resume where the user left off**

On mount only:

```ts
const [index, setIndex] = useState(() => {
	const answered = (name: Field["name"]) => initial[name] != null;
	if (!ONBOARDING_SCREENS.some((screen) => screen.fields.some(answered)))
		return -1;
	const next = ONBOARDING_SCREENS.findIndex(
		(screen) => !screen.fields.every(answered),
	);
	return next === -1 ? ONBOARDING_SCREENS.length : next;
});
```

- [ ] **Step 3: Save a whole screen at once**

`onSubmit` sends every visible field on the screen, mirroring `SettingsForm.onSubmit` — `values[name] ?? (field.type === "toggle" ? false : null)` — and omits fields whose `when` is false, so a hidden target weight is never written.

- [ ] **Step 4: Required is per field, not per screen**

Continue is disabled while any field in `ONBOARDING_REQUIRED` on this screen is empty, or while the username is known taken. Every other field may be left empty. A screen whose remaining unanswered fields are all optional shows `Skip for now` beside Continue, which advances without saving.

- [ ] **Step 5: One progress indicator**

Keep `StepBar`, now four nodes over the four question screens, hidden on the welcome and plan screens. Delete the duplicate `01 / 08` counters in the header and in `BrandPanel`.

- [ ] **Step 6: The welcome screen**

Heading, one line on what the flow asks and roughly how long it takes, three short items naming what it produces (a calorie target, a macro split, an age- and body-adjusted baseline), and one `Get started` button. No form, no fields.

- [ ] **Step 7: Focus management survives the rewrite**

On every screen change, focus moves to the `<h1>` (`tabIndex={-1}`), except where the screen's first field is a text input, which takes focus itself. The existing effect does this per question; it now runs per screen.

- [ ] **Step 8: Typecheck**

Run: `pnpm -F @mezo/nextjs typecheck`

---

### Task 6: The plan screen

**Files:**
- Create: `apps/nextjs/src/components/onboarding/plan-summary.tsx`

**Interfaces:**
- Consumes: `buildPlan`, `Plan` from `@mezo/api/plan` (Task 2); `UnitSystem`, `displayMeasure` from `~/lib/measure`; `SettingsValues` from `~/components/settings/settings-form`.
- Produces:

```tsx
export function PlanSummary(props: {
  values: SettingsValues;
  system: UnitSystem;
  pending: boolean;
  onFinish: (dailyCalories: number | null) => void;
}): React.ReactNode;
```

- [ ] **Step 1: The computed case**

Three tiers, descending in prominence: the calorie target as the headline number; protein, carbs and fat as three tiles under it; then a quiet row carrying age, BMI with its band, BMR, TDEE, daily water, and — when there is a target weight — the weekly pace and how many weeks it takes.

- [ ] **Step 2: The honest case**

`plan.ok === false` renders the same frame with the missing inputs named in a sentence and a link to `/settings/body`, never a fabricated number.

- [ ] **Step 3: The calorie target is editable before it is saved**

A number input seeded with `plan.calories`. `onFinish` receives whatever it holds, and the flow writes it to `dailyCalories` in the same step that completes onboarding.

- [ ] **Step 4: Say what it is**

One line, always shown: an estimate from a standard formula, a starting point to adjust from, and not medical advice. When `atFloor` is true, a second line says the target was raised to a safe minimum. BMI gets its own caveat that it does not account for muscle mass.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @mezo/nextjs typecheck`

---

### Task 7: Verify

- [ ] **Step 1: Everything typechecks**

Run: `pnpm typecheck`

- [ ] **Step 2: Everything tests**

Run: `pnpm test`

- [ ] **Step 3: Formatting and lint**

Run: `pnpm check:write && pnpm check`

- [ ] **Step 4: Walk the flow in a browser**

Run: `pnpm dev`, then sign in as a user with `onboarded_at` null and go to `/onboarding`. Check, in order: welcome renders; each screen saves and advances; Skip passes an optional screen; Back returns with answers intact; the target-weight field appears only after choosing lose or gain; the plan screen shows a number; Open dashboard lands on `/dashboard` and does not bounce back.

- [ ] **Step 5: Keyboard only**

Repeat Step 4 without touching the mouse. Every control must be reachable, every screen change must move focus, and the focus ring must be visible on each.
