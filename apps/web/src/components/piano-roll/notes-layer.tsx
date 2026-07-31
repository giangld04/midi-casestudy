/**
 * Konva Layer: renders note circles with drag and click interactions.
 *
 * Performance (Phase 06): this layer receives an ALREADY-CULLED subset of notes
 * (only those inside the visible tick window), so the number of live Konva nodes
 * stays bounded regardless of total song size. Each circle is a `React.memo`'d
 * `NoteCircle` so only added/removed/selected notes re-render — steady scroll
 * pays near-zero reconciliation cost.
 *
 * - Each note = colored Circle at (canvasX(track), canvasY(timeTick))
 * - Draggable: on DragEnd, inverse-maps new position → snapped (track, tick)
 *   and calls onMove (which handles optimistic update + 409 revert)
 * - onClick: select the note
 */

import { memo } from "react";
import { Layer, Circle } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Note } from "@ama-midi/shared";
import type { MovePayload } from "@/hooks/use-notes";

const NOTE_RADIUS = 12;

interface NoteCircleProps {
  note: Note;
  selected: boolean;
  canvasX: (track: number) => number;
  canvasY: (tick: number) => number;
  trackFromX: (x: number) => number;
  tickFromY: (y: number) => number;
  onSelect: (note: Note) => void;
  onMove: (note: Note, to: MovePayload) => void;
}

/** Single note node — memoized so unchanged notes skip re-render on scroll/zoom. */
const NoteCircle = memo(function NoteCircle({
  note,
  selected,
  canvasX,
  canvasY,
  trackFromX,
  tickFromY,
  onSelect,
  onMove,
}: NoteCircleProps) {
  function handleDragEnd(e: KonvaEventObject<DragEvent>) {
    const node = e.target;
    const newTrack = trackFromX(node.x());
    const newTick = tickFromY(node.y());

    // Snap the visual position to grid before confirming move
    node.x(canvasX(newTrack));
    node.y(canvasY(newTick));

    // Only call API if position actually changed
    if (newTrack !== note.track || newTick !== note.timeTick) {
      onMove(note, { track: newTrack, timeTick: newTick });
    }
  }

  return (
    <Circle
      x={canvasX(note.track)}
      y={canvasY(note.timeTick)}
      radius={NOTE_RADIUS}
      fill={note.color}
      stroke={selected ? "#ffffff" : note.color}
      strokeWidth={selected ? 2 : 0}
      opacity={0.9}
      draggable
      onClick={() => onSelect(note)}
      onTap={() => onSelect(note)}
      onDragEnd={handleDragEnd}
      dragBoundFunc={(pos) => pos}
    />
  );
});

interface NotesLayerProps {
  /** Visible (already culled) notes to render */
  notes: Note[];
  selectedNoteId: string | null;
  canvasX: (track: number) => number;
  canvasY: (tick: number) => number;
  /** Inverse: canvas X → track */
  trackFromX: (x: number) => number;
  /** Inverse: canvas Y → tick */
  tickFromY: (y: number) => number;
  onSelect: (note: Note) => void;
  onMove: (note: Note, to: MovePayload) => void;
}

export default function NotesLayer({
  notes,
  selectedNoteId,
  canvasX,
  canvasY,
  trackFromX,
  tickFromY,
  onSelect,
  onMove,
}: NotesLayerProps) {
  return (
    <Layer>
      {notes.map((note) => (
        <NoteCircle
          key={note.id}
          note={note}
          selected={note.id === selectedNoteId}
          canvasX={canvasX}
          canvasY={canvasY}
          trackFromX={trackFromX}
          tickFromY={tickFromY}
          onSelect={onSelect}
          onMove={onMove}
        />
      ))}
    </Layer>
  );
}
