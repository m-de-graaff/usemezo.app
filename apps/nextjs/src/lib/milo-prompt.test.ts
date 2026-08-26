import assert from "node:assert/strict";
import { test } from "node:test";
import {
	MUSCLES,
	PROGRESSION,
	REGIONS,
	REP_SCHEMES,
	REST_SEC,
	SPLITS,
	VOLUME_LANDMARKS,
} from "@mezo/api/training";
import { MILO_FIELDS } from "./milo.ts";
import { systemPrompt } from "./milo-prompt.ts";

const PROMPT = systemPrompt({ units: "metric" }, "Sam");

test("the prompt carries the volume landmarks, for every muscle", () => {
	// The whole reason the prompt is generated rather than typed: a landmark
	// changed in `@mezo/api/training` has to reach the model, and a hand-written
	// copy of this table would drift without anything failing.
	for (const muscle of MUSCLES) {
		const band = VOLUME_LANDMARKS[muscle];
		assert.ok(
			PROMPT.includes(
				`| ${muscle} | ${band.mev} | ${band.mev} to ${band.mav} | ${band.mrv} |`,
			),
			`${muscle} is missing from the prompt's landmark table`,
		);
	}
});

test("the prompt lists a split for every number of training days", () => {
	for (const [days, split] of Object.entries(SPLITS)) {
		assert.ok(PROMPT.includes(`${days} days: ${split.name}`), `${days} days`);
	}
});

test("the prompt states the rep and effort ranges it programs from", () => {
	for (const [key, scheme] of Object.entries(REP_SCHEMES)) {
		assert.ok(PROMPT.includes(key), key);
		assert.ok(
			PROMPT.includes(
				`${scheme.compound.reps[0]}-${scheme.compound.reps[1]} reps`,
			),
			`${key} compound reps`,
		);
	}
});

test("the prompt names every region a muscle has to be covered in", () => {
	// The user-visible failure this guards against is Milo writing two flat
	// presses and calling it a chest day, so the regions have to be in front of
	// it rather than inferred.
	for (const [muscle, regions] of Object.entries(REGIONS)) {
		assert.ok(PROMPT.includes(`- ${muscle}:`), muscle);
		for (const region of regions ?? []) {
			assert.ok(PROMPT.includes(region.label), `${muscle}: ${region.label}`);
		}
	}
});

test("the prompt states the rest intervals and the progression rule", () => {
	assert.ok(PROMPT.includes(String(REST_SEC.heavyCompound)));
	assert.ok(PROMPT.includes(String(REST_SEC.isolation)));
	assert.ok(PROMPT.includes(String(PROGRESSION.incrementKg.compound)));
	assert.ok(PROMPT.includes(String(PROGRESSION.stallSessions)));
});

test("every field Milo can propose is described to it", () => {
	for (const field of MILO_FIELDS) {
		assert.ok(
			PROMPT.includes(field.name),
			`${field.name} is not in the prompt`,
		);
	}
});

test("the prompt speaks the units the user reads", () => {
	assert.ok(systemPrompt({ units: "imperial" }, undefined).includes("pounds"));
	assert.ok(systemPrompt({ units: "metric" }, undefined).includes("kilograms"));
	// Storage is metric whichever way the display goes, and the model has to be
	// told so in both cases or it will write pounds into a kilogram column.
	for (const units of ["metric", "imperial"]) {
		assert.ok(
			systemPrompt({ units }, undefined).includes(
				"Mezo stores every measurement in metric",
			),
			units,
		);
	}
});

test("the name is used when there is one and not faked when there is not", () => {
	assert.ok(PROMPT.includes("Sam"));
	assert.ok(
		!systemPrompt({ units: "metric" }, undefined).includes("undefined"),
	);
});

test("the tools the prompt tells Milo to call are the ones it has", () => {
	// A prompt naming a tool that does not exist is a run that stalls, and the
	// route is where the list actually lives.
	for (const name of [
		"getProfile",
		"getTraining",
		"searchExercises",
		"estimateWeight",
		"reviewSession",
		"askUser",
		"proposeProfileUpdate",
		"proposeRoutine",
		"remember",
		"forget",
		"getWorkout",
		"noteWorkout",
		"createExercise",
		"hideExercise",
		"unhideExercise",
		"web_search",
	]) {
		assert.ok(PROMPT.includes(name), name);
	}
});

test("the prompt separates a note about the training from one about the person", () => {
	// Both tools write immediately and both take a sentence, so the only thing
	// keeping a session note out of the permanent memory is this instruction.
	assert.match(PROMPT, /Something durable about the person goes to `remember`/);
});

