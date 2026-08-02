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

## Phase 1 — GM instrument picker ✅ DONE (per-song, client-only, smplr)
Decisions: scope = **per-song**; persistence = **client-only** (no DB/socket); lib = **smplr** (MusyngKite SoundFont, CDN samples).
- `lib/gm-instruments.ts` — 16 GM families × 8 = 128 instruments (gleitz snake_case ids) + `DEFAULT_INSTRUMENT` + `instrumentLabel()`.
- `lib/playback-engine.ts` — PolySynth replaced by smplr `Soundfont(rawContext,{instrument})` loaded on Tone's AudioContext (shared clock); `setInstrument()` + Map cache + async `ensureSampler()`; Part callback calls `sampler.start({note,time,duration})`. play/pause/stop/preview API unchanged.
- `hooks/use-playback.ts` — exposes `{instrument,setInstrument}`.
- `components/song/instrument-picker-dialog.tsx` — two-pane (category | instrument) + OK/Cancel, dark theme + green accent, dbl-click = quick select.
- `piano-roll-stage.tsx` — pill button (bottom-right) shows current instrument, opens dialog.
- Verified: tsc clean, vite build ok (bundle ~809kB), 52 tests pass. Real audio not unit-tested (needs Web Audio).
- Later (deferred): persist to `song.instrument` column; per-track instruments.

## Phase 2 — Beats / BPM grid ✅ DONE (fixed BPM 120, 4/4)
- `grid-layer.tsx`: TICKS_PER_BEAT=2, TICKS_PER_BAR=8. Beat lines every 2 ticks (--grid-line), bar lines every 8 ticks (--grid-bold). Labels = bar number (1,2,3…) at each bar (was "Ns" seconds). Viewport culling kept. No props/DB change.
- Transport already shows BPM 120 + bar:beat readout (Phase-1 UI pass) → now visually matches grid.
- Verified: tsc clean, vite build ok, 52 tests pass.
- Optional later: editable/`song.bpm`.

## UI pass (done alongside Phase 1) ✅
- Full-width transport bar (rewind·stop·play·BPM·bar:beat:hundredths).
- Secondary `editor-toolbar.tsx`: instrument pill + volume + pan sliders + draw/select tool toggles.
- Multi-select marquee: `marquee-layer.tsx` + `use-stage-interactions.ts` (mode draw/select, selectedIds Set, delete-many).
- Volume/pan: engine GainNode→StereoPannerNode chain; use-playback exposes volume/pan/setVolume/setPan.
- Color unified to app cyan `--accent` (#00d4ff): tokens --accent-green* + `theme-constants.ts` (Konva).

## Phase 3 — Vertical piano-roll (screenshot: Y = piano keys C3/C4)
- BIG: flips coordinate model. Currently X=track(8), Y=time. Reference = Y=pitch, X=time.
- Requires `Note.pitch` (DB migration + socket events + zod validate) OR reinterpret `track` as pitch lane.
- Rewrite `coordinate-utils`, grid/notes/selection/cursors/playhead orientation; `track-header` → piano-keyboard component.
- Decide first: keep 8-lane model (add pitch separately) vs full 88-key redesign. Needs its own plan + backend work.

## Open questions
- Instrument scope: per-song or per-track?
- Persist instrument/BPM to DB, or client-only for now?
- Phase 3: extend current model or full redesign (bigger, touches API/DB)?
