/**
 * Performance metrics overlay for the piano-roll.
 *
 * Displays live FPS plus total vs. rendered note counts — the rendered count
 * being direct proof that viewport culling is active (rendered << total when
 * scrolled through a large song). Positioned absolutely over the canvas.
 */

interface FpsOverlayProps {
  fps: number;
  totalNotes: number;
  renderedNotes: number;
}

/** Green ≥50fps, amber ≥30fps, red below — quick visual health signal. */
function fpsColor(fps: number): string {
  if (fps >= 50) return "#22c55e";
  if (fps >= 30) return "#f59e0b";
  return "#ef4444";
}

export default function FpsOverlay({ fps, totalNotes, renderedNotes }: FpsOverlayProps) {
  const culledPct =
    totalNotes > 0 ? Math.round((1 - renderedNotes / totalNotes) * 100) : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        padding: "6px 10px",
        background: "rgba(10, 10, 20, 0.78)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 1.5,
        color: "var(--text-muted)",
        pointerEvents: "none",
        zIndex: 10,
        minWidth: 132,
      }}
    >
      <div style={{ color: fpsColor(fps), fontWeight: 700 }}>{fps} FPS</div>
      <div>
        rendered <span style={{ color: "var(--text)" }}>{renderedNotes}</span> /{" "}
        {totalNotes}
      </div>
      <div>
        culled <span style={{ color: "var(--accent)" }}>{culledPct}%</span>
      </div>
    </div>
  );
}
