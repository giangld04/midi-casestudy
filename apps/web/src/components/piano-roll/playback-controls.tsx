/**
 * Full-width transport bar docked at the bottom of the piano-roll canvas.
 *
 * Layout (centered): rewind · stop · big green Play/Pause · | · metronome BPM · | · time readout
 *
 * Time readout: bars:beats:hundredths format using the fixed BPM.
 * With BPM=120: 1 beat = 0.5s = 2 ticks, 1 bar (4/4) = 8 ticks.
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
  /** BPM for the time readout + grid display. */
  bpm: number;
  /** Called when user edits BPM (value already clamped 40–300). */
  onBpmChange: (bpm: number) => void;
}

/**
 * Convert ticks to bars:beats:hundredths string.
 * At BPM=120: 1 beat = 0.5s = 2 ticks, 1 bar = 8 ticks.
 */
function formatBarsBeatsTicks(tick: number, bpm: number): string {
  const beatsPerBar = 4;
  const ticksPerBeat = (60 / bpm) / TICK_SECONDS; // ticks per beat
  const ticksPerBar = ticksPerBeat * beatsPerBar;

  const bar = Math.floor(tick / ticksPerBar);
  const beatTick = tick % ticksPerBar;
  const beat = Math.floor(beatTick / ticksPerBeat);
  const remainingTick = beatTick % ticksPerBeat;
  // Hundredths-of-second from remaining ticks
  const hundredths = Math.floor(remainingTick * TICK_SECONDS * 100);

  const barStr = String(bar + 1).padStart(4, "0");
  const beatStr = String(beat + 1).padStart(2, "0");
  const hundStr = String(hundredths).padStart(3, "0");
  return `${barStr}:${beatStr}:${hundStr}`;
}

export default function PlaybackControls({
  isPlaying,
  currentTick,
  totalTick,
  disabled,
  onToggle,
  onStop,
  bpm,
  onBpmChange,
}: PlaybackControlsProps) {
  void totalTick; // kept in props for future use; not displayed in this layout

  return (
    <div style={barStyle}>
      {/* Rewind to start */}
      <button
        type="button"
        onClick={onStop}
        disabled={disabled}
        style={iconButtonStyle}
        aria-label="Rewind to start"
        title="Rewind to start"
      >
        {/* skip-to-start icon: vertical bar + left triangle */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zM9 12l9-6v12z" />
        </svg>
      </button>

      {/* Stop (square) */}
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

      <div style={dividerStyle} />

      {/* Metronome icon + editable BPM input */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Metronome SVG */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
          <path d="M12 2L6 20h12L12 2zm0 3.5l4.3 12H7.7L12 5.5z" />
          <rect x="11" y="14" width="2" height="4" rx="1" />
          <path d="M12 9l3 5H9l3-5z" fill="var(--text-muted)" opacity="0.5" />
        </svg>
        <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>BPM</span>
        {/* Editable number input — clamps 40–300 on change */}
        <input
          type="number"
          min={40}
          max={300}
          value={bpm}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onBpmChange(v);
          }}
          style={bpmInputStyle}
          aria-label="BPM"
          title="Beats per minute (40–300)"
        />
      </div>

      <div style={dividerStyle} />

      {/* Time readout: bars:beats:hundredths */}
      <span style={timeStyle}>
        {formatBarsBeatsTicks(currentTick, bpm)}
      </span>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  background: "var(--panel-bg)",
  borderTop: "1px solid var(--border)",
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
  background: "var(--accent-green)",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  padding: 0,
  paddingLeft: 2, // optical centering of the play triangle
  boxShadow: "0 2px 12px var(--accent-green-glow)",
  transition: "transform 0.1s ease",
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "var(--border)",
};

const timeStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "monospace",
  fontWeight: 600,
  letterSpacing: "0.06em",
  color: "var(--text-primary)",
  minWidth: 100,
  textAlign: "center",
};

const bpmInputStyle: React.CSSProperties = {
  width: 44,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "monospace",
  color: "var(--text-primary)",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 4,
  padding: "1px 2px",
  textAlign: "center",
  accentColor: "var(--accent)",
  outline: "none",
  // Highlight on focus with accent cyan
  cursor: "text",
};
