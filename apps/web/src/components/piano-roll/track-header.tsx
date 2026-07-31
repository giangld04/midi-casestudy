/**
 * HTML overlay row above the Konva canvas showing 8 track labels.
 * Positioned to align with the canvas track columns.
 */

import { TRACK_COUNT } from "@ama-midi/shared";
import { trackColor } from "@/lib/colors";

interface TrackHeaderProps {
  /** Total width of the canvas in pixels */
  width: number;
}

export default function TrackHeader({ width }: TrackHeaderProps) {
  const trackWidth = width / TRACK_COUNT;

  return (
    <div
      style={{
        display: "flex",
        width,
        height: 32,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {Array.from({ length: TRACK_COUNT }, (_, i) => {
        const track = i + 1;
        return (
          <div
            key={track}
            style={{
              width: trackWidth,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRight: "1px solid var(--grid-line)",
              fontSize: 11,
              fontWeight: 600,
              color: trackColor(track),
              letterSpacing: "0.05em",
              userSelect: "none",
            }}
          >
            T{track}
          </div>
        );
      })}
    </div>
  );
}
