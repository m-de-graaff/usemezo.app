import { loadEnvFile } from "node:process";
import type { Config } from "drizzle-kit";

// Same single root .env as the apps; see apps/nextjs/next.config.js.
loadEnvFile(new URL("../../.env", import.meta.url).pathname.slice(1));

// Read straight from process.env rather than @mezo/env: drizzle-kit bundles
// this file as CJS, where the top-level await that import needs is a syntax
// error, and the only value needed here is the connection string.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default {
	schema: "./src/schema.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: { url },
} satisfies Config;
