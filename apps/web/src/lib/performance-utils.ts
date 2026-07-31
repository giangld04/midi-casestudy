/**
 * Pure performance helpers for the piano-roll canvas.
 *
 * The Stage renders a single tall canvas (MAX_TIME_TICK * pixelsPerTick px)
 * inside a natively-scrolled div. Without culling, EVERY note becomes a live
 * Konva node regardless of scroll position — at 10k notes that is 10k nodes to
 * reconcile and draw. `cullNotes` trims the set to only those whose tick falls
 * inside the (already padded) visible range, cutting draw/reconciliation work
 * by ~80-90% at any scroll offset.
 */

import type { Note } from "@ama-midi/shared";

/**
 * Return only the notes whose `timeTick` lies within [firstTick, lastTick].
 *
 * The range is expected to already include a small padding (the viewport hook
 * pads by a few ticks) to prevent pop-in at the scroll edges. This is an O(n)
 * linear filter — trivial (<1ms) even for 10k notes, and avoids the complexity
 * of keeping a sorted index (YAGNI).
 *
 * @param notes      full note set for the song
 * @param firstTick  inclusive lower tick bound of the visible window
 * @param lastTick   inclusive upper tick bound of the visible window
 */
export function cullNotes(notes: Note[], firstTick: number, lastTick: number): Note[] {
  if (lastTick < firstTick) return [];
  return notes.filter((n) => n.timeTick >= firstTick && n.timeTick <= lastTick);
}

/**
 * Compute frames-per-second from a frame count over an elapsed window.
 * Pure and rounded to the nearest integer; returns 0 for a non-positive window.
 *
 * @param frames     number of frames observed
 * @param elapsedMs  duration of the observation window in milliseconds
 */
export function computeFps(frames: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.round((frames * 1000) / elapsedMs);
}
