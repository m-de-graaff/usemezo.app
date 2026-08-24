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
		// Resend sends real mail. Leave it unset in development and everything
		// goes to SMTP_URL (a local Mailpit) instead.
		RESEND_API_KEY:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		SMTP_URL: z.string().url().default("smtp://localhost:1025"),
		EMAIL_FROM: z.string().default("Mezo <onboarding@resend.dev>"),
		DATABASE_URL: z.string().url(),
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
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		SMTP_URL: process.env.SMTP_URL,
		EMAIL_FROM: process.env.EMAIL_FROM,
		DATABASE_URL: process.env.DATABASE_URL,
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
