// Song routes: /api/songs. Also nests the per-song note routes at
// /api/songs/:songId/notes so note listing/creation stays resource-scoped.
import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { validateBody } from "../middleware/validate";
import { createSongSchema, updateSongSchema } from "../validators/song-validator";
import {
  createSong,
  deleteSong,
  getAllSongs,
  getSongById,
  updateSong,
} from "../services/song-service";
import { nestedNoteRouter } from "./note-routes";

export const songRouter: Router = Router();

songRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const songs = await getAllSongs();
    res.json({ ok: true, data: songs });
  }),
);

songRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const song = await getSongById(req.params["id"] as string);
    res.json({ ok: true, data: song });
  }),
);

songRouter.post(
  "/",
  validateBody(createSongSchema),
  asyncHandler(async (req, res) => {
    // requireAuth guarantees req.user is populated on all /api/songs routes.
    const song = await createSong(req.body, req.user!.id);
    res.status(201).json({ ok: true, data: song });
  }),
);

songRouter.put(
  "/:id",
  validateBody(updateSongSchema),
  asyncHandler(async (req, res) => {
    const song = await updateSong(req.params["id"] as string, req.body, req.user!.id);
    res.json({ ok: true, data: song });
  }),
);

songRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteSong(req.params["id"] as string, req.user!.id);
    res.status(204).send();
  }),
);

// Nested note routes: /api/songs/:songId/notes
songRouter.use("/:songId/notes", nestedNoteRouter);
