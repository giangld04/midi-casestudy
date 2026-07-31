// Migration runner: applies drizzle migrations from ./drizzle directory
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import { config as loadEnv } from "dotenv";

// Load monorepo-root .env for local runs; does not override CI-provided env vars.
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

async function runMigrations() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "..", "drizzle"),
  });
  console.log("Migrations complete.");

  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
