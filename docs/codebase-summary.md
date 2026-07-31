# AMA-MIDI Codebase Summary

**Last updated:** 2026-07-31 | **Phases complete:** 05 (Real-Time), 06 (Performance), 07 (Auth & Security), 08 (AI Semantic Search)

## Directory Structure

```
ama-midi/
├── apps/
│   ├── api/                          # Express + Socket.io backend
│   │   └── src/
│   │       ├── auth/                 # Better Auth config (Phase 07)
│   │       │   └── auth-config.ts
│   │       ├── middleware/            # Express middleware (Phase 07)
│   │       │   ├── require-auth.ts
│   │       │   ├── rate-limiter.ts
│   │       │   └── csrf-protection.ts
│   │       ├── routes/               # REST endpoints (+ search routes Phase 08)
│   │       │   └── search-routes.ts  # GET /api/songs/search (Phase 08)
│   │       ├── socket/               # WebSocket layer (Phase 05 + 07 auth)
│   │       │   ├── socket-server.ts
│   │       │   ├── redis-adapter.ts
│   │       │   ├── presence-store.ts
│   │       │   ├── song-room-handler.ts
│   │       │   ├── note-event-handler.ts
│   │       │   └── rate-limiter.ts
│   │       ├── services/             # Business logic (embedding/search Phase 08, note-service shared w/ Socket.io)
│   │       │   ├── embedding-service.ts # Gemini text-embedding-001 wrapper (Phase 08)
│   │       │   ├── search-service.ts    # pgvector + ILIKE fallback (Phase 08)
│   │       ├── lib/                  # Utilities (to-note-dto.ts for wire format)
│   │       └── __tests__/            # Real Postgres + Socket.io + auth tests
│   └── web/                          # React 18 + Vite + Konva
│       └── src/
│           ├── lib/
│           │   ├── auth-client.ts    # Better Auth typed client (Phase 07)
│           │   ├── socket-client.ts  # Typed Socket.io singleton (Phase 05)
│           │   └── performance-utils.ts # Culling + FPS utils (Phase 06)
│           ├── hooks/
│           │   ├── use-auth.ts       # Auth state + user context (Phase 07)
│           │   ├── use-search.ts     # 300ms debounced search (Phase 08)
│           │   ├── use-socket.ts     # Connection + presence (Phase 05)
│           │   ├── use-realtime-notes.ts # Optimistic apply + rollback (Phase 05)
│           │   ├── use-viewport.ts   # Scroll-derived tick window
│           │   ├── use-viewport-culling.ts # Memoized note filter (Phase 06)
│           │   └── use-fps-counter.ts # rAF FPS sampling (Phase 06)
│           ├── components/
│           │   ├── auth/             # Auth UI (Phase 07)
│           │   │   ├── login-page.tsx # Email/password + OAuth scaffold
│           │   │   └── user-menu.tsx # User menu + logout
│           │   ├── search/           # Semantic search UI (Phase 08)
│           │   │   ├── semantic-search-bar.tsx # Input + dropdown
│           │   │   └── search-result-item.tsx  # Result rows w/ similarity badge
│           │   ├── layout/
│           │   │   └── protected-route.tsx # Client-side route guard (Phase 07)
│           │   ├── piano-roll/
│           │   │   ├── piano-roll-stage.tsx # Main canvas, zoom + culling (Phase 06)
│           │   │   ├── notes-layer.tsx # Culled notes, memo'd NoteCircle (Phase 06)
│           │   │   ├── grid-layer.tsx # Static grid, own Layer (Phase 06)
│           │   │   ├── cursors-layer.tsx # Remote cursors (Phase 05)
│           │   │   └── fps-overlay.tsx # Dev-only metrics (Phase 06)
│           │   ├── collaboration/
│           │   │   └── presence-indicator.tsx # Connection + avatars (Phase 05)
│           │   ├── toolbar.tsx       # Wired to real-time updates (Phase 05)
│           │   └── app.tsx           # Root, Socket + auth init (Phase 05 + 07)
│           ├── __tests__/
│           │   └── performance-utils.test.ts # Culling + FPS tests (Phase 06)
│           └── vite-env.d.ts         # Vite types (Phase 05)
│
├── packages/
│   ├── db/                           # Drizzle + Postgres schema
│   │   ├── src/
│   │   │   └── schema/
│   │   │       ├── notes.ts          # Note table (cell uniqueness, version)
│   │   │       └── event-ledger.ts   # Atomic write coordination
│   │   └── drizzle/
│   │       └── 0002_phase08_ivfflat_embedding_index.sql # IVFFlat index for pgvector (Phase 08)
│   └── shared/                       # Typed event defs + models
│       └── src/
│           └── socket-events.ts      # Client/Server events, PresenceUser, RemoteCursor (Phase 05)
│
└── docs/
    ├── system-architecture.md        # Phase 06 + Phase 05 details
    └── codebase-summary.md           # This file
```

## Key Technologies & Patterns

### Backend (Express + Socket.io)

