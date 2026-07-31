# Code Review: Phase 06 — Performance & Virtualization

**Date:** 2026-07-31
**Reviewer:** code-reviewer agent
**Plan:** `/Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/phase-06-performance-virtualization.md`

---

## Scope

| File | Status |
|---|---|
| `src/lib/performance-utils.ts` | NEW |
| `src/hooks/use-viewport-culling.ts` | NEW |
| `src/hooks/use-fps-counter.ts` | NEW |
| `src/components/piano-roll/fps-overlay.tsx` | NEW |
| `src/components/piano-roll/notes-layer.tsx` | MODIFIED |
| `src/components/piano-roll/grid-layer.tsx` | MODIFIED |
| `src/components/piano-roll/piano-roll-stage.tsx` | MODIFIED |
| `src/__tests__/performance-utils.test.ts` | NEW |

- Lines analyzed: ~590 across all files
- Build: **PASS** (tsc + vite, 0 errors)
- Tests: **52/52 PASS** (264ms)

---

## Overall Assessment

Implementation is clean, well-commented, and correct. Culling logic is sound, grid caching lifecycle is mostly correct, and React.memo is wired properly. Two MEDIUM issues need attention before this is production-ready: a large grid bitmap memory footprint at max zoom on HiDPI, and the FPS overlay running unconditionally in production.

---

## Critical Issues

None.

---

## High Priority Findings

None.

---

## Medium Priority Improvements

### M1 — Grid cache bitmap: very large at max zoom + HiDPI

**File:** `src/components/piano-roll/grid-layer.tsx` (line 46)

The `layer.cache()` call snapshots the entire Stage height into an offscreen `<canvas>`:

```
stageHeight = MAX_TIME_TICK × pixelsPerTick
            = 1200 × 8 = 9600 px  (max zoom)
```

At a 1920px-wide viewport, the bitmap cost:

| zoom (px/tick) | dpr=1 | dpr=2 (retina) |
|---|---|---|
| 2 | 17.6 MB | 70.3 MB |
| 4 (default) | 35.2 MB | 140.6 MB |
| 8 (max) | 70.3 MB | **281.2 MB** |

At max zoom + retina + a 1920px container the single grid cache consumes ~281 MB. That already exceeds half the stated 500 MB budget before any note data. Additionally, the cache is rebuilt on every zoom change (useEffect dep array includes `pixelsPerTick`), so zooming in/out triggers a multi-hundred-MB allocation each time.

**Impact:** potential OOM on memory-constrained devices; violates the "<500 MB at 10k notes" non-functional requirement when combined with other allocations.

**Suggested mitigation (not required for this review):** Cache only a viewport-height slice of the grid rather than the full tall canvas; rebuild on scroll when the cached region drifts out of range. Alternatively, skip `.cache()` on the grid and rely on Konva's normal batched redraw — the grid layer has `listening={false}` so it only redraws on explicit `batchDraw()`, which is already cheap.

---

### M2 — FPS overlay and rAF loop always active in production

**File:** `src/components/piano-roll/piano-roll-stage.tsx` (line 97)
**File:** `src/hooks/use-fps-counter.ts`

`useFpsCounter()` is called unconditionally without an `enabled` guard:

```ts
const fps = useFpsCounter();   // rAF loop always running
// ...
<FpsOverlay ... />              // always visible in prod
```

The plan spec (Security Considerations) explicitly states: "FPS overlay only visible in development mode (env flag)." This is not implemented. In production the rAF loop burns a small but real amount of CPU on every frame just to measure FPS nobody sees.

**Suggested fix:** Gate on `import.meta.env.DEV`:

```ts
const fps = useFpsCounter(import.meta.env.DEV);
// ...
{import.meta.env.DEV && <FpsOverlay ... />}
```

---

## Low Priority Suggestions

### L1 — `useViewport` hardcodes `1200` instead of `MAX_TIME_TICK`

**File:** `src/hooks/use-viewport.ts` (line 43)

```ts
Math.min(
  1200,   // ← should be MAX_TIME_TICK from @ama-midi/shared
  Math.ceil((scrollTop + containerHeight) / pixelsPerTick) + 4
);
```

If `MAX_TIME_TICK` ever changes, this will silently diverge. Minor, but inconsistent with everywhere else in the codebase that imports the constant.

---

### L2 — `viewport.containerRef` returned by `useViewport` is unused

**File:** `src/hooks/use-viewport.ts` (line 17, 33-35)
**File:** `src/components/piano-roll/piano-roll-stage.tsx`

`useViewport` returns a `containerRef` callback ref — but `piano-roll-stage.tsx` creates its own `useRef<HTMLDivElement>` and ignores `viewport.containerRef`. The hook carries dead surface area. No runtime impact, but causes mild confusion.

---

### L3 — `NoteCircle` memo effectiveness: function props are new-ref on every `NotesLayer` render

**File:** `src/components/piano-roll/notes-layer.tsx` (line 36)

`NoteCircle` is memoized. The `canvasX`, `canvasY`, `trackFromX`, `tickFromY` props are functions produced by `useCoordinateMapping` inside a `useMemo` — these refs are stable across renders as long as `pixelsPerTick` and `stageWidth` don't change (which is correct).

