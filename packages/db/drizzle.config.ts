import { loadEnvFile } from "node:process";
import type { Config } from "drizzle-kit";

// Same single root .env as the apps; see apps/nextjs/next.config.js.
loadEnvFile(new URL("../../.env", import.meta.url).pathname.slice(1));

const { env } = await import("@mezo/env");

export default {
	schema: "./src/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
} satisfies Config;
