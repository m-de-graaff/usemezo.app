"use client";

import { signOut } from "@mezo/auth/client";
import { Button } from "@mezo/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	return (
		<Button
			disabled={pending}
			onClick={async () => {
				setPending(true);
				await signOut();
				router.push("/sign-in");
				router.refresh();
			}}
			variant="outline"
		>
			Sign out
		</Button>
	);
}
