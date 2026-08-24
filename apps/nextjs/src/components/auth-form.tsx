"use client";

import { getLastUsedLoginMethod, signIn, signUp } from "@mezo/auth/client";
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
import { useEffect, useState } from "react";
import { authErrorMessage, passwordFieldError } from "~/lib/auth-error";
import { AppleIcon } from "./apple-icon";
import { GoogleIcon } from "./google-icon";
import { Logo } from "./logo";

type Mode = "sign-in" | "sign-up";

const COPY = {
	"sign-in": {
		title: "Sign in",
		description:
			"Use your email and password, or continue with Google or Apple.",
		submit: "Sign in",
		altText: "No account yet?",
		altLabel: "Sign up",
		altHref: "/sign-up",
	},
	"sign-up": {
		title: "Create an account",
		description:
			"Sign up with an email and password, with Google, or with Apple.",
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
	// Cookie-backed, so it is only readable after hydration.
	const [lastMethod, setLastMethod] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	useEffect(() => setLastMethod(getLastUsedLoginMethod()), []);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPasswordError(null);
		setNotice(null);
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
			const fieldError = passwordFieldError(result.error);
			if (fieldError) {
				setPasswordError(fieldError);
				return;
			}
			toast.error(authErrorMessage(result.error, "Something went wrong."));
			return;
		}

		if (mode === "sign-up") {
			// Email verification is required, so there is no session yet.
			setNotice(`Check ${email} for a link to verify your account.`);
			return;
		}

		router.push(callbackURL);
		router.refresh();
	}

	async function onSocial(provider: "google" | "apple") {
		setPending(true);
		// Redirects away on success, so `pending` stays true on purpose.
		const result = await signIn.social({ provider, callbackURL });
		if (result?.error) {
			const name = provider === "google" ? "Google" : "Apple";
			toast.error(authErrorMessage(result.error, `Could not reach ${name}.`));
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-md [--card-spacing:--spacing(6)]">
			<CardHeader>
				<Logo className="mb-2 text-lg" />
				<CardTitle className="text-2xl">{copy.title}</CardTitle>
				<CardDescription className="text-sm">
					{copy.description}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<form className="flex flex-col gap-5" onSubmit={onSubmit}>
					{mode === "sign-up" && (
						<div className="grid gap-2">
							<Label htmlFor="name">Name</Label>
							<Input
								autoComplete="name"
								className="h-10"
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
							className="h-10"
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
							aria-describedby={passwordError ? "password-error" : undefined}
							aria-invalid={passwordError ? true : undefined}
							autoComplete={
								mode === "sign-in" ? "current-password" : "new-password"
							}
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

					<Button className="h-10" disabled={pending} type="submit">
						{copy.submit}
					</Button>

					{notice && (
						<p
							aria-live="polite"
							className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm"
						>
							{notice}
						</p>
					)}
				</form>

				<Separator />

				<div className="flex flex-col gap-3">
					<Button
						className="h-10"
						disabled={pending}
						onClick={() => onSocial("google")}
						type="button"
						variant="outline"
					>
						<GoogleIcon className="size-4" />
						Continue with Google
						{lastMethod === "google" && <LastUsed />}
					</Button>
					<Button
						className="h-10"
						disabled={pending}
						onClick={() => onSocial("apple")}
						type="button"
						variant="outline"
					>
						<AppleIcon className="size-4" />
						Continue with Apple
						{lastMethod === "apple" && <LastUsed />}
					</Button>
				</div>

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

function LastUsed() {
	return (
		<span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-normal text-[0.7rem] text-muted-foreground">
			Last used
		</span>
	);
}
