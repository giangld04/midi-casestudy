# Phase 06 — Performance & Virtualization (Impl Report)

**Date:** 2026-07-31 09:50 | **Status:** ✅ complete | **Rubric:** Performance 10pts

## Scope (LEAN, user-approved)
Viewport culling + FPS/metrics overlay + vertical zoom. `use-dirty-flag` intentionally
SKIPPED — react-konva already batches redraws on prop/state change; a manual dirty
flag fights the framework (over-engineering, no gain).

## Problem
Stage renders a tall canvas (`MAX_TIME_TICK * pixelsPerTick` px) inside a natively
scrolled div. Without culling, EVERY note is a live Konva node regardless of scroll →
at ~9.6k notes, ~9.6k nodes to reconcile/draw. Culling to the visible tick window
keeps node count bounded.

## Files
**New (`apps/web/src/`):**
- `lib/performance-utils.ts` — `cullNotes(notes, firstTick, lastTick)` pure O(n) filter (inclusive bounds, inverted-range guard) + `computeFps(frames, elapsedMs)`
- `hooks/use-viewport-culling.ts` — memoized cull (recompute only on notes/range change)
- `hooks/use-fps-counter.ts` — rAF loop sampling FPS every 500ms; `enabled` flag skips loop
- `components/piano-roll/fps-overlay.tsx` — FPS + rendered/total counts + culled% (proof culling active)

**Modified:**
- `components/piano-roll/notes-layer.tsx` — renders culled subset; `React.memo`'d `NoteCircle` (only added/removed/selected notes re-render)
- `components/piano-roll/grid-layer.tsx` — full static grid, own Layer/canvas → not redrawn on scroll or on sibling note changes
- `components/piano-roll/piano-roll-stage.tsx` — zoom state (pixelsPerTick 2..8), culling wiring, dev-only metrics overlay, zoom controls
- `hooks/use-viewport.ts` — `MAX_TIME_TICK` constant (was literal 1200)

## Architecture decisions
- **Culling:** `useViewport` derives padded firstTick/lastTick from scrollTop; `useViewportCulling` filters notes to that window before they reach `NotesLayer`. Bounded node count at any song size.
- **Grid:** separate Konva Layer (own canvas). Native div scroll + per-layer canvases mean the grid is drawn once per commit and NOT re-rasterized on scroll or note mutations. `.cache()` deliberately NOT used (from code review M1): at max zoom the cached bitmap would be hundreds of MB on retina for zero scroll-time benefit; `listening={false}` already excludes it from hit-testing.
- **Zoom:** all coordinate math already parameterized on `pixelsPerTick` → zoom = single state var threaded to coords/viewport/grid/stageHeight. Clamp 2..8 px/tick (8..32 px/s), buttons disabled at bounds.
- **Overlay:** gated on `import.meta.env.DEV` (M2) → visible in demo/grading dev server, stripped from prod bundle (no idle rAF loop in prod).

## Tests (real, no mocks)
`apps/web/src/__tests__/performance-utils.test.ts` — 10 tests: cullNotes empty / all-visible /
none-visible / inclusive boundary / inverted range / full-grid (9608 cells) culled to <20%
of set / 10k-note filter <16ms; computeFps 60fps / rounding / non-positive window.
**Result:** 52 web tests pass (42 coordinate + 10 perf); `tsc --noEmit` clean; `vite build`
clean (276 modules, 153KB gzip).

## Code review
`plans/reports/code-reviewer-260731-0945-phase-06-performance.md` — no CRITICAL/HIGH.
Applied: M1 (drop grid .cache() → memory-safe), M2 (dev-only overlay), L1 (MAX_TIME_TICK),
L4 (dead div removed). L3 verified: `moveNote` is useCallback-wrapped → memo effective.

## Deferred
1. Manual DevTools FPS profiling at 1k/5k/10k seeded notes (needs running env + seed script) — Phase 10.
2. Playwright visual regression + k6 load test — Phase 10.
