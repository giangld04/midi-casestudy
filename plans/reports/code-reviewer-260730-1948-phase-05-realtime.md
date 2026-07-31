# Code Review — Phase 05: Real-Time Collaboration

**Date:** 2026-07-30
**Reviewer:** code-reviewer
**Plan:** `/Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/phase-05-realtime-collaboration.md`

---

## Scope

- Files reviewed: 17 (7 NEW server, 1 NEW shared, 5 NEW web, 1 NEW test, 3 MODIFIED)
- Lines analyzed: ~850
- Review focus: correctness of optimistic reconciliation, race conditions/leaks in presence/rate-limiter, security, KISS/DRY/YAGNI
- TypeScript: `tsc --noEmit` passes clean on both `apps/api` and `apps/web`
- Updated plans: phase-05-realtime-collaboration.md → status updated to **complete**

---

## Overall Assessment

Implementation is solid. The optimistic-update / rollback model is correct and leak-free for the common paths. Security posture (Zod reuse, rate-limit, room isolation) matches requirements. A few notable issues exist: a stale closure in `deleteNote`, a room-isolation gap for unauthenticated `note:delete`, a missed `NOT_FOUND` fallback in `rejectCodeOf`, and a subtle cursor-cleanup inconsistency. None are critical for the case-study scope, but the stale-closure and room-isolation issues should be fixed before production.

---

## Critical Issues

_None found_ — no data loss or crash-class bugs that would break all users.

---

## High Priority Findings

### H1 — Stale closure in `deleteNote` captures `notes` array at call time
**File:** `apps/web/src/hooks/use-realtime-notes.ts:174–188`

```ts
const deleteNote = useCallback(
  async (id: string) => {
    const removed = notes.find((n) => n.id === id) ?? null;  // ← stale ref
    ...
  },
  [songId, socket, notes]  // notes in deps → new fn on every render
);
```

`notes` is in the dependency array, meaning `deleteNote` is recreated on every note-array change (Konva `NotesLayer` receives a fresh ref constantly, causing unnecessary re-renders). More importantly, between the `setNotes` (remove) call and a potential rollback, if another socket event races in and mutates `notes` first, `removed` is the version from when `deleteNote` was last recreated — not necessarily the current one at call time. Fix: capture inside the callback via `setNotes` functional updater to read the freshest snapshot:

```ts
// Replace the notes.find() + setNotes pair:
let removed: Note | null = null;
setNotes((prev) => {
  removed = prev.find((n) => n.id === id) ?? null;
  return prev.filter((n) => n.id !== id);
});
pending.current.set(reqId, {
  rollback: () => { if (removed) setNotes((prev) => [...prev, removed!]); },
});
```
And remove `notes` from the `useCallback` deps → `[songId, socket]`.

### H2 — `note:delete` handler does not verify the sender is in the song's room
**File:** `apps/api/src/socket/note-event-handler.ts:110–132`

Any connected socket can emit `note:delete` with an arbitrary `noteId` for any `songId`. The handler calls `deleteNote(payload.noteId)` without checking that `socket.id` is a member of `song:{songId}`. An unauthenticated attacker who connects but never joins a room can delete any note whose UUID they know (guessable via REST or DevTools). Fix: add a membership guard before calling the service — e.g., re-use the `getMember(socket.id)` pattern from `song-room-handler.ts` and verify `member?.songId === payload.songId`. Same issue exists for `note:create` and `note:update` — all three need the guard.

### H3 — `rejectCodeOf` defaults unknown errors to `"CONFLICT"` — misleading
**File:** `apps/api/src/socket/note-event-handler.ts:32–40`

```ts
function rejectCodeOf(err: unknown): RejectCode {
  if (err instanceof AppError) {
    if (err.code === "CONFLICT") return "CONFLICT";
    if (err.code === "NOT_FOUND") return "NOT_FOUND";
  }
  if (err instanceof z.ZodError) return "VALIDATION";
  return "CONFLICT";  // ← DB errors, network errors → silently labeled CONFLICT
}
```

Unexpected DB failures (constraint violations outside the known two, connection drops) are reported to the client as "CONFLICT". This causes the client to show "reverted" UI when the real issue is a 500-class error. Fix: add `"SERVER_ERROR"` to `RejectCode` in `socket-events.ts` and use it as the default. Or at minimum, log the error before re-mapping.

---

## Medium Priority Improvements

