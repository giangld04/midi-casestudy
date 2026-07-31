/**
 * Displays the selected song's title and metadata in the toolbar area.
 */

import type { Song } from "@ama-midi/shared";

interface SongDetailHeaderProps {
  song: Song | null;
}

export default function SongDetailHeader({ song }: SongDetailHeaderProps) {
  if (!song) {
    return (
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
        No song selected
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
        {song.title}
      </span>
      {song.description && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {song.description}
        </span>
      )}
    </div>
  );
}
