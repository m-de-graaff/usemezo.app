import { loadEnvFile } from "node:process";

// The monorepo keeps a single .env at the root; Next only looks in its own
// directory, so pull it in before anything reads process.env.
try {
	loadEnvFile(new URL("../../.env", import.meta.url).pathname.slice(1));
} catch {
	// Absent in CI and on Vercel, where the platform supplies the variables.
}

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("@mezo/env");

/** @type {import("next").NextConfig} */
const config = {
	// Workspace packages ship TypeScript source, so Next compiles them itself.
	transpilePackages: [
		"@mezo/api",
		"@mezo/auth",
		"@mezo/db",
		"@mezo/env",
		"@mezo/ui",
	],
	images: {
		// Exercise stills and animations, pinned to one commit of the dataset.
		// They are referenced rather than committed because the imagery is
		// © Gym visual; see `packages/api/src/exercises.ts`.
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cdn.jsdelivr.net",
				pathname: "/gh/hasaneyldrm/exercises-dataset@**",
			},
		],
	},
};

export default config;
