/**
 * Editor toolbar: sits directly above the transport bar (bottom: 56px).
 *
 * LEFT:  instrument pill → opens picker
 *        speaker icon + volume slider
 *        "Pan" label + pan slider
 *
 * RIGHT: pencil (draw mode) + dotted-square (select/marquee mode) toggle buttons
 *
 * All controls are client-side state; no persistence.
 */

import { instrumentLabel } from "@/lib/gm-instruments";

export type EditorMode = "draw" | "select";

interface EditorToolbarProps {
  instrument: string;
  onOpenPicker: () => void;
  volume: number;        // 0..1
  onVolume: (v: number) => void;
  pan: number;           // -1..1
  onPan: (p: number) => void;
  mode: EditorMode;
  onMode: (m: EditorMode) => void;
}

export default function EditorToolbar({
  instrument,
  onOpenPicker,
  volume,
  onVolume,
  pan,
  onPan,
  mode,
  onMode,
}: EditorToolbarProps) {
  return (
    <div style={toolbarStyle}>
      {/* Instrument pill button */}
      <button
        type="button"
        onClick={onOpenPicker}
        style={instrumentPillStyle}
        title="Choose instrument"
      >
        🎹
        <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {instrumentLabel(instrument)}
        </span>
      </button>

      {/* Volume: speaker icon + range slider */}
      <div style={controlGroupStyle}>
        {/* Speaker SVG */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          style={sliderStyle}
          aria-label="Volume"
        />
      </div>

      {/* Pan: label + range slider */}
      <div style={controlGroupStyle}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>Pan</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={Math.round(pan * 100)}
          onChange={(e) => onPan(Number(e.target.value) / 100)}
          style={sliderStyle}
          aria-label="Pan"
        />
      </div>

      {/* RIGHT: mode toggle buttons (push right with marginLeft auto) */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        {/* Pencil = draw mode */}
        <button
          type="button"
          onClick={() => onMode("draw")}
          style={modeButtonStyle(mode === "draw")}
          aria-label="Draw mode"
          title="Draw mode (create notes)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </button>

        {/* Dotted square = marquee/select mode */}
        <button
          type="button"
          onClick={() => onMode("select")}
          style={modeButtonStyle(mode === "select")}
          aria-label="Select mode"
          title="Select mode (marquee multi-select)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 56, // sits directly above the 56px transport bar
  height: 48,
  background: "var(--panel-bg)",
  borderTop: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "0 16px",
  zIndex: 10,
  backdropFilter: "blur(6px)",
};

const instrumentPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const controlGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const sliderStyle: React.CSSProperties = {
  width: 80,
  accentColor: "var(--accent-green)",
  cursor: "pointer",
};

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "var(--accent-green)" : "rgba(255,255,255,0.05)",
    border: "1px solid " + (active ? "var(--accent-green)" : "var(--border)"),
    borderRadius: 6,
    color: active ? "#0a0a14" : "var(--text-muted)",
    cursor: "pointer",
    padding: 0,
    transition: "background 0.15s ease, color 0.15s ease",
  };
}
