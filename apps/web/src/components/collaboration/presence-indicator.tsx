/**
 * Compact presence widget for the toolbar: a live connection dot plus colored
 * avatars for everyone currently in the song room. Purely presentational.
 */

import type { PresenceUser } from "@ama-midi/shared";

interface PresenceIndicatorProps {
  connected: boolean;
  users: PresenceUser[];
}

/** First-letter avatar chip in the user's assigned color. */
function Avatar({ user }: { user: PresenceUser }) {
  return (
    <span
      title={user.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: user.color,
        color: "#0b0f19",
        fontSize: 11,
        fontWeight: 700,
        border: "1px solid var(--bg-secondary)",
        marginLeft: -6,
      }}
    >
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function PresenceIndicator({ connected, users }: PresenceIndicatorProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        title={connected ? "Connected" : "Disconnected"}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "#4ade80" : "#f87171",
          boxShadow: connected ? "0 0 6px #4ade80" : "none",
        }}
      />
      {users.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 6 }}>
          {users.slice(0, 6).map((u) => (
            <Avatar key={u.id} user={u} />
          ))}
        </div>
      )}
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        {users.length} online
      </span>
    </div>
  );
}
