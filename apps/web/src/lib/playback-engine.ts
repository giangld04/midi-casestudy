/**
 * Tone.js + smplr playback engine for the piano-roll.
 *
 * Audio routing: smplr Soundfont → GainNode (volume) → StereoPannerNode (pan) → ctx.destination.
 * All instruments share the same gain/panner chain (setVolume/setPan apply instantly).
 *
 * Time model: 1 tick = 0.25s. Tracks 1-8 map to C-major-pentatonic pitches.
 * React state lives in use-playback.ts; this class is framework-agnostic.
 */

import * as Tone from "tone";
import { Soundfont } from "smplr";
import { TICKS_PER_SECOND, MAX_TIME_TICK } from "@ama-midi/shared";
import type { Note } from "@ama-midi/shared";
import { DEFAULT_INSTRUMENT } from "./gm-instruments";

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
const NOTE_DURATION_SECONDS = 0.5;

/** Default output volume (0..1). */
const DEFAULT_VOLUME = 0.85;

export class PlaybackEngine {
  private part: Tone.Part | null = null;

  private instrument = DEFAULT_INSTRUMENT;
  private samplers = new Map<string, Soundfont>();
  private loading: Promise<Soundfont> | null = null;

  // Lazily created Web Audio chain: gain → panner → destination
  private gainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private currentVolume = DEFAULT_VOLUME;
  private currentPan = 0;

  /** Lazily create the gain → panner chain and wire to destination (once). */
  private ensureAudioChain(): { gain: GainNode; panner: StereoPannerNode } {
    if (this.gainNode && this.pannerNode) {
      return { gain: this.gainNode, panner: this.pannerNode };
    }
    const ctx = Tone.getContext().rawContext as unknown as AudioContext;
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    gain.gain.value = this.currentVolume;
    panner.pan.value = this.currentPan;
    gain.connect(panner);
    panner.connect(ctx.destination);
    this.gainNode = gain;
    this.pannerNode = panner;
    return { gain, panner };
  }

  /** Load (and cache) the smplr Soundfont for the active instrument, routing through the gain chain. */
  private async ensureSampler(): Promise<Soundfont> {
    const name = this.instrument;
    const cached = this.samplers.get(name);
    if (cached) return cached;

    const { gain } = this.ensureAudioChain();
    const ctx = Tone.getContext().rawContext as unknown as AudioContext;
    // Pass gainNode as destination so all instruments share volume/pan control.
    const sampler = Soundfont(ctx, { instrument: name, destination: gain });
    this.loading = sampler.ready.then(() => {
      this.samplers.set(name, sampler);
      return sampler;
    });
    return this.loading;
  }

  /** Choose a GM instrument and start loading it immediately. */
  setInstrument(name: string): void {
    if (name === this.instrument) return;
    this.instrument = name;
    this.loading = null;
    void this.ensureSampler();
  }

  /** Set output volume (0..1). Applied instantly to existing audio chain. */
  setVolume(v: number): void {
    this.currentVolume = Math.max(0, Math.min(1, v));
    if (this.gainNode) this.gainNode.gain.value = this.currentVolume;
  }

  /** Set stereo pan (-1..1, 0 = center). Applied instantly. */
  setPan(p: number): void {
    this.currentPan = Math.max(-1, Math.min(1, p));
    if (this.pannerNode) this.pannerNode.pan.value = this.currentPan;
  }

  /** The currently selected GM instrument id. */
  get currentInstrument(): string {
    return this.instrument;
  }

  /** Build a Tone.Part scheduling every note at its tick time. */
  private buildPart(notes: readonly Note[], sampler: Soundfont): void {
    this.part?.dispose();

    const events = notes.map((n) => ({
      time: n.timeTick * TICK_SECONDS,
      pitch: TRACK_PITCHES[n.track] ?? "C4",
    }));

    this.part = new Tone.Part((time, ev: { pitch: string }) => {
      sampler.start({ note: ev.pitch, time, duration: NOTE_DURATION_SECONDS });
    }, events);
    this.part.start(0);
  }

  /** Start (or resume) playback from startTick. Rebuilds schedule from current notes. */
  async play(notes: readonly Note[], startTick = 0): Promise<void> {
    await Tone.start(); // resume AudioContext (user-gesture requirement)
    const sampler = await this.ensureSampler();
    const transport = Tone.getTransport();
    this.buildPart(notes, sampler);
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
    const sampler = await this.ensureSampler();
    sampler.start({ note: TRACK_PITCHES[track] ?? "C4", duration: NOTE_DURATION_SECONDS });
  }

  /** Seek the transport to the given tick (clamped to valid range). Works while playing or paused. */
  seek(tick: number): void {
    const t = Tone.getTransport();
    t.seconds = Math.max(0, Math.min(MAX_TIME_TICK, tick)) * TICK_SECONDS;
  }

  /** Current transport position expressed in ticks. */
  get currentTick(): number {
    return Tone.getTransport().seconds / TICK_SECONDS;
  }

  /** Release all audio resources (call on unmount). */
  dispose(): void {
    this.stop();
    for (const sampler of this.samplers.values()) sampler.stop();
    this.samplers.clear();
    this.loading = null;
    // Disconnect audio chain
    try {
      this.gainNode?.disconnect();
      this.pannerNode?.disconnect();
    } catch {
      // ignore disconnect errors on already-closed context
    }
    this.gainNode = null;
    this.pannerNode = null;
  }
}
