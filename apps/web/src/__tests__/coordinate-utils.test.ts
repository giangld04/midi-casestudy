/**
 * Unit tests for coordinate-utils pure functions.
 * Covers: forward/inverse round-trips, snapping, clamping, boundary values.
 */

import { describe, it, expect } from "vitest";
import {
  toCanvasX,
  toCanvasY,
  toTrack,
  toTick,
  snapToTick,
  DEFAULT_PIXELS_PER_TICK,
} from "../lib/coordinate-utils";

const TRACK_WIDTH = 100; // 8 tracks × 100px = 800px total
const PPT = DEFAULT_PIXELS_PER_TICK; // 4

// ── Forward mappings ──────────────────────────────────────────────────────────

describe("toCanvasX", () => {
  it("track 1 maps to centre of first column", () => {
    expect(toCanvasX(1, TRACK_WIDTH)).toBe(50);
  });

  it("track 8 maps to centre of last column", () => {
    expect(toCanvasX(8, TRACK_WIDTH)).toBe(750);
  });

  it("track 4 maps to centre of 4th column", () => {
    expect(toCanvasX(4, TRACK_WIDTH)).toBe(350);
  });
});

describe("toCanvasY", () => {
  it("tick 0 maps to y=0", () => {
    expect(toCanvasY(0, PPT)).toBe(0);
  });

  it("tick 1200 maps to y = 1200 * PPT", () => {
    expect(toCanvasY(1200, PPT)).toBe(1200 * PPT);
  });

  it("tick 4 (=1s) maps to y=16 at 4px/tick", () => {
    expect(toCanvasY(4, PPT)).toBe(16);
  });
});

// ── Inverse mappings ──────────────────────────────────────────────────────────

describe("toTrack", () => {
  it("x=0 → track 1", () => {
    expect(toTrack(0, TRACK_WIDTH)).toBe(1);
  });

  it("x=750 (centre of track 8) → track 8", () => {
    expect(toTrack(750, TRACK_WIDTH)).toBe(8);
  });

  it("x=50 (centre of track 1) → track 1", () => {
    expect(toTrack(50, TRACK_WIDTH)).toBe(1);
  });

  it("clamps x < 0 → track 1", () => {
    expect(toTrack(-50, TRACK_WIDTH)).toBe(1);
  });

  it("clamps x > canvasWidth → track 8", () => {
    expect(toTrack(900, TRACK_WIDTH)).toBe(8);
  });

  it("x=799 (last px of track 8) → track 8", () => {
    expect(toTrack(799, TRACK_WIDTH)).toBe(8);
  });
});

describe("toTick", () => {
  it("y=0 → tick 0", () => {
    expect(toTick(0, PPT)).toBe(0);
  });

  it("y = 1200*PPT → tick 1200", () => {
    expect(toTick(1200 * PPT, PPT)).toBe(1200);
  });

  it("rounds to nearest tick — 0.4 tick below snaps down", () => {
    // y = 3.4 ticks → round(3.4) = 3
    expect(toTick(3.4 * PPT, PPT)).toBe(3);
  });

  it("rounds to nearest tick — 0.6 tick above snaps up", () => {
    // y = 3.6 ticks → round(3.6) = 4
    expect(toTick(3.6 * PPT, PPT)).toBe(4);
  });

  it("clamps negative y → tick 0", () => {
    expect(toTick(-10, PPT)).toBe(0);
  });

  it("clamps y beyond max → tick 1200", () => {
    expect(toTick(9999, PPT)).toBe(1200);
  });
});

// ── Round-trip invariants ─────────────────────────────────────────────────────

describe("round-trip: toCanvasX → toTrack", () => {
  for (let track = 1; track <= 8; track++) {
    it(`track ${track} survives round-trip at column centre`, () => {
      const x = toCanvasX(track, TRACK_WIDTH);
      expect(toTrack(x, TRACK_WIDTH)).toBe(track);
    });
  }
});

describe("round-trip: toCanvasY → toTick", () => {
  const testTicks = [0, 1, 4, 100, 600, 1199, 1200];
  for (const tick of testTicks) {
    it(`tick ${tick} survives round-trip`, () => {
      const y = toCanvasY(tick, PPT);
      expect(toTick(y, PPT)).toBe(tick);
    });
  }
});

// ── snapToTick ────────────────────────────────────────────────────────────────

describe("snapToTick", () => {
  it("rounds 3.2 → 3", () => {
    expect(snapToTick(3.2)).toBe(3);
  });

  it("rounds 3.7 → 4", () => {
    expect(snapToTick(3.7)).toBe(4);
  });

  it("rounds 3.5 → 4 (banker's round / JS round)", () => {
    expect(snapToTick(3.5)).toBe(4);
  });

  it("clamps negative → 0", () => {
    expect(snapToTick(-5)).toBe(0);
  });

  it("clamps >1200 → 1200", () => {
    expect(snapToTick(9999)).toBe(1200);
  });

  it("identity on exact integer within range", () => {
    expect(snapToTick(800)).toBe(800);
  });
});

// ── Boundary values ───────────────────────────────────────────────────────────

describe("boundary values", () => {
  it("track 8, tick 1200 — toCanvasX gives valid x", () => {
    const x = toCanvasX(8, TRACK_WIDTH);
    expect(x).toBeGreaterThan(0);
    expect(toTrack(x, TRACK_WIDTH)).toBe(8);
  });

  it("tick 1200 round-trips exactly", () => {
    expect(toTick(toCanvasY(1200, PPT), PPT)).toBe(1200);
  });

  it("tick 0 round-trips exactly", () => {
    expect(toTick(toCanvasY(0, PPT), PPT)).toBe(0);
  });
});
