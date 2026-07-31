/**
 * Konva layer rendering other collaborators' live cursors on the piano roll.
 * Each cursor is a small pointer + name label positioned via the same
 * coordinate mapping used for notes, so cursors line up with the grid.
 *
 * Purely presentational + ephemeral: listening is disabled so cursors never
 * intercept pointer events meant for the grid/notes.
 */

import { Layer, Group, Circle, Text, Rect } from "react-konva";
import type { RemoteCursor } from "@ama-midi/shared";

interface CursorsLayerProps {
  cursors: RemoteCursor[];
  /** track number → canvas X (column centre) */
  canvasX: (track: number) => number;
  /** tick → canvas Y */
  canvasY: (tick: number) => number;
}

export default function CursorsLayer({ cursors, canvasX, canvasY }: CursorsLayerProps) {
  return (
    <Layer listening={false}>
      {cursors.map((c) => {
        const x = canvasX(c.track);
        const y = canvasY(c.timeTick);
        const labelWidth = Math.max(36, c.name.length * 7 + 12);
        return (
          <Group key={c.userId} x={x} y={y}>
            {/* Cursor dot */}
            <Circle radius={5} fill={c.color} stroke="#0b0f19" strokeWidth={1} />
            {/* Name label */}
            <Rect
              x={8}
              y={-8}
              width={labelWidth}
              height={16}
              cornerRadius={4}
              fill={c.color}
              opacity={0.9}
            />
            <Text
              x={12}
              y={-5}
              text={c.name}
              fontSize={10}
              fill="#0b0f19"
              fontStyle="600"
            />
          </Group>
        );
      })}
    </Layer>
  );
}
