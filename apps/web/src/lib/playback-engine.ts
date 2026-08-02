/**
 * Tone.js playback engine for the piano-roll.
 *
 * Time model (from @ama-midi/shared): a note carries only `track` (1-8) and
 * `timeTick` (0-1200); 1 tick = 0.25s, so a note at tick T sounds at T * 0.25s.
 * Notes have NO pitch of their own → we map each of the 8 tracks to a fixed
 * C-major-pentatonic degree so any arrangement sounds pleasant.
 *
 * The engine is framework-agnostic: it owns the Tone.js synth + Transport and
 * exposes imperative play/pause/stop. React state (playhead, isPlaying) lives in
 * the `use-playback` hook, which reads `currentTick` on a rAF loop.
 */

import * as Tone from "tone";
import { TICKS_PER_SECOND } from "@ama-midi/shared";
import type { Note } from "@ama-midi/shared";

/** Seconds represented by one tick (0.25s). */
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

/**
 * Track (1-8) → pitch. C-major pentatonic across ~1.5 octaves:
 * C4 D4 E4 G4 A4 C5 D5 E5. Index 0 unused (tracks are 1-based).
 */
export const TRACK_PITCHES: readonly string[] = [
  "", // track 0 placeholder
  "C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5",
];

/** How long each triggered note rings (notes have no duration → fixed blip). */
const NOTE_RELEASE = "8n";

export class PlaybackEngine {
  private synth: Tone.PolySynth | null = null;
  private part: Tone.Part | null = null;

  /** Lazily create the synth (AudioContext must start from a user gesture). */
  private ensureSynth(): Tone.PolySynth {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 },
      }).toDestination();
      this.synth.volume.value = -6;
    }
    return this.synth;
  }

  /** Build a Tone.Part scheduling every note at its tick time. */
  private buildPart(notes: readonly Note[]): void {
    const synth = this.ensureSynth();
    this.part?.dispose();

    const events = notes.map((n) => ({
      time: n.timeTick * TICK_SECONDS,
      pitch: TRACK_PITCHES[n.track] ?? "C4",
    }));

    this.part = new Tone.Part((time, ev: { pitch: string }) => {
      synth.triggerAttackRelease(ev.pitch, NOTE_RELEASE, time);
    }, events);
    this.part.start(0);
  }

  /**
   * Start (or resume) playback from `startTick`. Rebuilds the schedule from the
   * current notes so edits made while stopped are reflected.
   */
  async play(notes: readonly Note[], startTick = 0): Promise<void> {
    await Tone.start(); // resume AudioContext (user-gesture requirement)
    const transport = Tone.getTransport();
    this.buildPart(notes);
    transport.seconds = startTick * TICK_SECONDS;
    transport.start();
  }

  /** Pause without resetting position (resume continues from here). */
  pause(): void {
    Tone.getTransport().pause();
  }

  /** Stop and reset the transport + clear the scheduled part. */
  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;
    transport.cancel();
    this.part?.dispose();
    this.part = null;
  }

  /** Play a single blip for a track's pitch (note-create preview / audition). */
  async preview(track: number): Promise<void> {
    await Tone.start();
    this.ensureSynth().triggerAttackRelease(TRACK_PITCHES[track] ?? "C4", NOTE_RELEASE);
  }

  /** Current transport position expressed in ticks. */
  get currentTick(): number {
    return Tone.getTransport().seconds / TICK_SECONDS;
  }

  /** Release all audio resources (call on unmount). */
  dispose(): void {
    this.stop();
    this.synth?.dispose();
    this.synth = null;
  }
}
