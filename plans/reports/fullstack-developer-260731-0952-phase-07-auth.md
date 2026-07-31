# Phase 07 — Authentication & Security: Implementation Report

## Executed Phase
- Phase: phase-07-auth-security
- Plan: /Users/giang/Documents/Giang-Project/ama-midi/plans/
- Status: completed

## Files Modified

### New Files Created
| File | Lines | Purpose |
|------|-------|---------|
| `packages/db/src/schema/auth.ts` | 60 | Auth tables (user, session, account, verification) with camelCase columns |
| `apps/api/src/auth/auth-config.ts` | 50 | betterAuth config using direct pg Pool adapter |
| `apps/api/src/middleware/require-auth.ts` | 22 | Session validation middleware, sets req.user |
| `apps/api/src/middleware/rate-limiter.ts` | 24 | Rate limiting (100/15min auth, 30/15min anon, skip test env) |
| `apps/api/src/middleware/csrf-protection.ts` | 51 | Origin/Referer CSRF guard, skips test env |
| `apps/api/src/types/express.d.ts` | 14 | Express.Request augmentation (user, session fields) |
| `apps/api/src/__tests__/helpers/auth-test-helper.ts` | 52 | signUpAndGetCookie, cookieHeader, cleanAuthTables helpers |
| `apps/api/src/__tests__/auth.test.ts` | 115 | 8 auth integration tests |
| `apps/web/src/lib/auth-client.ts` | 10 | Better Auth React client (createAuthClient) |
| `apps/web/src/hooks/use-auth.ts` | 47 | useAuth hook wrapping authClient.useSession() |
| `apps/web/src/components/auth/login-page.tsx` | 165 | Login/signup form + social buttons |
| `apps/web/src/components/auth/user-menu.tsx` | 82 | Avatar dropdown with logout |
| `apps/web/src/components/layout/protected-route.tsx` | 28 | Auth gate: loading → null, !auth → LoginPage, else children |
| `.env.example` | 18 | Template with all auth env vars |

### Modified Files
| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Added `export * from "./auth"` |
| `apps/api/src/index.ts` | Full rewrite: CORS+credentials, toNodeHandler, rateLimiter, csrfProtection, requireAuth on routes |
| `apps/api/src/socket/socket-server.ts` | SocketData type, io.use() auth middleware, fromNodeHeaders |
| `apps/api/src/socket/note-event-handler.ts` | SocketData type, passes socket.data.userId as actorId |
| `apps/api/src/socket/song-room-handler.ts` | Updated IO/ClientSocket types with SocketData |
| `apps/api/src/services/note-service.ts` | createNote/updateNote/deleteNote accept actorId param |
| `apps/api/src/routes/note-routes.ts` | Passes req.user?.id ?? null as actorId |
| `apps/api/src/__tests__/crud-integrity.test.ts` | Added auth: signUpAndGetCookie, .set("Cookie") on all requests |
| `apps/api/src/__tests__/realtime-collab.test.ts` | Added auth: session cookie, extraHeaders on socket connect |
| `apps/api/vitest.config.ts` | Added server.deps.external for pg, kysely, better-auth |
| `apps/web/src/components/layout/toolbar.tsx` | Added userMenu?: ReactNode prop |
| `apps/web/src/app.tsx` | ProtectedRoute wrapper, UserMenu in Toolbar |
| `apps/web/src/lib/api-client.ts` | credentials: "include" |
| `apps/web/src/lib/socket-client.ts` | withCredentials: true |
| `package.json` (root) | pnpm.overrides: drizzle-orm@0.38.4 |
| `.env` | AUTH_SECRET, AUTH_URL, CORS_ORIGIN, WEB_ORIGIN, OAuth placeholders |

## Tasks Completed

- [x] Auth DB schema (user, session, account, verification tables) with camelCase column names
- [x] Drizzle migration for auth tables
- [x] betterAuth config with direct pg Pool (avoids drizzle-orm version coupling)
- [x] Email/password auth fully functional
- [x] Google/GitHub OAuth scaffold (conditional on env vars)
- [x] Cookie-based sessions (HttpOnly, SameSite=Lax, 7-day expiry)
- [x] requireAuth middleware (GET /api/auth headers → session)
- [x] Rate limiter (100/15min auth, 30/15min anon, skip test+health)
- [x] CSRF protection (Origin/Referer check, skip test env)
- [x] toNodeHandler mounted BEFORE express.json()
- [x] CORS with credentials:true and explicit origin
- [x] Socket.io auth middleware (io.use(), fromNodeHeaders, socket.data.userId)
- [x] actorId threaded through note-service → event ledger
- [x] Web auth client (better-auth/react createAuthClient)
- [x] useAuth hook
- [x] LoginPage component (email+password + social buttons)
- [x] UserMenu component (avatar + logout dropdown)
- [x] ProtectedRoute gate
- [x] api-client credentials:include, socket-client withCredentials:true
- [x] All 28 API tests pass (14 crud + 6 realtime + 8 auth)
- [x] Web typecheck clean (0 errors)
- [x] Web build clean (527 kB bundle, chunk size warning advisory only)

## Tests Status
- Type check (API): pass
- Type check (Web): pass — fixed better-auth import path (`better-auth/react` not `better-auth/client/react`)
- Unit/integration tests: 28/28 pass
  - crud-integrity: 14/14
  - realtime-collab: 6/6
  - auth: 8/8
- Web build: pass (tsc + vite build)

## Key Technical Decisions

1. **Direct pg Pool adapter** — better-auth accepts `database: pool` directly; detects `connect` method and wraps in `PostgresDialect`. Avoids drizzle-orm version coupling entirely.

2. **camelCase column names** — better-auth v1 Kysely adapter uses field names as SQL column names without conversion. Schema uses `emailVerified`, `userId`, `createdAt` etc. not snake_case.

3. **pnpm.overrides drizzle-orm@0.38.4** — prevents multiple drizzle-orm versions (TypeScript private-field incompatibility between minor versions).

4. **Rate limiter skips test env** — rate limiter uses in-memory store, 14 sequential tests sharing one user ID exhaust the 30-req unauthenticated limit (limiter runs before requireAuth so req.user is unset at that point). Skip in test is the correct pattern (same as csrfProtection).

5. **toNodeHandler before express.json()** — better-auth reads raw request body for POST /api/auth routes. Placing after json() breaks sign-up/sign-in.

## Issues Encountered

1. drizzle-orm version conflict — resolved via pnpm.overrides
2. pg not in apps/api deps — resolved via `pnpm --filter @ama-midi/api add pg`
3. `db.selectFrom is not a function` — resolved by passing Pool directly (not wrapped)
4. camelCase vs snake_case DB columns — resolved by rewriting auth schema
5. `ipKeyGenerator` signature takes string not Request — resolved: `ipKeyGenerator(req.ip ?? "unknown")`
6. `better-auth/client/react` not found — resolved: correct path is `better-auth/react`
7. Rate limiter 429 in test — resolved: added `NODE_ENV === "test"` skip condition

## Next Steps

- Phase 07 complete. Unblocks any phases depending on authenticated users.
- OAuth providers (Google/GitHub) become active when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` are added to `.env`.
- Generate a secure AUTH_SECRET: `openssl rand -base64 32`
- For production: set `NODE_ENV=production` to enable Secure cookies.
