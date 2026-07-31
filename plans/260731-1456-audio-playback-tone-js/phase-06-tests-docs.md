# Phase 06: Tests + Documentation

## Context Links
- Existing test dir: `apps/web/src/__tests__/`
- API tests: `apps/api/src/__tests__/` (if exists)
- Docs: `docs/trade-offs.md`, `docs/system-architecture.md`
- Vitest config: `apps/web/package.json` (test script: `vitest run`)

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Write unit tests for new modules (validators, pitch-utils, audio-engine, midi-export). Update docs to reflect the audio enhancement. Add e2e smoke test for playback controls.

## Key Insights
- Vitest is the test runner for `apps/web` (already configured).
- `audio-engine.ts` depends on Tone.js which requires Web Audio API -- needs mocking in Node test env. Test the scheduling logic, not the actual audio output.
- `midi-export.ts` can be tested by verifying the Midi object structure without triggering download.
- `pitch-utils.ts` and validator changes are pure functions -- straightforward unit tests.
- `docs/trade-offs.md` should note audio playback as a new "optional enhancement" section.

## Requirements
**Functional:**
- Unit tests for:
  - Extended Zod schemas (pitch/duration/velocity validation bounds)
  - `pitchForTrack()`, `pitchName()`, `velocityToOpacity()`
  - `midi-export.ts` (mocked Blob/download)
- Update `docs/trade-offs.md` with audio playback trade-off entry
- Update `docs/system-architecture.md` if it references the note schema

**Non-functional:**
- Tests run in CI without audio hardware (mock Tone.js)
- Keep test files under 200 lines

## Related Code Files

**Create:**
- `apps/web/src/__tests__/pitch-utils.test.ts`
- `apps/web/src/__tests__/midi-export.test.ts`
- `apps/api/src/__tests__/note-validator-audio.test.ts` (or extend existing)

**Modify:**
- `docs/trade-offs.md` -- add audio trade-off section
- `docs/system-architecture.md` -- update note schema docs if present

## Implementation Steps

1. **Create `pitch-utils.test.ts`:**
   - Test pitchForTrack returns correct MIDI number for each track 1-8
   - Test pitchForTrack defaults to 60 for out-of-range track
   - Test pitchName returns correct name for known pitches
   - Test velocityToOpacity: velocity=1 → ~0.4, velocity=127 → 1.0

2. **Create/extend note validator tests:**
   - Test createNoteSchema accepts valid pitch (0, 60, 127)
   - Test createNoteSchema rejects pitch=-1, pitch=128
   - Test duration must be >= 1
   - Test velocity bounds 1-127
   - Test all three fields are optional (schema passes without them)

3. **Create `midi-export.test.ts`:**
   - Mock `document.createElement` and `URL.createObjectURL`
   - Call exportToMidi with sample notes
   - Verify Midi object has correct track count and note data
   - OR: extract the Midi-building logic into a testable function that returns the Midi object

4. **Update `docs/trade-offs.md`:**
   Add section:
   ```markdown
   ## 7. Audio Playback: Tone.js (Optional Enhancement)
   - Not in original case-study rubric scope (YAGNI)
   - Added as demo polish for "hearing" the piano roll
   - Tone.js chosen for its Transport scheduler + PolySynth
   - Client-side only -- no server audio processing
   - Option A (KISS): fixed pitch per track, not a full piano-roll pitch axis
   ```

5. **Run full test suite:**
   ```bash
   pnpm test
   pnpm typecheck
   ```

## Todo List
- [ ] Create pitch-utils unit tests
- [ ] Create/extend validator tests for audio fields
- [ ] Create midi-export unit tests
- [ ] Update trade-offs.md
- [ ] Update system-architecture.md (if applicable)
- [ ] Run full test suite, all pass

## Success Criteria
- All new tests pass in `pnpm test`
- `pnpm typecheck` passes
- docs/trade-offs.md reflects audio playback decision
- No regressions in existing tests

## Risk Assessment
- **LOW:** Mocking Tone.js in tests. Use vi.mock() to stub.
- **LOW:** Doc updates are additive.

## Security Considerations
- None. Tests and docs only.

## Next Steps
- Feature complete. Mark plan as completed.
