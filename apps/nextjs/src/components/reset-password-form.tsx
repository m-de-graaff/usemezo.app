"use client";

import { resetPassword } from "@mezo/auth/client";
import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { Input } from "@mezo/ui/input";
import { Label } from "@mezo/ui/label";
import { toast } from "@mezo/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "~/lib/auth-error";

export function ResetPasswordForm({ token }: { token: string }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const form = new FormData(event.currentTarget);
		const newPassword = String(form.get("password"));
		if (newPassword !== String(form.get("confirm"))) {
			toast.error("The two passwords do not match.");
			return;
		}

		setPending(true);
		const { error } = await resetPassword({ newPassword, token });
		setPending(false);

		if (error) {
			toast.error(authErrorMessage(error, "Could not reset the password."));
			return;
		}
		toast.success("Password changed. Sign in with your new password.");
		router.push("/sign-in");
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Choose a new password</CardTitle>
				<CardDescription>
					Signing in elsewhere will need the new password too.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<form className="flex flex-col gap-4" onSubmit={onSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="password">New password</Label>
						<Input
							autoComplete="new-password"
							id="password"
							minLength={8}
							name="password"
							required
							type="password"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="confirm">Confirm new password</Label>
						<Input
							autoComplete="new-password"
							id="confirm"
							minLength={8}
							name="confirm"
							required
							type="password"
						/>
					</div>
					<Button disabled={pending} type="submit">
						Change password
					</Button>
				</form>
				<p className="text-center text-muted-foreground text-sm">
					<Link className="underline" href="/sign-in">
						Back to sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
