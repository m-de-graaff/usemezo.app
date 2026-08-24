import { db } from "@mezo/db";
import { env } from "@mezo/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { sendActionEmail } from "./email";

const ONE_HOUR = 60 * 60;

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		resetPasswordTokenExpiresIn: ONE_HOUR,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }) => {
			await sendActionEmail(user.email, "Reset your Mezo password", {
				preview: "Reset your Mezo password",
				heading: "Reset your password",
				body: "Click the button below to choose a new password for your Mezo account.",
				buttonLabel: "Choose a new password",
				url,
				expiresInMinutes: ONE_HOUR / 60,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: ONE_HOUR,
		sendVerificationEmail: async ({ user, url }) => {
			await sendActionEmail(user.email, "Verify your Mezo email", {
				preview: "Confirm your email address",
				heading: "Verify your email",
				body: "Confirm this address to finish setting up your Mezo account.",
				buttonLabel: "Verify email",
				url,
				expiresInMinutes: ONE_HOUR / 60,
			});
		},
	},
	// Registering Google without credentials only produces a startup warning and
	// a 500 on the first click, so leave it out until both are configured.
	socialProviders:
		env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
						clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
					},
				}
			: {},
	rateLimit: {
		// On by default only in production; on everywhere so dev exercises it too.
		enabled: true,
		window: 60,
		max: 100,
		// ponytail: in-memory, so limits are per server instance. Move to
		// `storage: "database"` (needs a rateLimit table) or a shared Redis via
		// `secondaryStorage` once this runs on more than one instance.
		storage: "memory",
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 3 },
			"/request-password-reset": { window: 60, max: 3 },
			"/reset-password": { window: 60, max: 5 },
			"/send-verification-email": { window: 60, max: 3 },
		},
	},
	// Lets server actions persist the session cookie. Must stay last.
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
