/**
 * Konva Layer: the moving playhead line + a click-to-seek time ruler.
 *
 * Time flows down the Y-axis. The playhead is a horizontal line at
 * y = currentTick * pixelsPerTick - scrollTop  (stage-local coordinate).
 *
 * Seeking: a thin ruler strip on the LEFT edge captures clicks. Clicking at
 * any Y converts to a tick and calls `onSeek` — the playhead jumps there,
 * whether paused or playing. The ruler always renders (even when idle) so you
 * can seek at any time; clicks are stopped from bubbling so they never
 * create a note. The full-width line itself is non-interactive.
 */

import { Layer, Line, Rect, RegularPolygon } from "react-konva";
import { MAX_TIME_TICK } from "@ama-midi/shared";
import type Konva from "konva";

interface PlayheadLayerProps {
  /** Current playhead position in ticks. */
  currentTick: number;
  /** Vertical scale (px per tick) — must match the grid/notes. */
  pixelsPerTick: number;
  /** Current scroll offset (px) — subtracted to produce stage-local Y. */
  scrollTop: number;
  /** Stage width so the line spans the full canvas. */
  width: number;
  /** Show the moving line/marker (true while playing). */
  visible: boolean;
  /** Visible canvas height — ruler height + drag clamp. */
  containerHeight: number;
  /** Called when the user clicks the ruler to seek to a new tick. */
  onSeek?: (tick: number) => void;
}

const PLAYHEAD_COLOR = "#22c55e";
/** Cyan accent for the ruler + position marker. */
const ACCENT = "#00d4ff";
const MARKER_RADIUS = 7;
/** Width of the clickable time-ruler strip on the left edge. */
const RULER_WIDTH = 26;
/** Marker sits inside the ruler, slightly inset so it's fully visible. */
const MARKER_X = MARKER_RADIUS + 2;

export default function PlayheadLayer({
  currentTick,
  pixelsPerTick,
  scrollTop,
  width,
  visible,
  containerHeight,
  onSeek,
}: PlayheadLayerProps) {
  const y = currentTick * pixelsPerTick - scrollTop;

  // Show the line/marker only while active and within the visible viewport.
  const showLine =
    visible && y >= -MARKER_RADIUS && y <= containerHeight + MARKER_RADIUS;

  /** Convert a stage-local Y into a clamped integer tick. */
  const yToTick = (stageY: number): number => {
    const raw = (stageY + scrollTop) / pixelsPerTick;
    return Math.max(0, Math.min(MAX_TIME_TICK, Math.round(raw)));
  };

  const handleSeek = (e: Konva.KonvaEventObject<MouseEvent | Event>) => {
    e.cancelBubble = true; // never let the click reach the note-create handler
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) onSeek?.(yToTick(pos.y));
  };

  const setCursor = (e: Konva.KonvaEventObject<Event>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Layer>
      {/* Click-to-seek time ruler (left strip). Always present. */}
      <Rect
        x={0}
        y={0}
        width={RULER_WIDTH}
        height={containerHeight}
        fill="rgba(0, 212, 255, 0.06)"
        onMouseDown={handleSeek}
        onTap={handleSeek}
        onMouseEnter={(e) => setCursor(e, "pointer")}
        onMouseLeave={(e) => setCursor(e, "default")}
      />

      {showLine && (
        <>
          {/* Non-interactive playhead line */}
          <Line
            listening={false}
            points={[0, y, width, y]}
            stroke={PLAYHEAD_COLOR}
            strokeWidth={2}
            shadowColor={PLAYHEAD_COLOR}
            shadowBlur={6}
            shadowOpacity={0.8}
          />
          {/* Position marker on the ruler */}
          <RegularPolygon
            listening={false}
            x={MARKER_X}
            y={y}
            sides={3}
            radius={MARKER_RADIUS}
            rotation={90}
            fill={ACCENT}
            perfectDrawEnabled={false}
          />
        </>
      )}
    </Layer>
  );
}
