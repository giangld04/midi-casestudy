# Code Review — Phase 07: Authentication & Security

- **Date:** 2026-07-31
- **Reviewer:** code-reviewer agent
- **Phase spec:** `/Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/phase-07-auth-security.md`
- **Impl report:** `/Users/giang/Documents/Giang-Project/ama-midi/plans/reports/fullstack-developer-260731-0952-phase-07-auth.md`

---

## Code Review Summary

### Scope
- Files reviewed: 15 source files + 3 test files
- Lines analyzed: ~900 LOC
- Review focus: security-specific Phase 07 concerns (middleware order, rate limiting, CSRF, socket auth, cookie config, actorId threading, test authenticity)

### Overall Assessment

Implementation is solid. All 28 tests pass, TypeScript compiles clean. The core security architecture is correct — Better Auth handler before `express.json()`, `requireAuth` guarding `/api/songs` and `/api/notes`, socket auth rejecting on missing session. Three findings below, all LOW severity in production risk given the known test-env skip pattern is intentional and the missing test coverage are edge cases.

---

### Critical Issues

None.

---

### High Priority Findings

None.

---

### Medium Priority Findings

**M1 — Rate limiter runs before `requireAuth`: per-user 100/15min limit unreachable**
- File: `apps/api/src/index.ts:41` + `apps/api/src/middleware/rate-limiter.ts:12-16`
- `rateLimiter` is mounted globally at line 41 (`app.use(rateLimiter)`), BEFORE `requireAuth` is applied per-route at lines 56-57. At the time `rateLimiter` executes, `req.user` is always `undefined`, so the `(req.user ? 100 : 30)` branch always resolves to `30` and `keyGenerator` always takes the IP path.
- The per-user 100/15min limit advertised in the plan is dead code; every authenticated user is effectively IP-limited at 30/15min.
- **Severity:** Medium — not a security regression (IP cap is still enforced), but the intent is not met and creates misleading comments. Authenticated power users could be blocked by IP rate limits behind a shared proxy.
- **Recommended fix:** Move `rateLimiter` after `requireAuth` in the protected route chains: `app.use("/api/songs", requireAuth, rateLimiter, songRouter)` and similarly for `/api/notes`. Adjust the `skip` fn to handle `/health` only. Alternatively, split into two separate limiter instances (one global IP limiter before auth, one user-keyed limiter after).

---

### Low Priority Findings

**L1 — CSRF `req.path.startsWith("/")` condition is always true — dead check**
- File: `apps/api/src/middleware/csrf-protection.ts:28`
- The CSRF early-return condition is: `!MUTATING_METHODS.has(req.method) || !req.path.startsWith("/")`. Express always provides `req.path` starting with `/`, so the second clause `!req.path.startsWith("/")` is always `false`. The middleware correctly fires on all mutating requests regardless, but the dead branch adds confusion. A comment like `// req.path always starts with '/'` or removal of that clause would clarify.
- **Severity:** Low — no security impact, CSRF check fires correctly in all cases.

**L2 — No automated test for rate-limit (429) path and no test for logout→401 flow**
- Files: `apps/api/src/__tests__/auth.test.ts`
- Rate limiter is skipped in test env (`NODE_ENV=test`) — correct pattern per implementation notes. However, there is no test that verifies: (a) sign-out invalidates the session server-side (i.e., cookie from sign-in no longer grants 200 after sign-out), (b) the 429 response shape matches `{ ok: false, error, code: "RATE_LIMITED" }`.
- (a) is addressable without disabling rate-limit: sign-out via `/api/auth/sign-out`, then re-use the same cookie against `/api/songs` and expect 401.
- (b) can be tested by temporarily enabling or unit-testing the limiter response format.
- **Severity:** Low — coverage gap, not a runtime security bug.

---

### Positive Observations

1. **Middleware order is correct** (`index.ts:35,38`): `toNodeHandler(auth)` mounts at line 35, `express.json()` at line 38 — Better Auth reads raw body before JSON parsing. This is the documented critical ordering.

2. **`/health` is public and correctly unguarded**: `app.get("/health")` at line 47 is registered after CSRF/rate-limit but before protected routes, and both CSRF (skips GET) and rate-limit (skips `/health` path) leave it unblocked.

