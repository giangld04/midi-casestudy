// Load the monorepo-root .env before any test module (which imports the db
// client / auth config) is evaluated, so required vars are present when
// createDb() and Better Auth run.
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env") });

// Fallback test defaults. dotenv (above) does NOT override already-set vars, and
// `??=` only fills gaps — so local .env and CI job-env values always win. This
// guarantees the vitest worker has the required env even when no root .env is
// present (CI) and the worker doesn't inherit the job-level env. Values match the
// CI postgres/redis services and docker-compose.yml.
process.env["AUTH_SECRET"] ??= "test-secret-do-not-use-in-production";
process.env["AUTH_URL"] ??= "http://localhost:3000";
process.env["DATABASE_URL"] ??=
  "postgresql://ama_midi_user:ama_midi_pass@localhost:5432/ama_midi_db";
process.env["REDIS_URL"] ??= "redis://localhost:6379";
process.env["CORS_ORIGIN"] ??= "http://localhost:5173";
process.env["WEB_ORIGIN"] ??= "http://localhost:5173";
