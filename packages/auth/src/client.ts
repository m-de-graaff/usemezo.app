import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const {
	signIn,
	signUp,
	signOut,
	useSession,
	requestPasswordReset,
	resetPassword,
	sendVerificationEmail,
} = authClient;

export type Session = typeof authClient.$Infer.Session;