test("what Milo was told to remember reaches it, with the ids to change it", () => {
	const withNotes = systemPrompt({ units: "metric" }, "Sam", [
		{ id: "n1", kind: "goal", text: "Wants a V-taper" },
		{ id: "n2", kind: "constraint", text: "No hack squat at their gym" },
	]);

	assert.ok(withNotes.includes("Wants a V-taper"));
	assert.ok(withNotes.includes("No hack squat at their gym"));
	// The id has to travel with the note or `replaces` and `forget` have nothing
	// to point at, and a contradicted note stays in the list forever.
	assert.ok(withNotes.includes("n1") && withNotes.includes("n2"));
	assert.ok(withNotes.includes("[goal]") && withNotes.includes("[constraint]"));
});

test("no notes says so rather than leaving an empty heading", () => {
	// A bare "What you already know" with nothing under it invites a model to
	// fill the gap from the conversation and call it memory.
	assert.match(PROMPT, /Nothing yet\. You have not written anything down/);
});

test("the prompt says when not to search, not only when to", () => {
	// The failure mode is a coach that searches the web for what sets to do,
	// which is slower and worse than the evidence already in front of it.
	assert.match(PROMPT, /Do not use it for ordinary training or nutrition/);
});

test("the prompt tells Milo to program warm-ups rather than leave them out", () => {
	// It used to say "do not list them", which is exactly what it then did: every
	// routine arrived with the working sets and nothing to walk in on.
	assert.ok(PROMPT.includes("warmupSets"));
	assert.ok(!PROMPT.includes("do not list them"));
});

test("the prompt sets warm-ups and failure sets from the goal", () => {
	// The whole point of the goal being on the profile: a routine for somebody
	// building muscle is a different prescription from one for somebody who said
	// they want to feel better, and not only in the rep range.
	for (const goal of ["Build muscle", "Strength", "Endurance"]) {
		assert.ok(PROMPT.includes(`**${goal}.**`), goal);
	}
	assert.ok(PROMPT.includes("failureSets"));
	// The one rule that outranks all of them.
	assert.match(PROMPT, /No failure sets at all/);
});

test("the prompt keeps the two rest intervals apart", () => {
	// One number for both is how a session ends up sprinting out of the heaviest
	// thing in it.
	assert.ok(PROMPT.includes("restSec") && PROMPT.includes("restAfterSec"));
	assert.match(
		PROMPT,
		/two rest intervals on every exercise and they are different/,
	);
});

test("the prompt names no tool that has since been renamed away", () => {
	// A renamed tool leaves its old name scattered through prose that still
	// reads fine, and the model then calls something that is not there.
	for (const gone of [
		"checkVolume",
		"searchWeb",
		"getWorkouts",
		"saveRoutine",
	]) {
		assert.ok(!PROMPT.includes(gone), `${gone} is no longer a tool`);
	}
});

test("what the user did to their own catalogue reaches Milo, with the ids", () => {
	const withCatalogue = systemPrompt({ units: "metric" }, "Sam", [], {
		custom: [{ id: "custom_1", name: "Bayesian curl" }],
		hidden: ["0025", "0290"],
	});

	// The name so it is used rather than added again, the id so it can be
	// programmed without a search first.
	assert.ok(withCatalogue.includes("Bayesian curl"));
	assert.ok(withCatalogue.includes("custom_1"));
	// The blacklist travels with its ids, or `unhideExercise` has nothing to
	// point at when somebody changes their mind.
	assert.ok(withCatalogue.includes("0025") && withCatalogue.includes("0290"));
});

test("an untouched catalogue adds no empty list to the prompt", () => {
	// A heading with nothing under it invites a model to fill it in.
	assert.ok(!PROMPT.includes("Exercises this user has added"));
	assert.ok(!PROMPT.includes("They have blacklisted"));
	// The tools are still described, because the point is that it can add one.
	assert.ok(PROMPT.includes("createExercise"));
});

test("the prompt says how a rep range is stored, not only that it wants one", () => {
	// The range used to be prose in the note. Now it is two columns the app can
	// count, and the model has to be told which field is which end of it or it
	// writes the range where nothing reads it.
	assert.ok(PROMPT.includes("repsMax"));
	assert.match(PROMPT, /`reps` is the bottom of the range/);
});

test("the prompt says what a weight column means where it is not obvious", () => {
	// The failure this guards against is a dumbbell press proposed at the pair
	// total, which is a first working set nobody can lift.
	assert.match(PROMPT, /one dumbbell, not the pair/);
	assert.ok(PROMPT.includes("logAs"));
});
