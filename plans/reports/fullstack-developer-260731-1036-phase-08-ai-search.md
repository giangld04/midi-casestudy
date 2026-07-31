# Phase 08 — AI Semantic Search: Implementation Report

- **Agent:** fullstack-developer
- **Date:** 2026-07-31
- **Status:** completed
- **Tests:** 37 pass | 1 skipped (gated on GEMINI_API_KEY)

---

## Files Created

| File | Lines | Notes |
|---|---|---|
| `apps/api/src/services/embedding-service.ts` | 49 | Gemini text-embedding-004 wrapper |
| `apps/api/src/services/search-service.ts` | 117 | pgvector cosine search + ILIKE fallback |
| `apps/api/src/routes/search-routes.ts` | 32 | GET /api/songs/search with Zod validation |
| `apps/api/src/__tests__/search.test.ts` | 224 | 9 tests (1 gated) |
| `apps/api/.env.example` | 16 | Includes GEMINI_API_KEY placeholder |
| `apps/web/src/hooks/use-search.ts` | 81 | 300ms debounced search hook |
| `apps/web/src/components/search/semantic-search-bar.tsx` | 143 | Input + dropdown component |
| `apps/web/src/components/search/search-result-item.tsx` | 86 | Result row with similarity badge |
| `packages/db/drizzle/0002_phase08_ivfflat_embedding_index.sql` | 8 | IVFFlat index (lists=100) |

## Files Modified

| File | Change |
|---|---|
| `apps/api/src/services/song-service.ts` | +`scheduleEmbedding()` fire-and-forget on create + update |
| `apps/api/src/index.ts` | Mount `searchRouter` at `/api/songs/search` BEFORE songRouter |
| `apps/api/package.json` | Added `@google/genai` (installed as v2.15.0) |
| `apps/web/src/components/layout/toolbar.tsx` | Added `SemanticSearchBar` + `onSelectSong` prop |
| `apps/web/src/app.tsx` | Passed `songs.selectSong` to Toolbar's `onSelectSong` |
| `packages/db/drizzle/meta/_journal.json` | Added migration 0002 entry |

---

## Schema / Migration

- `embedding vector(768)` column was ALREADY present in migration 0000 (Phase 02 schema).
- Migration 0002 adds: `CREATE INDEX IF NOT EXISTS idx_songs_embedding_ivfflat ON songs USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)`.
- Applied to DB via `tsx src/migrate.ts` — confirmed successful.

---

## SDK Method Used

`@google/genai` v2.15.0 (NOT deprecated `@google/generative-ai`).

```typescript
const response = await ai.models.embedContent({
  model: "text-embedding-004",
  contents: text,         // ContentListUnion — plain string accepted
});
const values = response.embeddings?.[0]?.values;  // number[] | undefined
```

Response shape: `EmbedContentResponse.embeddings: ContentEmbedding[]` where each has `values?: number[]` (768 floats for text-embedding-004).

---

## Routing Decision

Mounted `searchRouter` as separate Express mount at `/api/songs/search` BEFORE the `songRouter` at `/api/songs`. This guarantees the literal string "search" is not captured by `/:id` param inside `songRouter`. Both mounts share the same `requireAuth + rateLimiter` chain.

---

## Auto-Embedding Design

`scheduleEmbedding()` in song-service: fire-and-forget `void (async () => { ... })()`.
- Does NOT block create/update response.
- Silent on error (Gemini down, key missing) — no retry, no queue.
- Re-embeds when `title` or `description` changes on update.
- Uses Drizzle `sql\`${literal}::vector\`` cast to store the embedding.

---

## Deviations from Spec

| Spec | Actual | Reason |
|---|---|---|
| `@google/generative-ai@0.4.2` | `@google/genai@2.15.0` | Per task instructions — newer unified SDK |
| Redis query-embedding cache | Skipped | YAGNI per task instructions — "prefer shipping correct search over premature caching" |
| 24h TTL cache spec | Skipped | Same reason |

---

## Test Results

```
Tests  37 passed | 1 skipped
Files  4 test files passed
```

### Test breakdown for search.test.ts (9 total, 1 skipped)

- **(a)** `buildSongEmbeddingText` — 3 unit tests — PASS
- **(b)** Vector ordering — raw SQL `<=>` cosine ordering confirmed — PASS
- **(c)** ILIKE fallback — unsets `GEMINI_API_KEY` env in-process, finds song by keyword — PASS
- **(d)** Route auth — 401 without cookie, 400 missing q, 200 authenticated — 3 tests PASS
- **(e)** Real Gemini e2e — SKIPPED (no `GEMINI_API_KEY` in test env) — reported correctly

Existing 29 tests from phases 03/05/07 all GREEN — no regressions.

---

## Type Check

- `pnpm --filter @ama-midi/api exec tsc --noEmit` — clean
- `pnpm --filter @ama-midi/web exec tsc --noEmit` — clean
- `pnpm --filter @ama-midi/web build` — clean (531 kB bundle, no errors)

---

## Onboarding Note

To enable real Gemini semantic search:
1. Get key at https://aistudio.google.com/apikey (free tier: 1500 req/min)
2. Add to `apps/api/.env`: `GEMINI_API_KEY=your-key-here`
3. Re-run tests: `pnpm --filter @ama-midi/api test` — the gated e2e test will now run
4. Run migrations if not yet applied: `DATABASE_URL=... pnpm --filter @ama-midi/db exec tsx src/migrate.ts`

Without the key, search falls back to ILIKE text matching automatically.

---

## Unresolved Questions

1. **Embedding retry/queue**: currently fire-and-forget with no retry. Songs created when Gemini is down will have `embedding = NULL` forever until manually re-triggered (there's no backfill endpoint). A backfill job (Phase 09 scope) or re-index on first search could address this.
2. **ivfflat index requires rows to exist before creation**: IVFFlat needs data to build the quantization clusters. On an empty database the index still creates (with `lists=100` default empty), but search quality improves once populated. At scale, consider `CONCURRENTLY` rebuild or `hnsw` for smaller datasets.
3. **Test file 224 lines**: slightly exceeds 200 LOC guideline but is a test file (all production files < 200 LOC). Could split into `search-unit.test.ts` + `search-integration.test.ts` if desired.
