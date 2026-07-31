# AMA-MIDI — Collaborative Piano-Roll MIDI Editor

A real-time, multi-user piano-roll MIDI editor. Draw notes on an 8-track grid, watch collaborators'
cursors and edits appear live, and find songs by meaning with AI semantic search. Built as a
Senior-level case study around three hard problems: **canvas performance**, **data integrity under
concurrency**, and **real-time collaboration**.

> Stack: React 18 · Vite · Konva.js · Node · Express · Socket.io · PostgreSQL 16 + pgvector ·
> Drizzle ORM · Redis 7 · Better Auth · Gemini embeddings · Turborepo · pnpm

## Features

- **Piano-roll editor** — 8 tracks × 1200 ticks (0.25 s/tick, 5 min), Konva canvas with viewport
  culling that holds ~60 fps at 10k notes.
- **Real-time collaboration** — live note create/update/delete, presence list, and volatile remote
  cursors over Socket.io (Redis adapter for cross-node fan-out).
- **Data integrity** — one note per grid cell via `UNIQUE(song_id, track, time_tick)`; optimistic
  locking (`version`) rejects stale writes; every mutation appends to an immutable event ledger in
  the same transaction.
- **AI semantic search** — Gemini 768-d embeddings ranked by pgvector cosine distance, with an
  automatic ILIKE fallback (never 500s).
- **Auth & security** — Better Auth email/password + Google/GitHub OAuth, HttpOnly cookie sessions,
  Origin/Referer CSRF checks, per-user rate limiting.

## Quick Start

Prerequisites: **Node 20+**, **pnpm 10+**, **Docker** (for Postgres + Redis).

```bash
git clone <repo-url> ama-midi && cd ama-midi   # 1. clone
pnpm install                                    # 2. install workspace deps
cp .env.example .env                            # 3. config (set AUTH_SECRET; Gemini key optional)
docker compose up -d && pnpm --filter @ama-midi/db db:migrate  # 4. start DB/Redis + migrate
pnpm dev                                         # 5. run API :3000 + web :5173
```

Open **http://localhost:5173**, sign up, and start placing notes. Generate `AUTH_SECRET` with
`openssl rand -base64 32`. OAuth and Gemini keys are optional — the app degrades gracefully without
them.

## Architecture

The API and WebSocket share one HTTP server; REST and Socket.io mutations flow through the **same
service layer**, so integrity guarantees hold on every transport.

```
apps/web  →  React + Vite + Konva piano-roll, socket.io-client, Better Auth client
apps/api  →  Express REST + Socket.io + service layer (note · song · event · search · embedding)
packages/db      →  Drizzle schema + migrations (Postgres 16 + pgvector)
packages/shared  →  typed socket events + shared constants
```

Deep dives live in [`docs/`](./docs):

- [Architecture & diagrams](./docs/architecture.md) — system, ER, component, canvas, real-time flow
- [Trade-offs](./docs/trade-offs.md) — Konva/Drizzle/optimistic-lock/cookie/ledger/Railway decisions
- [API reference](./docs/api-reference.md) — REST routes + Socket.io events
- [Event ledger](./docs/event-ledger.md) — append-only audit trail + undo design

## Testing

```bash
pnpm test          # unit + integration (Vitest, real Postgres) — excludes e2e
pnpm test:e2e      # Playwright end-to-end (auto-starts web, proxies /api → API)
pnpm test:load:notes && pnpm test:load:search   # k6 load (requires k6 installed)
```

Coverage highlights: coordinate/perf unit tests, Zod boundary tests, CRUD-integrity + realtime +
auth + search integration, and e2e for the conflict, boundary, realtime-sync, and auth flows.

## Deployment

Targets **Railway** — managed Postgres (with pgvector) + Redis alongside the Turborepo. Railway
injects `DATABASE_URL`/`REDIS_URL`; set `AUTH_SECRET`, `AUTH_URL`, `CORS_ORIGIN`, `WEB_ORIGIN`, and
`VITE_API_URL` to the deployed URLs. CI/CD runs via GitHub Actions. See
[`docs/system-architecture.md`](./docs/system-architecture.md) for phase-by-phase detail.

## License

MIT
