/**
 * Konva Layer: renders a highlight ring around the selected note.
 * Kept in a separate layer so it doesn't interfere with note hit-testing.
 */

import { Layer, Circle } from "react-konva";
import type { Note } from "@ama-midi/shared";

interface SelectionLayerProps {
  selectedNote: Note | null;
  canvasX: (track: number) => number;
  canvasY: (tick: number) => number;
}

const NOTE_RADIUS = 12;
const RING_RADIUS = NOTE_RADIUS + 5;

export default function SelectionLayer({
  selectedNote,
  canvasX,
  canvasY,
}: SelectionLayerProps) {
  if (!selectedNote) return <Layer />;

  return (
    <Layer listening={false}>
      <Circle
        x={canvasX(selectedNote.track)}
        y={canvasY(selectedNote.timeTick)}
        radius={RING_RADIUS}
        stroke="#00d4ff"
        strokeWidth={2}
        fill="transparent"
      />
    </Layer>
  );
}
