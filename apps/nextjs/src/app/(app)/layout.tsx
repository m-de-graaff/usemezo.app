import { getSession } from "@mezo/auth/server";
import { redirect } from "next/navigation";
import { AppShell } from "~/components/app-shell";
import { api } from "~/trpc/server";

/**
 * Everything under this group is signed-in-only. The proxy already redirects on
 * a missing cookie; this is the real check, and it also feeds the shell the
 * user it shows. Pages still call `getSession()` themselves — a layout is not
 * re-rendered on client-side navigation between its own routes.
 *
 * It is also the onboarding gate. `/onboarding` deliberately sits outside this
 * group, or sending someone there would send them there again.
 */
export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();
	if (!session) redirect("/sign-in");

	const profile = await api.profile.get();
	if (!profile.onboardedAt) redirect("/onboarding");

	return <AppShell user={session.user}>{children}</AppShell>;
}
