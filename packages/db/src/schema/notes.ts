// Notes table: individual note blocks on the MIDI editor grid
// Enforces: UNIQUE(song_id, track, time_tick), CHECK track 1-8, CHECK time_tick 0-1200
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { songs } from "./songs";

/** Notes table — each row is one note block placed on the editor grid */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Track lane 1-8 (enforced by CHECK constraint) */
    track: integer("track").notNull(),
    /** Start position in ticks 0-1200 (1 tick = 0.25 s, max = 300 s) */
    timeTick: integer("time_tick").notNull(),
    /** Hex display color e.g. "#22d3ee" */
    color: text("color").notNull().default("#22d3ee"),
    /** Optimistic-locking version counter — increment on every update */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Primary integrity guarantee: no two notes share the same grid cell
    unique("uq_notes_song_track_tick").on(t.songId, t.track, t.timeTick),
    // DB-level boundary enforcement (values also validated at API layer)
    check("chk_notes_track", sql`${t.track} BETWEEN 1 AND 8`),
    check("chk_notes_time_tick", sql`${t.timeTick} BETWEEN 0 AND 1200`),
    // Index for fast per-song queries (Phase 03 CRUD)
    index("idx_notes_song_id").on(t.songId),
  ],
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
