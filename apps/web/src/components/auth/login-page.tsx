// Login page — email/password form + optional Google/GitHub OAuth buttons.
// OAuth buttons only render if the social providers are configured server-side.
// Styling matches the dark-theme design system: var(--bg-*), var(--accent), etc.
import { useState } from "react";
interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ error?: string }>;
  onSignup: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  onGoogle: () => Promise<void>;
  onGithub: () => Promise<void>;
}

type Mode = "login" | "signup";

export default function LoginPage({ onLogin, onSignup, onGoogle, onGithub }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await onLogin(email, password)
          : await onSignup(email, password, name);
      if (result.error) setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 4,
    color: "#000",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };

  const socialBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontWeight: 400,
    marginTop: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 32,
          width: 360,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)" }}>AMA-MIDI</span>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input
              style={inputStyle}
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            style={inputStyle}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>
          )}

          <button style={btnStyle} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {/* Social login buttons */}
        <div style={{ marginTop: 16 }}>
          <button style={socialBtnStyle} type="button" onClick={onGoogle}>
            Continue with Google
          </button>
          <button style={socialBtnStyle} type="button" onClick={onGithub}>
            Continue with GitHub
          </button>
        </div>

        {/* Toggle login/signup */}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
          {mode === "login" ? "No account?" : "Already have an account?"}{" "}
          <button
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
            }}
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
