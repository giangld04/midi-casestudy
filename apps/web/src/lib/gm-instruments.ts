/**
 * General MIDI instrument catalog for the smplr Soundfont picker.
 *
 * The 128 GM programs are grouped into their 16 canonical families. Each
 * instrument `value` is the snake_case name expected by smplr's Soundfont
 * (Benjamin Gleitz's midi-js-soundfonts naming), while `label` is a human
 * friendly title for the picker UI. The data is static — no runtime fetch.
 */

export interface GmInstrument {
  /** smplr Soundfont instrument id (snake_case, e.g. "acoustic_grand_piano"). */
  value: string;
  /** Display name for the picker (e.g. "Acoustic Grand Piano"). */
  label: string;
}

export interface GmCategory {
  /** Family name shown in the left pane (e.g. "Piano"). */
  name: string;
  instruments: GmInstrument[];
}

/** Turn a snake_case soundfont id into a Title Case label. */
function label(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build a category from its family name + list of soundfont ids. */
function category(name: string, values: string[]): GmCategory {
  return { name, instruments: values.map((value) => ({ value, label: label(value) })) };
}

/** All 16 GM families → their 8 instruments (128 total). */
export const GM_CATEGORIES: readonly GmCategory[] = [
  category("Piano", [
    "acoustic_grand_piano", "bright_acoustic_piano", "electric_grand_piano",
    "honkytonk_piano", "electric_piano_1", "electric_piano_2", "harpsichord", "clavinet",
  ]),
  category("Chromatic Percussion", [
    "celesta", "glockenspiel", "music_box", "vibraphone",
    "marimba", "xylophone", "tubular_bells", "dulcimer",
  ]),
  category("Organ", [
    "drawbar_organ", "percussive_organ", "rock_organ", "church_organ",
    "reed_organ", "accordion", "harmonica", "tango_accordion",
  ]),
  category("Guitar", [
    "acoustic_guitar_nylon", "acoustic_guitar_steel", "electric_guitar_jazz", "electric_guitar_clean",
    "electric_guitar_muted", "overdriven_guitar", "distortion_guitar", "guitar_harmonics",
  ]),
  category("Bass", [
    "acoustic_bass", "electric_bass_finger", "electric_bass_pick", "fretless_bass",
    "slap_bass_1", "slap_bass_2", "synth_bass_1", "synth_bass_2",
  ]),
  category("Strings", [
    "violin", "viola", "cello", "contrabass",
    "tremolo_strings", "pizzicato_strings", "orchestral_harp", "timpani",
  ]),
  category("Ensemble", [
    "string_ensemble_1", "string_ensemble_2", "synth_strings_1", "synth_strings_2",
    "choir_aahs", "voice_oohs", "synth_choir", "orchestra_hit",
  ]),
  category("Brass", [
    "trumpet", "trombone", "tuba", "muted_trumpet",
    "french_horn", "brass_section", "synth_brass_1", "synth_brass_2",
  ]),
  category("Reed", [
    "soprano_sax", "alto_sax", "tenor_sax", "baritone_sax",
    "oboe", "english_horn", "bassoon", "clarinet",
  ]),
  category("Pipe", [
    "piccolo", "flute", "recorder", "pan_flute",
    "blown_bottle", "shakuhachi", "whistle", "ocarina",
  ]),
  category("Synth Lead", [
    "lead_1_square", "lead_2_sawtooth", "lead_3_calliope", "lead_4_chiff",
    "lead_5_charang", "lead_6_voice", "lead_7_fifths", "lead_8_bass__lead",
  ]),
  category("Synth Pad", [
    "pad_1_new_age", "pad_2_warm", "pad_3_polysynth", "pad_4_choir",
    "pad_5_bowed", "pad_6_metallic", "pad_7_halo", "pad_8_sweep",
  ]),
  category("Synth Effects", [
    "fx_1_rain", "fx_2_soundtrack", "fx_3_crystal", "fx_4_atmosphere",
    "fx_5_brightness", "fx_6_goblins", "fx_7_echoes", "fx_8_scifi",
  ]),
  category("Ethnic", [
    "sitar", "banjo", "shamisen", "koto",
    "kalimba", "bagpipe", "fiddle", "shanai",
  ]),
  category("Percussive", [
    "tinkle_bell", "agogo", "steel_drums", "woodblock",
    "taiko_drum", "melodic_tom", "synth_drum", "reverse_cymbal",
  ]),
  category("Sound Effects", [
    "guitar_fret_noise", "breath_noise", "seashore", "bird_tweet",
    "telephone_ring", "helicopter", "applause", "gunshot",
  ]),
];

/** Default instrument loaded on first playback. */
export const DEFAULT_INSTRUMENT = "acoustic_grand_piano";

/** Look up a friendly label for an instrument id (falls back to the id). */
export function instrumentLabel(value: string): string {
  for (const cat of GM_CATEGORIES) {
    const found = cat.instruments.find((i) => i.value === value);
    if (found) return found.label;
  }
  return label(value);
}
