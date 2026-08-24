"use client";

import { authClient } from "@mezo/auth/client";
import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { toast } from "@mezo/ui/sonner";
import { useState } from "react";
import { Logo } from "./logo";

/** Plain-language labels for the scopes we hand out; unknown ones show raw. */
const SCOPE_LABELS: Record<string, string> = {
	openid: "Confirm who you are",
	profile: "Read your name and profile picture",
	email: "Read your email address",
	offline_access: "Stay connected when you are not using the app",
};

export function ConsentForm({
	clientId,
	scopes,
	oauthQuery,
}: {
	clientId: string;
	scopes: string[];
	oauthQuery: string;
}) {
	const [pending, setPending] = useState(false);

	async function decide(accept: boolean) {
		setPending(true);
		const { data, error } = await authClient.$fetch<{ redirect_uri: string }>(
			"/oauth2/consent",
			{ method: "POST", body: { accept, oauth_query: oauthQuery } },
		);

		if (error || !data?.redirect_uri) {
			toast.error(error?.message ?? "Could not complete the authorization.");
			setPending(false);
			return;
		}

		// Leaves the app for the OAuth client, so `pending` stays true on purpose.
		window.location.href = data.redirect_uri;
	}

	return (
		<Card className="w-full max-w-md [--card-spacing:--spacing(6)]">
			<CardHeader>
				<Logo className="mb-2 text-lg" />
				<CardTitle className="text-2xl">Authorize access</CardTitle>
				<CardDescription className="text-sm">
					<span className="font-medium text-foreground">{clientId}</span> wants
					to connect to your Mezo account.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{scopes.length > 0 && (
					<ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground text-sm">
						{scopes.map((scope) => (
							<li key={scope}>{SCOPE_LABELS[scope] ?? scope}</li>
						))}
					</ul>
				)}

				<div className="flex gap-3">
					<Button
						className="h-10 flex-1"
						disabled={pending}
						onClick={() => decide(false)}
						variant="outline"
					>
						Deny
					</Button>
					<Button
						className="h-10 flex-1"
						disabled={pending}
						onClick={() => decide(true)}
					>
						Allow
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
