---
title: "Audio Playback with Tone.js"
description: "Add note playback to the MIDI editor so users can hear placed notes via Tone.js synthesizer"
status: pending
priority: P3
effort: 10h
branch: main
tags: [audio, tone-js, playback, optional-enhancement]
created: 2026-07-31
---

# Audio Playback (Tone.js) - Optional Enhancement

> **Scope note:** This feature is explicitly OUTSIDE the original case-study rubric (documented as YAGNI in `docs/trade-offs.md`). It is an optional demo-polish enhancement. All phases are additive; the existing editor works unchanged without them.

## Current State

The piano-roll editor has no audio. Notes are visual-only (circles on an 8-track x 1200-tick grid). The `title` column holds a free-text label (e.g. "Note"), not a MIDI pitch number. There is no duration (only start tick) and no velocity.

## Approach

**Option A (KISS, recommended first):** Fixed pitch per track (8 tracks = 8 predefined MIDI pitches). Duration defaults to 1 tick (0.25s). This avoids Y-axis redesign and keeps the existing grid model intact.

**Option B (future):** Full pitch-row piano-roll (Y = pitch 0-127, X = time). Deferred — YAGNI.

## Phases

| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 1 | DB + shared types (pitch/duration/velocity columns) | [phase-01](./phase-01-db-shared-types.md) | 2h | pending |
| 2 | API validation + service passthrough | [phase-02](./phase-02-api-validation-service.md) | 1.5h | pending |
| 3 | Frontend note input UI (pitch/duration display) | [phase-03](./phase-03-frontend-note-input-ui.md) | 2h | pending |
| 4 | Tone.js audio engine + playback transport | [phase-04](./phase-04-tonejs-audio-engine.md) | 3h | pending |
| 5 | MIDI export (.mid download) | [phase-05](./phase-05-midi-export.md) | 1h | pending |
| 6 | Tests + docs update | [phase-06](./phase-06-tests-docs.md) | 0.5h | pending |

## Key Dependencies

- `tone` npm package (Tone.js) added to `apps/web`
- `@tonejs/midi` npm package for Phase 5 export (optional)
- Drizzle migration for 3 new columns on `notes` table
- Browser AudioContext requires user gesture to start (handled in Phase 4)

## Risk Summary

- **UNIQUE constraint change:** adding `duration` means notes can span multiple ticks; existing UNIQUE(song_id, track, time_tick) may need review for overlap detection. Phase 1 addresses this.
- **AudioContext auto-play policy:** browsers block audio until user gesture. Phase 4 handles with explicit "start audio" button.
- **Backfill:** existing rows need default pitch/duration/velocity. Phase 1 migration handles.
