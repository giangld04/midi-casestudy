/**
 * Song browser sidebar.
 * Lists all songs; click to select. Shows a button to open the create dialog.
 */

import { useState } from "react";
import type { Song } from "@ama-midi/shared";
import SongCreateDialog from "./song-create-dialog";

interface SongListProps {
  songs: Song[];
  selectedSongId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onCreate: (title: string) => Promise<Song | null>;
}

export default function SongList({
  songs,
  selectedSongId,
  loading,
  error,
  onSelect,
  onCreate,
}: SongListProps) {
  const [showDialog, setShowDialog] = useState(false);

  async function handleCreate(title: string) {
    const song = await onCreate(title);
    setShowDialog(false);
    if (song) onSelect(song.id);
  }

  return (
    <aside
      style={{
        width: 200,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Songs
        </span>
        <button
          style={{ padding: "2px 8px", fontSize: 18, lineHeight: 1, border: "none", background: "transparent", color: "var(--accent)" }}
          title="New song"
          onClick={() => setShowDialog(true)}
        >
          +
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading && (
          <p style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 12 }}>
            Loading…
          </p>
        )}
        {error && (
          <p style={{ padding: "8px 12px", color: "var(--danger)", fontSize: 12 }}>
            {error}
          </p>
        )}
        {!loading && songs.length === 0 && !error && (
          <p style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 12 }}>
            No songs yet
          </p>
        )}
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => onSelect(song.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "7px 12px",
              border: "none",
              borderRadius: 0,
              background:
                song.id === selectedSongId
                  ? "var(--bg-tertiary)"
                  : "transparent",
              color:
                song.id === selectedSongId
                  ? "var(--accent)"
                  : "var(--text-primary)",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {song.title}
          </button>
        ))}
      </div>

      {showDialog && (
        <SongCreateDialog
          onSubmit={handleCreate}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </aside>
  );
}
