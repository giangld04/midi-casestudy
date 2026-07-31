/**
 * Per-track color palette — 8 distinct neon-on-dark colors.
 * Index 0 = track 1, index 7 = track 8.
 */
export const TRACK_COLORS: readonly string[] = [
  "#00d4ff", // cyan    — track 1
  "#ff6b6b", // coral   — track 2
  "#a8ff78", // lime    — track 3
  "#ffd93d", // yellow  — track 4
  "#c77dff", // violet  — track 5
  "#ff9a3c", // orange  — track 6
  "#4ecdc4", // teal    — track 7
  "#ff6eb4", // pink    — track 8
] as const;

/**
 * Return the display color for a 1-based track number.
 * Falls back to the first color if track is out of range.
 */
export function trackColor(track: number): string {
  return TRACK_COLORS[(track - 1) % TRACK_COLORS.length] ?? TRACK_COLORS[0]!;
}
