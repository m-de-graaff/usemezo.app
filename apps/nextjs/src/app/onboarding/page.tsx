import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "~/components/onboarding-flow";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Welcome to Mezo" };

/**
 * Outside the `(app)` group on purpose: that layout redirects here until
 * onboarding is done, so a route nested inside it would loop.
 */
export default async function OnboardingPage() {
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/onboarding");

	const profile = await api.profile.get();
	// Already done — there is nothing here to come back to.
	if (profile.onboardedAt) redirect("/dashboard");

	// No dither field behind this one, unlike the auth pages: onboarding is a
	// column of questions to work through, and ambient motion under it reads as
	// decoration competing with the thing being asked.
	return <OnboardingFlow values={profile} />;
}
