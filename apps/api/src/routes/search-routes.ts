// Search routes: GET /api/songs/search?q=...&limit=
// Mounted BEFORE /:id param route in index.ts so "search" is not captured as an id.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { searchSongs } from "../services/search-service";

export const searchRouter: Router = Router();

const querySchema = z.object({
  q: z.string().min(1, "q is required").max(500, "q too long"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Invalid query",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { q, limit } = parsed.data;
    const results = await searchSongs(q, limit);
    res.json({ ok: true, data: results });
  }),
);
