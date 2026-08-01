// Song CRUD. Songs hold MIDI project metadata; deleting a song cascades to
// its notes and events via the FK ON DELETE CASCADE defined in the schema.
// Phase 08: auto-embed songs on create/update via fire-and-forget async call.
import { desc, eq, sql } from "drizzle-orm";
import { songs, type Song } from "@ama-midi/db";
import { db } from "../db";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import type { CreateSongInput, UpdateSongInput } from "../validators/song-validator";
import { generateEmbedding, buildSongEmbeddingText } from "./embedding-service";

/** Public song shape returned by the API (no pgvector embedding) */
export type SongDto = Omit<Song, "embedding">;

/** Column selection that omits the heavy/nullable embedding vector */
const songColumns = {
  id: songs.id,
  title: songs.title,
  description: songs.description,
  ownerId: songs.ownerId,
  createdAt: songs.createdAt,
  updatedAt: songs.updatedAt,
} as const;

/**
 * Owner-based authorization guard for song mutations.
 * A song is mutable by `userId` when it is unowned (legacy null-owner songs stay
 * open to everyone) OR the caller is the owner. Otherwise → 403 Forbidden.
 * Throws 404 if the song does not exist.
 */
async function assertCanMutate(id: string, userId: string): Promise<void> {
  const [song] = await db
    .select({ ownerId: songs.ownerId })
    .from(songs)
    .where(eq(songs.id, id));
  if (!song) {
    throw new NotFoundError("Song not found");
  }
  if (song.ownerId !== null && song.ownerId !== userId) {
    throw new ForbiddenError("You do not have permission to modify this song");
  }
}

/** List all songs, newest first */
export async function getAllSongs(): Promise<SongDto[]> {
  return db.select(songColumns).from(songs).orderBy(desc(songs.createdAt));
}

/** Fetch a single song or throw 404 */
export async function getSongById(id: string): Promise<SongDto> {
  const [song] = await db.select(songColumns).from(songs).where(eq(songs.id, id));
  if (!song) {
    throw new NotFoundError("Song not found");
  }
  return song;
}

// NOTE: song mutations do not emit ledger events (only note mutations do) —
// the events table is scoped to the note timeline for undo/redo in Phase 05.

/** Async fire-and-forget: generate embedding and persist it to the songs table.
 * All errors are swallowed (logged) so a background embedding failure can never
 * reject the void-suppressed promise and crash the process (Node unhandled-rejection). */
function scheduleEmbedding(song: SongDto): void {
  void (async () => {
    try {
      const text = buildSongEmbeddingText(song);
      const vector = await generateEmbedding(text);
      if (!vector) return; // Gemini down or key missing — skip silently

      // Use raw sql() cast so Drizzle passes the vector literal correctly
      await db
        .update(songs)
        .set({ embedding: sql`${`[${vector.join(",")}]`}::vector` })
        .where(eq(songs.id, song.id));
    } catch (err) {
      console.error("[song-service] scheduleEmbedding failed:", err);
    }
  })();
}

/** Create a new song, stamping the creator as its owner. */
export async function createSong(input: CreateSongInput, ownerId: string): Promise<SongDto> {
  const [song] = await db
    .insert(songs)
    .values({ ...input, ownerId })
    .returning(songColumns);
  if (!song) {
    throw new Error("Failed to create song");
  }
  scheduleEmbedding(song);
  return song;
}

/** Update song metadata; bumps updatedAt. 404 if missing, 403 if not the owner. */
export async function updateSong(
  id: string,
  input: UpdateSongInput,
  userId: string,
): Promise<SongDto> {
  await assertCanMutate(id, userId);
  const [song] = await db
    .update(songs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(songs.id, id))
    .returning(songColumns);
  if (!song) {
    throw new NotFoundError("Song not found");
  }
  // Re-embed if title or description changed
  if (input.title !== undefined || input.description !== undefined) {
    scheduleEmbedding(song);
  }
  return song;
}

/** Delete a song (cascades to notes + events). 404 if missing, 403 if not the owner. */
export async function deleteSong(id: string, userId: string): Promise<void> {
  await assertCanMutate(id, userId);
  const deleted = await db.delete(songs).where(eq(songs.id, id)).returning({ id: songs.id });
  if (deleted.length === 0) {
    throw new NotFoundError("Song not found");
  }
}
