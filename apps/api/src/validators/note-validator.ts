// Zod schemas for note requests. Boundaries mirror the DB CHECK constraints
// (track 1-8, timeTick 0-1200) for defense-in-depth validation.
import { z } from "zod";
import { MAX_TIME_TICK, TRACK_COUNT } from "@ama-midi/shared";

/** 6-digit hex color, e.g. "#22d3ee" */
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "color must be a 6-digit hex string like #22d3ee");

/** Body for POST /songs/:songId/notes */
export const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  track: z.number().int().min(1).max(TRACK_COUNT),
  timeTick: z.number().int().min(0).max(MAX_TIME_TICK),
  color: hexColor.optional(),
});

/**
 * Body for PUT /notes/:id — all mutable fields optional, but `version` is
 * required to enable optimistic-locking (reject stale writes).
 */
export const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  track: z.number().int().min(1).max(TRACK_COUNT).optional(),
  timeTick: z.number().int().min(0).max(MAX_TIME_TICK).optional(),
  color: hexColor.optional(),
  // Expected current version for optimistic locking (>= 0 to tolerate seeds)
  version: z.number().int().min(0),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
