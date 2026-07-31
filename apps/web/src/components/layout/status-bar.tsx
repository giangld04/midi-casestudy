/**
 * Bottom status bar: shows selected note info or general stats.
 * Also surfaces transient status messages (conflicts, errors).
 */

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
  const content = statusMessage
    ? statusMessage
    : selectedNote
    ? `Selected: "${selectedNote.title}" — Track ${selectedNote.track}, Tick ${selectedNote.timeTick} (${(selectedNote.timeTick / 4).toFixed(2)}s) [Del to delete]`
    : `${noteCount} note${noteCount !== 1 ? "s" : ""} — click grid to add`;

  const isWarning = !!statusMessage;

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
