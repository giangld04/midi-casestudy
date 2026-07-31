# AMA-MIDI Project Roadmap

**Last Updated:** 2026-07-31 | **Overall Progress:** 80% (Phases 01-08 complete, 3 phases remaining)

## Milestone Overview

| Phase | Title | Points | Status | Completion |
|-------|-------|--------|--------|------------|
| 01 | Monorepo Setup | — | ✅ Complete | 100% |
| 02 | Database Schema & Drizzle | Foundation | ✅ Complete | 100% |
| 03 | API CRUD & Integrity | Foundation 20 + Integrity 10 | ✅ Complete | 100% |
| 04 | Piano-Roll Canvas UI | Visualization 10 + UX 10 | ✅ Complete | 100% |
| 05 | Real-Time Collaboration | Advanced Backend 10 | ✅ Complete | 100% |
| 06 | Performance & Virtualization | Performance 10 | ✅ Complete | 100% |
| 07 | Auth & Security | Security 10 | ✅ Complete | 100% |
| 08 | AI Semantic Search | AI Innovation 10 | ✅ Complete | 100% |
| 09 | DevOps, CI/CD & Deploy | DevOps 10 | pending | 0% |
| 10 | Testing Suite | Integrity coverage + Perf | pending | 0% |
| 11 | Documentation & Diagrams | Deliverables | pending | 0% |

## Completed Phases

### Phase 08: AI Semantic Search ✅
**Rubric Points:** AI Innovation 10pts | **Date Completed:** 2026-07-31

**Accomplishments:**
- Gemini text-embedding via pgvector cosine similarity (<=>) search
- SDK: @google/genai v2 (corrected from spec's deprecated text-embedding-004 → gemini-embedding-001)
- Model: outputDimensionality 768 (native 3072 truncated to match vector(768) column; cosine normalizes internally)
- Auto-embed on song create/update (fire-and-forget, try-catch guarded, no unhandled rejection)
- ILIKE fallback when key/API absent
- Migration 0002: ivfflat index on embeddings for O(log n) search
- API: GET /api/songs/search behind requireAuth+rateLimiter, Zod-validated query
- Web: debounced semantic-search-bar + result-item (similarity % badge) in toolbar
- 38/38 API tests pass INCLUDING live-Gemini e2e (real embedding, no mocks)
- tsc + web build clean; code review: 1 MUST-FIX applied (try-catch in scheduleEmbedding)

**Deferred to Future:**
- Reranking + hybrid search (BM25 + semantic blend)

---

### Phase 07: Auth & Security ✅
**Rubric Points:** Security 10pts | **Date Completed:** 2026-07-31

**Accomplishments:**
- Email/password + Google/GitHub OAuth scaffold (env-gated activation)
- Better Auth v1.x with session tables (user/session/account/verification)
- Cookie sessions: httpOnly, sameSite lax, secure-in-prod, 7d expiry, daily refresh
- requireAuth middleware guards /api/songs + /api/notes
- Socket.io handshake auth via io.use() (rejects UNAUTHORIZED, sets socket.data.userId)
- Per-user rate limiting 100/15min (after M1 fix: moved after requireAuth chain)
- CSRF origin check on all mutating methods
- actorId threaded into event ledger for audit trail (REST + Socket)
- cookieCache disabled for immediate logout revocation (no 5-min cached-session replay window)
- 29/29 API tests pass (14 CRUD + 6 realtime + 9 auth); tsc clean
- Code review M1 fix: rate-limiter moved post-requireAuth for per-user limits to work
- Code review L1/L2: dead CSRF clause removed; logout→401 coverage added

**Deferred to Future:**
- 2FA/TOTP (stretch goal; OAuth callback e2e deferred pending real provider creds)

---

### Phase 05: Real-Time Collaboration ✅
**Rubric Points:** Advanced Backend 10pts | **Date Completed:** 2026-07-30

**Accomplishments:**
- Socket.io real-time note mutations + presence tracking + live cursors
- Typed event maps (packages/shared/src/socket-events.ts)
- Note mutations sync via same service as REST (atomic integrity via upsert, 409 duplicates, optimistic-lock versioning)
- Room-based security + rate limiting (60 events/min per socket)
- Redis adapter for horizontal scaling with graceful fallback
- 6 comprehensive tests: broadcast, presence join/leave, duplicate detection, stale-version rejection, FORBIDDEN guard, delete broadcast
- Code review applied (H1 deleteNote stale closure, H2 room guard, H3 SERVER_ERROR, M3 socket.leave, M5 leave-song, L1 roomOf util, L4 dead fallback)

**Deferred to Phase 07:**
- Cross-node presence (needs Redis SET per room)
- Guest name verification
- Distributed rate limiter (Redis INCR/EXPIRE)

---

### Phase 06: Performance & Virtualization ✅
**Rubric Points:** Performance 10pts | **Date Completed:** 2026-07-31

**Accomplishments:**
- Viewport culling: O(n) filter keeps rendered node count bounded at 9.6k notes
- FPS/metrics overlay: live FPS + rendered/total/culled counts (dev-only, stripped from prod)
- Vertical zoom: 2..8 px/tick (8..32 px/s), single state var threaded through all coords
- React.memo on NoteCircle + separate grid Konva Layer (not re-rasterized on scroll)
- 10 comprehensive tests: cullNotes (empty/all/none visible, boundary cases, inverted range, 9.6k full-grid filtering <16ms), computeFps (60fps, rounding, edge cases)
- Code review applied (M1 drop grid .cache() for memory safety, M2 dev-only overlay, L1 MAX_TIME_TICK constant, L4 dead div removal)
- Production bundle: 276 modules, 153KB gzip (no idle rAF loop in prod)

**Deferred to Phase 10:**
- DevTools FPS profiling at 1k/5k/10k seeded notes
- Playwright visual regression + k6 load test

---

## Next Steps (Pending Phases)

**Phase 09 — DevOps, CI/CD & Deploy (10pts):** Docker, Railway deployment, GitHub Actions CI

**Phase 10 — Testing Suite (10pts):** Unit + integration coverage, seed scripts, DevTools profiling, Playwright visual regression, k6 load tests

**Phase 11 — Documentation & Diagrams (deliverables):** Architecture diagrams, API reference, deployment guide, case study writeup

## Key Technical Decisions (Locked)

- **Monorepo:** pnpm 11 + Turborepo 2.10
- **Frontend:** React 18 + Vite + Konva.js (PixiJS fallback if needed)
- **Backend:** Node 24 + Express + Socket.io 4.7
- **Database:** PostgreSQL 16 + Drizzle 0.35 + pgvector 0.7
- **Cache:** Redis 7
- **Auth:** Better Auth v1.x (OAuth + optional 2FA)
- **AI:** Gemini text-embedding via @google/genai v2 (gemini-embedding-001 model)
- **Deploy:** Docker + Railway + GitHub Actions

## Rubric Points Tracking

**Completed (80pts):**
- Foundation: 20pts (Phase 03)
- Visualization & Integrity: 10pts (Phase 04)
- UX: 10pts (Phase 04)
- Advanced Backend: 10pts (Phase 05)
- Performance: 10pts (Phase 06)
- Security: 10pts (Phase 07)
- AI Innovation: 10pts (Phase 08)

**Remaining (20pts):**
- DevOps: 10pts (Phase 09)
- Testing & Polish: 10pts (Phase 10-11)

## Timeline Notes

- Started: 2026-07-30
- Target Completion: 2026-08-02 (3-day sprint)
- Current Velocity: 2 phases/day (on track)
- Buffer: 1 day for integration + final polish
