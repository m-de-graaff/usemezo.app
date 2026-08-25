import assert from "node:assert/strict";
import { test } from "node:test";
import {
	BODY_PARTS,
	EQUIPMENT,
	EXERCISES,
	exerciseById,
	exerciseGif,
	exerciseImage,
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
		exerciseImage(first),
		/^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[0-9a-f]{40}\/images\/.+\.jpg$/,
	);
	assert.match(
		exerciseGif(first),
		/^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[0-9a-f]{40}\/videos\/.+\.gif$/,
	);
});
