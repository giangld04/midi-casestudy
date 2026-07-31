/**
 * Memoized viewport culling: derives the subset of notes currently inside the
 * visible tick window. Recomputes only when the note set or the visible range
 * changes (i.e. on scroll or zoom), so steady-state renders pay nothing.
 */

import { useMemo } from "react";
import type { Note } from "@ama-midi/shared";
import { cullNotes } from "@/lib/performance-utils";

/**
 * @param notes      full note set for the song
 * @param firstTick  inclusive lower tick bound (already padded by useViewport)
 * @param lastTick   inclusive upper tick bound (already padded by useViewport)
 * @returns notes visible in the current window
 */
export function useViewportCulling(
  notes: Note[],
  firstTick: number,
  lastTick: number
): Note[] {
  return useMemo(
    () => cullNotes(notes, firstTick, lastTick),
    [notes, firstTick, lastTick]
  );
}
