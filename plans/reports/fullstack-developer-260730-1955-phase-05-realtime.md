# Phase 05 — Real-Time Collaboration (Impl Report)

**Date:** 2026-07-30 19:55 | **Status:** ✅ complete | **Rubric:** Advanced Backend 10pts

## What shipped
Socket.io real-time note collaboration + presence + live cursors. Note mutations
flow over WebSocket through the SAME `note-service` as REST → identical integrity
(atomic upsert → 409 duplicate cell, optimistic-lock via version, atomic event
ledger). Optional Redis adapter for horizontal scaling with graceful fallback.

## Files
**Shared:** `packages/shared/src/socket-events.ts` (typed Client/Server event maps,
PresenceUser, RemoteCursor, RejectCode) + index re-export.

**API (`apps/api/src/`):**
- `socket/socket-server.ts` — Socket.io init, websocket-only, CORS, Redis adapter wire
- `socket/redis-adapter.ts` — ioredis pub/sub adapter; fail-fast + graceful fallback
- `socket/presence-store.ts` — in-memory room membership + guest name/color
- `socket/song-room-handler.ts` — join/leave, presence broadcast, volatile cursor relay
- `socket/note-event-handler.ts` — note:create/update/delete → service → broadcast/reject; room-membership guard + rate limit (60/min)
- `socket/rate-limiter.ts` — sliding-window per socket
- `socket/socket-utils.ts` — `roomOf(songId)`
- `lib/to-note-dto.ts` — DB row (desc: null) → shared Note (desc?: string) wire contract
- `index.ts` — socket server created only outside test mode (no leaked handles in REST tests)

**Web (`apps/web/src/`):**
- `lib/socket-client.ts` — typed singleton (VITE_API_URL, websocket, autoConnect off)
- `hooks/use-socket.ts` — connection lifecycle, join/leave, auto-rejoin on reconnect, presence + remote-cursor state, throttled cursor emit (40ms)
- `hooks/use-realtime-notes.ts` — drop-in for use-notes; optimistic apply + reqId ledger + rollback on note:rejected; REST initial load
- `components/piano-roll/cursors-layer.tsx` — Konva layer, remote cursors (non-listening)
- `components/collaboration/presence-indicator.tsx` — connection dot + avatars + count
- wired: `app.tsx`, `piano-roll-stage.tsx` (cursors + mousemove), `toolbar.tsx`
- `vite-env.d.ts` — vite/client types

## Reconciliation model
Sender optimistically renders + emits with unique `reqId`. Server broadcasts
note:{created,updated,deleted} (incl. reqId) to whole room → all clients converge
by id; created echo swaps sender's `temp-{reqId}` for real row. Rejections
(note:rejected) go to sender only → rollback via reqId ledger + toast.

## Security (applied from code review)
- Room-membership guard: mutations rejected FORBIDDEN unless socket joined that song
- Rate limit 60 events/min per socket; RATE_LIMIT reject
- Zod validators reused from REST (defense-in-depth bounds)
- Real server faults → SERVER_ERROR code + server-side log (not silent rollback)
- Room names = song UUIDs (not guessable)

## Tests (real Postgres + real Socket.io, no mocks)
`apps/api/src/__tests__/realtime-collab.test.ts` — 6 tests: broadcast created,
presence join/leave count, duplicate-cell CONFLICT (no double-insert), stale-version
optimistic-lock reject, FORBIDDEN for non-joined socket, delete broadcast.
**Result:** 19 API + 42 web pass, stable ×3 runs; both apps `tsc --noEmit` clean;
Redis adapter connects (scaling path real).

## Code review
`plans/reports/code-reviewer-260730-1948-phase-05-realtime.md` — no CRITICAL.
Applied: H1 (deleteNote stale closure), H2 (room guard), H3 (SERVER_ERROR),
M3 (await socket.leave), M5 (unconditional leave-song), L1 (roomOf util), L4 (drop dead fallback).

## Unresolved / deferred
1. Presence `listMembers` is process-local → multi-node shows only same-node users.
   Acceptable until Phase 07; needs Redis SET per room for true cross-node presence.
2. `join-song` `name` is unverified guest input → deferred to Phase 07 auth.
3. Rate limiter per-node (120/min total across 2 nodes) → Redis INCR/EXPIRE for prod.
