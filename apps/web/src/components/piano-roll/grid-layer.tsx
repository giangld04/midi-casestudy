/**
 * Konva Layer: static background grid.
 *
 * Musical grid — derived from bpm prop, 4/4 time:
 * - 8 vertical track dividers
 * - Horizontal beat lines every ticksPerBeat — thin, dim
 * - Horizontal bar lines every ticksPerBar (ticksPerBeat * 4) — bold, brighter
 * - Bar number labels (1, 2, 3 …) at each bar line, left-edge, muted
 *
 * ticksPerBeat = Math.max(1, Math.round(240 / bpm))
 *   since beat = 60/bpm s, tick = 0.25 s → 240/bpm ticks per beat.
 *   BPM 120 → 2 ticks/beat; BPM 60 → 4; BPM 240 → 1.
 *
 * Performance: tick lines are culled to the visible [firstTick, lastTick] window.
 * All Y positions are stage-local (absolute Y minus scrollTop) so they render
 * correctly inside the viewport-sized Konva Stage.
 * `listening={false}` keeps it out of hit-testing.
 */

import { Layer, Line, Text, Rect } from "react-konva";
import { TRACK_COUNT, MAX_TIME_TICK, TICKS_PER_SECOND } from "@ama-midi/shared";

// CSS token resolved values (Konva canvas, no CSS variables available)
const BEAT_STROKE = "#2d2d44"; // --grid-line
const BAR_STROKE = "#3d3d5c";  // --grid-bold
const LABEL_COLOR = "#8888aa"; // --text-muted
const BG_COLOR = "#1a1a2e";    // --bg-primary

/** Derive grid tick counts from BPM (tick = 0.25 s, beat = 60/bpm s). */
export function bpmToTicksPerBeat(bpm: number): number {
  return Math.max(1, Math.round(240 / bpm));
}

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
  /** BPM controls grid beat/bar spacing (default 120). */
  bpm?: number;
}

export default function GridLayer({
  width,
  height,
  trackWidth,
  pixelsPerTick,
  scrollTop,
  firstTick,
  lastTick,
  bpm = 120,
}: GridLayerProps) {
  // Derive beat/bar tick counts from BPM (4/4 time)
  const ticksPerBeat = bpmToTicksPerBeat(bpm);
  const ticksPerBar = ticksPerBeat * 4;

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
  const fromBeat = Math.floor(Math.max(0, firstTick) / ticksPerBeat) * ticksPerBeat;
  const to = Math.min(MAX_TIME_TICK, lastTick);

  for (let tick = fromBeat; tick <= to; tick += ticksPerBeat) {
    const y = tick * pixelsPerTick - scrollTop;
    const isBar = tick % ticksPerBar === 0;

    tickLines.push(
      <Line
        key={`tick-${tick}`}
        points={[0, y, width, y]}
        stroke={isBar ? BAR_STROKE : BEAT_STROKE}
        strokeWidth={isBar ? 1 : 0.5}
        opacity={isBar ? 1 : 0.6}
      />
    );

  }

  // Second labels ("1s", "2s" …) placed right of the seek ruler. Spacing is
  // widened as you zoom out so labels never overlap (min ~28px apart).
  const secStep = Math.max(1, Math.ceil(28 / (TICKS_PER_SECOND * pixelsPerTick)));
  const stepTicks = TICKS_PER_SECOND * secStep;
  const fromSec = Math.ceil(Math.max(0, firstTick) / stepTicks) * stepTicks;
  for (let tick = fromSec; tick <= to; tick += stepTicks) {
    if (tick === 0) continue;
    const y = tick * pixelsPerTick - scrollTop;
    tickLines.push(
      <Text
        key={`sec-${tick}`}
        x={30}
        y={y - 4}
        text={`${tick / TICKS_PER_SECOND}s`}
        fontSize={9}
        fill={LABEL_COLOR}
        listening={false}
      />
    );
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
