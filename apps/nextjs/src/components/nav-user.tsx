"use client";

import { signOut } from "@mezo/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@mezo/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@mezo/ui/dropdown-menu";
import { ThemeToggle } from "@mezo/ui/theme";
import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type NavUserProps = {
	user: { name?: string | null; email: string; image?: string | null };
};

export function NavUser({ user }: NavUserProps) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const label = user.name?.trim() || user.email;

	return (
		<div className="flex items-center gap-2">
			<ThemeToggle />
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label="Account menu"
					className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<Avatar>
						{user.image && <AvatarImage alt="" src={user.image} />}
						<AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					{/* Not `DropdownMenuLabel` — Base UI's GroupLabel throws outside a
					    `Menu.Group`, and this heading labels the menu, not a group. */}
					<div className="px-1.5 py-1 text-sm">
						<p className="truncate font-medium">{label}</p>
						{user.name && (
							<p className="truncate text-muted-foreground text-xs">
								{user.email}
							</p>
						)}
					</div>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						disabled={pending}
						onClick={async () => {
							setPending(true);
							await signOut();
							router.push("/sign-in");
							router.refresh();
						}}
						variant="destructive"
					>
						<LogOutIcon />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
