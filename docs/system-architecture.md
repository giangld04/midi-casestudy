# AMA-MIDI System Architecture

**Last updated:** 2026-07-31 | **Status:** Phase 07 (Auth & Security) complete

## Project Overview

AMA-MIDI is a collaborative web-based MIDI sequencer (pnpm monorepo):
- **apps/api:** Express + Socket.io server with Postgres persistence (Drizzle ORM)
- **apps/web:** React 18 + Vite + Konva Canvas for real-time piano roll editing
- **packages/db:** Drizzle schema + migrations
- **packages/shared:** Typed Socket.io event definitions + shared data models

---

## Phase 06: Performance & Virtualization

### Problem & Solution

The piano roll renders a tall canvas (`MAX_TIME_TICK * pixelsPerTick` pixels) inside a natively scrolled container. Without culling, every note becomes a live Konva node; at 9.6k notes, this means ~9.6k reconciliations + draws per frame. **Solution:** Viewport culling keeps Konva node count bounded to visible notes only.

### Architecture

**Viewport Culling Pipeline:**
1. `useViewport` hook derives `firstTick`/`lastTick` from container's `scrollTop`
2. `useViewportCulling` memoized hook filters notes to that window (O(n) inclusive-bounds filter)
3. `NotesLayer` renders only culled subset; `NoteCircle` wrapped in `React.memo` (re-renders only on added/removed/selected changes)
4. `GridLayer` is a separate Konva Layer (own canvas) → drawn once per commit, not re-rasterized on scroll

**Vertical Zoom:**
- State: `pixelsPerTick` (2..8 px/tick = 8..32 px/second)
- All coordinate math parameterized on this single var
- Buttons disabled at bounds

**Dev Metrics Overlay:**
- Gated on `import.meta.env.DEV` → visible in dev server, stripped from prod bundle
- Shows: FPS, rendered/total note counts, culled percentage
- FPS counter uses rAF loop sampling every 500ms
- No idle overhead in production

### Files (New)

| File | Purpose |
|------|---------|
| `apps/web/src/lib/performance-utils.ts` | `cullNotes(notes, firstTick, lastTick)` + `computeFps(frames, elapsedMs)` |
| `apps/web/src/hooks/use-viewport-culling.ts` | Memoized culling (recomputes only on notes/range change) |
| `apps/web/src/hooks/use-fps-counter.ts` | rAF loop + FPS sampling |
| `apps/web/src/components/piano-roll/fps-overlay.tsx` | Dev-only FPS/metrics display |

### Files (Modified)

| File | Changes |
|------|---------|
| `components/piano-roll/notes-layer.tsx` | Renders culled subset; `NoteCircle` memo'd |
| `components/piano-roll/grid-layer.tsx` | Full static grid, own Layer (not re-rasterized on scroll) |
| `components/piano-roll/piano-roll-stage.tsx` | Zoom state, culling wiring, dev overlay, zoom controls |
| `hooks/use-viewport.ts` | `MAX_TIME_TICK` extracted as constant |

### Key Decisions

- **No `.cache()` on grid:** Retina cached bitmap would be hundreds of MB at max zoom with zero scroll-time benefit; `listening={false}` already excludes from hit-testing
- **No manual dirty flag:** React-Konva already batches redraws; a manual flag over-engineers without gain
- **Dev-only overlay:** Stripped from production bundle; zero idle overhead

### Performance Results

- Tests: 52 web tests pass (42 coordinate + 10 perf)
- Build: `tsc --noEmit` clean; `vite build` clean (276 modules, 153KB gzip)
- Culling verified: 10k-note filter runs in <16ms; full-grid (9608 cells) culled to <20% of set
- No CRITICAL/HIGH code review issues

---

## Phase 05: Real-Time Collaboration

### Problem & Solution

