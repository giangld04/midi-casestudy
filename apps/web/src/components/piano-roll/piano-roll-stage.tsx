/**
 * Main Konva Stage wrapper for the piano-roll editor.
 *
 * Virtualization: Stage height = visible container height (never MAX_TIME_TICK*ppt).
 * A transparent spacer div inside the scroll container sets the total scrollable
 * height; all layer Y positions are stage-local (absolute Y - scrollTop).
 * This keeps the backing canvas small at any zoom level → no browser canvas limit crash.
 *
 * Pinch-zoom: handled by use-zoom.ts (wheel+ctrlKey, focal-point, rAF throttle).
 * All state/effects are in use-piano-roll-state.ts.
 */

import { Stage } from "react-konva";
import type { Note, RemoteCursor } from "@ama-midi/shared";
import { MIN_PIXELS_PER_TICK, MAX_PIXELS_PER_TICK } from "@/hooks/use-zoom";
import { usePianoRollState, ZOOM_STEP } from "./use-piano-roll-state";
import GridLayer from "./grid-layer";
import NotesLayer from "./notes-layer";
import SelectionLayer from "./selection-layer";
import MarqueeLayer from "./marquee-layer";
import CursorsLayer from "./cursors-layer";
import PlayheadLayer from "./playhead-layer";
import PlaybackControls from "./playback-controls";
import EditorToolbar from "./editor-toolbar";
import FpsOverlay from "./fps-overlay";
import TrackHeader from "./track-header";
import InstrumentPickerDialog from "@/components/song/instrument-picker-dialog";
import type { UseNotes } from "@/hooks/use-notes";

interface PianoRollStageProps {
  notes: UseNotes["notes"];
  onCreateNote: UseNotes["createNote"];
  onMoveNote: UseNotes["moveNote"];
  onDeleteNote: UseNotes["deleteNote"];
  cursors?: RemoteCursor[];
  onCursorMove?: (track: number, timeTick: number) => void;
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
  const {
    containerRef,
    stageWidth,
    containerHeight,
    pixelsPerTick,
    pickerOpen,
    setPickerOpen,
    mode,
    setMode,
    selectedNote,
    viewport,
    coords,
    visibleNotes,
    showMetrics,
    fps,
    playback,
    selectedIds,
    handleNoteSelect,
    interactions,
    stepZoom,
    totalScrollHeight,
    bpm,
    setBpm,
  } = usePianoRollState({
    notes,
    onCreateNote,
    onDeleteNote,
    onMoveNote,
    cursors,
    onCursorMove,
    onSelectionChange,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TrackHeader width={stageWidth} />

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {/* Scroll container: spacer sets scrollbar height; Stage stays sticky/viewport-sized */}
        <div
          ref={containerRef}
          style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}
          onScroll={viewport.onScroll}
        >
          <div style={{ height: totalScrollHeight, position: "relative" }}>
            <div style={{ position: "sticky", top: 0, height: containerHeight, zIndex: 1 }}>
              <Stage
                width={stageWidth}
                height={containerHeight}
                onClick={interactions.handleClick}
                onMouseDown={interactions.handleMouseDown}
                onMouseMove={interactions.handleMouseMove}
                onMouseUp={interactions.handleMouseUp}
                style={{ display: "block" }}
              >
                <GridLayer
                  width={stageWidth}
                  height={containerHeight}
                  trackWidth={coords.trackWidth}
                  pixelsPerTick={pixelsPerTick}
                  scrollTop={viewport.scrollTop}
                  firstTick={viewport.firstTick}
                  lastTick={viewport.lastTick}
                  bpm={bpm}
                />
                <NotesLayer
                  notes={visibleNotes}
                  selectedNoteId={selectedNote?.id ?? null}
                  selectedIds={selectedIds}
                  canvasX={coords.canvasX}
                  canvasY={coords.canvasY}
                  trackFromX={coords.track}
                  tickFromY={coords.tick}
                  onSelect={handleNoteSelect}
                  onMove={onMoveNote}
                />
                <SelectionLayer
                  selectedNote={selectedNote}
                  canvasX={coords.canvasX}
                  canvasY={coords.canvasY}
                />
                <MarqueeLayer rect={interactions.marqueeRect} />
                <CursorsLayer
                  cursors={cursors}
                  canvasX={coords.canvasX}
                  canvasY={coords.canvasY}
                />
                <PlayheadLayer
                  currentTick={playback.currentTick}
                  pixelsPerTick={pixelsPerTick}
                  scrollTop={viewport.scrollTop}
                  width={stageWidth}
                  visible={playback.isPlaying || playback.currentTick > 0}
                  containerHeight={containerHeight}
                  onSeek={playback.seek}
                />
              </Stage>
            </div>
          </div>
        </div>

        {showMetrics && (
          <FpsOverlay fps={fps} totalNotes={notes.length} renderedNotes={visibleNotes.length} />
        )}

        <div style={zoomControlsStyle}>
          <button type="button" onClick={() => stepZoom(-ZOOM_STEP)} disabled={pixelsPerTick <= MIN_PIXELS_PER_TICK} style={zoomBtnStyle} aria-label="Zoom out">−</button>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", minWidth: 52, textAlign: "center" }}>
            {pixelsPerTick.toFixed(1)}px/t
          </span>
          <button type="button" onClick={() => stepZoom(ZOOM_STEP)} disabled={pixelsPerTick >= MAX_PIXELS_PER_TICK} style={zoomBtnStyle} aria-label="Zoom in">+</button>
        </div>

        <EditorToolbar instrument={playback.instrument} onOpenPicker={() => setPickerOpen(true)} volume={playback.volume} onVolume={playback.setVolume} pan={playback.pan} onPan={playback.setPan} mode={mode} onMode={setMode} />
        <PlaybackControls isPlaying={playback.isPlaying} currentTick={playback.currentTick} totalTick={notes.reduce((m, n) => Math.max(m, n.timeTick), 0)} disabled={notes.length === 0} onToggle={playback.toggle} onStop={playback.stop} bpm={bpm} onBpmChange={setBpm} />

        {pickerOpen && (
          <InstrumentPickerDialog
            current={playback.instrument}
            onSelect={(name) => { playback.setInstrument(name); setPickerOpen(false); }}
            onCancel={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

const zoomControlsStyle: React.CSSProperties = {
  position: "absolute", bottom: 112, left: 8, display: "flex", alignItems: "center",
  gap: 6, padding: "4px 6px", background: "var(--panel-bg)",
  border: "1px solid var(--border)", borderRadius: 6, zIndex: 10,
};

const zoomBtnStyle: React.CSSProperties = {
  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 4,
  color: "var(--text-primary)", cursor: "pointer", fontSize: 14, lineHeight: 1,
};
