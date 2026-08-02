/**
 * Transport bar overlay: restart · big green Play/Pause · stop · time readout.
 * Centered at the bottom of the canvas, styled like a DAW transport.
 *
 * The app has no tempo/BPM (1 tick = 0.25s is fixed), so instead of a BPM field
 * we show "current / total" time — honest and actually useful.
 */

import { TICK_SECONDS } from "@/lib/playback-engine";

interface PlaybackControlsProps {
  isPlaying: boolean;
  /** Playhead position in ticks. */
  currentTick: number;
  /** Last note's tick → total length for the readout. */
  totalTick: number;
  /** Disable when there are no notes to play. */
  disabled: boolean;
  onToggle: () => void;
  /** Restart/stop → resets the playhead to 0. */
  onStop: () => void;
}

/** ticks → "m:ss" */
function formatTime(tick: number): string {
  const total = Math.max(0, Math.floor(tick * TICK_SECONDS));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaybackControls({
  isPlaying,
  currentTick,
  totalTick,
  disabled,
  onToggle,
  onStop,
}: PlaybackControlsProps) {
  return (
    <div style={barStyle}>
      {/* Restart to start */}
      <button
        type="button"
        onClick={onStop}
        disabled={disabled}
        style={iconButtonStyle}
        aria-label="Restart"
        title="Restart"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zM20 6v12l-9-6z" />
        </svg>
      </button>

      {/* Big green Play / Pause */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        style={{ ...playButtonStyle, opacity: disabled ? 0.4 : 1 }}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0a0a14">
          {isPlaying ? (
            <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </button>

      {/* Stop */}
      <button
        type="button"
        onClick={onStop}
        disabled={disabled}
        style={iconButtonStyle}
        aria-label="Stop"
        title="Stop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      </button>

      <div style={dividerStyle} />

      {/* Time: current / total */}
      <span style={timeStyle}>
        <span style={{ color: "var(--text)" }}>{formatTime(currentTick)}</span>
        <span style={{ color: "var(--text-muted)" }}> / {formatTime(totalTick)}</span>
      </span>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 16px",
  background: "rgba(15, 15, 24, 0.9)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(8px)",
  zIndex: 10,
};

const iconButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: 0,
};

const playButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  background: "#22c55e",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  padding: 0,
  paddingLeft: 2, // optical centering of the play triangle
  boxShadow: "0 2px 12px rgba(34, 197, 94, 0.5)",
  transition: "transform 0.1s ease",
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "var(--border)",
};

const timeStyle: React.CSSProperties = {
  fontSize: 14,
  fontFamily: "monospace",
  fontWeight: 600,
  letterSpacing: "0.03em",
  minWidth: 84,
  textAlign: "center",
};
