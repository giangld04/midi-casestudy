/**
 * Hook encapsulating all stage mouse/keyboard interactions for the piano-roll.
 *
 * Separates the interaction logic from the rendering in piano-roll-stage.tsx
 * to keep both files under the 200-line target.
 *
 * Responsibilities:
 *   - Keyboard: Delete/Backspace deletes all selectedIds; Space = play/pause
 *   - Mouse: draw mode → create note on click; select mode → marquee drag
 *   - Marquee: tracks start/current pointer; finalizes hit-test on mouse-up
 *   - Cursor broadcast: always reports pointer grid position via onCursorMove
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Note } from "@ama-midi/shared";
import type { CoordinateMapping } from "@/hooks/use-coordinate-mapping";
import type { EditorMode } from "./editor-toolbar";

/** Normalized top-left rectangle in stage coordinates. */
export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function normalizeRect(ax: number, ay: number, bx: number, by: number): MarqueeRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

interface UseStageInteractionsParams {
  mode: EditorMode;
  notes: readonly Note[];
  coords: CoordinateMapping;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  onCreateNote: (track: number, timeTick: number) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onPreview: (track: number) => void;
  onCursorMove?: (track: number, timeTick: number) => void;
  onToggle: () => void;
}

export function useStageInteractions({
  mode,
  notes,
  coords,
  selectedIds,
  setSelectedIds,
  onCreateNote,
  onDeleteNote,
  onPreview,
  onCursorMove,
  onToggle,
}: UseStageInteractionsParams) {
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  // Keyboard: Delete/Backspace → delete all; Space → play/pause
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          for (const id of selectedIds) void onDeleteNote(id);
          setSelectedIds(new Set());
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, onDeleteNote, setSelectedIds, onToggle]);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos || mode !== "select") return;
      marqueeStartRef.current = { x: pos.x, y: pos.y };
      setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [mode]
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      if (onCursorMove) onCursorMove(coords.track(pos.x), coords.tick(pos.y));
      if (mode === "select" && marqueeStartRef.current) {
        const s = marqueeStartRef.current;
        setMarqueeRect(normalizeRect(s.x, s.y, pos.x, pos.y));
      }
    },
    [mode, coords, onCursorMove]
  );

  const handleMouseUp = useCallback(
    (_e: KonvaEventObject<MouseEvent>) => {
      if (mode !== "select" || !marqueeStartRef.current || !marqueeRect) return;
      const { x: rx, y: ry, width: rw, height: rh } = marqueeRect;
      const hit = notes.filter((n) => {
        const cx = coords.canvasX(n.track);
        const cy = coords.canvasY(n.timeTick);
        return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
      });
      setSelectedIds(new Set(hit.map((n) => n.id)));
      marqueeStartRef.current = null;
      setMarqueeRect(null);
    },
    [mode, marqueeRect, notes, coords, setSelectedIds]
  );

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos || mode !== "draw") return;
      const track = coords.track(pos.x);
      const tick = coords.tick(pos.y);
      void onCreateNote(track, tick);
      onPreview(track);
      setSelectedIds(new Set());
    },
    [mode, coords, onCreateNote, onPreview, setSelectedIds]
  );

  return { marqueeRect, handleMouseDown, handleMouseMove, handleMouseUp, handleClick };
}
