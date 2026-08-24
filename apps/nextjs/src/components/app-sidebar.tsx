"use client";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@mezo/ui/sidebar";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	findNavItem,
	navGroups,
	settingsNavGroups,
} from "~/components/app-nav";
import { LogoMark } from "~/components/logo";

export function AppSidebar() {
	const pathname = usePathname();
	const active = findNavItem(pathname);
	// Settings swaps the whole nav out rather than nesting under it. Reading the
	// path here keeps the layouts free of prop plumbing they have no use for.
	const inSettings = pathname.startsWith("/settings");
	const groups = inSettings ? settingsNavGroups : navGroups;

	return (
		<Sidebar collapsible="icon" variant="sidebar">
			<SidebarHeader className="h-14 justify-center border-b px-2">
				<SidebarMenuButton render={<Link href="/dashboard" />}>
					<LogoMark className="size-4" />
					<span className="font-semibold tracking-tight">mezo</span>
				</SidebarMenuButton>
			</SidebarHeader>
			<SidebarContent>
				{groups.map((group) => (
					<SidebarGroup key={group.label ?? "default"}>
						{group.label && (
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						)}
						<SidebarMenu>
							{group.items.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										isActive={item === active}
										render={<Link href={item.href} />}
										tooltip={item.title}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			{inSettings && (
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={<Link href="/dashboard" />}
								tooltip="Back to dashboard"
							>
								<ArrowLeftIcon />
								<span>Back to dashboard</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			)}
		</Sidebar>
	);
}