Enable multiple users to edit the same song simultaneously with conflicting mutations, presence awareness, and live cursor tracking. **Solution:** Socket.io real-time layer reuses the same `note-service` (atomic upsert, optimistic locking, event ledger) to guarantee identical integrity as REST.

### Reconciliation Model

1. Sender optimistically renders + emits note mutation with unique `reqId`
2. Server broadcasts `note:{created,updated,deleted}` (including `reqId`) to whole room
3. All clients converge by note id; sender's `temp-{reqId}` swapped for real row on created
4. Rejections (`note:rejected`) sent to sender only → rollback via `reqId` ledger + toast UI

**Key:** Same validation + versioning logic as REST → conflicts (duplicate cell, stale version) rejected identically over WebSocket or HTTP.

### Architecture

**Socket.io Server:**
- `socket-server.ts` — WebSocket-only init, CORS, Redis adapter wire
- `redis-adapter.ts` — ioredis pub/sub; fail-fast + graceful fallback to in-memory
- `presence-store.ts` — in-memory room membership (user name/color)
- `song-room-handler.ts` — join/leave, presence broadcast, volatile cursor relay
- `note-event-handler.ts` — note mutations → service → broadcast/reject
- `rate-limiter.ts` — sliding-window: 60 events/min per socket

**Web Client:**
- `lib/socket-client.ts` — Typed singleton (connection lifecycle, auto-rejoin on reconnect)
- `hooks/use-socket.ts` — Presence + remote-cursor state, throttled cursor emit (40ms)
- `hooks/use-realtime-notes.ts` — Drop-in for `use-notes`; optimistic apply + rollback on reject
- `components/piano-roll/cursors-layer.tsx` — Konva layer, remote cursors (non-listening)
- `components/collaboration/presence-indicator.tsx` — Connection dot, avatars, member count

**Shared Types:**
- `packages/shared/src/socket-events.ts` — Typed Client/Server event maps, PresenceUser, RemoteCursor, RejectCode

### Security

| Control | Implementation |
|---------|----------------|
| Room Guard | Mutations rejected `FORBIDDEN` unless socket joined that song |
| Rate Limit | 60 events/min per socket; `RATE_LIMIT` reject code |
| Validation | Zod validators reused from REST (defense-in-depth) |
| Error Handling | Real faults → `SERVER_ERROR` + server log (not silent rollback) |
| Room Identity | Song UUIDs (not guessable) |

### Files (New)

**Shared:**
- `packages/shared/src/socket-events.ts`

**API:**
- `apps/api/src/socket/socket-server.ts`
- `apps/api/src/socket/redis-adapter.ts`
- `apps/api/src/socket/presence-store.ts`
- `apps/api/src/socket/song-room-handler.ts`
- `apps/api/src/socket/note-event-handler.ts`
- `apps/api/src/socket/rate-limiter.ts`
- `apps/api/src/socket/socket-utils.ts`
- `apps/api/src/lib/to-note-dto.ts`

**Web:**
- `apps/web/src/lib/socket-client.ts`
- `apps/web/src/hooks/use-socket.ts`
- `apps/web/src/hooks/use-realtime-notes.ts`
- `apps/web/src/components/piano-roll/cursors-layer.tsx`
- `apps/web/src/components/collaboration/presence-indicator.tsx`

### Test Coverage

- **API:** 19 tests pass (real Postgres + Socket.io, no mocks)
  - Broadcast create, presence join/leave count
  - Duplicate-cell conflict, stale-version reject
  - Room-membership guard, delete broadcast
- **Web:** 42 tests pass
- Both apps: `tsc --noEmit` clean
- Redis adapter tested (scaling path real)

### Known Limitations (Deferred to Phase 07)

1. **Presence listMembers:** Process-local → multi-node shows only same-node users; needs Redis SET per room for true cross-node
2. **Guest names:** Unverified input → deferred to Phase 07 auth
3. **Rate limiter:** Per-node only; needs Redis INCR/EXPIRE for multi-node prod deployment

---

## Phase 08: AI Semantic Search

