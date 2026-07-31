# Phase 04: Tone.js Audio Engine + Playback Transport

## Context Links
- Piano roll stage: `apps/web/src/components/piano-roll/piano-roll-stage.tsx`
- Shared constants: `packages/shared/src/constants.ts` (TICKS_PER_SECOND=4)
- use-realtime-notes: `apps/web/src/hooks/use-realtime-notes.ts`
- Coordinate utils: `apps/web/src/lib/coordinate-utils.ts`

## Overview
- **Priority:** P2 (core audio feature)
- **Status:** pending
- **Description:** Install Tone.js, create an audio engine module and a React hook for playback transport (play/pause/stop). Add a playhead line on the Konva canvas that moves during playback. Schedule all notes in the current song for synthesis.

## Key Insights
- Tone.js `PolySynth` handles multiple simultaneous notes across 8 tracks. A single PolySynth with 8 voices is sufficient.
- `Tone.Transport` provides a timeline scheduler. Notes are scheduled using `Transport.schedule()` with computed time offsets.
- **Browser AudioContext policy:** Tone.start() must be called from a user gesture (click/tap). The "Play" button satisfies this. First click calls `Tone.start()` then begins playback.
- Timing: 1 tick = 0.25s (TICKS_PER_SECOND=4 from shared constants). Note start time = timeTick / 4 seconds. Duration = duration / 4 seconds.
- MIDI pitch to Tone.js note: `Tone.Frequency(pitch, "midi").toNote()` converts 60 → "C4".
- Velocity: Tone.js triggerAttackRelease accepts velocity as 0-1 float. Map: velocity/127.
- Playhead: a Konva `Line` on a dedicated layer, Y = currentTick * pixelsPerTick. Updated via requestAnimationFrame during playback, reading Transport.seconds and converting back to ticks.

## Requirements
**Functional:**
- Install `tone` package in `apps/web`
- Audio engine module: init synth, scheduleNotes(notes[]), play(), pause(), stop(), dispose()
- `usePlayback` hook: exposes isPlaying, currentTick, play, pause, stop, scheduleNotes
- Transport controls UI: Play/Pause toggle button + Stop button, positioned in the piano-roll layout
- Playhead line on Konva canvas that tracks current playback position
- On play: schedule all notes, start transport. On stop: clear transport, reset to tick 0.
- On pause: pause transport, keep position. Resume continues from paused tick.

**Non-functional:**
- Audio engine is a standalone module (no React dependency) for testability
- Hook wraps engine with React lifecycle (dispose on unmount)
- Playhead update uses rAF, not setInterval (smooth animation)

## Architecture
```
apps/web/src/lib/audio-engine.ts    (pure TS module)
  ├── createAudioEngine()
  │   ├── synth: Tone.PolySynth
  │   ├── scheduleNotes(notes: Note[])  → clears + reschedules
  │   ├── play()  → Tone.start() + Transport.start()
  │   ├── pause() → Transport.pause()
  │   ├── stop()  → Transport.stop() + Transport.position = 0
  │   ├── getCurrentSeconds() → Transport.seconds
  │   └── dispose()
  └── (exported as singleton-factory)

apps/web/src/hooks/use-playback.ts  (React hook)
  ├── usePlayback(notes: Note[])
  │   ├── isPlaying, isPaused, currentTick (state)
  │   ├── play(), pause(), stop()  (call engine)
  │   ├── rAF loop → reads engine.getCurrentSeconds() → currentTick
  │   └── cleanup → engine.dispose()

apps/web/src/components/piano-roll/playback-controls.tsx  (UI)
  ├── Play/Pause button + Stop button
  └── Current time display (seconds)

apps/web/src/components/piano-roll/playhead-layer.tsx  (Konva)
  └── Horizontal Line at Y = currentTick * pixelsPerTick
```

## Related Code Files

**Create:**
- `apps/web/src/lib/audio-engine.ts` -- Tone.js synth + transport wrapper
- `apps/web/src/hooks/use-playback.ts` -- React hook for playback state
- `apps/web/src/components/piano-roll/playback-controls.tsx` -- Play/Pause/Stop UI
- `apps/web/src/components/piano-roll/playhead-layer.tsx` -- Konva playhead line

**Modify:**
- `apps/web/package.json` -- add `tone` dependency
- `apps/web/src/components/piano-roll/piano-roll-stage.tsx` -- integrate PlayheadLayer + pass playback state
- Parent component that renders PianoRollStage (likely `app.tsx` or a song page) -- add PlaybackControls

## Implementation Steps

1. **Install Tone.js:**
   ```bash
   cd apps/web && pnpm add tone
   ```

