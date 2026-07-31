# Code Review — Phase 09: DevOps / CI-CD

**Date:** 2026-07-31
**Reviewer:** code-reviewer
**Impl report:** `plans/reports/fullstack-developer-260731-1058-phase-09-devops.md`

---

## Scope

| File | Lines | Status |
|---|---|---|
| `apps/api/Dockerfile` | 53 | reviewed |
| `apps/web/Dockerfile` | 44 | reviewed |
| `apps/web/nginx.conf` | 24 | reviewed |
| `.dockerignore` | 40 | reviewed |
| `docker-compose.yml` | 42 | reviewed |
| `docker-compose.prod.yml` | 96 | reviewed |
| `.github/workflows/ci.yml` | 144 | reviewed |
| `railway.json` | 13 | reviewed |
| `.env.example` (root) | 40 | reviewed |
| `apps/api/.env.example` | 23 | reviewed |
| `apps/web/.env.example` | 8 | reviewed |

---

## Overall Assessment

Phase 09 is well-structured. The CI/CD pipeline, Dockerfiles, and compose files follow correct patterns. No real secrets found in committed files. Two issues require attention: a weak default password in `docker-compose.prod.yml` and a missing `server_tokens off` in nginx. Everything else is clean.

---

## Critical Issues

None. No real credentials committed. No root-user runtime in API. `.env*` excluded from image build context.

---

## High Priority Findings

### [HIGH] `docker-compose.prod.yml` — weak hardcoded default fallback passwords

**Lines 18, 35, 39:**
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
--requirepass ${REDIS_PASSWORD:-changeme}
redis-cli -a "${REDIS_PASSWORD:-changeme}" ping
```

`changeme` is an industry-known default; if an operator forgets to set `POSTGRES_PASSWORD` or `REDIS_PASSWORD` in the env file, prod DB and Redis run with a known-weak password. The fallback `-:changeme` provides false safety.

**Fix:** Remove the `:-changeme` fallback so Docker Compose fails loudly on missing vars, forcing the operator to set them explicitly:
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
```

### [HIGH] `.gitignore` does not cover `.env.production`

`.gitignore` contains:
```
.env
.env.local
.env.*.local
```

`.env.production` (referenced in `docker-compose.prod.yml` usage comment) is **not** covered by these patterns. If a developer creates `.env.production` locally, it would not be gitignored and could be accidentally committed.

**Fix:** Add to `.gitignore`:
```
.env.*
!.env.example
```

This mirrors the `.dockerignore` approach which already does this correctly.

---

## Medium Priority Findings

### [MEDIUM] `apps/web/Dockerfile` — nginx runtime runs as root

The web Dockerfile has no `USER` directive in the nginx runtime stage. nginx:1.27-alpine runs the master process as root (worker processes drop to `nginx` user via built-in config, but the master is root). The API Dockerfile correctly adds `appuser`; the web should follow the same pattern where possible.

**Note:** nginx requires root to bind port 80 — the standard mitigation is to use `nginx:unprivileged` image or remap to port 8080 with a non-root user. This is a deliberate tradeoff in many deployments. Since the web container is behind a reverse proxy/Railway routing in practice, risk is reduced but not zero.

**Fix option (lowest effort):** Switch to `nginxinc/nginx-unprivileged:1.27-alpine` and expose port 8080, update compose `ports: "80:8080"`.

### [MEDIUM] `apps/web/nginx.conf` — missing `server_tokens off`

Nginx by default exposes version in error pages and `Server:` response header (`nginx/1.27.x`). This is minor information leakage.

**Fix:** Add to `server {}` block:
```nginx
server_tokens off;
```

### [MEDIUM] `.env.example` (root + api) — dev DB credentials are real local credentials, not placeholders

```
DATABASE_URL=postgresql://ama_midi_user:ama_midi_pass@localhost:5432/ama_midi_db
```

These match `docker-compose.yml` dev credentials. They are not "real" production secrets, so this is acceptable for a dev compose setup, but the comments could more clearly indicate these are **dev-only local compose credentials** and should never be reused in production.

Current comment says "Local dev: matches docker-compose.yml credentials" — adequate. No action required, flagging for awareness only.

---

## Low Priority Suggestions

### [LOW] CI `AUTH_SECRET` is a hardcoded string, not a GitHub secret

```yaml
AUTH_SECRET: ci-test-secret-do-not-use-in-production
```

