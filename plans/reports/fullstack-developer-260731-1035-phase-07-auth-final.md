# Phase 07 — Auth & Security (Final Impl Report)

**Date:** 2026-07-31 10:35 | **Status:** ✅ complete | **Rubric:** Security 10pts

## Scope (user-approved, LEAN)
Email/password (primary, fully tested) + Google/GitHub OAuth **scaffold** (activates only
when env secrets present) + session guards + rate-limit + CSRF origin check + Socket.io
handshake auth. **2FA DEFERRED** (stretch, per user).

## Stack
Better Auth v1.x (NOT plan's 0.14 — outdated). Direct `pg.Pool` → BA drives SQL via Kysely
(avoids drizzle-adapter peer-dep conflict). Cookie sessions: httpOnly, sameSite lax,
secure-in-prod, 7d expiry, daily refresh. Tables: user/session/account/verification.

## Post-review fixes applied (this pass)
Code review `code-reviewer-260731-1028-phase-07-auth.md` → no CRITICAL/HIGH. Applied all 3:

- **M1 — rate-limiter reachability.** `rateLimiter` was global `app.use()` BEFORE `requireAuth`
  → `req.user` always undefined → per-user 100/15min branch was dead code (everyone IP-capped
  at 30). Fix: moved into protected chains AFTER auth: `app.use("/api/songs", requireAuth,
  rateLimiter, songRouter)` (+ `/api/notes`). Now user-keyed limit is live. `/health` sits
  outside these chains so it's unaffected; simplified skip fn to test-env only.
- **L1 — dead CSRF clause.** Removed always-false `!req.path.startsWith("/")` from
  `csrf-protection.ts` guard.
- **L2 — logout→401 coverage.** Added integration test: sign-up → GET /api/songs 200 →
  sign-out → **same cookie → 401**.

## Bug surfaced by the new logout test (real, fixed)
Test initially FAILED (old cookie still 200 after sign-out). Root cause: `session.cookieCache`
was enabled (5-min signed snapshot in cookie) → `getSession` skipped DB → revocation gap /
cookie-replay window after logout. **Disabled cookieCache** → every request validates against
the DB → logout revokes immediately. Correct for a security-graded editor; cheap at this scale
(local Postgres, requireAuth already per-request). NOT a test cheat — closed a real gap.

## Files
**API:** `auth/auth-config.ts`, `middleware/{require-auth,rate-limiter,csrf-protection}.ts`,
`index.ts` (middleware order), `socket/socket-server.ts` (io.use handshake auth),
`services/{note-service,event-service}.ts` (actorId threading), `__tests__/auth.test.ts`,
`__tests__/helpers/auth-test-helper.ts`.
**Web:** `lib/auth-client.ts`, `hooks/use-auth.ts`, `components/auth/{login-page,user-menu}.tsx`,
`components/layout/protected-route.tsx`, `app.tsx`, `lib/{api-client,socket-client}.ts`
(credentials/cookie), `.env.example`.
**DB:** auth schema (user/session/account/verification).

## Verification
`pnpm --filter @ama-midi/api test` → **29/29 pass** (14 CRUD + 6 realtime + 9 auth).
`tsc --noEmit` clean (api + web). web `vite build` clean (from prior pass; no web files touched
this fix pass).

## Security posture (reviewer-confirmed)
- BA handler mounts before `express.json()` (raw body) ✓
- `requireAuth` guards /api/songs + /api/notes; /health public ✓
- Socket `io.use()` rejects missing/invalid session (`UNAUTHORIZED`), sets `socket.data.userId` ✓
- actorId threaded to event ledger (REST + socket) ✓
- AUTH_SECRET from env w/ startup guard; `.env` gitignored; `.env.example` placeholders only ✓
- CSRF origin check on all mutating methods, BA owns /api/auth/* CSRF ✓

## Onboarding (user action required)
1. Generate secret: `openssl rand -base64 32` → set `AUTH_SECRET` in `apps/api/.env`.
2. OAuth optional: set `GOOGLE_CLIENT_ID/SECRET` and/or `GITHUB_CLIENT_ID/SECRET` to activate
   those buttons (scaffold no-ops without them).

## Deferred
2FA/TOTP (stretch). OAuth live-callback e2e (needs real provider creds) — manual demo only.