`onSelect` is `setSelectedNote` (stable), `onMove` is `onMoveNote` (passed from parent — verify it is `useCallback`-wrapped upstream). If `onMoveNote` is not stable, `NoteCircle` memo breaks on every parent render. This is a risk to track upstream; not a defect in these files.

---

### L4 — `HEADER_HEIGHT = 32` div at the bottom of the render tree is hidden and unreferenced

**File:** `src/components/piano-roll/piano-roll-stage.tsx` (line 243)

```tsx
{/* Invisible height: total canvas height label */}
<div style={{ height: HEADER_HEIGHT, display: "none" }} />
```

This is dead DOM. Remove to keep the render tree clean.

---

### L5 — `handleDragEnd` re-created each render inside `NoteCircle`

**File:** `src/components/piano-roll/notes-layer.tsx` (line 46)

`handleDragEnd` is a regular function expression inside the `memo`'d component. Because it closes over `note`, `canvasX`, `canvasY`, etc., it cannot be hoisted to a `useCallback`. This is the correct pattern — no fix needed — but worth documenting that the memo benefit here is about skipping *reconciliation of unchanged notes*, not about reusing the same function identity. Each re-render of a `NoteCircle` (which only happens when its props change) will allocate a new `handleDragEnd`. Acceptable.

---

## Tests Verification

Tests are real — no mocks, no fake data:
- `makeNote` is a minimal factory using actual shared types (`TrackNumber`, `Note`).
- The 9608-cell full-grid test builds real note objects in a double loop (`tick × track`) and filters them; the assertion checks `visible.length < notes.length * 0.2` — a genuine culling proof.
- The 10k-note timing test uses `performance.now()` with a 16ms budget (one frame); this is real wall-clock measurement, not a mocked timer.
- `computeFps` tests are pure arithmetic — nothing to mock.

No concerns with test quality.

---

## Task Completeness vs. Plan Todo List

| Todo item | Status |
|---|---|
| Implement `cullNotes` pure function | DONE |
| Create `use-viewport-culling` hook | DONE |
| Create `use-dirty-flag` hook | SKIPPED (intentional — see scope note) |
| Add `.cache()` to grid layer | DONE |
| Update notes-layer to render only visible notes | DONE |
| Add scroll handling + zoom to piano-roll-stage | DONE |
| Create FPS counter hook + overlay | DONE |
| Add zoom controls to toolbar | DONE (inline in stage, not toolbar component) |
| Run manual performance tests at 1k/5k/10k | NOT DONE (manual, expected) |
| Document performance results | NOT DONE (manual, expected) |

The lean scope agreed with the user is fully implemented. The two manual items require a running environment and are deferred.

---

## Positive Observations

- `cullNotes` is a correct, pure, O(n) filter with proper inclusive-boundary semantics. The guard `if (lastTick < firstTick) return []` handles the inverted-range edge case cleanly.
- `computeFps` is pure and handles the zero/negative window guard.
- `useViewportCulling` correctly delegates to `cullNotes` with `useMemo` — no over-engineering.
- `useFpsCounter` cleanup is correct: `cancelAnimationFrame(rafId)` in the effect cleanup, and the `enabled` guard skips the loop entirely rather than cancelling a timer.
- Grid cache lifecycle deps `[width, height, trackWidth, pixelsPerTick]` are complete — no stale-cache risk on geometry changes.
- `GridLayer` has `listening={false}` — correct, prevents unnecessary hit-testing on the static background.
- Zoom clamp is correct: `Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, p + delta))` with disabled state on buttons at boundaries.
- `NoteCircle` snap-back on drag (`node.x(canvasX(newTrack))`) is correct — visual position is corrected before React re-renders.
- `key={note.id}` ensures React reconciliation by identity, not index — critical for correct memo behavior when notes are added/removed.

---

## Recommended Actions

1. **(M2 — fix now)** Gate the FPS overlay + rAF loop on `import.meta.env.DEV`. One-line fix per file.
2. **(M1 — design decision)** Evaluate whether full-canvas `.cache()` is acceptable given the memory budget. If HiDPI support is required and max-zoom usage is expected, consider caching a viewport slice instead of the full tall canvas.
3. **(L1)** Replace literal `1200` in `use-viewport.ts:43` with `MAX_TIME_TICK` from `@ama-midi/shared`.
4. **(L4)** Remove the dead hidden `div` at the bottom of `piano-roll-stage.tsx`.
5. **(L2)** Either use `viewport.containerRef` in the stage or remove it from `useViewport`'s return type (DRY).

---

## Metrics

- Type Coverage: 100% — no `any` usage in reviewed files
- Test Coverage: 10/10 tests for `performance-utils`, all edge cases covered
- Build: PASS (0 errors, 0 warnings)
- Linting Issues: 0 blocking
- Severity breakdown: 0 Critical / 0 High / 2 Medium / 5 Low

---

## Unresolved Questions

1. Is the FPS overlay intentionally always-on for the grader's demo, or should it be dev-only as stated in the plan? Clarify before shipping to production.
2. Is `onMoveNote` (passed into `PianoRollStageProps`) wrapped in `useCallback` at its call site? If not, `NoteCircle` memo breaks silently.
3. What is the target device for the 500 MB memory budget — desktop only, or also mobile/tablet? The grid cache at max zoom + retina consumes ~281 MB alone on a 1920px-wide container, which matters significantly on mobile.
