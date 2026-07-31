/**
 * Pure coordinate-mapping functions for the piano-roll canvas.
 *
 * Time model: integer TICKS (0..1200). 1 tick = 0.25 s. 1200 ticks = 300 s.
 * X-axis: 8 track columns, each trackWidth = canvasWidth / 8.
 * Y-axis: tickHeight = pixelsPerTick * tick (default 4 px/tick → 4800 px total).
 *
 * Grid scheme:
 *   Minor line  every 1 tick  (thin, dim)
 *   Major line  every 4 ticks = 1 s (brighter, labelled)
 */

import { TRACK_COUNT, MAX_TIME_TICK } from "@ama-midi/shared";

/** Canvas default: 4 pixels per tick → 4800 px scrollable height */
export const DEFAULT_PIXELS_PER_TICK = 4;

// ── Forward mappings ──────────────────────────────────────────────────────────

/**
 * Convert a track number (1-8) to canvas X (centre of the column).
 * @param track       1-based track number
 * @param trackWidth  width of each column in pixels
 */
export function toCanvasX(track: number, trackWidth: number): number {
  return (track - 1) * trackWidth + trackWidth / 2;
}

/**
 * Convert a tick position to canvas Y (top edge of the tick row).
 * @param tick           integer tick 0..1200
 * @param pixelsPerTick  vertical pixels per tick
 */
export function toCanvasY(tick: number, pixelsPerTick: number): number {
  return tick * pixelsPerTick;
}

// ── Inverse mappings ──────────────────────────────────────────────────────────

/**
 * Convert canvas X to track number, clamped to [1, TRACK_COUNT].
 * @param canvasX    pixel X on the canvas
 * @param trackWidth width of each column in pixels
 */
export function toTrack(canvasX: number, trackWidth: number): number {
  const raw = Math.floor(canvasX / trackWidth) + 1;
  return Math.max(1, Math.min(TRACK_COUNT, raw));
}

/**
 * Convert canvas Y to the nearest integer tick, clamped to [0, MAX_TIME_TICK].
 * Rounds to nearest tick (snap-to-grid with 1-tick resolution).
 * @param canvasY        pixel Y on the canvas
 * @param pixelsPerTick  vertical pixels per tick
 */
export function toTick(canvasY: number, pixelsPerTick: number): number {
  const raw = canvasY / pixelsPerTick;
  const snapped = Math.round(raw);
  return Math.max(0, Math.min(MAX_TIME_TICK, snapped));
}

// ── Snap helper (explicit, for callers that already have a raw tick) ──────────

/**
 * Snap an arbitrary tick value to the nearest integer tick and clamp.
 */
export function snapToTick(rawTick: number): number {
  return Math.max(0, Math.min(MAX_TIME_TICK, Math.round(rawTick)));
}
