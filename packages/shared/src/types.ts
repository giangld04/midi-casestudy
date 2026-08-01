// Shared TypeScript interfaces used across web and api apps

/** Track number 1-8 (8 lanes in the MIDI editor) */
export type TrackNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Time position in ticks (0-1200). 1 tick = 0.25s, so 1200 ticks = 300s */
export type TimeTick = number;

/** A song project in the MIDI editor */
export interface Song {
  id: string;
  title: string;
  description?: string;
  /** Creator/owner user id. null for legacy songs created before authorization. */
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A note (block) placed on the MIDI editor timeline.
 * Track ranges 1-8, timeTick ranges 0-1200.
 */
export interface Note {
  id: string;
  songId: string;
  title: string;
  description?: string;
  /** Which track lane (1-8) this note belongs to */
  track: TrackNumber;
  /** Start position in ticks (0-1200) */
  timeTick: TimeTick;
  /** Display color (hex string e.g. "#3b82f6") */
  color: string;
  /** Optimistic-concurrency version counter */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Standard API response envelope */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  ok: boolean;
}
