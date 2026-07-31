# Code Review — Phase 08: AI Semantic Search

- **Reviewer:** code-reviewer
- **Date:** 2026-07-31
- **Plan:** `/Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/phase-08-ai-semantic-search.md`
- **Impl report:** `plans/reports/fullstack-developer-260731-1036-phase-08-ai-search.md`

---

## Scope

| File | LOC |
|---|---|
| `apps/api/src/services/embedding-service.ts` | 49 |
| `apps/api/src/services/search-service.ts` | 117 |
| `apps/api/src/routes/search-routes.ts` | 32 |
| `apps/api/src/services/song-service.ts` | 88 |
| `apps/api/src/index.ts` | 77 |
| `apps/api/src/__tests__/search.test.ts` | 224 |
| `packages/db/drizzle/0002_phase08_ivfflat_embedding_index.sql` | 8 |
| `packages/db/src/schema/songs.ts` | 40 |
| `apps/web/src/hooks/use-search.ts` | 81 |
| `apps/web/src/components/search/semantic-search-bar.tsx` | 143 |
| `apps/web/src/components/search/search-result-item.tsx` | 86 |

TypeScript check: `pnpm --filter @ama-midi/api exec tsc --noEmit` → **clean** (confirmed).

---

## Overall Assessment

Phase 08 is implemented correctly and securely for all priority-1 concerns. No CRITICAL issues found. One HIGH finding on the `scheduleEmbedding` Drizzle `sql` template usage (needs scrutiny but ultimately safe — see detail). One MEDIUM on missing outer try-catch in `scheduleEmbedding`. ILIKE fallback, auth chain, route ordering, key handling, XSS, and debounce cleanup are all correct.

---

## Critical Issues

**None.**

---

## High Priority Findings

### H1 — `scheduleEmbedding`: Drizzle `sql` tag on vector literal (safe, but warrants explicit note)

**File:** `apps/api/src/services/song-service.ts:50`

```typescript
.set({ embedding: sql`${`[${vector.join(",")}]`}::vector` })
```

**Analysis:** Drizzle's `sql` tagged template literal treats every `${}` interpolation as a **parameterized binding** (generates `$1::vector` in the resulting query). Verified in drizzle-orm@0.38.4 source (`sql/sql.js:129`: `escapeParam(paramStartIndex.value++, chunk)`). The vector literal `[n,n,n,...]` never appears as raw SQL text — it becomes `$1` with the string value bound separately.

**Additionally:** `vector` is `number[]` from `generateEmbedding()`, which only returns a 768-element float array or `null`. No user input ever reaches `vector.join(",")`. The path is: user query string → Gemini API call → float array → `join(",")` → parameterized bind.

**Verdict:** No SQL injection risk. However, the code looks like raw string interpolation at first glance. A comment explaining Drizzle parameterizes `${}` would prevent future confusion.

**Severity:** HIGH (flag for awareness, not a bug)

---

## Medium Priority Findings

### M1 — `scheduleEmbedding`: Drizzle update error is unhandled

**File:** `apps/api/src/services/song-service.ts:41-53`

```typescript
function scheduleEmbedding(song: SongDto): void {
  void (async () => {
    const text = buildSongEmbeddingText(song);
    const vector = await generateEmbedding(text);
    if (!vector) return; // ← handles null
    await db.update(songs).set({ ... }).where(eq(songs.id, song.id));
    // ↑ No try-catch — if DB update throws, it becomes an unhandled rejection
  })();
}
```

The `void` operator suppresses the outer promise, and `generateEmbedding` handles its own errors. But if `db.update(...)` throws (e.g., DB connection drop, constraint violation after row is deleted between create and embedding write), it propagates as an **unhandled promise rejection**. In Node.js 18+ `--unhandled-rejections=throw` is the default, which crashes the process.

**Recommended fix:**
```typescript
void (async () => {
  try {
    const text = buildSongEmbeddingText(song);
    const vector = await generateEmbedding(text);
    if (!vector) return;
    await db.update(songs).set({ embedding: sql`${`[${vector.join(",")}]`}::vector` }).where(eq(songs.id, song.id));
  } catch (err) {
    console.error("[song-service] scheduleEmbedding failed:", err);
  }
})();
```

**Severity:** MEDIUM — process crash risk on DB error during fire-and-forget

---

