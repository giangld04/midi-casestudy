/**
 * Main Konva Stage wrapper for the piano-roll editor.
 *
 * Layout:
 *   - TrackHeader (HTML, fixed 32px top)
 *   - Scrollable div → Stage → [GridLayer, NotesLayer, SelectionLayer, CursorsLayer]
 *   - FPS/metrics overlay + zoom controls (Phase 06)
 *
 * Performance (Phase 06):
 *   - Notes AND grid lines are culled to the visible tick window before rendering
 *     (bounded Konva node count regardless of song size or zoom level).
 *   - Vertical zoom adjusts pixelsPerTick (all coordinate math is parameterized).
 *
 * Interactions:
 *   - Click on empty canvas → create note (snap to tick + track)
 *   - Click on note → select it
 *   - Drag note → move with optimistic update
 *   - Delete key → delete selected note
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Note, RemoteCursor } from "@ama-midi/shared";
import { MAX_TIME_TICK } from "@ama-midi/shared";
import { DEFAULT_PIXELS_PER_TICK } from "@/lib/coordinate-utils";
import { useCoordinateMapping } from "@/hooks/use-coordinate-mapping";
import { useViewport } from "@/hooks/use-viewport";
import { useViewportCulling } from "@/hooks/use-viewport-culling";
import { useFpsCounter } from "@/hooks/use-fps-counter";
import { usePlayback } from "@/hooks/use-playback";
import GridLayer from "./grid-layer";
import NotesLayer from "./notes-layer";
import SelectionLayer from "./selection-layer";
import CursorsLayer from "./cursors-layer";
import PlayheadLayer from "./playhead-layer";
import PlaybackControls from "./playback-controls";
import FpsOverlay from "./fps-overlay";
import TrackHeader from "./track-header";
import type { UseNotes } from "@/hooks/use-notes";

// Vertical zoom bounds (pixels per tick). 4 ticks = 1s, so 2..8 px/tick maps to
// 8..32 px/s — a comfortable range for a 300s timeline.
const MIN_PIXELS_PER_TICK = 2;
const MAX_PIXELS_PER_TICK = 8;
const ZOOM_STEP = 1;

interface PianoRollStageProps {
  notes: UseNotes["notes"];
  onCreateNote: UseNotes["createNote"];
  onMoveNote: UseNotes["moveNote"];
  onDeleteNote: UseNotes["deleteNote"];
  /** Remote collaborators' live cursors (empty when solo) */
  cursors?: RemoteCursor[];
  /** Report local pointer position (grid coords) for cursor broadcast */
  onCursorMove?: (track: number, timeTick: number) => void;
  /** Notify parent when the selected note changes (drives the status bar) */
  onSelectionChange?: (note: Note | null) => void;
}

