/**
 * Konva Layer: the moving playhead.
 *
 * Time flows down the Y-axis, so the playhead is a horizontal line sweeping
 * downward at y = currentTick * pixelsPerTick. Kept in its own non-listening
 * layer so it never interferes with note hit-testing.
 */

import { Layer, Line } from "react-konva";

interface PlayheadLayerProps {
  /** Current playhead position in ticks. */
  currentTick: number;
  /** Vertical scale (px per tick) — must match the grid/notes. */
  pixelsPerTick: number;
  /** Stage width so the line spans the full canvas. */
  width: number;
  /** Hide the line entirely when idle at the very top. */
  visible: boolean;
}

const PLAYHEAD_COLOR = "#22c55e";

export default function PlayheadLayer({
  currentTick,
  pixelsPerTick,
  width,
  visible,
}: PlayheadLayerProps) {
  if (!visible) return <Layer listening={false} />;

  const y = currentTick * pixelsPerTick;

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
