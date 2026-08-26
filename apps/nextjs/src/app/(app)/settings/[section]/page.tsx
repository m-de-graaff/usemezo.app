import { findSection } from "@mezo/api/profile-fields";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsForm } from "~/components/settings/settings-form";
import { api } from "~/trpc/server";

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const section = findSection((await params).section);
	return {
		title: section ? `${section.title} settings` : "Settings",
	};
}

export default async function SettingsSectionPage({ params }: Props) {
	const section = findSection((await params).section);
	if (!section) notFound();

	// `protectedProcedure` is the real auth check; the layout has already
	// redirected anyone without a session.
	const answers = await api.profile.get();

	return (
		// Keyed on the slug: sibling settings routes render the same component in
		// the same slot, and without this the form would keep the previous
		// section's state instead of re-seeding from the server.
		<SettingsForm key={section.slug} slug={section.slug} values={answers} />
	);
}
