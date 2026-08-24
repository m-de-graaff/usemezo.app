import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next 16 runs this on the Node runtime — `proxy` has no edge option. It only checks that a session
 * cookie is *present*, never that it is valid, because that needs the database. Treat this as a
 * redirect optimisation; every protected page/procedure still calls
 * `getSession()` and is the real authority.
 */
const PROTECTED_PREFIXES = ["/dashboard"];
// `/reset-password` stays reachable while signed in: the token in the link is
// the authority there, not the session.
const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password"];

const startsWithAny = (pathname: string, prefixes: string[]) =>
	prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	const signedIn = getSessionCookie(request) !== null;

	if (!signedIn && startsWithAny(pathname, PROTECTED_PREFIXES)) {
		const url = new URL("/sign-in", request.url);
		url.searchParams.set("callbackURL", `${pathname}${search}`);
		return NextResponse.redirect(url);
	}

	if (signedIn && startsWithAny(pathname, AUTH_PAGES)) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	// Skip API routes, Next internals and anything with a file extension.
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*.).*)"],
};
