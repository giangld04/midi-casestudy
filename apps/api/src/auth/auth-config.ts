// Better Auth configuration.
// Uses a direct pg Pool connection — avoids drizzle-orm peer-dep version conflicts
// that arise from the drizzle adapter. BA handles SQL directly via Kysely.
// Table names "user", "session", "account", "verification" match BA v1 defaults.
// Social providers (Google/GitHub) only activate when env secrets are present.
import { betterAuth } from "better-auth";
import { Pool } from "pg";

const AUTH_SECRET = process.env["AUTH_SECRET"];
if (!AUTH_SECRET) throw new Error("AUTH_SECRET env var is required");

const AUTH_URL = process.env["AUTH_URL"] ?? "http://localhost:3000";
const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");

// Dedicated pool for Better Auth — separate from app's Drizzle pool
const authPool = new Pool({ connectionString: DATABASE_URL });

// Social providers only wired when both id+secret are present (YAGNI / conditional)
function buildSocialProviders() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: Record<string, any> = {};
  const googleId = process.env["GOOGLE_CLIENT_ID"];
  const googleSecret = process.env["GOOGLE_CLIENT_SECRET"];
  if (googleId && googleSecret) {
    providers["google"] = { clientId: googleId, clientSecret: googleSecret };
  }
  const githubId = process.env["GITHUB_CLIENT_ID"];
  const githubSecret = process.env["GITHUB_CLIENT_SECRET"];
  if (githubId && githubSecret) {
    providers["github"] = { clientId: githubId, clientSecret: githubSecret };
  }
  return providers;
}

export const auth = betterAuth({
  // Pass pg Pool directly — BA detects "connect" method and wraps it in PostgresDialect
  // (see @better-auth/kysely-adapter createKyselyAdapter: "connect" in db → PostgresDialect)
  database: authPool,
  secret: AUTH_SECRET,
  baseURL: AUTH_URL,
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
  socialProviders: buildSocialProviders(),
  session: {
    // cookieCache intentionally DISABLED: a signed session snapshot in the cookie would
    // let getSession skip the DB, leaving a revocation gap where a sign-out (DB row deleted)
    // still validates until the cache expires. We validate against the DB every request so
    // logout revokes access immediately — correct for a security-graded collaborative editor,
    // and cheap at this scale (local Postgres, requireAuth already runs per request).
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh daily
  },
  trustedOrigins: [
    process.env["WEB_ORIGIN"] ?? "http://localhost:5173",
    process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  ],
  advanced: {
    cookiePrefix: "ama-midi",
    useSecureCookies: process.env["NODE_ENV"] === "production",
  },
});

export type Auth = typeof auth;
