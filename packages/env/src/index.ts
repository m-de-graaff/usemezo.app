import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		BETTER_AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		BETTER_AUTH_URL: z.string().url().default("http://localhost:3050"),
		// Optional outside production so the app boots before OAuth is set up;
		// Better Auth just disables the Google provider when they are missing.
		BETTER_AUTH_GOOGLE_CLIENT_ID:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		BETTER_AUTH_GOOGLE_CLIENT_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		// Apple's "client secret" is a short-lived JWT you generate from the
		// private key; both stay optional so the provider is simply skipped
		// until they are set.
		BETTER_AUTH_APPLE_CLIENT_ID: z.string().optional(),
		BETTER_AUTH_APPLE_CLIENT_SECRET: z.string().optional(),
		// Optional everywhere for now: billing is wired but has no plans yet, so
		// the Stripe plugin stays off until the keys exist.
		STRIPE_SECRET_KEY: z.string().optional(),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),
		// Resend sends real mail. Leave it unset in development and everything
		// goes to SMTP_URL (a local Mailpit) instead.
		RESEND_API_KEY:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		SMTP_URL: z.string().url().default("smtp://localhost:1025"),
		EMAIL_FROM: z.string().default("Mezo <onboarding@resend.dev>"),
		DATABASE_URL: z.string().url(),
		// OpenRouter, which is what Milo talks to. Optional outside production so
		// the app still boots without it; the chat endpoint says so plainly
		// rather than failing with a provider error.
		AI_OPEN_ROUTER_KEY:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		BETTER_AUTH_GOOGLE_CLIENT_ID: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
		BETTER_AUTH_GOOGLE_CLIENT_SECRET:
			process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
		BETTER_AUTH_APPLE_CLIENT_ID: process.env.BETTER_AUTH_APPLE_CLIENT_ID,
		BETTER_AUTH_APPLE_CLIENT_SECRET:
			process.env.BETTER_AUTH_APPLE_CLIENT_SECRET,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		SMTP_URL: process.env.SMTP_URL,
		EMAIL_FROM: process.env.EMAIL_FROM,
		DATABASE_URL: process.env.DATABASE_URL,
		AI_OPEN_ROUTER_KEY: process.env.AI_OPEN_ROUTER_KEY,
		NODE_ENV: process.env.NODE_ENV,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
