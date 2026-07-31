// Normalize a Drizzle note row (description: string | null) to the shared Note
// wire contract (description?: string). Keeps typed Socket.io payloads honest —
// the DB uses NULL for "no description", the API contract uses undefined/omitted.

import type { Note as DbNote } from "@ama-midi/db";
import type { Note } from "@ama-midi/shared";

export function toNoteDto(row: DbNote): Note {
  return {
    id: row.id,
    songId: row.songId,
    title: row.title,
    description: row.description ?? undefined,
    track: row.track as Note["track"],
    timeTick: row.timeTick,
    color: row.color,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
