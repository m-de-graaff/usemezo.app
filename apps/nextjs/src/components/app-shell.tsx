import { SidebarInset, SidebarProvider } from "@mezo/ui/sidebar";
import { AppHeader } from "~/components/app-header";
import { AppSidebar } from "~/components/app-sidebar";
import type { NavUserProps } from "~/components/nav-user";

export function AppShell({
	children,
	user,
}: NavUserProps & { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<AppHeader user={user} />
				<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
