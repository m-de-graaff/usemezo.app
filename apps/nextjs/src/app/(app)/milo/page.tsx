import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Milo" };

/**
 * A new conversation.
 *
 * `/milo` is a door rather than a page: it mints an id and sends the browser to
 * it, so every conversation has a URL from its first word and reloading keeps
 * it. Nothing is written here — the row appears when the first reply finishes
 * streaming, which is what stops an abandoned chat leaving a blank row behind.
 */
export default async function NewMiloThreadPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/milo");

	redirect(`/milo/${crypto.randomUUID()}`);
}
