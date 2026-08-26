import assert from "node:assert/strict";
import test from "node:test";
import { pendingStream } from "./pending-stream.ts";

test("a thread opened mid-reply starts out knowing which run to resume", () => {
	assert.equal(pendingStream("run-1").getStreamId(), "run-1");
	assert.equal(pendingStream(null).getStreamId(), null);
});

test("the runtime is told when a run starts and when it ends", () => {
	const pending = pendingStream(null);
	let woken = 0;
	pending.subscribe?.(() => {
		woken += 1;
	});

	pending.setStreamId("run-2");
	assert.equal(pending.getStreamId(), "run-2");
	assert.equal(woken, 1);

	pending.clear();
	assert.equal(pending.getStreamId(), null);
	assert.equal(woken, 2);
});

test("nothing is announced when nothing changed", () => {
	// The runtime resumes on every change it hears about, so an id repeated back
	// to it must not read as a second run.
	const pending = pendingStream("run-3");
	let woken = 0;
	pending.subscribe?.(() => {
		woken += 1;
	});

	pending.setStreamId("run-3");
	pending.clear();
	pending.clear();
	assert.equal(woken, 1);
});

test("a listener that has gone stops hearing about runs", () => {
	const pending = pendingStream(null);
	let woken = 0;
	const stop = pending.subscribe?.(() => {
		woken += 1;
	});

	stop?.();
	pending.setStreamId("run-4");
	assert.equal(woken, 0);
});
