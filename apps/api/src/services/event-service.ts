// Event ledger writes — append-only audit trail powering undo/redo (Phase 05).
// Rows are never updated or deleted. Monotonic ordering comes from the
// events.id bigserial column, so no manual sequence bookkeeping is needed.
import { events, type EventType } from "@ama-midi/db";
import type { DbOrTx } from "../db";

interface RecordEventInput {
  songId: string;
  eventType: EventType;
  /** Note the event relates to (null for song-level events) */
  noteId?: string | null;
  /** Full snapshot/diff — enough to replay or invert the change */
  payload: unknown;
  /** User who triggered the event (null until Phase 07 auth) */
  actor?: string | null;
}

/**
 * Append one event row. Accepts a transaction handle so callers can make the
 * mutation + its event atomic (all-or-nothing).
 */
export async function recordEvent(db: DbOrTx, input: RecordEventInput): Promise<void> {
  await db.insert(events).values({
    songId: input.songId,
    eventType: input.eventType,
    noteId: input.noteId ?? null,
    payload: input.payload,
    actor: input.actor ?? null,
  });
}
