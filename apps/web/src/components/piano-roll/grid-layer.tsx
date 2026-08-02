/**
 * Konva Layer: static background grid.
 *
 * Musical grid — BPM 120, 4/4 time:
 * - 8 vertical track dividers
 * - Horizontal beat lines every TICKS_PER_BEAT (2 ticks = 0.5 s) — thin, dim
 * - Horizontal bar lines every TICKS_PER_BAR  (8 ticks = 2 s)   — bold, brighter
 * - Bar number labels (1, 2, 3 …) at each bar line, left-edge, muted
 *
 * Performance: tick lines are culled to the visible [firstTick, lastTick] window.
 * All Y positions are stage-local (absolute Y minus scrollTop) so they render
 * correctly inside the viewport-sized Konva Stage.
 * `listening={false}` keeps it out of hit-testing.
 */

import { Layer, Line, Text, Rect } from "react-konva";
import { TRACK_COUNT, MAX_TIME_TICK } from "@ama-midi/shared";

// Musical grid constants — BPM 120, 4/4 time (1 tick = 0.25 s)
// 1 beat = 0.5 s = 2 ticks; 1 bar = 4 beats = 8 ticks
const TICKS_PER_BEAT = 2;
const TICKS_PER_BAR = 8;

// CSS token resolved values (Konva canvas, no CSS variables available)
const BEAT_STROKE = "#2d2d44"; // --grid-line
const BAR_STROKE = "#3d3d5c";  // --grid-bold
const LABEL_COLOR = "#8888aa"; // --text-muted
const BG_COLOR = "#1a1a2e";    // --bg-primary

interface GridLayerProps {
  width: number;
  /** Visible container height (stage height in virtualized mode). */
  height: number;
  trackWidth: number;
  pixelsPerTick: number;
  /** Current scroll offset (px). Y positions are offset by this amount. */
  scrollTop: number;
  /** First visible tick (inclusive) — grid rows outside the viewport are not drawn */
  firstTick: number;
  /** Last visible tick (inclusive) */
  lastTick: number;
}

export default function GridLayer({
  width,
  height,
  trackWidth,
  pixelsPerTick,
  scrollTop,
  firstTick,
  lastTick,
}: GridLayerProps) {
  // Vertical track dividers span the full stage height (no scroll offset needed)
  const trackLines = Array.from({ length: TRACK_COUNT - 1 }, (_, i) => (
    <Line
      key={`vline-${i}`}
      points={[trackWidth * (i + 1), 0, trackWidth * (i + 1), height]}
      stroke={BAR_STROKE}
      strokeWidth={1}
    />
  ));

  // Horizontal beat/bar lines — only the visible window (viewport-culled).
  // Y = tick * ppt - scrollTop  → stage-local coordinate
  const tickLines: React.ReactNode[] = [];
  const fromBeat = Math.floor(Math.max(0, firstTick) / TICKS_PER_BEAT) * TICKS_PER_BEAT;
  const to = Math.min(MAX_TIME_TICK, lastTick);

  for (let tick = fromBeat; tick <= to; tick += TICKS_PER_BEAT) {
    const y = tick * pixelsPerTick - scrollTop;
    const isBar = tick % TICKS_PER_BAR === 0;

    tickLines.push(
      <Line
        key={`tick-${tick}`}
        points={[0, y, width, y]}
        stroke={isBar ? BAR_STROKE : BEAT_STROKE}
        strokeWidth={isBar ? 1 : 0.5}
        opacity={isBar ? 1 : 0.6}
      />
    );

    // Bar number label at each bar line (skip bar 0 / the very top edge)
    if (isBar && tick > 0) {
      const barNumber = tick / TICKS_PER_BAR + 1;
      tickLines.push(
        <Text
          key={`label-${tick}`}
          x={4}
          y={y + 2}
          text={`${barNumber}`}
          fontSize={9}
          fill={LABEL_COLOR}
          listening={false}
        />
      );
    }
  }

  return (
    <Layer listening={false}>
      {/* Background fill — covers the visible viewport */}
      <Rect x={0} y={0} width={width} height={height} fill={BG_COLOR} />
      {tickLines}
      {trackLines}
    </Layer>
  );
}
