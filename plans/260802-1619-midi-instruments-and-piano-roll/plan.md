# MIDI Playback v2 — Instruments · Piano-roll Y · Beats

Follow-up to the shipped Tone.js playback (engine + transport bar + note-create
preview). Three requested features, ordered by size. Do in a fresh session
(this plan survives compaction).

## Done (committed)
- `apps/web/src/lib/playback-engine.ts` — Tone.PolySynth, 8 tracks → C-major
  pentatonic (`C4 D4 E4 G4 A4 C5 D5 E5`), Transport scheduling, `preview(track)`.
- `apps/web/src/hooks/use-playback.ts` — {isPlaying,currentTick,toggle,stop,preview}, rAF playhead, stable callbacks.
- `piano-roll/playhead-layer.tsx` — green horizontal sweep (Y=time).
- `piano-roll/playback-controls.tsx` — transport bar (restart · green Play/Pause · stop · `m:ss / m:ss`).
- `piano-roll-stage.tsx` — wired; Space=play/pause; auto-scroll; click-create plays preview.
- dep: `tone`.

## Phase 1 — GM instrument picker (screenshot: Categories | Instruments)
- Lib: **`smplr`** (SoundFont2 sampler, CDN samples) or `@tonejs/instruments`. Replaces PolySynth voice.
- GM map: 16 categories (Piano, Chromatic Perc, Organ, Guitar, Bass, Strings, Ensemble, Brass, Reed, Pipe, Synth Lead, …) → instrument list. Static data file `lib/gm-instruments.ts`.
- Engine: swap `ensureSynth()` → load selected instrument sampler (async, cache); keep `triggerAttackRelease` API.
- UI: `components/song/instrument-picker-dialog.tsx` — two-pane (category list | instrument list) + OK/Cancel, matches app dark theme + green accent.
- State: selected instrument per **song** (simple) or per **track** (richer). Persist? MVP = client state; later add `song.instrument` column.
- Entry point: button in toolbar or track-header.

## Phase 2 — Beats / BPM grid (question: "chia phách?")
- Current grid = seconds (major line every 4 ticks = 1s). Add fixed **BPM** (e.g. 120): 1 beat = 2 ticks, 1 bar(4/4) = 8 ticks.
- `grid-layer.tsx`: relabel major = bar, minor = beat; time readout `bar:beat`.
- No DB change if BPM fixed; optional `song.bpm` later.

## Phase 3 — Vertical piano-roll (screenshot: Y = piano keys C3/C4)
- BIG: flips coordinate model. Currently X=track(8), Y=time. Reference = Y=pitch, X=time.
- Requires `Note.pitch` (DB migration + socket events + zod validate) OR reinterpret `track` as pitch lane.
- Rewrite `coordinate-utils`, grid/notes/selection/cursors/playhead orientation; `track-header` → piano-keyboard component.
- Decide first: keep 8-lane model (add pitch separately) vs full 88-key redesign. Needs its own plan + backend work.

## Open questions
- Instrument scope: per-song or per-track?
- Persist instrument/BPM to DB, or client-only for now?
- Phase 3: extend current model or full redesign (bigger, touches API/DB)?
