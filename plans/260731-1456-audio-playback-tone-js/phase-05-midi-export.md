# Phase 05: MIDI Export (.mid Download)

## Context Links
- Shared types: `packages/shared/src/types.ts`
- Shared constants: `packages/shared/src/constants.ts`
- Piano roll or song page (wherever download button lives)

## Overview
- **Priority:** P3 (optional nice-to-have)
- **Status:** pending
- **Description:** Allow users to download the current song as a Standard MIDI File (.mid) using `@tonejs/midi`. Client-side only, no S3 upload.

## Key Insights
- `@tonejs/midi` provides `Midi` class that builds a .mid file in-memory. Add tracks, set notes with pitch/duration/velocity, then `midi.toArray()` → Uint8Array → Blob → download link.
- BPM: 1 tick = 0.25s = 240 BPM at 1 tick per beat. Set MIDI tempo to match.
- 8 tracks in the editor map to 8 MIDI tracks in the file.
- File size is tiny (a few KB). No server involvement.

## Requirements
**Functional:**
- "Download MIDI" button in the song UI
- Generates a .mid file from current notes array
- Each editor track becomes a MIDI track
- Pitch, duration, velocity mapped correctly
- File named `{song-title}.mid`

**Non-functional:**
- Client-side only, no network call
- Small dependency (~20KB)

## Architecture
```
apps/web/src/lib/midi-export.ts
  └── exportToMidi(notes: Note[], songTitle: string): void
      ├── new Midi() from @tonejs/midi
      ├── group notes by track
      ├── for each track → midi.addTrack() → addNote(pitch, time, duration, velocity)
      ├── blob = new Blob([midi.toArray()])
      └── trigger download via <a> click
```

## Related Code Files

**Create:**
- `apps/web/src/lib/midi-export.ts`

**Modify:**
- `apps/web/package.json` -- add `@tonejs/midi` dependency
- Playback controls or song header -- add "Download MIDI" button

## Implementation Steps

1. **Install @tonejs/midi:**
   ```bash
   cd apps/web && pnpm add @tonejs/midi
   ```

2. **Create `apps/web/src/lib/midi-export.ts`:**
   ```ts
   import { Midi } from "@tonejs/midi";
   import type { Note } from "@ama-midi/shared";
   import { TICKS_PER_SECOND } from "@ama-midi/shared";

   export function exportToMidi(notes: Note[], songTitle: string): void {
     const midi = new Midi();
     midi.header.setTempo(120); // 120 BPM, standard

     // Group notes by track
     const byTrack = new Map<number, Note[]>();
     for (const n of notes) {
       const arr = byTrack.get(n.track) ?? [];
       arr.push(n);
       byTrack.set(n.track, arr);
     }

     for (const [trackNum, trackNotes] of byTrack) {
       const track = midi.addTrack();
       track.name = `Track ${trackNum}`;
       for (const n of trackNotes) {
         track.addNote({
           midi: n.pitch,
           time: n.timeTick / TICKS_PER_SECOND,
           duration: n.duration / TICKS_PER_SECOND,
           velocity: n.velocity / 127,
         });
       }
     }

     const blob = new Blob([midi.toArray()], { type: "audio/midi" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `${songTitle || "song"}.mid`;
     a.click();
     URL.revokeObjectURL(url);
   }
   ```

3. **Add download button to playback controls:**
   ```tsx
   <button onClick={() => exportToMidi(notes, songTitle)}>Download MIDI</button>
   ```

## Todo List
- [ ] Install @tonejs/midi
- [ ] Create midi-export.ts
- [ ] Add download button to UI
- [ ] Test: download .mid, open in a MIDI player to verify

## Success Criteria
- Clicking "Download MIDI" downloads a valid .mid file
- Opening in any MIDI player plays the correct notes
- `pnpm typecheck` passes

## Risk Assessment
- **LOW:** Straightforward client-side file generation
- **LOW:** @tonejs/midi is a well-maintained small library

## Security Considerations
- No server calls. No user data uploaded. Pure client-side.

## Next Steps
- Phase 06: tests + docs
