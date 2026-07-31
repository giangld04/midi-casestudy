// User menu — shows avatar/name and a logout button.
import { useState } from "react";
interface UserMenuProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
  onLogout: () => Promise<void>;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  const initial = (user.name ?? user.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#000",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={user.name ?? user.email ?? "User"}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? "avatar"}
            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
            minWidth: 160,
            zIndex: 100,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)", padding: "0 8px" }}>
            {user.email}
          </p>
          <button
            onClick={async () => { setOpen(false); await onLogout(); }}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 13,
              textAlign: "left",
              borderRadius: 4,
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
