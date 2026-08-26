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
import { BrainIcon, Trash2Icon } from "lucide-react";
import { api } from "~/trpc/react";

/**
 * Everything Milo remembers, where the user can see it and delete it.
 *
 * Memory that a person cannot read is a product deciding things about them
 * behind a curtain, and memory they cannot delete is worse. So the list lives
 * beside the conversations rather than three levels into Settings: it is part
 * of the chat, and it is on screen while the assistant is using it.
 *
 * Read-only apart from the delete. Editing a note in place would be a text box
 * in a sidebar, and the faster correction is telling Milo, which it already
 * handles by superseding the note.
 */

/** Kinds, in the order the router returns them, as a reader would say them. */
const KIND_LABEL: Record<string, string> = {
	goal: "Goal",
	constraint: "Constraint",
	preference: "Preference",
	fact: "Note",
};

export function MiloMemory() {
	const utils = api.useUtils();
	const notes = api.milo.notes.useQuery();

	const forget = api.milo.forget.useMutation({
		onSuccess: () => {
			void utils.milo.notes.invalidate();
			toast.success("Forgotten.");
		},
		onError: (error) => toast.error(error.message),
	});

	// Absent rather than empty while it loads: a "nothing yet" that turns into a
	// list a moment later reads as the app having lost something.
	if (!notes.data) return null;

	return (
		<SidebarGroup>
			<SidebarGroupLabel>What Milo remembers</SidebarGroupLabel>
			<SidebarMenu>
				{notes.data.map((note) => (
					<SidebarMenuItem key={note.id}>
						{/* Not a link: there is nowhere to go. The button is here for the
						    tooltip, which is how a truncated note is read in full. */}
						<SidebarMenuButton
							className="cursor-default"
							tooltip={`${KIND_LABEL[note.kind] ?? "Note"}: ${note.text}`}
						>
							<BrainIcon />
							<span className="truncate">{note.text}</span>
						</SidebarMenuButton>
						<SidebarMenuAction
							aria-label={`Forget: ${note.text}`}
							disabled={forget.isPending}
							onClick={() => forget.mutate({ id: note.id })}
							showOnHover
						>
							<Trash2Icon />
						</SidebarMenuAction>
					</SidebarMenuItem>
				))}

				{/* Inside a menu item, not loose in the list: `SidebarMenu` is a
				    `<ul>`, and a bare `<p>` in one is thrown out by the parser. */}
				{notes.data.length === 0 && (
					<SidebarMenuItem className="px-2 py-1.5 text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
						Nothing yet. Tell Milo what you are training for and it will keep
						it.
					</SidebarMenuItem>
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