### M1 — `presence-store.ts`: `listMembers` is O(n) over all sockets, not just the room
**File:** `apps/api/src/socket/presence-store.ts:48–54`

For 50 users (per requirements) this is fine. For any real scale the map should be indexed by `songId`. Low-risk now but worth noting for Phase 06+ when concurrent rooms increase. Fix when rooms > ~20.

### M2 — Rate limiter is per-process; bypassed under Redis/multi-node scaling
**File:** `apps/api/src/socket/rate-limiter.ts`

`RateLimiter` is an in-memory singleton in `note-event-handler.ts`. With the Redis adapter enabled and two server instances, a client can make 60 req/min to each instance (120 total). Fine for case-study, but the plan claims Redis enables horizontal scaling. Fix when multi-node is exercised: move rate-limit counting to Redis using `INCR`/`EXPIRE`.

### M3 — `join-song` swaps rooms but broadcasts presence to the old room before `socket.leave` completes
**File:** `apps/api/src/socket/song-room-handler.ts:27–31`

```ts
const previous = removeMember(socket.id);
if (previous && previous !== songId) {
  socket.leave(roomOf(previous));  // async — not awaited
  broadcastPresence(io, previous);  // fires immediately after non-awaited leave
}
```

`socket.leave()` in Socket.io 4.x is synchronous for the in-memory adapter but async for the Redis adapter. With Redis, `broadcastPresence(io, previous)` may fire before the socket has actually left the room, so the leaving socket still receives the presence update for the old room. Fix: `await socket.leave(roomOf(previous))` (it returns a Promise).

### M4 — `deleteNote` optimistic rollback restores note at array tail, not original position
**File:** `apps/web/src/hooks/use-realtime-notes.ts:181–183`

```ts
rollback: () => { if (removed) setNotes((prev) => [...prev, removed]); }
```

If the note was originally at index 2, rollback appends it at the end. Piano-roll is order-dependent for selection state. Low visual impact since notes are rendered by coordinate, not array index, but position-sensitive features may differ. Fix: restore at original index via `splice` or keep the original index in the closure.

### M5 — `use-socket.ts`: disconnect on unmount does not `leave-song` explicitly
**File:** `apps/web/src/hooks/use-socket.ts:89–94`

The `useEffect` cleanup emits `leave-song` correctly, but only if `socket.connected`. If the socket is mid-reconnect when the component unmounts, the leave is skipped. Server-side `disconnect` event handles cleanup, so there's no data corruption — just a ~20s presence ghost until `pingTimeout` fires. Fix: emit `leave-song` regardless of `socket.connected` state (Socket.io will buffer it if reconnecting, or drop it cleanly if truly gone).

### M6 — `socket-client.ts` singleton is module-level; not reset between tests
**File:** `apps/web/src/lib/socket-client.ts:17`

