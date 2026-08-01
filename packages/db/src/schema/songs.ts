// Songs table: stores MIDI song projects with optional pgvector embedding
import { customType, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";

/**
 * Custom Drizzle type for pgvector vector(768).
 * Stored as text-like in Drizzle metadata; actual SQL type is vector(768).
 * Populated in Phase 08 (Gemini embeddings) — nullable for now.
 */
const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)";
  },
  fromDriver(val: string): number[] {
    // pgvector returns "[0.1,0.2,...]" string — parse to float array
    return val
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
  toDriver(val: number[]): string {
    return `[${val.join(",")}]`;
  },
});

/** Songs table — one row per MIDI project */
export const songs = pgTable("songs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  /**
   * Song owner (creator). Nullable so pre-authorization "legacy" songs keep
   * owner_id = NULL and stay editable by anyone. ON DELETE SET NULL: if the
   * owning user is removed, the song becomes a legacy (null-owner) song rather
   * than being cascaded away.
   */
  ownerId: text("owner_id").references(() => authUser.id, { onDelete: "set null" }),
  /** pgvector 768-dim embedding (nullable until Phase 08 populates it) */
  embedding: vector768("embedding"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
