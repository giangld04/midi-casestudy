/**
 * Measures real render frame-rate via a requestAnimationFrame loop.
 * Samples frames over a fixed window and reports a rounded FPS every ~500ms,
 * so the overlay updates smoothly without re-rendering every frame.
 */

import { useEffect, useState } from "react";
import { computeFps } from "@/lib/performance-utils";

const SAMPLE_WINDOW_MS = 500;

/**
 * @param enabled  when false, the rAF loop is not started (0 FPS reported)
 * @returns the most recent measured frames-per-second
 */
export function useFpsCounter(enabled: boolean = true): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= SAMPLE_WINDOW_MS) {
        setFps(computeFps(frames, elapsed));
        frames = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return fps;
}
