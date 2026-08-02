/**
 * Pinch-zoom hook for the piano-roll.
 *
 * Mac trackpad pinch fires wheel events with ctrlKey=true.
 * We use multiplicative zoom (exp scale) for smooth continuous feel,
 * throttled via requestAnimationFrame so React never floods at >60fps.
 *
 * Focal-point zoom: the tick under the pointer stays stationary,
 * meaning we recompute scrollTop after each zoom so the same tick
 * remains at the same screen Y.
 */

import { useCallback, useRef } from "react";

export const MIN_PIXELS_PER_TICK = 1;
export const MAX_PIXELS_PER_TICK = 40;

/** Sensitivity constant for wheel-based pinch (lower = slower zoom). */
const PINCH_K = 0.01;

interface UseZoomOptions {
  pixelsPerTick: number;
  onZoom: (next: number) => void;
  /** Mutable ref to the scrollable container div (for reading/setting scrollTop). */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Returns a wheel handler to attach (via addEventListener) to the scroll container.
 * Pinch events (ctrlKey/metaKey) adjust zoom; plain scroll falls through.
 */
export function useZoom({ pixelsPerTick, onZoom, scrollContainerRef }: UseZoomOptions) {
  // Store current ppt in a ref so the stable wheel handler always reads the latest value
  const pptRef = useRef(pixelsPerTick);
  pptRef.current = pixelsPerTick;

  // rAF gate: one update per animation frame max
  const rafRef = useRef<number | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain two-finger scroll → let browser handle

      e.preventDefault();

      // Capture delta now (before rAF; WheelEvent is synthetic and may be pooled)
      const delta = e.deltaY;
      const container = scrollContainerRef.current;
      if (!container) return;

      // Capture focal point: screen-relative Y of pointer within the container
      const rect = container.getBoundingClientRect();
      const pointerScreenY = e.clientY - rect.top;
      // The tick under the pointer before zoom
      const tickUnderPointer = (container.scrollTop + pointerScreenY) / pptRef.current;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const prev = pptRef.current;
        // Multiplicative zoom: exp(-delta * k) so small delta → small change
        const factor = Math.exp(-delta * PINCH_K);
        const next = Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, prev * factor));

        if (next === prev) return;

        // Focal-point: after zoom, scroll so the same tick stays at pointerScreenY
        // newScrollTop = tickUnderPointer * nextPpt - pointerScreenY
        const newScrollTop = tickUnderPointer * next - pointerScreenY;
        container.scrollTop = Math.max(0, newScrollTop);

        onZoom(next);
      });
    },
    [onZoom, scrollContainerRef]
  );

  return { handleWheel };
}
