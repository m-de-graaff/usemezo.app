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
import { authErrorMessage, passwordFieldError } from "~/lib/auth-error";
import { Logo } from "./logo";

export function ResetPasswordForm({ token }: { token: string }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		setPasswordError(null);

		const form = new FormData(event.currentTarget);
		const newPassword = String(form.get("password"));
		if (newPassword !== String(form.get("confirm"))) {
			setPasswordError("The two passwords do not match.");
			return;
		}

		setPending(true);
		const { error } = await resetPassword({ newPassword, token });
		setPending(false);

		if (error) {
			const fieldError = passwordFieldError(error);
			if (fieldError) {
				setPasswordError(fieldError);
				return;
			}
			toast.error(authErrorMessage(error, "Could not reset the password."));
			return;
		}
		toast.success("Password changed. Sign in with your new password.");
		router.push("/sign-in");
	}

	return (
		<Card className="w-full max-w-md [--card-spacing:--spacing(6)]">
			<CardHeader>
				<Logo className="mb-2 text-lg" />
				<CardTitle className="text-2xl">Choose a new password</CardTitle>
				<CardDescription>
					Signing in elsewhere will need the new password too.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<form className="flex flex-col gap-5" onSubmit={onSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="password">New password</Label>
						<Input
							aria-describedby={passwordError ? "password-error" : undefined}
							aria-invalid={passwordError ? true : undefined}
							autoComplete="new-password"
							className="h-10"
							id="password"
							minLength={8}
							name="password"
							onChange={() => passwordError && setPasswordError(null)}
							required
							type="password"
						/>
						{passwordError && (
							<p className="text-destructive text-sm" id="password-error">
								{passwordError}
							</p>
						)}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="confirm">Confirm new password</Label>
						<Input
							aria-invalid={passwordError ? true : undefined}
							autoComplete="new-password"
							className="h-10"
							id="confirm"
							minLength={8}
							name="confirm"
							onChange={() => passwordError && setPasswordError(null)}
							required
							type="password"
						/>
					</div>
					<Button className="h-10" disabled={pending} type="submit">
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
