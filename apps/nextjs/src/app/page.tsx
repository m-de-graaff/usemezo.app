import { getSession } from "@mezo/auth/server";
import { Button } from "@mezo/ui/button";
import Link from "next/link";
import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
	const hello = await api.post.hello({ text: "from tRPC" });
	const session = await getSession();

	if (session) {
		void api.post.getLatest.prefetch();
	}

	return (
		<HydrateClient>
			<main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-6">
				<h1 className="font-semibold text-3xl">usemezo</h1>
				<p className="text-muted-foreground">{hello.greeting}</p>

				{session ? (
					<div className="flex flex-col gap-4">
						<p>Signed in as {session.user.email}</p>
						<Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
					</div>
				) : (
					<div className="flex gap-2">
						<Button render={<Link href="/sign-in" />}>Sign in</Button>
						<Button render={<Link href="/sign-up" />} variant="outline">
							Sign up
						</Button>
					</div>
				)}

				{session?.user && <LatestPost />}
			</main>
		</HydrateClient>
	);
}
