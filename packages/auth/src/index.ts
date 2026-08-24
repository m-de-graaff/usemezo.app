import { apiKey } from "@better-auth/api-key";
import { mcp } from "@better-auth/mcp";
import { stripe } from "@better-auth/stripe";
import { db } from "@mezo/db";
import { env } from "@mezo/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, jwt, lastLoginMethod } from "better-auth/plugins";
import Stripe from "stripe";
import { sendActionEmail } from "./email";

const ONE_HOUR = 60 * 60;

// Billing stays off until the keys exist, so local dev and CI boot without them.
const stripePlugins =
	env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
		? [
				stripe({
					stripeClient: new Stripe(env.STRIPE_SECRET_KEY),
					stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
					createCustomerOnSignUp: true,
					// ponytail: no `subscription` block yet — that needs real plans and
					// price ids. Add it when the pricing page exists.
				}),
			]
		: [];

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
	// Registering a provider without credentials only produces a startup warning
	// and a 500 on the first click, so leave each one out until it is configured.
	socialProviders: {
		...(env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
						clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
					},
				}
			: {}),
		...(env.BETTER_AUTH_APPLE_CLIENT_ID && env.BETTER_AUTH_APPLE_CLIENT_SECRET
			? {
					apple: {
						clientId: env.BETTER_AUTH_APPLE_CLIENT_ID,
						clientSecret: env.BETTER_AUTH_APPLE_CLIENT_SECRET,
					},
				}
			: {}),
	},
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
	plugins: [
		// Rejects passwords that appear in a known breach, checked k-anonymously
		// against the Have I Been Pwned range API.
		haveIBeenPwned({
			customPasswordCompromisedMessage:
				"That password has shown up in a data breach. Please pick a different one.",
		}),
		// Remembers which provider was used last so the sign-in page can point at
		// it. Cookie-backed by default — no schema change.
		lastLoginMethod(),
		// Signs the tokens the MCP authorization server hands out.
		jwt(),
		// OAuth 2.1 authorization server for MCP clients.
		mcp({
			loginPage: "/sign-in",
			consentPage: "/oauth/consent",
			resource: `${env.BETTER_AUTH_URL}/api/auth/mcp`,
		}),
		// Programmatic access for the future public API.
		apiKey(),
		...stripePlugins,
		// Lets server actions persist the session cookie. Must stay last.
		nextCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
