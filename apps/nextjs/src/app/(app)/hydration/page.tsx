import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hydration } from "~/components/hydration/hydration";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Hydration" };

/**
 * The screen itself is a Client Component, which is unusual here and is the
 * point: everything on it is keyed to the user's local day, and the server does
 * not know which day that is. All this page fetches is the unit preference,
 * which is the same whatever the clock says.
 */
export default async function HydrationPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/hydration");

	const profile = await api.profile.get();

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
			<h1 className="font-semibold text-xl tracking-tight">Hydration</h1>
			<Hydration units={profile.units} />
		</div>
	);
}
