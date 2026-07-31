// Socket.io event contracts shared by web (client) and api (server).
// Single source of truth for event names + payload shapes so both ends stay
// type-safe and in sync (DRY). Consumed via typed Socket<Server,Client> maps.

import type { Note, TimeTick } from "./types";

/** A user currently connected to a song room (guest identity until Phase 07 auth). */
export interface PresenceUser {
  /** Stable per-connection id (socket id for now) */
  id: string;
  /** Display name (guest label or authenticated username) */
  name: string;
  /** Assigned color for cursor + avatar, hex string */
  color: string;
}

/** Ephemeral cursor position broadcast to other room members (grid coords). */
export interface RemoteCursor {
  userId: string;
  name: string;
  color: string;
  /** Track lane under the cursor (1-8) */
  track: number;
  /** Time position under the cursor (ticks) */
  timeTick: TimeTick;
}

/** Reason codes echoed back when the server rejects an optimistic mutation. */
export type RejectCode =
  | "CONFLICT"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "FORBIDDEN"
  | "SERVER_ERROR";

// ---------------------------------------------------------------------------
// Client → Server events
// ---------------------------------------------------------------------------

export interface JoinSongPayload {
  songId: string;
  /** Optional preferred guest name */
  name?: string;
}

export interface LeaveSongPayload {
  songId: string;
}

export interface NoteCreatePayload {
  songId: string;
  /** Client-generated nonce so the sender can reconcile its optimistic temp note */
  reqId: string;
  title: string;
  track: number;
  timeTick: number;
  color?: string;
}

export interface NoteUpdatePayload {
  songId: string;
  reqId: string;
  noteId: string;
  track?: number;
  timeTick?: number;
  title?: string;
  description?: string;
  color?: string;
  /** Expected current version for optimistic locking */
  version: number;
}

export interface NoteDeletePayload {
  songId: string;
  reqId: string;
  noteId: string;
}

export interface CursorMovePayload {
  songId: string;
  track: number;
  timeTick: number;
}

export interface ClientToServerEvents {
  "join-song": (payload: JoinSongPayload) => void;
  "leave-song": (payload: LeaveSongPayload) => void;
  "note:create": (payload: NoteCreatePayload) => void;
  "note:update": (payload: NoteUpdatePayload) => void;
  "note:delete": (payload: NoteDeletePayload) => void;
  "cursor:move": (payload: CursorMovePayload) => void;
}

// ---------------------------------------------------------------------------
// Server → Client events
// ---------------------------------------------------------------------------

export interface PresenceUpdatePayload {
  users: PresenceUser[];
}

export interface NoteCreatedPayload {
  note: Note;
  /** Echoes the sender's reqId so it can swap its temp note for the real one */
  reqId: string;
}

export interface NoteUpdatedPayload {
  note: Note;
  /** Echoes the originating sender's reqId so it can clear its pending op */
  reqId: string;
}

export interface NoteDeletedPayload {
  noteId: string;
  /** Echoes the originating sender's reqId so it can clear its pending op */
  reqId: string;
}

export interface NoteRejectedPayload {
  reqId: string;
  code: RejectCode;
  error: string;
}

export interface CursorLeavePayload {
  userId: string;
}

export interface ServerToClientEvents {
  "presence:update": (payload: PresenceUpdatePayload) => void;
  "cursor:update": (payload: RemoteCursor) => void;
  "cursor:leave": (payload: CursorLeavePayload) => void;
  "note:created": (payload: NoteCreatedPayload) => void;
  "note:updated": (payload: NoteUpdatedPayload) => void;
  "note:deleted": (payload: NoteDeletedPayload) => void;
  "note:rejected": (payload: NoteRejectedPayload) => void;
}

/** Palette used to assign each guest a distinct cursor/avatar color. */
export const PRESENCE_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#facc15", // yellow
  "#4ade80", // green
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
] as const;
