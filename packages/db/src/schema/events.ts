// Events ledger: append-only table for event-sourcing (undo/redo + audit trail)
// Rows are NEVER updated or deleted (soft-append pattern).
import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { songs } from "./songs";

/** Allowed domain event types */
export type EventType = "note_created" | "note_updated" | "note_deleted";

/**
 * Events ledger table.
 * Each state-changing operation appends one row here with a full payload
 * so the note timeline can be replayed for undo/redo or audit.
 */
export const events = pgTable(
  "events",
  {
    /** Monotonic bigserial — guarantees ordering without UUID entropy */
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    /** Domain event type: note_created | note_updated | note_deleted */
    eventType: text("event_type").notNull(),
    /** ID of the note this event relates to (null for song-level events) */
    noteId: uuid("note_id"),
    /** Full note snapshot or diff — supports undo replay */
    payload: jsonb("payload").notNull(),
    /** User who triggered the event (null until Phase 07 auth) */
    actor: text("actor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Ordered replay of all events for a song
    index("idx_events_song_id_id").on(t.songId, t.id),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
