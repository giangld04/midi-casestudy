// Domain constants shared across web and api

/** Number of track lanes in the MIDI editor */
export const TRACK_COUNT = 8 as const;

/** Maximum time position in ticks (300s * 4 ticks/s) */
export const MAX_TIME_TICK = 1200 as const;

/** How many ticks represent one second (1 tick = 0.25s) */
export const TICKS_PER_SECOND = 4 as const;

/** Maximum song duration in seconds */
export const MAX_TIME_SECONDS = 300 as const;
