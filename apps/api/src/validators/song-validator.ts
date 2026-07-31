// Zod schemas for song requests.
import { z } from "zod";

/** Body for POST /songs */
export const createSongSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

/** Body for PUT /songs/:id — partial update of song metadata */
export const updateSongSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined, {
    message: "at least one field (title or description) must be provided",
  });

export type CreateSongInput = z.infer<typeof createSongSchema>;
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
