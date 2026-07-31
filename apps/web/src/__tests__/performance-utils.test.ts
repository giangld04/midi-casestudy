/**
 * Unit tests for Phase 06 performance helpers.
 * Covers cullNotes edge cases (empty / all-visible / none-visible / boundary),
 * a realistic 10k-note culling assertion (proves the visible set is bounded and
 * the filter is fast), and computeFps arithmetic.
 */

import { describe, it, expect } from "vitest";
import type { Note, TrackNumber } from "@ama-midi/shared";
import { MAX_TIME_TICK, TRACK_COUNT } from "@ama-midi/shared";
import { cullNotes, computeFps } from "../lib/performance-utils";

/** Minimal Note factory for tests. */
function makeNote(id: string, track: TrackNumber, timeTick: number): Note {
  return {
    id,
    songId: "song-1",
    title: "n",
    track,
    timeTick,
    color: "#22d3ee",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("cullNotes", () => {
  it("returns an empty array for no notes", () => {
    expect(cullNotes([], 0, 100)).toEqual([]);
  });

  it("returns all notes when every note is inside the window", () => {
    const notes = [makeNote("a", 1, 10), makeNote("b", 2, 50), makeNote("c", 3, 90)];
    expect(cullNotes(notes, 0, 100)).toHaveLength(3);
  });

  it("returns none when all notes are outside the window", () => {
    const notes = [makeNote("a", 1, 10), makeNote("b", 2, 20)];
    expect(cullNotes(notes, 100, 200)).toEqual([]);
  });

  it("includes notes exactly on the inclusive boundaries", () => {
    const notes = [
      makeNote("low", 1, 100), // == firstTick
      makeNote("mid", 2, 150),
      makeNote("high", 3, 200), // == lastTick
      makeNote("under", 4, 99), // just below
      makeNote("over", 5, 201), // just above
    ];
    const visible = cullNotes(notes, 100, 200).map((n) => n.id);
    expect(visible).toEqual(["low", "mid", "high"]);
  });

  it("returns empty when the range is inverted (lastTick < firstTick)", () => {
    const notes = [makeNote("a", 1, 50)];
    expect(cullNotes(notes, 200, 100)).toEqual([]);
  });

  it("culls a fully-packed song (every grid cell) to only the visible window", () => {
    // The grid holds at most TRACK_COUNT × (MAX_TIME_TICK + 1) = 8 × 1201 = 9608
    // unique (track, tick) cells — the realistic dense-song ceiling.
    const notes: Note[] = [];
    let i = 0;
    for (let tick = 0; tick <= MAX_TIME_TICK; tick++) {
      for (let track = 1; track <= TRACK_COUNT; track++) {
        notes.push(makeNote(`n-${i++}`, track as TrackNumber, tick));
      }
    }
    expect(notes.length).toBe(TRACK_COUNT * (MAX_TIME_TICK + 1)); // 9608

    // A ~150-tick viewport (≈ a screenful) must yield a tiny fraction of the set.
    const firstTick = 400;
    const lastTick = 550; // 151 ticks × 8 tracks = 1208 max, but capped by 10k spread
    const visible = cullNotes(notes, firstTick, lastTick);

    // Every visible note is genuinely inside the window
    expect(visible.every((n) => n.timeTick >= firstTick && n.timeTick <= lastTick)).toBe(true);
    // Culling removes the vast majority (>80% reduction is the Phase 06 target)
    expect(visible.length).toBeLessThan(notes.length * 0.2);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("filters 10k notes in well under a frame budget", () => {
    const notes: Note[] = Array.from({ length: 10_000 }, (_, i) =>
      makeNote(`n-${i}`, ((i % TRACK_COUNT) + 1) as TrackNumber, i % (MAX_TIME_TICK + 1))
    );
    const start = performance.now();
    cullNotes(notes, 300, 450);
    const elapsed = performance.now() - start;
    // O(n) filter over 10k items is sub-millisecond; allow generous CI headroom.
    expect(elapsed).toBeLessThan(16);
  });
});

describe("computeFps", () => {
  it("computes 60fps from 30 frames over 500ms", () => {
    expect(computeFps(30, 500)).toBe(60);
  });

  it("rounds to the nearest integer", () => {
    expect(computeFps(29, 500)).toBe(58);
  });

  it("returns 0 for a non-positive window", () => {
    expect(computeFps(10, 0)).toBe(0);
    expect(computeFps(10, -100)).toBe(0);
  });
});