| Concern | Pattern |
|---------|---------|
| Authentication | Better Auth v1 (direct Postgres/Kysely); cookie sessions (7d + daily refresh) |
| Session Validation | Every request validates against DB (immediate logout; cookieCache disabled) |
| Protected Routes | requireAuth → rateLimiter → router; 100 req/15min per user |
| WebSocket Auth | Socket.io io.use() middleware; rejects unauthenticated handshakes |
| CSRF Protection | Origin-header validation on POST/PUT/DELETE/PATCH; Better Auth owns /api/auth/* CSRF |
| Note Mutations | REST (HTTP) + Socket.io WebSocket both flow through `note-service` |
| Conflict Resolution | Atomic upsert (409 on dup cell), optimistic-lock (version field), event ledger with actorId |
| Scaling | Optional Redis adapter (pub/sub); graceful fallback to in-memory |
| Presence | In-memory store per room; deferred for cross-node Redis sync |
| Semantic Search | Gemini `gemini-embedding-001` (768-dim) → pgvector cosine `<=>` via IVFFlat index; ILIKE fallback |
| Search Embedding | Fire-and-forget on song create/update; null if Gemini down (silent, no retry) |

### Frontend (React + Konva + Vite)

| Concern | Pattern |
|---------|---------|
| Authentication | Better Auth client; login/logout UI; OAuth scaffold (Google/GitHub) |
| Auth State | `use-auth` hook + context; client-side route guards |
| Canvas Rendering | Konva Stage inside natively scrolled div |
| Performance | Viewport culling (bounded node count) + memo'd NoteCircle |
| Grid | Separate Konva Layer (own canvas, drawn once, not re-rasterized) |
| Zoom | Parameterized `pixelsPerTick` (2..8), all coords derived from it |
| Real-time Updates | Optimistic apply + `reqId` ledger; rollback on `note:rejected` |
| Presence | Remote cursors (throttled 40ms emit), member avatars |
| Dev Tools | FPS + render count overlay (dev-only, stripped in prod) |
| Semantic Search | `use-search` hook (300ms debounce) → GET /api/songs/search?q=... |
| Search UI | `semantic-search-bar` input + dropdown, `search-result-item` w/ similarity badge |

### Shared Data Model

```typescript
// packages/shared/socket-events.ts

interface PresenceUser {
  socketId: string;
  name: string;
  color: string;
}

interface RemoteCursor {
  socketId: string;
  tick: number;
  pitch: number;
}

type RejectCode = 'CONFLICT' | 'STALE_VERSION' | 'FORBIDDEN' | 'RATE_LIMIT' | 'SERVER_ERROR';
```

## Testing Strategy

### Real, No Mocks

- **API tests:** Real Postgres + real Socket.io + real Gemini e2e (gated)
- **Tests:** 37 pass, 1 skipped (search gated on GEMINI_API_KEY env)
- **Web tests:** 52 tests pass (42 coordinate + 10 perf)
- Both apps compile clean (`tsc --noEmit`)
- Build clean (Vite 276 modules, 531KB bundle)

### Test Coverage

| Domain | Test Count | Notes |
|--------|-----------|-------|
| Authentication | 9 | Sign-up, sign-in, sign-out, logout revocation, rate-limit, CSRF |
| Real-time Collab | 6 | Broadcast, presence, conflict, stale-version, room-guard, delete |
| CRUD Operations | 14 | Note mutations, validation, integrity checks |
| Semantic Search | 9 | Text embedding, vector ordering, ILIKE fallback, route auth, real Gemini e2e (gated) |
| Culling | 10 | Empty, all-visible, none-visible, boundary, inverted-range, 10k-note performance |
| FPS Metrics | 3 | 60fps, rounding, non-positive window |
| Coordinates | 42 | Piano roll positioning, layout, zoom |
| **Total** | **93** | API: 37 tests (14 CRUD + 6 realtime + 9 auth + 9 search, 1 skipped); Web: 52 tests |

## Performance Notes

### Phase 06: Viewport Culling

- **Culling:** O(n) filter on note visibility; recomputes only on notes or scroll range change
- **Verified:** 10k-note set filtered in <16ms; full grid (9.6k cells) culled to <20%
- **Overlay:** Dev-only FPS counter (no idle rAF in prod)
- **Grid:** No `.cache()` (would be 100s MB retina bitmap at max zoom); `listening={false}` already excludes from hit-testing

### Phase 05: Real-time Overhead

- **Socket.io:** Negligible per-mutation cost (broadcast to room + ledger entry)
- **Optimistic:** Client-side renders immediately; rollback on reject (rare)
- **Throttle:** Cursor updates throttled 40ms (prevents flood)

## Known Issues & Deferments

| Issue | Target Phase | Notes |
|-------|--------------|-------|
| 2FA/TOTP | Stretch | User-approved deferment; adds significant complexity for low ROI |
| OAuth e2e testing | Manual only | Scaffold implemented; e2e requires real provider credentials |
| Embedding retry/queue | Phase 09+ | Fire-and-forget only; no backfill job for songs created when Gemini down |
| Query embedding cache | Phase 09+ | Redis cache could save Gemini API calls; skipped (YAGNI) |
| Presence cross-node | Phase 09+ | Needs Redis SET per room (currently process-local) |
| Rate limiter multi-node | Phase 09+ | Currently per-node; needs Redis INCR/EXPIRE for distributed scaling |
| Manual DevTools profiling | Phase 10 | 1k/5k/10k seeded notes, needs running env |
| Playwright visual regression | Phase 10 | Full build + k6 load test |

## Build & Deployment

```bash
# Development
pnpm install
pnpm dev                    # Both apps + HMR

# Production
pnpm build                  # API + web
pnpm start                  # Production server

# Testing
pnpm test                   # All apps
pnpm test:watch            # Watch mode
```

**Key Artifacts:**
- API: Express server on PORT 3000 (default), Socket.io on same port
- Web: Vite dev server on PORT 5173, SPA + Canvas rendering
- Shared: TypeScript types exported to both apps

## Next Phases

- **Phase 09+:** Embedding backfill job, query cache, presence/rate-limiter Redis sync
- **Phase 10:** Performance profiling + load testing (DevTools + k6)

---

**For detailed architecture decisions, see [`system-architecture.md`](./system-architecture.md)**