### Problem & Solution

Enable full-text + semantic search for song discovery without manually maintained indexes. **Solution:** Generate embeddings via Gemini `gemini-embedding-001` (768-dim), store in pgvector column, query via cosine distance. Auto-embed on create/update (fire-and-forget). ILIKE fallback (no 500 errors) when Gemini unavailable or API key missing.

### Architecture

**Query → Search Flow:**
```
1. User enters query string
2. Route: GET /api/songs/search?q=... (requireAuth + rateLimiter)
3. generateEmbedding(q) → Gemini API → 768-dim vector (or null)
4a. If vector: pgvector cosine `embedding <=> $1::vector` → ranked results w/ similarity [0..1]
4b. If null: ILIKE `title/description LIKE %q%` → results (similarity=null)
5. Return SearchResult[] to client
```

**Auto-Embed on Mutation:**
- `song-service.ts`: `scheduleEmbedding()` on create/update (fire-and-forget, non-blocking)
- Silent error handling (no retry, no queue) — embedding null if Gemini down
- Re-embeds on title/description change only (timestamp/BPM updates don't re-embed)
- Uses Drizzle `sql\`${literal}::vector\`` to store 768-dim float array

**Index Strategy:**
- Migration 0002: `CREATE INDEX idx_songs_embedding_ivfflat ON songs USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)`
- IVFFlat quantizes clusters for fast approximate neighbor search (trade off: exact ranking for speed at scale)
- Requires data to build clusters (empty DB index still creates, search quality improves with population)

### Files (New)

| File | Purpose |
|------|---------|
| `apps/api/src/services/embedding-service.ts` | `generateEmbedding(text)` — Gemini wrapper, returns 768-dim float[] or null |
| `apps/api/src/services/search-service.ts` | `searchSongs(query, limit)` — vector search + ILIKE fallback, parameterized SQL |
| `apps/api/src/routes/search-routes.ts` | `GET /api/songs/search` — Zod-validated q/limit, mounted BEFORE /:id |
| `packages/db/drizzle/0002_phase08_ivfflat_embedding_index.sql` | IVFFlat index creation |

### Files (Modified)

| File | Changes |
|------|---------|
| `apps/api/src/services/song-service.ts` | `scheduleEmbedding()` call on create/update |
| `apps/api/src/index.ts` | Mount `searchRouter` at `/api/songs/search` BEFORE `songRouter` /:id |
| `apps/api/package.json` | Dependency: `@google/genai` v2.15.0 |
| `apps/web/src/hooks/use-search.ts` | 300ms debounced search hook |
| `apps/web/src/components/search/semantic-search-bar.tsx` | Input + dropdown UI |
| `apps/web/src/components/search/search-result-item.tsx` | Result rows with similarity badge |
| `apps/web/src/components/layout/toolbar.tsx` | Integrated `SemanticSearchBar` |
| `.env.example` | `GEMINI_API_KEY` placeholder |

### Configuration

- **Model:** `gemini-embedding-001` → 768-dim (matches `vector(768)` column)
- **outputDimensionality:** Truncates native 3072 dims to 768; cosine distance normalizes, so truncated vectors rank correctly
- **API Key:** `GEMINI_API_KEY` env var (required for semantic search; fallback to ILIKE if missing)
- **Rate Limit:** Search route behind same `requireAuth + rateLimiter` as mutations (100 req/15min)

### Fallback Behavior

| Scenario | Behavior | HTTP Code | Example |
|----------|----------|-----------|---------|
| Key present, Gemini up | Vector search + similarity scores | 200 | Results with similarity 0.87 |
| Key missing or Gemini down | ILIKE fallback (no error) | 200 | Results with similarity=null |
| Validation error (q missing/too long) | Zod error response | 400 | "q is required" |
| Unauthenticated | Same as other protected routes | 401 | No session cookie |

**Never returns 500:** Embedding errors are silent; search always succeeds via fallback.

### Test Coverage

- **9 tests** (1 gated on `GEMINI_API_KEY` env)
- `buildSongEmbeddingText` — 3 unit tests (title-only, title+description, edge cases)
- Vector ordering — raw SQL `<=>` cosine ranking confirmed
- ILIKE fallback — unsets key in-process, verifies text search works
- Route auth — 401 unauthenticated, 400 validation, 200 authenticated
- Real e2e Gemini — skipped if key absent (gated test)
- Existing 29 tests (phases 03/05/07) — no regressions

### Security & Performance

| Aspect | Implementation |
|--------|----------------|
| SQL Injection | Parameterized queries; no string interpolation of user input |
| Rate Limit | requireAuth + rateLimiter middleware (100 req/15min per user) |
| Validation | Zod schema: q required, 1-500 chars; limit 1-50 (default 10) |
| Fire-and-Forget | Embedding updates don't block song create/update response |
| Graceful Degradation | ILIKE fallback when Gemini key/API down → no 500 errors |

### Known Limitations (Deferred)

1. **Embedding retry/queue:** No backfill job (Phase 09 scope). Songs created when Gemini down have `embedding=NULL` forever until manually re-triggered.
2. **IVFFlat rebuild:** Empty DB index creates with empty clusters; quality improves with data. At scale, consider `CONCURRENTLY` rebuild or `hnsw` for smaller datasets.
3. **Query embedding cache:** Skipped (YAGNI). Redis cache could save Gemini calls; deferred for Phase 09+ optimization.

---

## Phase 07: Authentication & Security

### Problem & Solution

Enforce user authentication, protect collaborative mutations, secure WebSocket handshakes, and implement rate-limiting + CSRF defense. **Solution:** Better Auth v1.x (cookie-based sessions via Postgres) + middleware chains (CORS → Better Auth handler → express.json → CSRF → protected routes).

### Authentication Stack

**Better Auth v1.x (Direct Postgres via Kysely)**
- Avoids drizzle-adapter peer-dep conflicts (BA drives SQL directly via Kysely)
- Session tables: `user`, `session`, `account`, `verification`
- Cookie-based sessions (httpOnly, sameSite lax, secure-in-prod, 7d expiry)
- Daily session refresh + **cookieCache disabled** (immediate logout revocation; every request validates against DB)
- Social providers (Google/GitHub) scaffold—only activate when env secrets present

**Middleware Order (CRITICAL)**
```
CORS → Better Auth handler → express.json → CSRF → protected routes
       (raw body access)
```
Better Auth mounts BEFORE express.json to read raw request body for signature verification.

### Session Model

| Property | Value | Notes |
|----------|-------|-------|
| Expiry | 7 days | |
| Refresh | Daily | Sliding window via updateAge |
| Cookie | httpOnly | Cannot access via JavaScript |
| SameSite | lax | Prevent cross-site cookie send |
| Secure | prod only | HTTPS-only in production |
| Cache | Disabled | Every request validates DB (immediate logout) |

### Protected Route Chains

| Route | Chain | Behavior |
|-------|-------|----------|
| `/api/songs/*` | requireAuth → rateLimiter → songRouter | User-keyed 100 req/15min |
| `/api/notes/*` | requireAuth → rateLimiter → noteRouter | User-keyed 100 req/15min |
| `/health` | Public | Unaffected by auth; unmetered |

**Rate Limiter Behavior:**
- Authenticated: 100 req/15min (keyed by `req.user.id`)
- Unauthenticated: 30 req/15min (keyed by normalized IP)
- Test env: Skipped (prevents test flakiness)

### Socket.io Handshake Auth

1. Client connects with cookie headers
2. Server `io.use()` middleware calls `auth.api.getSession(fromNodeHeaders)`
3. Missing/invalid session → reject with `UNAUTHORIZED` error
4. Valid session → set `socket.data.userId` (available in all event handlers)

**Result:** Only authenticated users can join rooms or emit note mutations.

### CSRF Protection

**Mechanism:**
- Whitelist trusted origins (from env or defaults: localhost:3000, localhost:5173)
- On all mutating methods (POST, PUT, DELETE, PATCH): verify `Origin` or `Referer` header origin matches trusted list
- Better Auth owns CSRF for `/api/auth/*` internally
- Test env: Skipped (tests send direct requests)

### User Context Threading

**Request-scoped:**
- `req.user` (Better Auth session user)
- `req.session` (Better Auth session record)
- Used in `requireAuth` middleware, available to route handlers

**Socket-scoped:**
- `socket.data.userId` (set by io.use auth middleware)
- Threaded to `note-service` via `eventService.recordActor(userId)`
- Event ledger associates all mutations with actor

**Event Ledger:**
- All note mutations (REST + Socket.io) recorded with `actorId` + timestamp
- Enables audit trail + conflict resolution

### Files (New)

**API:**
- `apps/api/src/auth/auth-config.ts` — Better Auth init + social provider wiring
- `apps/api/src/middleware/require-auth.ts` — Session extraction + 401 gate
- `apps/api/src/middleware/rate-limiter.ts` — User/IP-keyed sliding-window (100/30 per 15min)
- `apps/api/src/middleware/csrf-protection.ts` — Origin-header validation
- `apps/api/src/__tests__/auth.test.ts` — Sign-up, sign-in, sign-out, logout revocation, rate-limit tests

**Web:**
- `apps/web/src/lib/auth-client.ts` — Better Auth typed client
- `apps/web/src/hooks/use-auth.ts` — Auth state + user context
- `apps/web/src/components/auth/login-page.tsx` — Email/password + OAuth scaffold UI
- `apps/web/src/components/auth/user-menu.tsx` — Logged-in user menu + logout
- `apps/web/src/components/layout/protected-route.tsx` — Client-side route guard

**Updated Files:**
- `apps/api/src/index.ts` — Middleware order documented; requireAuth + rateLimiter per protected chain
- `apps/api/src/socket/socket-server.ts` — io.use() auth middleware (Phase 07 addition)
- `apps/api/src/services/{note-service,event-service}.ts` — actorId threading
- `.env.example` — AUTH_SECRET, GOOGLE/GITHUB_CLIENT_ID/SECRET placeholders

### Test Coverage

- **29/29 API tests pass** (14 CRUD + 6 realtime + 9 auth)
- Sign-up → verify user created
- Sign-in → verify session cookie set
- Sign-out + same cookie → 401 (revocation verified)
- Rate limiter reachability + per-user branching
- CSRF origin check
- Socket.io auth reject on missing/invalid session

### Security Posture

| Control | Status |
|---------|--------|
| Auth Handler mounts before express.json | ✓ |
| Mutations require requireAuth | ✓ |
| Sessions DB-validated every request | ✓ |
| Socket.io rejects unauthenticated connections | ✓ |
| Rate limiting keyed by user/IP | ✓ |
| CSRF origin validation | ✓ |
| Event ledger tracks actorId | ✓ |
| AUTH_SECRET env-gated + .gitignored | ✓ |

### Deferred

- **2FA/TOTP:** Stretch feature (user approved deferment)
- **OAuth e2e:** Lives on scaffold; needs real provider credentials for full callback testing

---

## Data Layer

**Database:** Postgres (Drizzle ORM in packages/db)
- Note integrity: atomic upsert (cell uniqueness), optimistic lock (version), event ledger
- WebSocket mutations flow through same service as REST

**Optional Redis:** Adapter for horizontal scaling with graceful fallback to in-memory

---

## Deployment Notes

- Socket.io server created only outside test mode (no leaked handles)
- Vite build: 276 modules, 153KB gzip
- Performance overlay stripped from production (dev-only)
- Culling + grid architecture scales to 10k+ notes with bounded rendering
