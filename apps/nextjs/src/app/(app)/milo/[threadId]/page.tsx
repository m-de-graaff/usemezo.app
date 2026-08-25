import { getSession } from "@mezo/auth/server";
import type { UIMessage } from "ai";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Milo } from "~/components/milo/milo";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Milo | Mezo" };

/**
 * One conversation.
 *
 * A chat wants a fixed box rather than a growing one: the composer sticks to
 * the bottom and the thread scrolls inside itself, which only works if
 * something above it has a height. The app shell is `min-h-svh`, so this is
 * the viewport less the header and the shell's own padding — the one place in
 * the app that has to know those two numbers, which is why they are named here
 * rather than inlined twice.
 */
const HEADER = "3.5rem"; // AppHeader's h-14
const PADDING = { base: "2rem", md: "3rem" }; // AppShell's p-4 / md:p-6, doubled

export default async function MiloThreadPage({
	params,
}: {
	params: Promise<{ threadId: string }>;
}) {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/milo");

	const { threadId } = await params;
	// Null for a thread that does not exist yet — which is the normal case, since
	// `/milo` sends people here with an id nothing has written to. It is also
	// what an id belonging to somebody else returns, and the two look the same
	// from here on purpose.
	const thread = await api.milo.get({ id: threadId });

	return (
		<div
			className="-mx-4 h-(--milo-height) md:-mx-6 md:h-(--milo-height-md)"
			style={{
				["--milo-height" as string]: `calc(100svh - ${HEADER} - ${PADDING.base})`,
				["--milo-height-md" as string]: `calc(100svh - ${HEADER} - ${PADDING.md})`,
			}}
		>
			<Milo
				initialMessages={(thread?.messages ?? []) as UIMessage[]}
				threadId={threadId}
			/>
		</div>
	);
}
