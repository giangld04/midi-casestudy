# Phase 09 — DevOps / CI-CD / Deploy — Implementation Report

**Date:** 2026-07-31
**Status:** completed (local verification passed; live cloud deploy deferred — needs user account)

---

## Files Created / Modified

| File | Action | Notes |
|---|---|---|
| `apps/api/Dockerfile` | created | 2-stage: builder (install + tsc) + runtime (node:24-alpine, non-root) |
| `apps/web/Dockerfile` | created | 2-stage: builder (Vite build) + runtime (nginx:1.27-alpine) |
| `apps/web/nginx.conf` | created | SPA fallback + gzip + 1y cache headers for hashed assets |
| `.dockerignore` | created | excludes node_modules, .env*, dist, .turbo, docs, plans |
| `docker-compose.yml` | modified | added comment header; healthchecks were already present |
| `docker-compose.prod.yml` | created | full stack: api + web + postgres(pgvector) + redis, no ports exposed for infra |
| `.github/workflows/ci.yml` | created | jobs: ci (typecheck/lint/build/migrate/test) + deploy (scaffold) |
| `railway.json` | created | deploy scaffold for Railway CLI |
| `.env.example` (root) | modified | added GEMINI_API_KEY placeholder |
| `apps/api/.env.example` | modified | aligned with actual variable names (AUTH_SECRET, not BETTER_AUTH_SECRET) |
| `apps/web/.env.example` | created | VITE_API_URL only |

---

## Docker Approach

### API (`apps/api/Dockerfile`)
- **Base:** `node:24-alpine`
- **Stage 1 (builder):** corepack + pnpm@10.31.0, `pnpm install --frozen-lockfile`, `pnpm --filter @ama-midi/api build` (tsc → dist/), then `pnpm deploy --legacy` to prune dev deps into /prod
- **Stage 2 (runtime):** node:24-alpine, copy /prod/node_modules + dist/ + drizzle migrations, non-root user (appuser)
- **Port:** 3000
- **HEALTHCHECK:** `wget -qO- http://localhost:3000/health` (uses existing `/health` route)
- **CMD:** `node dist/index.js` (pre-compiled, no tsx at runtime — KISS)

### Web (`apps/web/Dockerfile`)
- **Stage 1 (builder):** node:24-alpine, pnpm fetch + install (offline cache), `pnpm --filter @ama-midi/web build` (tsc + vite → dist/)
- **Stage 2 (runtime):** `nginx:1.27-alpine`, custom nginx.conf (SPA fallback), copy dist assets
- **Port:** 80

---

## CI Workflow Jobs

### `ci` job (ubuntu-latest)
Services: `pgvector/pgvector:pg16` (port 5432) + `redis:7-alpine` (port 6379)
Steps: checkout → setup-node@v4 (node 24) → corepack pnpm@10.31.0 → cache pnpm store → cache .turbo → install → typecheck → lint → build → migrate (tsx packages/db/src/migrate.ts) → test

ENV in CI:
- `DATABASE_URL`: points to service container
- `REDIS_URL`: points to service container
- `AUTH_SECRET`: dummy CI value
- `NODE_ENV=test` → CSRF and rate-limit middleware skip (existing logic)
- `GEMINI_API_KEY` absent → search tests use ILIKE fallback (search.test.ts (c) path)

### `deploy` job (scaffold only)
- `needs: ci`, runs on `push` to `main` only
- Steps are commented out — echoes instructions to add `RAILWAY_TOKEN` secret

---

## Deploy Scaffold

**railway.json** — minimal Railway config pointing to Dockerfile, `/health` healthcheck.

**Required env vars for production** (set in Railway dashboard / cloud provider):
```
DATABASE_URL          # Railway injects from Postgres plugin
REDIS_URL             # Railway injects from Redis plugin
AUTH_SECRET           # openssl rand -base64 32
AUTH_URL              # https://your-api.railway.app
CORS_ORIGIN           # https://your-web.railway.app
WEB_ORIGIN            # https://your-web.railway.app
GOOGLE_CLIENT_ID      # optional OAuth
GOOGLE_CLIENT_SECRET  # optional OAuth
GITHUB_CLIENT_ID      # optional OAuth
GITHUB_CLIENT_SECRET  # optional OAuth
GEMINI_API_KEY        # optional — search falls back to ILIKE
```

**GitHub Actions secret needed:**
- `RAILWAY_TOKEN` → add at repo Settings → Secrets → Actions

---

## Verification Results

| Check | Result |
|---|---|
| `docker build --check -f apps/api/Dockerfile .` | PASS — no warnings |
| `docker build --check -f apps/web/Dockerfile .` | PASS — no warnings |
| `docker build -f apps/api/Dockerfile -t ama-midi-api:test .` | PASS — built in ~15s |
| `docker build -f apps/web/Dockerfile -t ama-midi-web:test .` | PASS — Vite 325 modules, built in 775ms |
| CI YAML syntax (python yaml.safe_load) | PASS — 2 jobs parsed |
| API image size | 376MB uncompressed (~150-180MB compressed) |
| Web image size | 77MB uncompressed |

---

## Deviations from Spec

1. **API image >200MB:** Spec says <200MB. Actual: 376MB uncompressed. Root cause: Better Auth + Gemini SDK (@google/genai 16MB) + Drizzle + react-dom (included by legacy deploy) inflate node_modules to ~120MB; Node 24 alpine base ~170MB. Compressed transfer size would be ~160MB. To hit <200MB uncompressed would require removing @google/genai from prod deps (use dynamic import) or switching to distroless — out of scope / YAGNI for this phase.

2. **Health route at `/health` not `/api/health`:** Phase spec says `GET /api/health`. Existing code (Phase 03) already has `/health`. Changing path would break existing tests. Dockerfiles and compose files use `/health` — consistent with implementation.

3. **`pnpm deploy --legacy` flag required:** pnpm v10 changed default to require injected workspace packages. `--legacy` flag preserves pre-v10 behavior. Harmless WARN in output.

4. **Live deploy not executed:** Railway/cloud account + RAILWAY_TOKEN not available in this context. Deploy job scaffolded with instructions; `railway.json` created.

5. **`docker-compose.yml` minimal change:** File already had healthchecks for postgres and redis (Phase 01). Added comment header clarifying dev vs prod split — no structural changes needed.

---

## Unresolved Questions

1. Should `GEMINI_API_KEY` be a CI secret for the end-to-end Gemini test (search.test.ts "(e) [gated]")? Currently it's absent in CI → gated test skips. User can add `GEMINI_API_KEY` as a GitHub Actions secret if needed.

2. Railway deploy for web (static SPA) — Railway can serve nginx Docker containers, but static site hosting (with CDN) may work better via Vercel/Netlify for the web app. The `docker-compose.prod.yml` runs nginx but Railway's routing between api and web services needs the user to configure.

3. API image >200MB — acceptable for case study? Can be reduced by separating `@google/genai` into an optional dynamic import pattern.
