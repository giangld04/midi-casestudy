/**
 * Konva Layer: the moving playhead.
 *
 * Time flows down the Y-axis. The playhead is a horizontal line at
 * y = currentTick * pixelsPerTick - scrollTop  (stage-local coordinate).
 * Hidden when it scrolls above the visible window (y < 0).
 */

import { Layer, Line } from "react-konva";

interface PlayheadLayerProps {
  /** Current playhead position in ticks. */
  currentTick: number;
  /** Vertical scale (px per tick) — must match the grid/notes. */
  pixelsPerTick: number;
  /** Current scroll offset (px) — subtracted to produce stage-local Y. */
  scrollTop: number;
  /** Stage width so the line spans the full canvas. */
  width: number;
  /** Hide the line entirely when idle. */
  visible: boolean;
}

const PLAYHEAD_COLOR = "#22c55e";

export default function PlayheadLayer({
  currentTick,
  pixelsPerTick,
  scrollTop,
  width,
  visible,
}: PlayheadLayerProps) {
  if (!visible) return <Layer listening={false} />;

  const y = currentTick * pixelsPerTick - scrollTop;

  // Don't render if out of the visible viewport
  if (y < 0 || y > 9999) return <Layer listening={false} />;

  return (
    <Layer listening={false}>
      <Line
        points={[0, y, width, y]}
        stroke={PLAYHEAD_COLOR}
        strokeWidth={2}
        shadowColor={PLAYHEAD_COLOR}
        shadowBlur={6}
        shadowOpacity={0.8}
      />
    </Layer>
  );
}
