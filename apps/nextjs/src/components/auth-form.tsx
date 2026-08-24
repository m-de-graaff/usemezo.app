"use client";

import { signIn, signUp } from "@mezo/auth/client";
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
import { Separator } from "@mezo/ui/separator";
import { toast } from "@mezo/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "~/lib/auth-error";

type Mode = "sign-in" | "sign-up";

const COPY = {
	"sign-in": {
		title: "Sign in",
		description: "Use your email and password, or continue with Google.",
		submit: "Sign in",
		altText: "No account yet?",
		altLabel: "Sign up",
		altHref: "/sign-up",
	},
	"sign-up": {
		title: "Create an account",
		description: "Sign up with an email and password, or with Google.",
		submit: "Sign up",
		altText: "Already have an account?",
		altLabel: "Sign in",
		altHref: "/sign-in",
	},
} satisfies Record<Mode, Record<string, string>>;

export function AuthForm({
	mode,
	callbackURL,
}: {
	mode: Mode;
	callbackURL: string;
}) {
	const router = useRouter();
	const copy = COPY[mode];
	const [pending, setPending] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);

		const form = new FormData(event.currentTarget);
		const email = String(form.get("email"));
		const password = String(form.get("password"));

		const result =
			mode === "sign-in"
				? await signIn.email({ email, password })
				: await signUp.email({
						email,
						password,
						name: String(form.get("name")),
						callbackURL,
					});

		setPending(false);

		if (result.error) {
			toast.error(authErrorMessage(result.error, "Something went wrong."));
			return;
		}

		if (mode === "sign-up") {
			// Email verification is required, so there is no session yet.
			toast.success(`Check ${email} for a link to verify your account.`);
			return;
		}

		router.push(callbackURL);
		router.refresh();
	}

	async function onGoogle() {
		setPending(true);
		// Redirects away on success, so `pending` stays true on purpose.
		const result = await signIn.social({ provider: "google", callbackURL });
		if (result?.error) {
			toast.error(authErrorMessage(result.error, "Could not reach Google."));
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{copy.title}</CardTitle>
				<CardDescription>{copy.description}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<form className="flex flex-col gap-4" onSubmit={onSubmit}>
					{mode === "sign-up" && (
						<div className="grid gap-2">
							<Label htmlFor="name">Name</Label>
							<Input
								autoComplete="name"
								id="name"
								name="name"
								required
								type="text"
							/>
						</div>
					)}
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
					<div className="grid gap-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							{mode === "sign-in" && (
								<Link
									className="text-muted-foreground text-xs underline"
									href="/forgot-password"
								>
									Forgot password?
								</Link>
							)}
						</div>
						<Input
							autoComplete={
								mode === "sign-in" ? "current-password" : "new-password"
							}
							id="password"
							minLength={8}
							name="password"
							required
							type="password"
						/>
					</div>

					<Button disabled={pending} type="submit">
						{copy.submit}
					</Button>
				</form>

				<Separator />

				<Button
					disabled={pending}
					onClick={onGoogle}
					type="button"
					variant="outline"
				>
					Continue with Google
				</Button>

				<p className="text-center text-muted-foreground text-sm">
					{copy.altText}{" "}
					<Link className="underline" href={copy.altHref}>
						{copy.altLabel}
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
