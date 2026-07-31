// Phase 10 — Pure unit tests for request validators (Zod schemas).
// These run WITHOUT a database: they assert the API-layer domain boundaries
// (track 1-8, timeTick 0-1200) that mirror the DB CHECK constraints — the
// "reject 301 / reject track 0" boundary deliverable at the validation layer.
import { describe, expect, it } from "vitest";
import { MAX_TIME_TICK, TRACK_COUNT } from "@ama-midi/shared";
import { createNoteSchema, updateNoteSchema } from "../validators/note-validator";
import { createSongSchema, updateSongSchema } from "../validators/song-validator";

const baseNote = { title: "C4", track: 3, timeTick: 120, color: "#22d3ee" };

describe("createNoteSchema — valid inputs", () => {
  it("accepts a fully-specified note", () => {
    expect(createNoteSchema.safeParse(baseNote).success).toBe(true);
  });

  it("accepts the minimum boundary (track 1, timeTick 0)", () => {
    expect(
      createNoteSchema.safeParse({ title: "min", track: 1, timeTick: 0 }).success,
    ).toBe(true);
  });

  it("accepts the maximum boundary (track 8, timeTick 1200 = 300s)", () => {
    expect(
      createNoteSchema.safeParse({
        title: "max",
        track: TRACK_COUNT,
        timeTick: MAX_TIME_TICK,
      }).success,
    ).toBe(true);
  });

  it("accepts note without optional color/description", () => {
    expect(
      createNoteSchema.safeParse({ title: "bare", track: 2, timeTick: 40 }).success,
    ).toBe(true);
  });
});

describe("createNoteSchema — track boundary rejections", () => {
  it("rejects track 0 (below min)", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, track: 0 }).success).toBe(false);
  });

  it("rejects track 9 (above max)", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, track: 9 }).success).toBe(false);
  });

  it("rejects a non-integer track", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, track: 1.5 }).success).toBe(false);
  });

  it("rejects a non-numeric track", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, track: "abc" }).success).toBe(false);
  });
});

describe("createNoteSchema — timeTick boundary rejections", () => {
  it("rejects timeTick -1 (below 0)", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, timeTick: -1 }).success).toBe(false);
  });

  it("rejects timeTick 1201 (above 1200 → note past 300s)", () => {
    expect(
      createNoteSchema.safeParse({ ...baseNote, timeTick: MAX_TIME_TICK + 1 }).success,
    ).toBe(false);
  });

  it("rejects a fractional timeTick", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, timeTick: 10.7 }).success).toBe(false);
  });
});

describe("createNoteSchema — title & color rules", () => {
  it("rejects an empty title", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 255 chars", () => {
    expect(
      createNoteSchema.safeParse({ ...baseNote, title: "x".repeat(256) }).success,
    ).toBe(false);
  });

  it("rejects a malformed hex color", () => {
    expect(createNoteSchema.safeParse({ ...baseNote, color: "red" }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...baseNote, color: "#fff" }).success).toBe(false);
  });

  it("rejects a description longer than 1000 chars", () => {
    expect(
      createNoteSchema.safeParse({ ...baseNote, description: "d".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("updateNoteSchema — optimistic-locking version", () => {
  it("requires the version field for optimistic locking", () => {
    const res = updateNoteSchema.safeParse({ track: 4 });
    expect(res.success).toBe(false);
  });

  it("accepts version 0 (tolerates seeded rows)", () => {
    expect(updateNoteSchema.safeParse({ version: 0 }).success).toBe(true);
  });

  it("accepts a partial update carrying a version", () => {
    expect(
      updateNoteSchema.safeParse({ timeTick: 200, version: 3 }).success,
    ).toBe(true);
  });

  it("still enforces bounds on optional fields", () => {
    expect(updateNoteSchema.safeParse({ track: 9, version: 1 }).success).toBe(false);
    expect(
      updateNoteSchema.safeParse({ timeTick: MAX_TIME_TICK + 1, version: 1 }).success,
    ).toBe(false);
  });

  it("rejects a negative version", () => {
    expect(updateNoteSchema.safeParse({ version: -1 }).success).toBe(false);
  });
});

describe("createSongSchema", () => {
  it("accepts a title-only song", () => {
    expect(createSongSchema.safeParse({ title: "Song A" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(createSongSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 255 chars", () => {
    expect(
      createSongSchema.safeParse({ title: "x".repeat(256) }).success,
    ).toBe(false);
  });

  it("rejects a description longer than 2000 chars", () => {
    expect(
      createSongSchema.safeParse({ title: "ok", description: "d".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("updateSongSchema — at-least-one-field refinement", () => {
  it("rejects an empty object (no fields to update)", () => {
    expect(updateSongSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a title-only update", () => {
    expect(updateSongSchema.safeParse({ title: "Renamed" }).success).toBe(true);
  });

  it("accepts a description-only update", () => {
    expect(updateSongSchema.safeParse({ description: "new desc" }).success).toBe(true);
  });
});
