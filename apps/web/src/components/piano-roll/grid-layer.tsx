/**
 * Konva Layer: static background grid.
 *
 * - 8 vertical track dividers
 * - Horizontal minor lines every 1 tick (thin, dim)
 * - Horizontal major lines every 4 ticks = 1 s (brighter)
 * - Second labels every 4 ticks on the left edge
 *
 * Performance (Phase 06): the grid is its own Konva Layer (separate canvas) and
 * scrolling is native DOM scroll of the parent div — so this layer is drawn once
 * per commit and is NOT re-rasterized while scrolling or while notes change on a
 * sibling layer. It re-renders only on resize/zoom. We deliberately do NOT call
 * `layer.cache()`: at max zoom the cached bitmap (up to ~9600px tall × retina)
 * would consume hundreds of MB for no scroll-time benefit. `listening={false}`
 * also keeps it out of hit-testing.
 */

import { Layer, Line, Text, Rect } from "react-konva";
import { TRACK_COUNT, MAX_TIME_TICK } from "@ama-midi/shared";

const MINOR_STROKE = "#2d2d44"; // grid-line
const MAJOR_STROKE = "#3d3d5c"; // grid-bold
const LABEL_COLOR = "#8888aa";
const BG_COLOR = "#1a1a2e";

interface GridLayerProps {
  width: number;
  height: number;
  trackWidth: number;
  pixelsPerTick: number;
}

export default function GridLayer({
  width,
  height,
  trackWidth,
  pixelsPerTick,
}: GridLayerProps) {
  // Vertical track dividers
  const trackLines = Array.from({ length: TRACK_COUNT - 1 }, (_, i) => (
    <Line
      key={`vline-${i}`}
      points={[trackWidth * (i + 1), 0, trackWidth * (i + 1), height]}
      stroke={MAJOR_STROKE}
      strokeWidth={1}
    />
  ));

  // Horizontal tick lines — full grid, drawn once per commit (static across scroll)
  const tickLines: React.ReactNode[] = [];
  for (let tick = 0; tick <= MAX_TIME_TICK; tick++) {
    const y = tick * pixelsPerTick;
    const isMajor = tick % 4 === 0; // every 4 ticks = 1 second

    tickLines.push(
      <Line
        key={`tick-${tick}`}
        points={[0, y, width, y]}
        stroke={isMajor ? MAJOR_STROKE : MINOR_STROKE}
        strokeWidth={isMajor ? 1 : 0.5}
        opacity={isMajor ? 1 : 0.6}
      />
    );

    // Second label every major line (1s = 4 ticks)
    if (isMajor && tick > 0) {
      const seconds = tick / 4;
      tickLines.push(
        <Text
          key={`label-${tick}`}
          x={4}
          y={y + 2}
          text={`${seconds}s`}
          fontSize={9}
          fill={LABEL_COLOR}
          listening={false}
        />
      );
    }
  }

  return (
    <Layer listening={false}>
      {/* Background fill */}
      <Rect x={0} y={0} width={width} height={height} fill={BG_COLOR} />
      {tickLines}
      {trackLines}
    </Layer>
  );
}
