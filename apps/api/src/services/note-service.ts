// Note CRUD with data-integrity guarantees:
//  - Atomic upsert via ON CONFLICT DO NOTHING → duplicate grid cell = 409
//  - Optimistic locking via version column → stale write = 409
//  - Every mutation appends an event in the same transaction (atomic audit)
//  - Phase 07: actorId (user id) threaded from auth middleware into event ledger
import { and, asc, eq } from "drizzle-orm";
import { notes, type Note } from "@ama-midi/db";
import { db } from "../db";
import { ConflictError, NotFoundError } from "../lib/errors";
import { recordEvent } from "./event-service";
import type { CreateNoteInput, UpdateNoteInput } from "../validators/note-validator";

/** List all notes for a song, ordered by track then time for stable rendering */
export async function getNotesBySong(songId: string): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.songId, songId))
    .orderBy(asc(notes.track), asc(notes.timeTick));
}

/**
 * Insert a note. Relies on the UNIQUE(song_id, track, time_tick) constraint:
 * onConflictDoNothing() returns zero rows when the grid cell is taken, which
 * we surface as a 409 instead of silently overwriting.
 */
export async function createNote(
  songId: string,
  input: CreateNoteInput,
  actorId?: string | null,
): Promise<Note> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(notes)
      .values({ ...input, songId })
      .onConflictDoNothing()
      .returning();

    const note = inserted[0];
    if (!note) {
      throw new ConflictError(
        `A note already exists at track ${input.track}, tick ${input.timeTick}`,
      );
    }

    await recordEvent(tx, {
      songId,
      eventType: "note_created",
      noteId: note.id,
      payload: note,
      actor: actorId ?? null,
    });
    return note;
  });
}

/**
 * Update a note guarded by optimistic locking. The WHERE clause matches both
 * id AND the caller's expected version; a zero-row result means either the
 * note is gone (404) or another writer bumped the version first (409).
 */
export async function updateNote(
  noteId: string,
  input: UpdateNoteInput,
  actorId?: string | null,
): Promise<Note> {
  const { version: expectedVersion, ...patch } = input;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(notes)
      .set({ ...patch, version: expectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.version, expectedVersion)))
      .returning();

    const note = updated[0];
    if (!note) {
      // Distinguish "missing" from "stale version" for an accurate status code
      const existing = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(eq(notes.id, noteId));
      if (existing.length === 0) {
        throw new NotFoundError("Note not found");
      }
      throw new ConflictError("Stale version — note was modified by another writer");
    }

    await recordEvent(tx, {
      songId: note.songId,
      eventType: "note_updated",
      noteId: note.id,
      payload: note,
      actor: actorId ?? null,
    });
    return note;
  });
}

/** Delete a note and record the deletion event. 404 if it does not exist. */
export async function deleteNote(noteId: string, actorId?: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const deleted = await tx.delete(notes).where(eq(notes.id, noteId)).returning();

    const note = deleted[0];
    if (!note) {
      throw new NotFoundError("Note not found");
    }

    await recordEvent(tx, {
      songId: note.songId,
      eventType: "note_deleted",
      noteId: note.id,
      payload: note,
      actor: actorId ?? null,
    });
  });
}
