"use client";

import { requestPasswordReset } from "@mezo/auth/client";
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
import { useState } from "react";
import { authErrorMessage } from "~/lib/auth-error";

export function ForgotPasswordForm() {
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);

		const email = String(new FormData(event.currentTarget).get("email"));
		const { error } = await requestPasswordReset({
			email,
			redirectTo: "/reset-password",
		});

		setPending(false);
		if (error) {
			toast.error(authErrorMessage(error, "Could not send the email."));
			return;
		}
		// Deliberately the same message whether or not the account exists —
		// otherwise this page confirms which emails are registered.
		setSent(true);
		toast.success(`If ${email} has an account, a reset link is on its way.`);
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Forgot your password?</CardTitle>
				<CardDescription>
					We will email you a link to choose a new one.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<form className="flex flex-col gap-4" onSubmit={onSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							autoComplete="email"
							id="email"
							name="email"
							required
							type="email"
						/>
					</div>
					<Button disabled={pending || sent} type="submit">
						{sent ? "Link sent" : "Send reset link"}
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
