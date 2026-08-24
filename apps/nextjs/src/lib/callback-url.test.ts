// node --test src/lib/callback-url.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { safeCallbackURL } from "./callback-url.ts";

test("safeCallbackURL only allows same-origin paths", () => {
	assert.equal(safeCallbackURL("/dashboard/settings"), "/dashboard/settings");
	assert.equal(safeCallbackURL(undefined), "/dashboard");
	assert.equal(safeCallbackURL(["/a", "/b"]), "/dashboard");
	assert.equal(safeCallbackURL("//evil.com"), "/dashboard");
	assert.equal(safeCallbackURL("https://evil.com"), "/dashboard");
	assert.equal(safeCallbackURL("javascript:alert(1)"), "/dashboard");
});