This value is safe for CI test usage — it's intentionally a dummy, clearly labeled, and never touches production. However, using `${{ secrets.CI_AUTH_SECRET }}` would be more aligned with secret hygiene discipline. Not required.

### [LOW] `docker-compose.yml` — no version field warning

`version: "3.9"` is technically deprecated in newer Docker Compose (v2 ignores it). No functional impact.

### [LOW] `railway.json` — missing `numReplicas` / region config

`railway.json` is a minimal scaffold. Fine for current state; Railway injects defaults. No action needed.

### [LOW] CI deploy job is a no-op scaffold

The deploy job echoes a placeholder string instead of deploying. This is documented and intentional. Operator must add `RAILWAY_TOKEN` and uncomment commands. Clear comment provided. No issue.

---

## Positive Observations

- **No real secrets committed.** All `.env.example` files contain only placeholders or empty values. Auth secrets, Gemini key, OAuth secrets all correctly use `replace-with-...` or empty strings.
- **`.dockerignore` is correct and thorough.** Pattern `.env.*` with `!.env.example` exception is exactly right. Excludes `node_modules`, `dist`, `.turbo`, `docs`, `plans`.
- **API Dockerfile runs as non-root.** `addgroup -S appgroup && adduser -S appuser -G appgroup` + `USER appuser` on line 44-45.
- **Multi-stage builds** prune dev deps correctly. API uses `pnpm deploy --prod`; web discards the builder stage entirely.
- **Base images use minor-pinned tags** (`node:24-alpine`, `nginx:1.27-alpine`, `pgvector/pgvector:pg16`, `redis:7-alpine`). Not SHA-pinned but minor tags are acceptable for this project.
- **CI postgres service uses `pgvector/pgvector:pg16`** — matches dev compose, ensures pgvector extension is available during tests.
- **DB migrations run before tests** (step order: migrate → test). Correct sequencing.
- **`GEMINI_API_KEY` absent in CI** is intentional and well-documented; gated tests skip cleanly.
- **`pnpm install --frozen-lockfile`** enforced in both CI and Dockerfiles — reproducible installs.
- **Health check consistent** across all three consumers: `railway.json` (`/health`), `docker-compose.prod.yml` (`wget .../health`), `apps/api/Dockerfile` HEALTHCHECK. Route exists at `apps/api/src/index.ts:46`.
- **SPA fallback** in nginx.conf is correct (`try_files $uri $uri/ /index.html`).
- **Immutable cache headers** for hashed static assets (`Cache-Control: public, immutable`, `expires 1y`). Correct.
- **Redis password in prod compose** (`--requirepass ${REDIS_PASSWORD:-changeme}`) — password protection exists; weakness is only the fallback value (see HIGH above).

---

## Recommended Actions

1. **[HIGH — fix before production deploy]** Remove `:-changeme` fallbacks in `docker-compose.prod.yml` for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`. Use `:?` syntax to fail-fast on missing vars.
2. **[HIGH — fix before production deploy]** Add `.env.*` (with `!.env.example` exception) to `.gitignore` to cover `.env.production` and other suffixed env files.
3. **[MEDIUM — optional but recommended]** Add `server_tokens off;` to `apps/web/nginx.conf`.
4. **[MEDIUM — optional]** Switch web runtime to `nginxinc/nginx-unprivileged:1.27-alpine` + port 8080 to eliminate root master process.

---

## Metrics

- Secret leakage: 0 real secrets committed
- Hardcoded CI secrets: 1 (`AUTH_SECRET` dummy — acceptable)
- Gitignore gaps: 1 (`.env.production` not covered)
- Weak defaults: 2 (`:-changeme` fallbacks in prod compose)
- Root-user runtime images: 1 (web nginx)
- Missing security headers: 1 (`server_tokens` in nginx.conf)
- Build correctness: PASS (per impl report; not re-run per instructions)
- Health check alignment: PASS (consistent across all 3 consumers)

---

## Unresolved Questions

1. Should the deploy job activate now (user adds `RAILWAY_TOKEN`) or remain scaffolded? Needs user decision.
2. API image 376MB uncompressed — acceptable for this case study? (Per impl report deviation #1.)
3. For web deployment on Railway: nginx Docker container vs static site hosting (Vercel/Netlify)? nginx works but Railway native static hosting would be smaller/faster.
