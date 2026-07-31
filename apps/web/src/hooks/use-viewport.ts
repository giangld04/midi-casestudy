/**
 * Tracks the vertical scroll offset of the piano-roll container,
 * exposing the visible tick range so layers can cull off-screen elements.
 */

import { useState, useCallback, useRef } from "react";
import { MAX_TIME_TICK } from "@ama-midi/shared";
import { DEFAULT_PIXELS_PER_TICK } from "@/lib/coordinate-utils";

export interface Viewport {
  /** Current scroll position in pixels */
  scrollTop: number;
  /** First visible tick (floor) */
  firstTick: number;
  /** Last visible tick (ceil) */
  lastTick: number;
  /** Ref callback to attach to the scrollable container div */
  containerRef: (el: HTMLDivElement | null) => void;
  /** Scroll handler to pass to the container's onScroll */
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

/**
 * @param containerHeight  visible height of the scroll container (px)
 * @param pixelsPerTick    vertical scale
 */
export function useViewport(
  containerHeight: number,
  pixelsPerTick: number = DEFAULT_PIXELS_PER_TICK
): Viewport {
  const [scrollTop, setScrollTop] = useState(0);
  const _containerRef = useRef<HTMLDivElement | null>(null);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    _containerRef.current = el;
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop);
  }, []);

  const firstTick = Math.max(0, Math.floor(scrollTop / pixelsPerTick) - 4);
  const lastTick = Math.min(
    MAX_TIME_TICK,
    Math.ceil((scrollTop + containerHeight) / pixelsPerTick) + 4
  );

  return { scrollTop, firstTick, lastTick, containerRef, onScroll };
}
