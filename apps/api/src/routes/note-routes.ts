// Note routes, split across two mount points:
//  - nestedNoteRouter → mounted at /api/songs/:songId/notes  (list + create)
//  - noteRouter       → mounted at /api/notes                (update + delete)
// Phase 07: req.user is guaranteed by requireAuth in index.ts; pass id as actorId.
import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { validateBody } from "../middleware/validate";
import { createNoteSchema, updateNoteSchema } from "../validators/note-validator";
import {
  createNote,
  deleteNote,
  getNotesBySong,
  updateNote,
} from "../services/note-service";

/** Routes scoped to a song: /api/songs/:songId/notes */
export const nestedNoteRouter: Router = Router({ mergeParams: true });

nestedNoteRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notes = await getNotesBySong(req.params["songId"] as string);
    res.json({ ok: true, data: notes });
  }),
);

nestedNoteRouter.post(
  "/",
  validateBody(createNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await createNote(
      req.params["songId"] as string,
      req.body,
      req.user?.id ?? null,
    );
    res.status(201).json({ ok: true, data: note });
  }),
);

// Flat routes keyed by note id: /api/notes/:id
export const noteRouter: Router = Router();

noteRouter.put(
  "/:id",
  validateBody(updateNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await updateNote(req.params["id"] as string, req.body, req.user?.id ?? null);
    res.json({ ok: true, data: note });
  }),
);

noteRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteNote(req.params["id"] as string, req.user?.id ?? null);
    res.status(204).send();
  }),
);
