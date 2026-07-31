// Drizzle Kit configuration for schema generation and migrations
import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// drizzle-kit runs this config from packages/db and does NOT auto-load .env, so
// `pnpm --filter @ama-midi/db db:migrate` (README step 4) needs the monorepo-root
// .env loaded here. dotenv does not override already-set vars (e.g. CI job env).
loadEnv({ path: resolve(process.cwd(), "../../.env") });

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL environment variable is required");
}

const config: Config = {
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env["DATABASE_URL"],
  },
};

export default config;
