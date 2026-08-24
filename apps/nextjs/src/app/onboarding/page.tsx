import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Backdrop } from "~/components/backdrop";
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

	// Same dither field as the auth pages, so signing up and setting up read as
	// one flow rather than two products.
	return (
		<>
			<Backdrop />
			<OnboardingFlow values={profile} />
		</>
	);
}
