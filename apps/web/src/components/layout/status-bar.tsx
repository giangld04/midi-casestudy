/**
 * Bottom status bar: shows selected note info or general stats.
 * Also surfaces transient status messages (conflicts, errors).
 */

import type { ReactNode } from "react";
import type { Note } from "@ama-midi/shared";

interface StatusBarProps {
  selectedNote: Note | null;
  statusMessage: string | null;
  noteCount: number;
}

export default function StatusBar({
  selectedNote,
  statusMessage,
  noteCount,
}: StatusBarProps) {
  const isWarning = !!statusMessage;

  // Highlighted "Press Delete" hint so users can discover the delete action.
  const deleteHint = (
    <span
      style={{
        marginLeft: 8,
        padding: "1px 6px",
        borderRadius: 4,
        background: "var(--accent, #22d3ee)",
        color: "#0b0b0f",
        fontWeight: 600,
      }}
    >
      ⌫ Press Delete to remove
    </span>
  );

  let content: ReactNode;
  if (statusMessage) {
    content = statusMessage;
  } else if (selectedNote) {
    content = (
      <>
        {`Selected: "${selectedNote.title}" — Track ${selectedNote.track}, Tick ${selectedNote.timeTick} (${(selectedNote.timeTick / 4).toFixed(2)}s)`}
        {deleteHint}
      </>
    );
  } else {
    content = `${noteCount} note${noteCount !== 1 ? "s" : ""} — click grid to add`;
  }

  return (
    <footer
      style={{
        height: 24,
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        fontSize: 11,
        color: isWarning ? "#ffd93d" : "var(--text-muted)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {content}
    </footer>
  );
}
