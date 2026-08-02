/**
 * Hook that exposes coordinate-mapping helpers bound to current canvas config.
 * Consumers get stable function refs that auto-update if layout changes.
 *
 * Virtualization note (scroll offset):
 *   With a viewport-sized Stage the Konva canvas top always maps to `scrollTop`
 *   in absolute tick-space.
 *   - Forward (tick → stage Y):  stageY = tick * ppt - scrollTop
 *   - Inverse (stage Y → tick):  tick   = (stageY + scrollTop) / ppt
 *   X-axis is unaffected (no horizontal scroll).
 */

import { useMemo } from "react";
import {
  toCanvasX,
  toCanvasY,
  toTrack,
  toTick,
  DEFAULT_PIXELS_PER_TICK,
} from "@/lib/coordinate-utils";

export interface CoordinateMapping {
  pixelsPerTick: number;
  trackWidth: number;
  /** Forward: tick → stage-local Y (accounts for scroll offset). */
  canvasY: (tick: number) => number;
  /** Forward: track number → canvas X (column centre). */
  canvasX: (track: number) => number;
  /** Inverse: stage-local Y → snapped integer tick (accounts for scroll offset). */
  tick: (stageY: number) => number;
  /** Inverse: canvas X → clamped track number. */
  track: (canvasX: number) => number;
}

/**
 * @param stageWidth     current canvas width in pixels
 * @param pixelsPerTick  vertical scale (default DEFAULT_PIXELS_PER_TICK)
 * @param scrollTop      current scroll offset of the container div in pixels
 */
export function useCoordinateMapping(
  stageWidth: number,
  pixelsPerTick: number = DEFAULT_PIXELS_PER_TICK,
  scrollTop: number = 0
): CoordinateMapping {
  const trackWidth = stageWidth / 8;

  return useMemo(
    () => ({
      pixelsPerTick,
      trackWidth,
      // Stage-local Y: absolute Y minus scroll offset
      canvasY: (tick: number) => toCanvasY(tick, pixelsPerTick) - scrollTop,
      canvasX: (track: number) => toCanvasX(track, trackWidth),
      // Inverse: stage Y is relative to visible top; add scrollTop for absolute position
      tick: (stageY: number) => toTick(stageY + scrollTop, pixelsPerTick),
      track: (x: number) => toTrack(x, trackWidth),
    }),
    [pixelsPerTick, trackWidth, scrollTop]
  );
}
