# Phase 03: Frontend Note Input UI

## Context Links
- Notes layer: `apps/web/src/components/piano-roll/notes-layer.tsx`
- Piano roll stage: `apps/web/src/components/piano-roll/piano-roll-stage.tsx`
- Track header: `apps/web/src/components/piano-roll/track-header.tsx`
- Coordinate utils: `apps/web/src/lib/coordinate-utils.ts`
- Colors: `apps/web/src/lib/colors.ts`
- use-realtime-notes: `apps/web/src/hooks/use-realtime-notes.ts`
- use-notes: `apps/web/src/hooks/use-notes.ts`
- Shared constants: `packages/shared/src/constants.ts`

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Update frontend to handle pitch, duration, velocity. Option A (KISS): each track maps to a fixed MIDI pitch. Duration shown as note width/height on canvas. Velocity reflected via opacity.

## Key Insights
- **Option A pitch mapping:** Track 1-8 maps to MIDI pitches [60, 62, 64, 65, 67, 69, 71, 72] (C major scale C4-C5). This requires zero Y-axis changes. The track header shows the note name alongside "T1".
- Notes are currently rendered as circles (radius=12). To show duration, change to rounded rectangles: width = trackWidth * 0.7 (fixed), height = duration * pixelsPerTick. A 1-tick note = 4px tall (matches current circle), a 4-tick note = 16px tall.
- Velocity maps to opacity: velocity/127 clamped to [0.4, 1.0] range so notes are always visible.
- `createNote` and socket payloads need to include pitch (derived from track) and duration (default 1). Velocity defaults to 100.

## Requirements
**Functional:**
- Track header shows note name (e.g. "T1 C4", "T2 D4") from `TRACK_PITCH_MAP`
- Notes render as rounded Rects instead of Circles, height = duration * pixelsPerTick
- Note opacity reflects velocity (0.4-1.0 range)
- On create, pitch auto-assigned from track via `TRACK_PITCH_MAP`
- Duration defaults to 1 tick on click-create. Drag-resize to change duration is a stretch goal (can add if time permits).

**Non-functional:**
- Maintain viewport culling performance (culling now considers duration span)
- Keep note rendering memoized

## Architecture
```
TRACK_PITCH_MAP (new constant in shared/constants.ts):
  Track 1 → 60 (C4)    Track 5 → 67 (G4)
  Track 2 → 62 (D4)    Track 6 → 69 (A4)
  Track 3 → 64 (E4)    Track 7 → 71 (B4)
  Track 4 → 65 (F4)    Track 8 → 72 (C5)

Note rendering: Circle → Rect
  x = canvasX(track) - halfWidth
  y = canvasY(timeTick)
  width = trackWidth * 0.7
  height = duration * pixelsPerTick
  opacity = 0.4 + (velocity / 127) * 0.6
```

## Related Code Files

**Modify:**
- `packages/shared/src/constants.ts` -- add TRACK_PITCH_MAP, PITCH_NAMES
- `apps/web/src/components/piano-roll/notes-layer.tsx` -- Circle → Rect, add duration height + velocity opacity
- `apps/web/src/components/piano-roll/track-header.tsx` -- show note name
- `apps/web/src/components/piano-roll/selection-layer.tsx` -- update selection highlight for Rect shape
- `apps/web/src/hooks/use-realtime-notes.ts` -- include pitch in createNote
- `apps/web/src/hooks/use-notes.ts` -- include pitch in createNote
- `apps/web/src/hooks/use-viewport-culling.ts` -- account for duration in visibility check

**Create:**
- `apps/web/src/lib/pitch-utils.ts` -- pitchForTrack(), pitchName() helpers

## Implementation Steps

1. **Add `TRACK_PITCH_MAP` + `PITCH_NAMES` to `packages/shared/src/constants.ts`:**
   ```ts
   export const TRACK_PITCH_MAP: Record<number, number> = {
     1: 60, 2: 62, 3: 64, 4: 65, 5: 67, 6: 69, 7: 71, 8: 72,
   } as const;
   export const PITCH_NAMES: Record<number, string> = {
     60: "C4", 62: "D4", 64: "E4", 65: "F4",
     67: "G4", 69: "A4", 71: "B4", 72: "C5",
   } as const;
   ```

2. **Create `apps/web/src/lib/pitch-utils.ts`:**
   - `pitchForTrack(track: number): number` -- lookup from TRACK_PITCH_MAP, default 60
   - `pitchName(pitch: number): string` -- lookup from PITCH_NAMES or format as "Note {pitch}"
   - `velocityToOpacity(velocity: number): number` -- 0.4 + (v/127)*0.6

3. **Update `notes-layer.tsx`:**
   - Replace `Circle` with `Rect` from react-konva
   - Props: x, y, width (trackWidth * 0.7), height (note.duration * pixelsPerTick)
   - opacity from velocityToOpacity(note.velocity)
   - Update drag logic: drag position maps to (track, tick) same as before; rect x/y is top-left corner, adjust inverse mapping
   - Pass `pixelsPerTick` and `trackWidth` as new props

4. **Update `track-header.tsx`:**
   - Import PITCH_NAMES and TRACK_PITCH_MAP
   - Display "T1 C4" instead of just "T1"

5. **Update `use-realtime-notes.ts` createNote:**
   - Add `pitch: pitchForTrack(track)` to optimistic note and socket payload

6. **Update `use-notes.ts` createNote:**
   - Add `pitch: pitchForTrack(track)` to REST body

7. **Update `selection-layer.tsx`:**
   - Adjust selection indicator for Rect shape (if applicable)

8. **Update `use-viewport-culling.ts`:**
   - Note visible if `timeTick < lastTick AND timeTick + duration > firstTick` (instead of just `timeTick` range)

## Todo List
- [ ] Add TRACK_PITCH_MAP + PITCH_NAMES to shared constants
- [ ] Create pitch-utils.ts in web lib
- [ ] Refactor notes-layer Circle → Rect with duration height
- [ ] Add velocity → opacity mapping
- [ ] Update track header with note names
- [ ] Update createNote in use-realtime-notes to include pitch
- [ ] Update createNote in use-notes to include pitch
- [ ] Update viewport culling for duration-aware visibility
- [ ] Update selection layer for new note shape
- [ ] Verify `pnpm typecheck` + visual check in dev

## Success Criteria
- Notes render as rectangles whose height reflects duration
- Track header shows note names (C4, D4, etc.)
- Note opacity varies with velocity
- Click-to-create assigns correct pitch from track
- Viewport culling still works correctly with duration-spanning notes
- `pnpm typecheck` passes

## Risk Assessment
- **MEDIUM:** Circle → Rect refactor touches the core rendering component. Thoroughly test drag interactions.
- **LOW:** Duration-aware culling is a simple range comparison change.

## Security Considerations
- No new security surface. Pitch values validated server-side (Phase 02).

## Next Steps
- Phase 04 depends on this: audio engine reads pitch/duration/velocity from notes
