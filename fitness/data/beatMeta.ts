/**
 * WELLIVA BEATS — track metadata for the 15 original instrumental loops.
 *
 * The audio itself is synthesized by `scripts/generate-beats.js` (no samples,
 * no copyrighted material — fully original, royalty-free compositions owned
 * by the project) and lives in `assets/audio/beats/`. This file is pure data
 * so services and tests can reason about tracks without touching Metro asset
 * loading; the `require()` map lives separately in `beatSources.ts`.
 *
 * Keep ids in sync with the generator's TRACKS list.
 */

import type { BeatMeta, EnergyLevel } from "../types";

export const BEATS: BeatMeta[] = [
  { id: "pop-cardio-pulse", title: "Pop Cardio Pulse", bpm: 120, energy: "high", mood: "Bright four-on-the-floor pop drive" },
  { id: "disco-sprint", title: "Disco Sprint", bpm: 122, energy: "high", mood: "Octave-bass groove with open-hat shimmer" },
  { id: "electro-strength", title: "Electro Strength", bpm: 100, energy: "high", mood: "Heavy electro stomp for lifting tempo" },
  { id: "funk-motion", title: "Funk Motion", bpm: 104, energy: "medium", mood: "Syncopated pocket with plucky bass" },
  { id: "synth-run", title: "Synth Run", bpm: 118, energy: "medium", mood: "Arpeggiated night-drive momentum" },
  { id: "house-endurance", title: "House Endurance", bpm: 124, energy: "medium", mood: "Deep, patient club pulse that lasts" },
  { id: "neon-hiit", title: "Neon HIIT", bpm: 145, energy: "high", mood: "Relentless sixteenth-note interval driver" },
  { id: "bass-boost", title: "Bass Boost", bpm: 95, energy: "medium", mood: "Half-time sub-bass weight" },
  { id: "power-circuit", title: "Power Circuit", bpm: 130, energy: "high", mood: "Big-room stabs for circuit peaks" },
  { id: "rhythm-climb", title: "Rhythm Climb", bpm: 112, energy: "medium", mood: "Percussion-forward steady ascent" },
  { id: "dance-burn", title: "Dance Burn", bpm: 126, energy: "high", mood: "Dance-pop sparkle with a plucked hook" },
  { id: "victory-drive", title: "Victory Drive", bpm: 128, energy: "high", mood: "Uplifting major-key finish-line energy" },
  { id: "focus-flow", title: "Focus Flow", bpm: 90, energy: "low", mood: "Mellow broken beat for controlled work" },
  { id: "peak-energy", title: "Peak Energy", bpm: 140, energy: "high", mood: "Stab-led rave surge for max effort" },
  { id: "cooldown-groove", title: "Cooldown Groove", bpm: 80, energy: "low", mood: "Warm analog groove for winding down" },
];

export const BEAT_BY_ID: ReadonlyMap<string, BeatMeta> = new Map(
  BEATS.map((b) => [b.id, b]),
);

/** Pick a sensible default beat for a session energy level (deterministic). */
export function defaultBeatForEnergy(energy: EnergyLevel): BeatMeta {
  const pool = BEATS.filter((b) => b.energy === energy);
  return pool[0] ?? BEATS[0];
}

/** The next track in the catalog (wraps) — powers the dock's "next" button. */
export function nextBeatId(currentId: string): string {
  const idx = BEATS.findIndex((b) => b.id === currentId);
  return BEATS[(idx + 1) % BEATS.length].id;
}
