/**
 * Simple inline dialog for creating a new song.
 * Renders as a small form overlay; calls onSubmit with title.
 */

import { useState } from "react";

interface SongCreateDialogProps {
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

export default function SongCreateDialog({
  onSubmit,
  onCancel,
}: SongCreateDialogProps) {
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "24px",
          minWidth: 300,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>New Song</h2>
        <input
          autoFocus
          placeholder="Song title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="accent" disabled={!title.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
