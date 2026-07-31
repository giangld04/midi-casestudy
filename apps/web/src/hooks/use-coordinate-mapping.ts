/**
 * Hook that exposes coordinate-mapping helpers bound to current canvas config.
 * Consumers get stable function refs that auto-update if layout changes.
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
  /** Forward: tick position → canvas Y */
  canvasY: (tick: number) => number;
  /** Forward: track number → canvas X (column centre) */
  canvasX: (track: number) => number;
  /** Inverse: canvas Y → snapped integer tick */
  tick: (canvasY: number) => number;
  /** Inverse: canvas X → clamped track number */
  track: (canvasX: number) => number;
}

/**
 * @param stageWidth     current canvas width in pixels
 * @param pixelsPerTick  vertical scale (default DEFAULT_PIXELS_PER_TICK)
 */
export function useCoordinateMapping(
  stageWidth: number,
  pixelsPerTick: number = DEFAULT_PIXELS_PER_TICK
): CoordinateMapping {
  const trackWidth = stageWidth / 8;

  return useMemo(
    () => ({
      pixelsPerTick,
      trackWidth,
      canvasY: (tick: number) => toCanvasY(tick, pixelsPerTick),
      canvasX: (track: number) => toCanvasX(track, trackWidth),
      tick: (y: number) => toTick(y, pixelsPerTick),
      track: (x: number) => toTrack(x, trackWidth),
    }),
    [pixelsPerTick, trackWidth]
  );
}