2. **Create `apps/web/src/lib/audio-engine.ts`:**
   ```ts
   import * as Tone from "tone";
   import type { Note } from "@ama-midi/shared";
   import { TICKS_PER_SECOND } from "@ama-midi/shared";

   export interface AudioEngine {
     scheduleNotes: (notes: Note[]) => void;
     play: () => Promise<void>;
     pause: () => void;
     stop: () => void;
     getCurrentSeconds: () => number;
     dispose: () => void;
   }

   export function createAudioEngine(): AudioEngine {
     const synth = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 16 }).toDestination();
     let scheduledIds: number[] = [];

     function scheduleNotes(notes: Note[]) {
       // Clear previous schedule
       scheduledIds.forEach((id) => Tone.getTransport().clear(id));
       scheduledIds = [];
       for (const note of notes) {
         const startSec = note.timeTick / TICKS_PER_SECOND;
         const durSec = note.duration / TICKS_PER_SECOND;
         const freq = Tone.Frequency(note.pitch, "midi").toNote();
         const vel = note.velocity / 127;
         const id = Tone.getTransport().schedule((time) => {
           synth.triggerAttackRelease(freq, durSec, time, vel);
         }, startSec);
         scheduledIds.push(id);
       }
     }

     async function play() {
       await Tone.start(); // satisfies browser autoplay policy
       Tone.getTransport().start();
     }

     function pause() { Tone.getTransport().pause(); }
     function stop() {
       Tone.getTransport().stop();
       Tone.getTransport().position = 0;
     }
     function getCurrentSeconds() { return Tone.getTransport().seconds; }
     function dispose() {
       stop();
       scheduledIds.forEach((id) => Tone.getTransport().clear(id));
       synth.dispose();
     }

     return { scheduleNotes, play, pause, stop, getCurrentSeconds, dispose };
   }
   ```

3. **Create `apps/web/src/hooks/use-playback.ts`:**
   - Holds engine ref, isPlaying/isPaused state, currentTick (number) updated via rAF
   - `play()`: call engine.scheduleNotes(notes) then engine.play(), start rAF loop
   - `pause()`: engine.pause(), stop rAF, keep currentTick
   - `stop()`: engine.stop(), stop rAF, set currentTick to 0
   - rAF loop: read engine.getCurrentSeconds() * TICKS_PER_SECOND → setCurrentTick
   - Auto-stop when currentTick >= MAX_TIME_TICK or beyond last note
   - Cleanup: engine.dispose() on unmount

4. **Create `apps/web/src/components/piano-roll/playback-controls.tsx`:**
   - HTML div, absolute-positioned below track header or above zoom controls
   - Play/Pause toggle button (triangle / double-bar icons via Unicode)
   - Stop button (square icon)
   - Time display: `currentTick / TICKS_PER_SECOND` formatted as mm:ss

5. **Create `apps/web/src/components/piano-roll/playhead-layer.tsx`:**
   - Konva Layer with a single horizontal Line
   - Props: currentTick, pixelsPerTick, stageWidth
   - Line at y = currentTick * pixelsPerTick, x from 0 to stageWidth
   - Color: bright red/orange, 2px stroke, slight opacity

6. **Integrate into `piano-roll-stage.tsx`:**
   - Import PlayheadLayer, render between NotesLayer and SelectionLayer
   - Pass currentTick and pixelsPerTick
   - PlaybackControls rendered outside the Konva Stage (HTML overlay)

7. **Auto-scroll during playback (stretch):**
   - When playhead moves out of visible viewport, scroll the container to follow. Can defer to a follow-up.

## Todo List
- [ ] Install tone in apps/web
- [ ] Create audio-engine.ts
- [ ] Create use-playback.ts hook
- [ ] Create playback-controls.tsx
- [ ] Create playhead-layer.tsx
- [ ] Integrate into piano-roll-stage.tsx
- [ ] Test: place notes, click play, hear audio
- [ ] Test: pause/resume works
- [ ] Test: stop resets to beginning
- [ ] Verify no audio plays without user gesture

## Success Criteria
- Clicking Play produces audible synth tones matching placed notes
- Playhead line moves across canvas in sync with audio
- Pause freezes playback, resume continues
- Stop resets playhead to tick 0
- No console errors about AudioContext policy
- `pnpm typecheck` passes

## Risk Assessment
- **MEDIUM:** Tone.js bundle size (~300KB gzipped). Acceptable for a demo/case-study.
- **MEDIUM:** AudioContext browser policy requires careful UX. Handled by explicit Play button.
- **LOW:** rAF playhead may drift slightly from audio. Acceptable for visual feedback.

## Security Considerations
- No server interaction. Audio is purely client-side.
- No microphone access needed (synthesis only).

## Next Steps
- Phase 05 (MIDI export) depends on notes having pitch/duration/velocity from Phases 01-03
