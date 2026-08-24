/**
 * Only same-origin, absolute paths may come back from the query string —
 * anything else would turn `?callbackURL=` into an open redirect.
 */
export function safeCallbackURL(value: string | string[] | undefined) {
	if (typeof value !== "string") return "/dashboard";
	if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
	return value;
}
