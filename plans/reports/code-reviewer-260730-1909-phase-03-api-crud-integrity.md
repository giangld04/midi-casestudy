# Code Review Report — Phase 03: REST API CRUD & Data Integrity

**Date:** 2026-07-30
**Reviewer:** code-reviewer agent
**Plan:** Phase 03 (no plan file found in /plans)

---

## Code Review Summary

### Scope
- **Files reviewed:** 14 source files + 3 schema files
- **Lines of code:** ~430 LOC (API) + ~140 LOC (schema)
- **Review focus:** Phase 03 REST API — Song+Note CRUD, data integrity, transactions, security

### Overall Assessment
High-quality implementation. Architecture is clean, separation of concerns is well-maintained, integrity guarantees are correctly layered (Zod → service → DB constraint backstop), and transactions are used correctly. No critical security vulnerabilities. A few important correctness gaps and minor concerns noted below.

---

## Critical Issues

None.

---

## High Priority (IMPORTANT) Findings

### 1. CORS wildcard in production — `index.ts` line 16
```ts
app.use(cors({ origin: process.env["VITE_API_URL"] ?? "*" }));
```
`VITE_API_URL` is a client-side Vite env var (prefix `VITE_`) — it will not exist in the Node process unless explicitly forwarded. The fallback `"*"` means production can silently serve open CORS. The env var name is also semantically wrong for the API (it describes the API URL *from the client's perspective*, not the allowed origin). Should use a dedicated `CORS_ORIGIN` server env var with no wildcard fallback.

### 2. Missing `GET /api/notes/:id` endpoint
`noteRouter` (flat mount at `/api/notes`) exposes only `PUT /:id` and `DELETE /:id`. There is no `GET /api/notes/:id`. This is a REST completeness gap — callers who have a note ID cannot fetch it without listing all notes for a song. Whether intentional (fetch-via-song-list model) is not documented. If it is intentional, add a comment justifying the omission; otherwise add the route.

### 3. `updateNoteSchema` min version `z.number().int().min(1)` — will silently break v0 notes
```ts
version: z.number().int().min(1),
```
The DB `version` column defaults to `1` on insert, so `min(1)` is safe today. However, if the default changes or a row is ever manually set to 0 (e.g., migration or seed), this validation will block all updates on those rows with an opaque 400 instead of a 409. Prefer `min(0)` with the logical check "must match DB version" enforced by the optimistic-lock logic itself.

### 4. `missing vs stale` distinction is a read-inside-transaction TOCTOU risk — `note-service.ts` lines 69-77
```ts
const existing = await tx
  .select({ id: notes.id })
  .from(notes)
  .where(eq(notes.id, noteId));
if (existing.length === 0) {
  throw new NotFoundError("Note not found");
}
throw new ConflictError("Stale version ...");
```
The secondary SELECT is inside the same transaction (correct), but in Drizzle's default READ COMMITTED isolation the note could be deleted by another tx between the UPDATE and this SELECT, causing the secondary SELECT to also return empty — correctly surfacing 404. This is fine. However: there is a subtle edge case when a caller sends `version: 0` — Zod blocks it with 400 (see item 3), so the DB never sees it; this is not a bug but the coupling is fragile.

### 5. `createSong` return cast `as SongDto` — `song-service.ts` line 40
```ts
const [song] = await db.insert(songs).values(input).returning(songColumns);
return song as SongDto;
```
The type assertion `as SongDto` is used because destructuring `[song]` types it as `SongDto | undefined`. The comment "insert...returning always yields a row on success" is correct but the `as` cast silences TypeScript. A safer pattern is to check for undefined and throw (consistent with how `updateSong` and `getSongById` handle this). This is a type-safety smell.

### 6. No rate limiting or request size cap — `index.ts`
`express.json()` is used without a `limit` option. Default is 100 kb — acceptable for now but should be documented. No rate-limiting middleware (express-rate-limit) is present. For a Phase 03 monorepo case study this is acceptable, but should be tracked.

---

## Medium Priority Improvements

### 7. `eventType` column is `text` with no DB-level enum — `events.ts` line 31
```ts
eventType: text("event_type").notNull(),
```
`EventType` is a TS union type only. The DB column accepts any string, so a typo in a future `recordEvent` call would silently persist bad data. A Postgres enum or a CHECK constraint would enforce the invariant at the DB layer.

### 8. `payload` stores full note snapshot on delete — event-service + note-service
On `note_deleted` the full `Note` row is stored as payload. This is intentional for undo/redo replay. However there is no size cap on the JSONB payload, and future notes may gain large fields (e.g., wave data). Document the payload strategy or add a max-size guard.

### 9. `updateSong` does not record an event — `song-service.ts`
Song mutations (create, update, delete) write no event rows. Note mutations do. This asymmetry is fine if song-level events are deferred to a later phase, but it should be explicitly documented in the service file.

### 10. `songRouter.use("/:songId/notes", nestedNoteRouter)` — no song existence pre-check
`POST /api/songs/:songId/notes` will attempt to insert a note with an invalid `song_id`. The FK constraint on `notes.song_id` will fire, and the error-handler maps `23503 → 404`. This works correctly but the 404 message is generic (`"Referenced resource not found"`) rather than the more helpful `"Song not found"`. A `getSongById` pre-check in the route or a per-route guard would give a better DX.

### 11. Test isolation — `beforeEach` deletes all songs globally
```ts
beforeEach(async () => { await db.delete(songs); });
```
This works but truncates the entire songs table before each test. In a shared CI database this would conflict with parallel test runs. Use a per-test random seed prefix or wrap each test in a transaction that rolls back. Acceptable for Phase 03 but should be upgraded before CI parallelism.

### 12. No `GET /api/notes/:id` test coverage
Tests cover list-via-song, create, update, delete, and event ledger. There is no test for fetching a single note directly (see item 2). If the route is intentionally absent, this is consistent; otherwise it's a coverage gap.

---

## Low Priority Suggestions

### 13. `asyncHandler` return type could be `void` instead of `Promise<unknown>`
```ts
(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>)
```
`Promise<void>` is more precise and communicates that route handlers are not expected to return values. Minor.

### 14. `eslint-disable-next-line` comment in `error-handler.ts` line 27
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```
The `_next` parameter is required by Express's 4-argument error handler signature. Prefixing with `_` should be enough for most ESLint configs. Prefer renaming unused params to `_next` consistently (already done for `_req`) rather than suppressing. Alternatively the lint config's `argsIgnorePattern: "^_"` would make this disable unnecessary.

### 15. `lint` script is a no-op — `package.json` line 12
```json
"lint": "echo 'No linting configured'"
```
No ESLint is wired in for the `api` package. Pre-commit lint pass is effectively skipped. Should add `eslint` with the project's shared config.

### 16. `description` field missing from `songColumns` projection — `song-service.ts`
`description` is included in `songColumns` (line 17) but is not in the `Song` shared type's required fields — it is `description?: string`. This is fine. Confirming it is intentionally included (description is nullable and the column is nullable).

---

## Positive Observations

- **Transaction discipline**: Every mutating note operation wraps both the data write and the `recordEvent` call in a single `db.transaction()`. Atomic audit trail is correctly implemented.
- **Defense-in-depth validation**: Zod validates at the API boundary; DB CHECK constraints provide a backstop. The error-handler maps both layers to client-friendly responses without leaking internal detail.
- **Optimistic lock with missing/stale distinction**: The secondary SELECT inside the transaction to distinguish 404 vs 409 is the correct pattern and is clearly commented.
- **ON CONFLICT DO NOTHING**: Correct use to detect duplicate grid cells without a separate SELECT (avoids TOCTOU on the happy path).
- **SongDto / embedding exclusion**: `songColumns` projection cleanly omits the heavy `vector(768)` field — well-scoped for Phase 03.
- **`DbOrTx` union type**: Clean abstraction allowing services to accept either the pool or an in-progress transaction.
- **`asyncHandler`**: Correct pattern for Express 4 async error propagation.
- **YAGNI adherence**: No premature abstractions; auth placeholder (`actor: null`) is correctly deferred.
- **Test quality**: 13 integration tests against real Postgres, testing boundary values, exact boundaries (1200/8 accepted), and negative cases. No mocks.
- **Code is well under 200 LOC per file**: All files are focused and readable.

---

## Recommended Actions

1. **(IMPORTANT)** Rename CORS env var to `CORS_ORIGIN` with explicit production-safe default (empty string or specific origin, not `"*"`).
2. **(IMPORTANT)** Decide and document `GET /api/notes/:id` — add route or add comment explaining list-via-song model.
3. **(IMPORTANT)** Fix `as SongDto` cast in `createSong` — check for undefined and throw, consistent with other service functions.
4. **(MEDIUM)** Add DB-level CHECK or Postgres enum for `events.event_type` column.
5. **(MEDIUM)** Change `version: z.number().int().min(1)` to `.min(0)` to avoid coupling validation to DB default.
6. **(MEDIUM)** Add comment in `song-service.ts` explaining song-level events are deferred to a later phase.
7. **(LOW)** Add `eslint` to the `api` package scripts.
8. **(LOW)** Consider `Promise<void>` return type for `asyncHandler`'s `fn` parameter.

---

## Metrics
- **Type Coverage:** High — Drizzle inferred types throughout; one `as` cast (item 5)
- **Test Coverage:** 13 integration tests covering all CRUD paths, boundary values, conflict scenarios, and event ledger; no unit tests for service functions in isolation
- **Linting Issues:** ESLint not configured for this package (item 15)
- **Security:** No SQL injection risk (Drizzle parameterizes all queries); no sensitive data leakage in error responses; CORS misconfiguration risk (item 1)

---

## Unresolved Questions

1. Is `GET /api/notes/:id` intentionally absent (fetch-via-song-list model) or an oversight?
2. Should song mutations (create/update/delete) emit events in Phase 03 or is that deferred?
3. What is the intended `express.json()` body size limit? 100 kb default acceptable?
4. Will the `eventType` DB column be tightened to a PG enum in a future phase?