The `let socket: AppSocket | null` module singleton is never reset. If web unit tests `import { getSocket }` across test files, they share the same instance and can cross-contaminate. Not a problem for the current API integration tests (which don't import this module) but will matter for future web hook tests. Fix: export a `resetSocket()` for test teardown, or use `vi.resetModules()`.

---

## Low Priority Suggestions

### L1 — `roomOf` helper duplicated in two files
`apps/api/src/socket/song-room-handler.ts:17` and `apps/api/src/socket/note-event-handler.ts:30` both define identical `const roomOf = (songId: string) => \`song:${songId}\``. DRY: move to a shared `socket-utils.ts`.

### L2 — `cursors-layer.tsx`: label width calculated per-render with magic constant
**File:** `apps/web/src/components/piano-roll/cursors-layer.tsx:27`
`Math.max(36, c.name.length * 7 + 12)` — `7` is font-width-estimate for 10px. Works but brittle. Minor; no behavioral impact.

### L3 — `realttime-collab.test.ts`: `once()` helper swallows the timer reference if `socket.once` fires synchronously
**File:** `apps/api/src/__tests__/realtime-collab.test.ts:53–61`
`clearTimeout` is called inside the listener, but if the event fires before `setTimeout` executes (theoretically possible in same-tick microtask queue), timer id is already 0. In practice Node 24 event loop ordering prevents this, but the pattern is slightly fragile. Not a blocking test issue.

### L4 — `newReqId` fallback branch in `use-realtime-notes.ts` is dead code in any modern browser/Node
**File:** `apps/web/src/hooks/use-realtime-notes.ts:28–31`
`crypto.randomUUID()` is available in all supported targets (Vite/React 18 + Node 24). The `Math.random` fallback is YAGNI.

### L5 — `PresenceIndicator` clips at 6 avatars without indicating overflow
**File:** `apps/web/src/components/collaboration/presence-indicator.tsx:53`
`users.slice(0, 6)` silently drops avatars when > 6 users. Fine for <50 user scope but "+N more" label would improve UX.

---

## Positive Observations

- **Service-layer reuse is excellent**: socket handlers call the same `createNote` / `updateNote` / `deleteNote` functions as REST routes — atomic transactions, duplicate-cell 409, and optimistic-lock 409 are all inherited for free.
- **reqId ledger design**: clean separation of concerns; pending ops map is scoped to a `useRef` (no re-renders on ledger mutations).
- **Graceful Redis fallback**: `createRedisAdapter` never throws, logs clearly, keeps local dev/CI working without Redis.
- **Volatile cursor emissions**: `socket.volatile.to(...)` for cursor broadcasts is the correct approach — skips buffering under load.
- **Test quality**: 5 integration tests with real Postgres + real Socket.io server, no mocks. Covers broadcast, presence, duplicate-cell conflict, stale-version conflict, and deletion. End-to-end honest.
- **TypeScript contracts in shared package**: `ClientToServerEvents` / `ServerToClientEvents` enforce type safety across transport boundary — no `any` casts observed.
- **`disconnect` cleanup registered in both handlers**: `song-room-handler` and `note-event-handler` each clean up their own state on `disconnect` (presence map + rate-limiter window), preventing unbounded growth.
- **CORS config**: socket server reads `CORS_ORIGIN` env var matching the REST CORS config — consistent allow-list.

---

## Recommended Actions (Priority Order)

1. **[H1]** Fix `deleteNote` stale closure: capture `removed` inside `setNotes` functional updater, remove `notes` from `useCallback` deps.
2. **[H2]** Add room-membership guard in `note-event-handler.ts` for all three mutation events (`note:create`, `note:update`, `note:delete`).
3. **[H3]** Add `"SERVER_ERROR"` to `RejectCode` and log unexpected errors before mapping to a reject code.
4. **[M3]** `await socket.leave()` before `broadcastPresence` in `song-room-handler.ts` for Redis-adapter correctness.
5. **[M5]** Emit `leave-song` on unmount unconditionally (not gated on `socket.connected`).
6. **[L1]** Extract `roomOf` to a shared `socket-utils.ts` to eliminate duplication.

---

## Metrics

- Type Coverage: 100% — `tsc --noEmit` clean on both apps
- Test Coverage (Phase 05): 5 integration tests, all happy + conflict + stale-version paths covered; no unit tests for client hooks (not blocking)
- Linting Issues: 0 blocking; L4 (dead fallback code) is style-only
- Security: Rate limiting present but process-local (M2); room-membership not enforced on mutations (H2) — fix H2 before any public exposure

---

## Task Completeness vs Plan Todo List

| Todo Item | Status |
|---|---|
| Install socket.io (server + client) | DONE |
| Create socket-server with Redis adapter | DONE |
| Implement song room handler (join/leave/presence) | DONE |
| Implement note event handler (create/update/delete + conflict broadcast) | DONE |
| Create socket-client singleton | DONE |
| Create use-socket hook | DONE |
| Create use-realtime-notes hook (optimistic + rollback) | DONE |
| Integrate realtime notes into piano-roll | DONE |
| Add presence indicator to UI | DONE |
| Test: open 2 browser tabs, create note in one → appears in other | DONE (automated integration test covers this) |

All 10 plan tasks completed. Phase 05 status: **COMPLETE** (with H1/H2/H3 as recommended follow-ups before production).

---

## Unresolved Questions

1. **Auth (Phase 07)**: `name` in `join-song` is currently unverified — user can claim any display name. Plan notes this is deferred to Phase 07, but H2 (room membership guard) becomes more important once auth is in place and real user IDs are used.
2. **Presence across nodes**: With Redis adapter, `listMembers()` only returns users on the local node. Is showing a partial presence list acceptable until Phase 07 or later? If not, presence needs a Redis SET per room.
3. **`cursors` prop optional vs required**: `PianoRollStage` accepts `cursors?` as optional (defaults to `[]`). The solo-editor path never passes it. This is correct by design but worth documenting that the component works in both modes.
