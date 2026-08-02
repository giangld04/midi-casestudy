/**
 * Hook that consolidates all piano-roll state and side effects,
 * keeping piano-roll-stage.tsx focused on rendering only.
 *
 * Manages: container sizing, zoom (pixelsPerTick), note selection,
 * auto-scroll, pinch-wheel listener, and playback.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Note } from "@ama-midi/shared";
import { MAX_TIME_TICK } from "@ama-midi/shared";
import { DEFAULT_PIXELS_PER_TICK } from "@/lib/coordinate-utils";
import { useViewport } from "@/hooks/use-viewport";
import { useViewportCulling } from "@/hooks/use-viewport-culling";
import { useFpsCounter } from "@/hooks/use-fps-counter";
import { usePlayback } from "@/hooks/use-playback";
import { useCoordinateMapping } from "@/hooks/use-coordinate-mapping";
import { useZoom, MIN_PIXELS_PER_TICK, MAX_PIXELS_PER_TICK } from "@/hooks/use-zoom";
import { useStageInteractions } from "./use-stage-interactions";
import type { EditorMode } from "./editor-toolbar";
import type { UseNotes } from "@/hooks/use-notes";
import type { RemoteCursor } from "@ama-midi/shared";

export const ZOOM_STEP = 1;

interface PianoRollStateParams {
  notes: UseNotes["notes"];
  onCreateNote: UseNotes["createNote"];
  onDeleteNote: UseNotes["deleteNote"];
  onMoveNote: UseNotes["moveNote"];
  cursors: RemoteCursor[];
  onCursorMove?: (track: number, timeTick: number) => void;
  onSelectionChange?: (note: Note | null) => void;
}

export function usePianoRollState({
  notes,
  onCreateNote,
  onDeleteNote,
  onMoveNote: _onMoveNote,
  cursors: _cursors,
  onCursorMove,
  onSelectionChange,
}: PianoRollStateParams) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [pixelsPerTick, setPixelsPerTick] = useState<number>(DEFAULT_PIXELS_PER_TICK);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("draw");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** BPM: visual grid + time readout only; audio stays tick-based. Range 40–300. */
  const [bpm, setBpmRaw] = useState(120);
  const setBpm = useCallback((v: number) => setBpmRaw(Math.max(40, Math.min(300, Math.round(v)))), []);

  // Observe container size changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setStageWidth(e.contentRect.width);
        setContainerHeight(e.contentRect.height);
      }
    });
    ro.observe(el);
    setStageWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const viewport = useViewport(containerHeight, pixelsPerTick);
  const coords = useCoordinateMapping(stageWidth, pixelsPerTick, viewport.scrollTop);
  const visibleNotes = useViewportCulling(notes, viewport.firstTick, viewport.lastTick);
  const showMetrics = import.meta.env.DEV;
  const fps = useFpsCounter(showMetrics);
  const playback = usePlayback(notes);

  // Sync Inspector when exactly 1 note is selected
  useEffect(() => {
    if (selectedIds.size === 1) {
      const [id] = selectedIds;
      const found = notes.find((n) => n.id === id) ?? null;
      setSelectedNote(found);
      onSelectionChange?.(found);
    } else {
      setSelectedNote(null);
      onSelectionChange?.(null);
    }
  }, [selectedIds, notes, onSelectionChange]);

  // Auto-scroll playhead into view while playing
  useEffect(() => {
    if (!playback.isPlaying) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, playback.currentTick * pixelsPerTick - containerHeight / 3);
  }, [playback.isPlaying, playback.currentTick, pixelsPerTick, containerHeight]);

  const handleZoom = useCallback((next: number) => {
    setPixelsPerTick(Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, next)));
  }, []);

  // Integer step zoom for +/- buttons, keeping viewport center stationary
  const stepZoom = useCallback(
    (delta: number) => {
      const el = containerRef.current;
      if (!el) { handleZoom(pixelsPerTick + delta); return; }
      const centerTick = (el.scrollTop + containerHeight / 2) / pixelsPerTick;
      const next = Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, pixelsPerTick + delta));
      el.scrollTop = Math.max(0, centerTick * next - containerHeight / 2);
      handleZoom(next);
    },
    [pixelsPerTick, containerHeight, handleZoom]
  );

  const { handleWheel } = useZoom({ pixelsPerTick, onZoom: handleZoom, scrollContainerRef: containerRef });

  // Attach wheel listener with { passive: false } so e.preventDefault() works for pinch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleNoteSelect = useCallback((note: Note) => {
    setSelectedIds(new Set([note.id]));
  }, []);

  const interactions = useStageInteractions({
    mode,
    notes,
    coords,
    selectedIds,
    setSelectedIds,
    onCreateNote,
    onDeleteNote,
    onPreview: playback.preview,
    onCursorMove,
    onToggle: playback.toggle,
  });

  return {
    containerRef,
    stageWidth,
    containerHeight,
    pixelsPerTick,
    pickerOpen,
    setPickerOpen,
    mode,
    setMode,
    selectedNote,
    selectedIds,
    viewport,
    coords,
    visibleNotes,
    showMetrics,
    fps,
    playback,
    handleNoteSelect,
    interactions,
    stepZoom,
    totalScrollHeight: MAX_TIME_TICK * pixelsPerTick,
    bpm,
    setBpm,
  };
}