export default function PianoRollStage({
  notes,
  onCreateNote,
  onMoveNote,
  onDeleteNote,
  cursors = [],
  onCursorMove,
  onSelectionChange,
}: PianoRollStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [pixelsPerTick, setPixelsPerTick] = useState(DEFAULT_PIXELS_PER_TICK);

  const stageHeight = MAX_TIME_TICK * pixelsPerTick;

  // Lift selection up so the status bar (parent) reflects the selected note.
  useEffect(() => {
    onSelectionChange?.(selectedNote);
  }, [selectedNote, onSelectionChange]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setStageWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const coords = useCoordinateMapping(stageWidth, pixelsPerTick);
  const viewport = useViewport(containerHeight, pixelsPerTick);

  // Cull to the visible tick window → bounded Konva node count at any song size
  const visibleNotes = useViewportCulling(notes, viewport.firstTick, viewport.lastTick);

  // Metrics overlay + its rAF loop run only in dev (demo/grading), never in prod
  const showMetrics = import.meta.env.DEV;
  const fps = useFpsCounter(showMetrics);

  // Audio playback (Tone.js) — drives the moving playhead + auto-scroll.
  const playback = usePlayback(notes);

  // Keep the playhead in view while playing (scroll so it sits ~1/3 from top).
  useEffect(() => {
    if (!playback.isPlaying) return;
    const el = containerRef.current;
    if (!el) return;
    const target = playback.currentTick * pixelsPerTick - containerHeight / 3;
    el.scrollTop = Math.max(0, target);
  }, [playback.isPlaying, playback.currentTick, pixelsPerTick, containerHeight]);

  const zoom = useCallback((delta: number) => {
    setPixelsPerTick((p) =>
      Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, p + delta))
    );
  }, []);

  // Delete key handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when the user is editing a form field — otherwise Backspace/Delete
      // used to erase text inside an input would also delete the selected note.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNote) {
        void onDeleteNote(selectedNote.id);
        setSelectedNote(null);
      }

      // Space toggles play/pause (prevent the default page scroll).
      if (e.key === " ") {
        e.preventDefault();
        playback.toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNote, onDeleteNote, playback.toggle]);

  // Click on empty stage area → create note
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Only handle clicks on the background (not on notes)
      if (e.target !== e.target.getStage()) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      const track = coords.track(pos.x);
      const tick = coords.tick(pos.y);
      void onCreateNote(track, tick);
      playback.preview(track); // audition the new note
    },
    [coords, onCreateNote, playback.preview]
  );

  // Broadcast local pointer position (throttling handled in useSocket)
  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!onCursorMove) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      onCursorMove(coords.track(pos.x), coords.tick(pos.y));
    },
    [coords, onCursorMove]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Fixed track header row */}
      <TrackHeader width={stageWidth} />

      {/* Canvas area — position relative to anchor overlays */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div
          ref={containerRef}
          style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}
          onScroll={viewport.onScroll}
        >
          <Stage
            width={stageWidth}
            height={stageHeight}
            onClick={handleStageClick}
            onMouseMove={handleStageMouseMove}
            style={{ display: "block" }}
          >
            <GridLayer
              width={stageWidth}
              height={stageHeight}
              trackWidth={coords.trackWidth}
              pixelsPerTick={pixelsPerTick}
              firstTick={viewport.firstTick}
              lastTick={viewport.lastTick}
            />
            <NotesLayer
              notes={visibleNotes}
              selectedNoteId={selectedNote?.id ?? null}
              canvasX={coords.canvasX}
              canvasY={coords.canvasY}
              trackFromX={coords.track}
              tickFromY={coords.tick}
              onSelect={setSelectedNote}
              onMove={onMoveNote}
            />
            <SelectionLayer
              selectedNote={selectedNote}
              canvasX={coords.canvasX}
              canvasY={coords.canvasY}
            />
            <CursorsLayer
              cursors={cursors}
              canvasX={coords.canvasX}
              canvasY={coords.canvasY}
            />
            <PlayheadLayer
              currentTick={playback.currentTick}
              pixelsPerTick={pixelsPerTick}
              width={stageWidth}
              visible={playback.isPlaying || playback.currentTick > 0}
            />
          </Stage>
        </div>

        {/* Live performance metrics — rendered count proves culling is active */}
        {showMetrics && (
          <FpsOverlay fps={fps} totalNotes={notes.length} renderedNotes={visibleNotes.length} />
        )}

        {/* Transport controls (Play/Stop + time) */}
        <PlaybackControls
          isPlaying={playback.isPlaying}
          currentTick={playback.currentTick}
          totalTick={notes.reduce((m, n) => Math.max(m, n.timeTick), 0)}
          disabled={notes.length === 0}
          onToggle={playback.toggle}
          onStop={playback.stop}
        />

        {/* Vertical zoom controls */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px",
            background: "rgba(10, 10, 20, 0.78)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => zoom(-ZOOM_STEP)}
            disabled={pixelsPerTick <= MIN_PIXELS_PER_TICK}
            style={zoomButtonStyle}
            aria-label="Zoom out"
          >
            −
          </button>
          <span
            style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", minWidth: 44, textAlign: "center" }}
          >
            {pixelsPerTick}px/t
          </span>
          <button
            type="button"
            onClick={() => zoom(ZOOM_STEP)}
            disabled={pixelsPerTick >= MAX_PIXELS_PER_TICK}
            style={zoomButtonStyle}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

const zoomButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
