// Database client: Drizzle ORM over postgres (pg) driver
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazy-initialise: only connect when DATABASE_URL is present
const createPool = (): Pool => {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return new Pool({ connectionString: url });
};

/** Shared Drizzle database client (initialised on first import in api) */
export const createDb = () => {
  const pool = createPool();
  return drizzle(pool, { schema });
};

// Re-export schema tables + inferred types for consumers (api, tests)
export * from "./schema";

// Convenience type alias for the db instance
export type DbClient = ReturnType<typeof createDb>;
