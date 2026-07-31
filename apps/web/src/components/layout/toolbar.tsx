/**
 * Top toolbar: shows song detail header, semantic search, and note count.
 * YAGNI: no zoom controls (deferred to later phase).
 */

import type { Song, PresenceUser } from "@ama-midi/shared";
import SongDetailHeader from "@/components/song/song-detail-header";
import PresenceIndicator from "@/components/collaboration/presence-indicator";
import SemanticSearchBar from "@/components/search/semantic-search-bar";

interface ToolbarProps {
  song: Song | null;
  noteCount: number;
  connected: boolean;
  presence: PresenceUser[];
  /** Optional user menu element (rendered on the right side) */
  userMenu?: React.ReactNode;
  /** Callback when user selects a song from search results */
  onSelectSong?: (id: string) => void;
}

export default function Toolbar({ song, noteCount, connected, presence, userMenu, onSelectSong }: ToolbarProps) {
  return (
    <header
      style={{
        height: 48,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* App logo / brand */}
      <span
        style={{
          fontWeight: 700,
          fontSize: 15,
          color: "var(--accent)",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        AMA-MIDI
      </span>

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />

      {/* Song info */}
      <SongDetailHeader song={song} />

      {/* Semantic search bar — flex spacer before it to push right */}
      <div style={{ flex: 1 }} />
      {onSelectSong && <SemanticSearchBar onSelectSong={onSelectSong} />}

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />

      {/* Live collaborators */}
      <PresenceIndicator connected={connected} users={presence} />

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />

      {/* Note count indicator */}
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {noteCount} note{noteCount !== 1 ? "s" : ""}
      </span>

      {/* User menu (avatar + logout) */}
      {userMenu && (
        <>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          {userMenu}
        </>
      )}
    </header>
  );
}
