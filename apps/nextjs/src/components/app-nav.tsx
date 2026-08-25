import { SECTIONS } from "@mezo/api/profile-fields";
import {
	ChartPieIcon,
	HeartPulseIcon,
	IdCardIcon,
	LayoutGridIcon,
	SaladIcon,
	ScaleIcon,
	SettingsIcon,
	SparklesIcon,
	TargetIcon,
	UserRoundIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavItem = {
	title: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
	/** A small label after the title, like the AI pill on Milo. */
	badge?: string;
	/** Rendered before the item in the header breadcrumb, when it has one. */
	parent?: { title: string; href: string };
};

export type NavGroup = {
	label?: string;
	items: NavItem[];
};

/**
 * The single source of truth for the app nav: the sidebar renders it, the
 * header reads the current page's title out of it. Add a row here when a route
 * lands — only routes that exist belong in it, or the sidebar ships dead links.
 */
export const navGroups: NavGroup[] = [
	{
		label: "Product",
		items: [
			{ title: "Dashboard", href: "/dashboard", icon: LayoutGridIcon },
			{ title: "Milo", href: "/milo", icon: SparklesIcon, badge: "AI" },
			{ title: "Settings", href: "/settings", icon: SettingsIcon },
		],
	},
];

/** Keyed by section slug — the sections themselves come from the API package,
 *  which has no business importing an icon set. */
const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
	account: IdCardIcon,
	profile: UserRoundIcon,
	goals: TargetIcon,
	body: ScaleIcon,
	nutrition: SaladIcon,
	advanced: ChartPieIcon,
	health: HeartPulseIcon,
};

/**
 * Settings replaces the sidebar rather than nesting inside it, so this is a
 * second, parallel nav rather than a sub-tree of the first one.
 */
export const settingsNavGroups: NavGroup[] = [
	{
		label: "Settings",
		items: SECTIONS.map((section) => ({
			title: section.title,
			href: `/settings/${section.slug}`,
			icon: SECTION_ICONS[section.slug] ?? SettingsIcon,
			parent: { title: "Settings", href: "/settings" },
		})),
	},
];

export const navItems = [...navGroups, ...settingsNavGroups].flatMap(
	(group) => group.items,
);

/** Longest matching prefix, so `/dashboard/x` still resolves to Dashboard. */
export function findNavItem(pathname: string) {
	return navItems
		.filter(
			(item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
		)
		.sort((a, b) => b.href.length - a.href.length)[0];
}
