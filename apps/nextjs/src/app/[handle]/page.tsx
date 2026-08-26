import {
	ACTIVITIES,
	FITNESS_EXPERIENCE,
	GOALS,
	usernameSchema,
} from "@mezo/api/profile-fields";
import { Avatar, AvatarFallback, AvatarImage } from "@mezo/ui/avatar";
import { Badge } from "@mezo/ui/badge";
import { Button } from "@mezo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mezo/ui/card";
import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "~/components/logo";
import { api } from "~/trpc/server";

type Props = { params: Promise<{ handle: string }> };

/**
 * Profiles sit at the root as `/@name`. This segment is dynamic, so it also
 * catches every path no static route claimed — the leading `@` is what tells
 * a profile apart from a typo, and it is checked before any query runs.
 *
 * The rest of the segment is user input, so an illegal handle is a 404 too.
 */
async function load(params: Props["params"]) {
	const handle = decodeURIComponent((await params).handle);
	if (!handle.startsWith("@")) notFound();

	const parsed = usernameSchema.safeParse(handle.slice(1));
	if (!parsed.success) notFound();

	const profile = await api.profile.byUsername({ username: parsed.data });
	if (!profile) notFound();

	return profile;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const profile = await load(params);

	return {
		title: profile.visible
			? `${profile.name} (@${profile.username})`
			: `@${profile.username}`,
		// A private profile must not be indexed, and a public one is the user's
		// call to share, not ours to advertise.
		robots: { index: false, follow: false },
	};
}

export default async function PublicProfilePage({ params }: Props) {
	const profile = await load(params);

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-4 md:p-6 lg:max-w-5xl">
			<header className="flex items-center justify-between pt-2">
				<Link
					className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					href="/"
				>
					<Logo />
				</Link>
				{profile.isOwner && (
					<Button render={<Link href="/settings/account" />} variant="outline">
						Edit profile
					</Button>
				)}
			</header>

			{profile.visible ? (
				// One column on a phone; on a wide screen the identity card takes a
				// sidebar and follows the page, so the cards beside it are not
				// stacked under a header that has scrolled away.
				<div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
					<Card className="lg:sticky lg:top-6">
						<CardContent className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left lg:flex-col lg:text-center">
							<Avatar className="size-16 lg:size-20">
								{profile.image && <AvatarImage alt="" src={profile.image} />}
								<AvatarFallback className="text-xl">
									{profile.name.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="flex flex-col gap-0.5">
								<h1 className="font-semibold text-xl tracking-tight lg:text-2xl">
									{profile.name}
								</h1>
								<p className="text-muted-foreground text-sm">
									@{profile.username}
								</p>
								<p className="text-muted-foreground text-xs">
									On Mezo since{" "}
									{profile.memberSince.toLocaleDateString("en-GB", {
										month: "long",
										year: "numeric",
									})}
								</p>
							</div>
						</CardContent>
					</Card>

					<div className="flex flex-col gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Training</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<Facts
									items={[
										{
											label: "Experience",
											values: profile.fitnessExperience
												? [FITNESS_EXPERIENCE[profile.fitnessExperience]]
												: [],
										},
										{
											label: "Goals",
											values: labelsFor(profile.goals, GOALS),
										},
										{
											label: "Enjoys",
											values: labelsFor(
												profile.preferredActivities,
												ACTIVITIES,
											),
										},
									]}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Workouts</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm">
									No workouts yet. Logged sessions will show up here.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			) : (
				<Card>
					<CardContent className="flex flex-col items-center gap-2 py-10 text-center">
						<LockIcon
							aria-hidden="true"
							className="size-6 text-muted-foreground"
						/>
						<h1 className="font-semibold text-lg">@{profile.username}</h1>
						<p className="max-w-sm text-muted-foreground text-sm">
							This profile is private. Only its owner can see what is on it.
						</p>
					</CardContent>
				</Card>
			)}
		</main>
	);
}

const labelsFor = (values: string[] | null, options: Record<string, string>) =>
	(values ?? []).map((value) => options[value]).filter(Boolean) as string[];

function Facts({
	items,
}: {
	items: { label: string; values: (string | undefined)[] }[];
}) {
	const shown = items.filter((item) => item.values.length > 0);

	if (shown.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nothing shared yet on this profile.
			</p>
		);
	}

	return (
		<dl className="flex flex-col gap-4">
			{shown.map((item) => (
				<div className="flex flex-col gap-1.5" key={item.label}>
					<dt className="text-muted-foreground text-xs uppercase tracking-wide">
						{item.label}
					</dt>
					<dd className="flex flex-wrap gap-1.5">
						{item.values.map((value) => (
							<Badge key={value} variant="secondary">
								{value}
							</Badge>
						))}
					</dd>
				</div>
			))}
		</dl>
	);
}
