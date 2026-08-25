"use client";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@mezo/ui/sidebar";
import { toast } from "@mezo/ui/sonner";
import { MessageSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "~/trpc/react";

/**
 * Milo's past conversations, under the main nav.
 *
 * Only rendered on `/milo`, the same way Settings swaps the nav out: a list of
 * chats is noise on the dashboard, and the sidebar is the one place in the app
 * that has room for it.
 */
export function MiloThreadList() {
	const pathname = usePathname();
	const router = useRouter();
	const utils = api.useUtils();
	const threads = api.milo.list.useQuery();

	const remove = api.milo.remove.useMutation({
		onSuccess: (_data, { id }) => {
			void utils.milo.list.invalidate();
			toast.success("Conversation deleted.");
			// Deleting the one on screen would otherwise leave it readable until
			// the next navigation.
			if (pathname === `/milo/${id}`) router.push("/milo");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Conversations</SidebarGroupLabel>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						render={<Link href="/milo" />}
						tooltip="New conversation"
					>
						<PlusIcon />
						<span>New conversation</span>
					</SidebarMenuButton>
				</SidebarMenuItem>

				{threads.data?.map((thread) => (
					<SidebarMenuItem key={thread.id}>
						<SidebarMenuButton
							isActive={pathname === `/milo/${thread.id}`}
							render={<Link href={`/milo/${thread.id}`} />}
							tooltip={thread.title ?? "Untitled conversation"}
						>
							<MessageSquareIcon />
							<span className="truncate">
								{thread.title ?? "Untitled conversation"}
							</span>
						</SidebarMenuButton>
						<SidebarMenuAction
							aria-label={`Delete ${thread.title ?? "this conversation"}`}
							disabled={remove.isPending}
							onClick={() => remove.mutate({ id: thread.id })}
							showOnHover
						>
							<Trash2Icon />
						</SidebarMenuAction>
					</SidebarMenuItem>
				))}

				{/* Inside a menu item, not loose in the list: `SidebarMenu` is a
				    `<ul>`, and a bare `<p>` in one is thrown out by the parser. */}
				{threads.data?.length === 0 && (
					<SidebarMenuItem className="px-2 py-1.5 text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
						Nothing here yet. Ask Milo something.
					</SidebarMenuItem>
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
