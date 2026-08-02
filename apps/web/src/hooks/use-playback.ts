/**
 * React binding for the Tone.js PlaybackEngine.
 *
 * Exposes { isPlaying, currentTick, toggle, stop, preview, instrument,
 * setInstrument, volume, setVolume, pan, setPan }.
 *
 * While playing it runs a requestAnimationFrame loop that (a) pushes the
 * transport position into React state so the playhead can render, and (b)
 * auto-stops when the last note has sounded.
 *
 * `toggle`/`stop` are stable (backed by refs) so consumers can list them in
 * effect deps without re-subscribing every animation frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@ama-midi/shared";
import { PlaybackEngine, TICK_SECONDS } from "@/lib/playback-engine";
import { DEFAULT_INSTRUMENT } from "@/lib/gm-instruments";

export interface UsePlayback {
  isPlaying: boolean;
  /** Current playhead position in ticks (drives the moving line). */
  currentTick: number;
  /** Play/pause toggle (also the Space-key action). */
  toggle: () => void;
  /** Stop and reset the playhead to 0. */
  stop: () => void;
  /** Seek to a specific tick — updates transport + React state immediately. */
  seek: (tick: number) => void;
  /** Audition a single track's pitch (e.g. when a note is created). */
  preview: (track: number) => void;
  /** Currently selected GM instrument id (per song). */
  instrument: string;
  /** Choose a GM instrument for playback + preview. */
  setInstrument: (name: string) => void;
  /** Output volume 0..1 (default 0.85). */
  volume: number;
  /** Set output volume 0..1. */
  setVolume: (v: number) => void;
  /** Stereo pan -1..1 (0 = center). */
  pan: number;
  /** Set stereo pan -1..1. */
  setPan: (p: number) => void;
}

/** Extra ticks to run past the last note so its release tail is audible. */
const RELEASE_TAIL_TICKS = 0.5 / TICK_SECONDS;

export function usePlayback(notes: readonly Note[]): UsePlayback {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [instrument, setInstrumentState] = useState(DEFAULT_INSTRUMENT);
  const [volume, setVolumeState] = useState(0.85);
  const [pan, setPanState] = useState(0);

  if (!engineRef.current) engineRef.current = new PlaybackEngine();

  // Mirror latest values into refs so the stable callbacks below can read them
  // without being re-created on every render.
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const isPlayingRef = useRef(false);
  const currentTickRef = useRef(0);

  const cancelRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const setPlaying = (v: boolean) => {
    isPlayingRef.current = v;
    setIsPlaying(v);
  };
  const setTick = (t: number) => {
    currentTickRef.current = t;
    setCurrentTick(t);
  };

  const stop = useCallback(() => {
    cancelRaf();
    engineRef.current?.stop();
    setPlaying(false);
    setTick(0);
  }, []);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    const notesNow = notesRef.current;
    if (!engine || notesNow.length === 0) return;

    if (isPlayingRef.current) {
      cancelRaf();
      engine.pause();
      setPlaying(false);
      return;
    }

    const endTick = notesNow.reduce((max, n) => Math.max(max, n.timeTick), 0);
    // Resume from current position; restart from 0 if we're at/after the end.
    const startTick = currentTickRef.current >= endTick ? 0 : currentTickRef.current;
    void engine.play(notesNow, startTick);
    setPlaying(true);

    const loop = () => {
      const t = engine.currentTick;
      setTick(t);
      if (t >= endTick + RELEASE_TAIL_TICKS) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [stop]);

  const seek = useCallback((tick: number) => {
    // Update transport position immediately (works playing or paused)
    engineRef.current?.seek(tick);
    // Update React state so playhead + time readout reflect the new position
    setTick(tick);
  }, []);

  const preview = useCallback((track: number) => {
    void engineRef.current?.preview(track);
  }, []);

  const setInstrument = useCallback((name: string) => {
    engineRef.current?.setInstrument(name);
    setInstrumentState(name);
  }, []);

  const setVolume = useCallback((v: number) => {
    engineRef.current?.setVolume(v);
    setVolumeState(v);
  }, []);

  const setPan = useCallback((p: number) => {
    engineRef.current?.setPan(p);
    setPanState(p);
  }, []);

  // Dispose audio resources when the component unmounts.
  useEffect(() => {
    return () => {
      cancelRaf();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return {
    isPlaying,
    currentTick,
    toggle,
    stop,
    seek,
    preview,
    instrument,
    setInstrument,
    volume,
    setVolume,
    pan,
    setPan,
  };
}
