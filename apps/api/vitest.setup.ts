// Load the monorepo-root .env before any test module (which imports the db
// client) is evaluated, so DATABASE_URL is present when createDb() runs.
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env") });
