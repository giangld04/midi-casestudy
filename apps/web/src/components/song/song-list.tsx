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
  onDelete: (id: string) => Promise<boolean>;
}

export default function SongList({
  songs,
  selectedSongId,
  loading,
  error,
  onSelect,
  onCreate,
  onDelete,
}: SongListProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  async function handleCreate(title: string) {
    const song = await onCreate(title);
    setShowDialog(false);
    if (song) onSelect(song.id);
  }

  async function handleDelete(song: Song, e: React.MouseEvent) {
    e.stopPropagation(); // don't trigger row selection
    if (!window.confirm(`Delete "${song.title}"? This removes all its notes.`)) return;
    await onDelete(song.id);
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
        {songs.map((song) => {
          const isSelected = song.id === selectedSongId;
          return (
            <div
              key={song.id}
              onMouseEnter={() => setHoveredId(song.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === song.id ? null : cur))}
              style={{
                display: "flex",
                alignItems: "center",
                background: isSelected ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              <button
                onClick={() => onSelect(song.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  padding: "7px 12px",
                  border: "none",
                  background: "transparent",
                  color: isSelected ? "var(--accent)" : "var(--text-primary)",
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {song.title}
              </button>
              {/* Delete — visible on hover or when selected */}
              <button
                onClick={(e) => handleDelete(song, e)}
                title="Delete song"
                aria-label={`Delete ${song.title}`}
                style={{
                  flexShrink: 0,
                  padding: "2px 10px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 15,
                  lineHeight: 1,
                  cursor: "pointer",
                  visibility:
                    hoveredId === song.id || isSelected ? "visible" : "hidden",
                }}
              >
                ×
              </button>
            </div>
          );
        })}
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
