import { apiKeyClient } from "@better-auth/api-key/client";
import { stripeClient } from "@better-auth/stripe/client";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [lastLoginMethodClient(), apiKeyClient(), stripeClient()],
});

export const {
	signIn,
	signUp,
	signOut,
	useSession,
	requestPasswordReset,
	resetPassword,
	sendVerificationEmail,
	getLastUsedLoginMethod,
	isLastUsedLoginMethod,
} = authClient;

export type Session = typeof authClient.$Infer.Session;