### M2 — ILIKE fallback test: `_ai` singleton not reset between test suite runs

**File:** `apps/api/src/__tests__/search.test.ts:134-148`

The ILIKE fallback test deletes `process.env["GEMINI_API_KEY"]` to force `getClient()` to return `null`. However, `embedding-service.ts` caches the `GoogleGenAI` instance in module-level `let _ai`. If any test earlier in the run already called `generateEmbedding` (triggering `_ai` construction), deleting the env key will NOT null out `_ai`. The client is already constructed, and the singleton persists.

**Current behaviour in test run:**
Test (c) runs without any prior `generateEmbedding` call (tests a, b, d don't call it), so `_ai === null` when the key is deleted → `getClient()` reads env → key gone → returns null. The test passes **by coincidence of test ordering**.

If tests are reordered (e.g., gated test (e) somehow runs first), the `_ai` singleton stays alive, `getClient()` returns the cached instance, Gemini is called, and test (c) would fail.

**Recommended fix:** Export a `resetClientForTesting()` function in `embedding-service.ts` or expose the `_ai` via a setter, then call it in `beforeEach` for test (c). Alternatively, restructure tests to not rely on env mutation for module-level singletons.

**Severity:** MEDIUM — test reliability / ordering sensitivity

---

### M3 — `toVectorLiteral` in `search-service.ts` is exported only via direct call (not the same function as in `song-service.ts`)

**File:** `apps/api/src/services/search-service.ts:33-35` and `apps/api/src/services/song-service.ts:50`

Two places independently build `[n,n,n,...]` from a `number[]`:
- `search-service.ts:toVectorLiteral()` (local fn)
- `song-service.ts:50` (inline template)

Minor DRY violation — not a bug, but if the format changes, two places need updating.

**Severity:** LOW-MEDIUM — not a bug, maintainability concern

---

## Low Priority Suggestions

### L1 — `semantic-search-bar.tsx`: `clear` function in `useEffect` deps

**File:** `apps/web/src/components/search/semantic-search-bar.tsx:28`

```tsx
useEffect(() => {
  ...
  return () => document.removeEventListener("mousedown", onClickOutside);
}, [clear]);
```

`clear` is a new function reference on every `useSearch()` render (defined inline as `() => { setQuery(""); setResults([]); }`). This causes the click-outside `useEffect` to re-register on every render. Functionally harmless (cleanup runs correctly), but causes unnecessary event listener churn. Wrapping `clear` in `useCallback` inside `useSearch` would fix it.

**Severity:** LOW

---

### L2 — `use-search.ts`: stale closure risk on unmount

**File:** `apps/web/src/hooks/use-search.ts:50-63`

```typescript
timerRef.current = setTimeout(async () => {
  try {
    const data = await apiFetch<SearchResult[]>(...);
    setResults(data);  // ← called after await
```

If the component unmounts after the timer fires but before `apiFetch` resolves, `setResults` and `setError` will be called on an unmounted component. React 18 silenced the warning, but it's still a potential issue with strict mode. The `useEffect` cleanup cancels the *timer* but not the in-flight fetch.

A cleanup via `AbortController` would be ideal but is a low priority for a debounced search bar:
```typescript
const abortRef = useRef<AbortController | null>(null);
// cancel on cleanup
abortRef.current?.abort();
```

**Severity:** LOW — React 18 no-ops state updates on unmounted components by default

---

### L3 — test file 224 LOC (minor)

Exceeds the 200 LOC guideline, but test files are exempt per project standards. If splitting is desired: `search-unit.test.ts` (tests a) and `search-integration.test.ts` (tests b-e).

**Severity:** LOW

---

## Security Audit Results

| Check | Result |
|---|---|
| SQL injection (vector path) | SAFE — Drizzle `sql` tag parameterizes `${}` → `$1::vector` bound param; `number[]` only, no user data |
| SQL injection (ILIKE path) | SAFE — `pool.query("... ILIKE '%' \|\| $1 \|\| '%'", [query, limit])` fully parameterized |
| Auth on search route | SAFE — `requireAuth` + `rateLimiter` applied before `searchRouter` (index.ts:59) |
| Route ordering | SAFE — `/api/songs/search` mounted before `/api/songs` (index.ts:59-60) |
| Zod validation on `q` | SAFE — min(1) + max(500), `limit` coerced int 1-50 |
| GEMINI_API_KEY | SAFE — read via `process.env["GEMINI_API_KEY"]` only; not logged; `.env.example` has empty placeholder; `.env` in `.gitignore`; no key in test files |
| Key in error logs | SAFE — `console.error` logs `err` object (Gemini error), not the key |
| XSS in search results | SAFE — `{result.title}` and `{result.description}` rendered as React text nodes (no `dangerouslySetInnerHTML`) |
| Debounce cleanup (timer leak) | SAFE — `useEffect` cleanup runs `clearTimeout(timerRef.current)` |
| Graceful degradation | SAFE — `embedding === null` → `ilikeSearch()` fallback; verified in test (c) |

---

## Test Authenticity Verification

- No `jest.mock`, `vi.mock`, `vi.fn()`, or fake data used — confirmed by grep scan.
- DB operations use real Postgres pool (`insertSongWithEmbedding` with `pool.query`).
- ILIKE fallback triggered via real `process.env` mutation → real `null` return from `getClient()`.
- Gated Gemini test uses `describe.skipIf(!GEMINI_KEY_PRESENT)` — skips cleanly, no fake embeddings.
- Vector ordering test uses raw `pool.query` with `<=>` operator — real pgvector math, no simulation.

---

## Positive Observations

- Vector search path is **fully parameterized** via `pool.query(sql, [vectorLiteral, limit])` — `vectorLiteral` is `$1`, not raw-concatenated.
- `toVectorLiteral` comment explicitly states "only numbers pass — no user input reaches this function" — good defensive documentation.
- `generateEmbedding` validates response shape (`values.length !== 768`) before returning, preventing silent dimension mismatches.
- `SongDto = Omit<Song, "embedding">` correctly excludes the 768-float column from API responses — no accidental vector data leakage to clients.
- Lazy singleton `getClient()` is clean and testable via env deletion.
- `encodeURIComponent(trimmed)` in `use-search.ts:53` prevents query string injection in the URL.
- Fire-and-forget `void (async () => {...})()` pattern correctly returns before embedding completes — create/update latency unaffected.

---

## Recommended Actions

1. **[MUST FIX — MEDIUM]** Wrap the `db.update(...)` call in `scheduleEmbedding` in a `try-catch` to prevent unhandled promise rejection / process crash on DB error. (song-service.ts:48-51)

2. **[SHOULD FIX — MEDIUM]** Add a comment to `scheduleEmbedding` explaining Drizzle's `sql` tag parameterizes `${}`, and optionally export `resetClientForTesting()` from `embedding-service.ts` to make test (c) order-independent. (M2)

3. **[LOW]** Extract the vector literal builder into a shared helper (or export `toVectorLiteral` from `search-service.ts` and import it in `song-service.ts`) to remove the DRY duplication. (M3)

4. **[LOW]** Wrap `clear` in `useCallback` inside `useSearch` to stabilize the reference and avoid click-outside listener churn. (L1)

5. **[LOW]** Consider `AbortController` in `use-search.ts` to cancel in-flight fetches on unmount. (L2)

---

## Task Completeness vs Phase 08 Spec

| Spec Todo | Status |
|---|---|
| Install @google/generative-ai (newer: @google/genai) | DONE |
| Create embedding-service (Gemini) | DONE |
| Redis cache for query embeddings | SKIPPED (YAGNI, documented deviation) |
| Create search-service (pgvector cosine search) | DONE |
| Create search API route | DONE |
| Add ivfflat index migration | DONE |
| Update song-service to auto-embed | DONE |
| Create use-search hook | DONE |
| Build search bar + results UI | DONE |
| Add ILIKE fallback | DONE |

**Phase 08 status: COMPLETE** (Redis cache deferred by explicit YAGNI decision — documented).

---

## Unresolved Questions

1. **No retry / backfill for failed embeddings**: Songs created during Gemini outage stay `embedding = NULL` forever. A backfill job or re-index endpoint is needed for completeness. Deferred to Phase 09 scope per impl report.
2. **`_ai` singleton thread-safety in tests**: If tests ever run with `--pool` (parallel workers), env mutation in test (c) could race with other tests. Current single-worker setup is fine.
3. **ivfflat empty DB**: Index created on empty DB; quantization clusters will be trivial. At scale (>10K songs), a `REINDEX` will improve recall. Acceptable for current scope.