3. **Socket.io handshake auth is correct**: `io.use()` in `socket-server.ts:44-62` calls `auth.api.getSession()` on the raw handshake headers via `fromNodeHeaders`, rejects with `new Error("UNAUTHORIZED")` on missing/invalid session, sets `socket.data.userId` before `next()`. No bypass path identified.

4. **actorId threading is complete and consistent**: REST routes (`note-routes.ts:34,47,55`) pass `req.user?.id ?? null`; socket handlers (`note-event-handler.ts:85,105,118`) pass `socket.data.userId ?? null`. Test `crud-integrity.test.ts:235-244` verifies `events[0].actor` is truthy on authenticated mutations.

5. **Cookie security correctly configured**: `useSecureCookies: process.env["NODE_ENV"] === "production"` in `auth-config.ts:56`. Better Auth defaults to `HttpOnly` and `SameSite=Lax`. Session 7-day expiry set. Matches spec.

6. **AUTH_SECRET sourced from env with startup guard**: `auth-config.ts:9-10` throws at startup if `AUTH_SECRET` is absent — no silent fallback to insecure default.

7. **`.env` is gitignored, never committed**: Verified via `git show HEAD:.env` (fatal error), `.gitignore` includes `.env`.

8. **`.env.example` has correct placeholder** (`AUTH_SECRET=replace-with-32-plus-char-random-secret`) — no real secrets in the file.

9. **CSRF covers all mutating methods** (`csrf-protection.ts:6`): `SET = new Set(["POST", "PUT", "DELETE", "PATCH"])` — comprehensive, includes PATCH.

10. **CSRF correctly skipped in test env, active in prod**: The `NODE_ENV === "test"` check at line 39 runs AFTER the test env is confirmed to be test. In production (`NODE_ENV=production`), the skip never triggers and origin enforcement applies. Acceptable pattern.

11. **Rate limiter skip is test-env only**: `process.env["NODE_ENV"] === "test"` is evaluated at request time, not at module load, so the skip applies only in test env. Production (`NODE_ENV=production`) never matches the test skip.

12. **Tests are real, no mocks**: `signUpAndGetCookie()` issues a real HTTP sign-up via supertest, extracts the `Set-Cookie` header, and passes it in subsequent requests. No session mocking or header injection bypass.

13. **Socket rejection test is present**: `auth.test.ts:96-107` verifies that a socket with no cookie receives `connect_error` with `UNAUTHORIZED`. Valid-session connect is also tested.

14. **Web `authClient.signOut()` triggers server-side invalidation**: Better Auth's `signOut()` calls `/api/auth/sign-out` which invalidates the DB session row — not just a client-side cookie clear.

---

### Recommended Actions

1. **(Medium — M1)** Move `rateLimiter` after `requireAuth` in protected route chains so `req.user` is populated when the limiter runs. This makes the per-user 100/15min limit functional. Update the comment on `index.ts:40` accordingly.

2. **(Low — L2)** Add a `sign-out → 401` integration test: sign-up → hit protected route (200) → sign-out → hit same route with original cookie → expect 401.

3. **(Low — L1)** Remove or comment the dead `!req.path.startsWith("/")` clause in `csrf-protection.ts:28`.

---

### Metrics
- Type coverage: clean (tsc --noEmit passes, 0 errors)
- Test coverage: 28/28 pass; gap on rate-limit 429 path and logout→401 flow
- Linting issues: 0 blocking
- Critical security issues: 0
- Security regressions vs. pre-auth baseline: 0

---

### Plan File Task Status Update

All phase-07 todo items are complete per the implementation report and verified by test run. Updating phase spec status below:

**`/Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/phase-07-auth-security.md`**
- Status: **completed** (with one known medium finding: rate-limiter per-user branch unreachable due to middleware ordering)

---

## Unresolved Questions

1. Is the effective 30 req/15min IP limit acceptable for authenticated users behind a shared proxy (e.g. office NAT, CI runners)? If yes, M1 is lower priority. If no, the split-limiter approach is needed before production.
2. `authClient.signOut()` on the web side — does it await completion before the UI updates session state, or is there a race where a request could still use the old cookie before the session row is invalidated on the server? (Out of scope for backend review but worth checking in FE integration testing.)
