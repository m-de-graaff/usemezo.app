import { getSession } from "@mezo/auth/server";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { redirect } from "next/navigation";
import { SignOutButton } from "~/components/sign-out-button";

export default async function DashboardPage() {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/dashboard");

	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Signed in</CardTitle>
					<CardDescription>{session.user.email}</CardDescription>
				</CardHeader>
				<CardContent>
					<SignOutButton />
				</CardContent>
			</Card>
		</main>
	);
}
