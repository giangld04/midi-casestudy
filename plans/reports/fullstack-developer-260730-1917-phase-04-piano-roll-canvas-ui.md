# Phase Implementation Report

## Executed Phase
- Phase: phase-04-piano-roll-canvas-ui
- Plan: /Users/giang/Documents/Giang-Project/plans/260730-1755-ama-midi-editor-collaboration-suite/
- Status: completed

## Files Modified
- `apps/web/package.json` — added konva^9.3.0, react-konva^18.2.10, vitest^2.1.8; added `test` script
- `apps/web/vite.config.ts` — removed `rewrite` from proxy so `/api/*` forwards unchanged to `:3000/api/*`
- `apps/web/src/main.tsx` — import `./styles/globals.css`
- `apps/web/src/app.tsx` — full rewrite composing AppLayout + hooks

## Files Created

### lib/
- `apps/web/src/lib/coordinate-utils.ts` — pure fns: toCanvasX, toCanvasY, toTrack, toTick, snapToTick; DEFAULT_PIXELS_PER_TICK=4
- `apps/web/src/lib/api-client.ts` — typed fetch wrapper, ApiError class, unwraps {ok,data} envelope
- `apps/web/src/lib/colors.ts` — TRACK_COLORS[8] neon palette + trackColor(n) helper

### styles/
- `apps/web/src/styles/globals.css` — CSS custom properties dark studio theme

### hooks/
- `apps/web/src/hooks/use-coordinate-mapping.ts` — binds coord fns to stageWidth + pixelsPerTick
- `apps/web/src/hooks/use-viewport.ts` — scroll tracking, visible tick range for culling
- `apps/web/src/hooks/use-songs.ts` — CRUD: fetch list, create, select
- `apps/web/src/hooks/use-notes.ts` — CRUD: fetch per-song, create (default title "Note", per-track color), optimistic moveNote (sends version, reverts on 409 with flash msg), deleteNote (optimistic)

### components/piano-roll/
- `piano-roll-stage.tsx` — Stage, ResizeObserver for width, Delete key handler, empty-click→create, composes sub-layers
- `grid-layer.tsx` — background Rect + minor tick lines (0.5px, #2d2d44) + major lines every 4 ticks (1px, #3d3d5c) + second labels; culls to viewport tick range
- `notes-layer.tsx` — Circle per note, draggable, snaps on DragEnd, onClick→select
- `selection-layer.tsx` — highlight ring (radius+5, cyan stroke) around selected note
- `track-header.tsx` — HTML flex row, 8 columns, neon labels

### components/song/
- `song-list.tsx` — sidebar with + button, song rows, active highlight
- `song-create-dialog.tsx` — modal form for title input
- `song-detail-header.tsx` — song title + description in toolbar

### components/layout/
- `app-layout.tsx` — toolbar/sidebar/main/status-bar shell
- `toolbar.tsx` — brand, SongDetailHeader, note count
- `status-bar.tsx` — selected note info or flash message or count

### tests/
- `apps/web/src/__tests__/coordinate-utils.test.ts` — 42 unit tests

### config/
- `apps/web/vitest.config.ts` — node env, vitest run

## Tasks Completed
- [x] Install konva + react-konva + vitest
- [x] coordinate-utils.ts (forward + inverse + snap + clamp)
- [x] Dark theme CSS variables
- [x] grid-layer (minor per-tick, major per-second, labels, viewport culled)
- [x] notes-layer (circles + draggable + snap on DragEnd + click-to-select)
- [x] selection-layer (ring around selected)
- [x] piano-roll-stage (compose layers, Delete key, empty-click create, ResizeObserver)
- [x] track-header (HTML overlay, neon labels)
- [x] use-notes + use-songs hooks
- [x] api-client (typed, ApiError, 204 handling)
- [x] song-list + song-create-dialog + song-detail-header
- [x] app-layout + toolbar + status-bar
- [x] Rewired app.tsx
- [x] Vite proxy rewrite removed
- [x] Unit tests: 42 pass

## Tests Status
```
> @ama-midi/web@0.1.0 test
> vitest run

 RUN  v2.1.9

 ✓ src/__tests__/coordinate-utils.test.ts (42 tests) 2ms

 Test Files  1 passed (1)
      Tests  42 passed (42)
   Duration  263ms
```
- Type check: PASS (tsc --noEmit, zero errors)
- Unit tests: PASS (42/42)
- Build: PASS (tsc && vite build, 238 modules, 447 kB JS)

## Vite Proxy Change
Removed `rewrite: (path) => path.replace(/^\/api/, "")`.
Now `/api/songs` proxies to `http://localhost:3000/api/songs` unchanged. Old `/api/health` demo removed from app.tsx.

## Coordinate Model
- `pixelsPerTick = 4` → canvas height 4800 px (scrollable)
- Minor gridline every 1 tick (0.5 px, #2d2d44, opacity 0.6)
- Major gridline every 4 ticks = 1 s (1 px, #3d3d5c) with label "Ns"
- `toTick` = `Math.round(canvasY / pixelsPerTick)` clamped [0, 1200]
- `toTrack` = `Math.floor(canvasX / trackWidth) + 1` clamped [1, 8]
- Round-trip invariant verified by 42 unit tests at all boundary values

## Issues Encountered
None. All four done-checks pass without errors.

## Unresolved Questions
None.
