import assert from "node:assert/strict";
import { test } from "node:test";
import {
	BODY_PARTS,
	CUSTOM_PREFIX,
	customById,
	EQUIPMENT,
	EXERCISES,
	type Exercise,
	exerciseById,
	exerciseGif,
	exerciseImage,
	isCustomExercise,
	loggingHint,
	registerCustomExercises,
	searchExercises,
} from "./exercises.ts";

test("the catalogue is whole", () => {
	assert.ok(EXERCISES.length > 1000);
	assert.ok(BODY_PARTS.includes("chest"));
	assert.ok(EQUIPMENT.includes("barbell"));
	// Every row has to be addressable and renderable, or a picker row breaks.
	for (const exercise of EXERCISES) {
		assert.ok(exercise.id, "id");
		assert.ok(exercise.name, "name");
		assert.ok(exercise.media, `media for ${exercise.name}`);
	}
});

test("ids are unique", () => {
	assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
});

test("lookup by id", () => {
	const first = EXERCISES[0];
	assert.ok(first);
	assert.equal(exerciseById(first.id)?.name, first.name);
	assert.equal(exerciseById("nope"), undefined);
});

test("search matches on name, case and spacing insensitively", () => {
	const hits = searchExercises({ query: "BENCH   PRESS" });
	assert.ok(hits.length > 0);
	assert.ok(hits.every((e) => e.name.toLowerCase().includes("bench press")));
});

test("search filters compose", () => {
	const hits = searchExercises({ bodyPart: "chest", equipment: "barbell" });
	assert.ok(hits.length > 0);
	assert.ok(
		hits.every((e) => e.bodyPart === "chest" && e.equipment === "barbell"),
	);
});

test("limit is capped server-side", () => {
	assert.equal(searchExercises({ limit: 5000 }).length, 200);
	assert.equal(searchExercises({ limit: 3 }).length, 3);
});

test("an empty search is every exercise, up to the cap", () => {
	assert.equal(searchExercises({}).length, 200);
});

test("media urls are pinned to the recorded commit", () => {
	const first = EXERCISES[0];
	assert.ok(first);
	assert.match(
		exerciseImage(first) as string,
		/^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[0-9a-f]{40}\/images\/.+\.jpg$/,
	);
	assert.match(
		exerciseGif(first) as string,
		/^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[0-9a-f]{40}\/videos\/.+\.gif$/,
	);
});

/* -------------------------------------------------------------------------- */
/* The user's own layer                                                       */
/* -------------------------------------------------------------------------- */

const BAYESIAN: Exercise = {
	id: `${CUSTOM_PREFIX}bayesian`,
	name: "Bayesian curl",
	bodyPart: "upper arms",
	equipment: "cable",
	target: "biceps",
	secondary: ["forearms"],
};

test("a custom id is one the dataset could never mint", () => {
	// The dataset's own ids are four digits. If a custom one could collide with
	// them, a user's exercise would silently shadow a real one.
	assert.ok(isCustomExercise(BAYESIAN.id));
	for (const exercise of EXERCISES) {
		assert.ok(!isCustomExercise(exercise.id), exercise.id);
	}
});

test("an exercise somebody added resolves by id, given their own list", () => {
	const mine = customById([BAYESIAN]);
	assert.equal(exerciseById(BAYESIAN.id, mine)?.name, "Bayesian curl");
	// Without the list it is nobody's exercise, which is what keeps one user's
	// additions out of another user's request on the server.
	assert.equal(exerciseById(BAYESIAN.id), undefined);
	// The dataset still wins for its own ids, whatever is passed alongside it.
	const first = EXERCISES[0];
	assert.ok(first);
	assert.equal(exerciseById(first.id, mine)?.name, first.name);
});

test("their own exercises are searched, and come first", () => {
	const hits = searchExercises({ query: "curl", custom: [BAYESIAN] });
	assert.equal(hits[0]?.id, BAYESIAN.id);
	assert.ok(hits.length > 1, "the dataset's curls are still there");
});

test("a blacklisted exercise is not offered, but still resolves", () => {
	const bench = searchExercises({ query: "bench press", limit: 1 })[0];
	assert.ok(bench);

	const hidden = new Set([bench.id]);
	assert.ok(
		!searchExercises({ query: "bench press", hidden }).some(
			(exercise) => exercise.id === bench.id,
		),
	);
	// A session somebody already did has to keep rendering. Hiding is a
	// statement about the future, not an edit to the past.
	assert.equal(exerciseById(bench.id)?.name, bench.name);
});

test("the blacklist can be read back, to be undone", () => {
	const bench = searchExercises({ query: "bench press", limit: 1 })[0];
	assert.ok(bench);

	const only = searchExercises({
		hidden: new Set([bench.id]),
		onlyHidden: true,
	});
	assert.deepEqual(
		only.map((exercise) => exercise.id),
		[bench.id],
	);
});

test("an exercise with no picture has no url, rather than a broken one", () => {
	assert.equal(exerciseImage(BAYESIAN), null);
	assert.equal(exerciseGif(BAYESIAN), null);
});

// Last, because it writes module state the tests above rely on being empty.
test("the browser registers one user's exercises once, for every lookup", () => {
	registerCustomExercises([BAYESIAN]);
	assert.equal(exerciseById(BAYESIAN.id)?.name, "Bayesian curl");
	assert.ok(
		searchExercises({ query: "bayesian" }).some(
			(exercise) => exercise.id === BAYESIAN.id,
		),
	);

	registerCustomExercises([]);
	assert.equal(exerciseById(BAYESIAN.id), undefined);
});

test("equipment that is logged unusually says so, and the rest says nothing", () => {
	const hint = (equipment: string) => loggingHint({ ...BAYESIAN, equipment });

	// The three that silently corrupt a training history when logged the way
	// they read: half the load, backwards, and a bar somebody added in.
	assert.match(hint("dumbbell") ?? "", /one dumbbell/i);
	assert.match(hint("assisted") ?? "", /taken off you/i);
	assert.match(hint("barbell") ?? "", /plates you loaded, not the bar/i);

	// Most of the catalogue has no convention worth an icon.
	assert.equal(hint("stability ball"), null);
	assert.equal(hint("rope"), null);
});

test("every hint is keyed to equipment the catalogue actually uses", () => {
	// A typo in the table is a hint that never renders, and nothing else would
	// fail. `weighted` and the rest have to match the dataset's own spelling.
	for (const equipment of ["dumbbell", "assisted", "body weight", "weighted"]) {
		assert.ok(EQUIPMENT.includes(equipment), equipment);
		assert.ok(loggingHint({ ...BAYESIAN, equipment }), equipment);
	}
});
