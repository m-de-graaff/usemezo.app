"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@mezo/ui/breadcrumb";
import { Kbd, KbdGroup } from "@mezo/ui/kbd";
import { Separator } from "@mezo/ui/separator";
import { SidebarTrigger } from "@mezo/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mezo/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavItem } from "~/components/app-nav";
import { NavUser, type NavUserProps } from "~/components/nav-user";

export function AppHeader({ user }: NavUserProps) {
	const page = findNavItem(usePathname());

	return (
		<header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/50 md:px-6">
			<div className="flex items-center gap-2">
				<Tooltip>
					<TooltipTrigger render={<SidebarTrigger />} />
					<TooltipContent side="right">
						Toggle sidebar
						<KbdGroup>
							<Kbd>⌘</Kbd>
							<Kbd>B</Kbd>
						</KbdGroup>
					</TooltipContent>
				</Tooltip>
				<Separator
					className="mr-1 h-4 data-vertical:self-center"
					orientation="vertical"
				/>
				{page && (
					<Breadcrumb>
						<BreadcrumbList>
							{page.parent && (
								<>
									<BreadcrumbItem className="hidden sm:block">
										<BreadcrumbLink render={<Link href={page.parent.href} />}>
											{page.parent.title}
										</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator className="hidden sm:block" />
								</>
							)}
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 [&>svg]:size-3.5">
									<page.icon />
									{page.title}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				)}
			</div>
			<NavUser user={user} />
		</header>
	);
}
