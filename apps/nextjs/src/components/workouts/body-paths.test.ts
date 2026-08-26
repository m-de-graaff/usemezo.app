import assert from "node:assert/strict";
import { test } from "node:test";
import { MUSCLES } from "@mezo/api/training";
import { type BodyModel, FEMALE, MALE } from "./body-paths.ts";

const MODELS: [string, BodyModel][] = [
	["male", MALE],
	["female", FEMALE],
];

const views = (model: BodyModel) => [model.front, model.back];

test("every muscle the app counts has somewhere to be drawn", () => {
	// The failure this guards against is silent: a slug renamed upstream, the
	// extraction re-run, and one muscle quietly stops lighting up on a map that
	// still looks complete. Nothing else would notice.
	for (const [name, model] of MODELS) {
		const drawn = new Set(
			views(model).flatMap((view) =>
				view.parts.flatMap((part) => (part.muscle ? [part.muscle] : [])),
			),
		);

		for (const muscle of MUSCLES) {
			assert.ok(drawn.has(muscle), `${name} model cannot draw ${muscle}`);
		}
	}
});

/**
 * Upstream's sub-groups, which are drawn on top of the muscle they belong to.
 * Not every compound name is one: `upperBack` and `lowerBack` are neighbours
 * that between them make up the back, and both are kept.
 */
const OVERLAYS = [
	"upperChest",
	"lowerChest",
	"innerQuad",
	"outerQuad",
	"upperAbs",
	"lowerAbs",
	"frontDeltoid",
	"rearDeltoid",
	"upperTrapezius",
	"lowerTrapezius",
];

test("no muscle is drawn twice over itself", () => {
	// Left in, an inert sub-group greys over a highlighted parent and a hot one
	// colours the same sets twice, which is why the extraction drops them.
	for (const [name, model] of MODELS) {
		const slugs = new Set(
			views(model).flatMap((view) => view.parts.map((part) => part.slug)),
		);

		for (const overlay of OVERLAYS) {
			assert.ok(!slugs.has(overlay), `${name} still draws ${overlay}`);
		}
	}
});

test("both models can be drawn without the one part that reads as a gender", () => {
	// What `neutral` leaves out. If upstream ever renames it, somebody who said
	// "prefer not to say" gets hair again and nothing fails.
	for (const [name, model] of MODELS) {
		for (const view of views(model)) {
			assert.ok(
				view.parts.some((part) => part.slug === "hair"),
				`${name} has no hair path to leave out`,
			);
		}
	}
});

test("every path is a path, and every view has a window onto it", () => {
	for (const [name, model] of MODELS) {
		for (const view of views(model)) {
			// Four numbers: the origin and size of this view's crop out of the one
			// coordinate space both models share.
			assert.match(view.viewBox, /^\d+ \d+ \d+ \d+$/, name);
			assert.ok(view.parts.length > 10, name);

			for (const part of view.parts) {
				// Absolute in one model, relative in the other. Both are movetos and
				// both are valid; what matters is that a path starts with one.
				assert.match(part.d, /^[Mm][\s\d-]/, `${name}: ${part.slug}`);
			}
		}
	}
});

test("every part starts inside the window its view crops to", () => {
	// The two models are different sizes and both views of each are cut out of
	// one shared coordinate space, so a viewBox copied from the wrong row does
	// not error — it renders a blank panel, or half a person. This is the check
	// that a browser would otherwise have to be the first to make.
	for (const [name, model] of MODELS) {
		for (const [side, view] of Object.entries(model)) {
			const [x, y, width, height] = view.viewBox.split(" ").map(Number) as [
				number,
				number,
				number,
				number,
			];

			for (const part of view.parts) {
				// The moveto that opens the path: two numbers, absolute in one model
				// and relative in the other, but a relative moveto at the start of a
				// path is measured from the origin, so both are page coordinates.
				const [startX, startY] = (part.d.match(/-?[\d.]+/g) ?? [])
					.slice(0, 2)
					.map(Number) as [number, number];

				const where = `${name} ${side}: ${part.slug} at ${startX},${startY}`;
				assert.ok(startX >= x && startX <= x + width, `${where} outside x`);
				assert.ok(startY >= y && startY <= y + height, `${where} outside y`);
			}
		}
	}
});
