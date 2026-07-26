#!/usr/bin/env node
/**
 * WELLIVA BEATS — procedural workout-music synthesizer.
 *
 * Generates the 15 original instrumental loops that ship in
 * `assets/audio/beats/`. Everything is synthesized from first principles
 * (sine/saw/square oscillators + shaped noise) with deterministic seeds:
 *
 *   • No samples, no copyrighted melodies, no imitation of existing tracks.
 *   • Fully royalty-free and commercial-use friendly — the compositions are
 *     created by this script and owned by the project.
 *   • Reproducible: same script → bit-identical WAVs (seeded PRNG noise).
 *
 * Output: 22 050 Hz / 16-bit / mono PCM WAV, rendered WRAP-AROUND so every
 * file loops seamlessly (note tails that spill past the end are folded back
 * into the start of the buffer).
 *
 * Usage:  node scripts/generate-beats.js
 *
 * The track metadata (titles, BPM, energy) is mirrored in
 * `fitness/data/beatMeta.ts` — keep the two in sync when adding tracks.
 */

const fs = require("fs");
const path = require("path");

const SR = 22050; // sample rate — compact but keeps hat sparkle up to ~11 kHz
const OUT_DIR = path.join(__dirname, "..", "assets", "audio", "beats");

/* ────────────────────────── deterministic PRNG ────────────────────────── */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────────── music helpers ──────────────────────────── */

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Chord qualities as semitone stacks. */
const CHORDS = {
  min: [0, 3, 7],
  min7: [0, 3, 7, 10],
  maj: [0, 4, 7],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  min9: [0, 3, 7, 14],
};

/* ─────────────────────────────── renderer ─────────────────────────────── */

class Renderer {
  constructor(totalSamples, rand) {
    this.n = totalSamples;
    this.buf = new Float64Array(totalSamples);
    this.rand = rand;
  }

  /** Add `fn(t) → sample` starting at `start`, wrapping past the loop end. */
  add(start, durSec, gain, fn) {
    const durSamples = Math.floor(durSec * SR);
    const s0 = Math.floor(start);
    for (let i = 0; i < durSamples; i++) {
      const t = i / SR;
      this.buf[(s0 + i) % this.n] += fn(t) * gain;
    }
  }

  /* ── drum voices ── */

  kick(start, gain = 1, opts = {}) {
    const pDrop = opts.punch ?? 30; // pitch-drop speed
    const f0 = opts.f0 ?? 160;
    const fEnd = opts.fEnd ?? 46;
    const decay = opts.decay ?? 17;
    let phase = 0;
    let last = -1;
    this.add(start, opts.len ?? 0.32, gain, (t) => {
      // integrate the falling pitch for a continuous phase
      if (t !== last) {
        const f = fEnd + (f0 - fEnd) * Math.exp(-t * pDrop);
        phase += (2 * Math.PI * f) / SR;
        last = t;
      }
      const body = Math.sin(phase) * Math.exp(-t * decay);
      const click = Math.exp(-t * 420) * 0.45;
      return Math.tanh((body + click) * 1.5);
    });
  }

  /** Long sub-bass kick for half-time styles. */
  boom(start, midi, gain = 1, len = 0.6) {
    const f = midiHz(midi);
    let phase = 0;
    this.add(start, len, gain, (t) => {
      const fNow = f * (1 + 1.6 * Math.exp(-t * 40));
      phase += (2 * Math.PI * fNow) / SR;
      return Math.tanh(Math.sin(phase) * 1.6) * Math.exp(-t * 4.2);
    });
  }

  snare(start, gain = 1, opts = {}) {
    const rand = this.rand;
    let n1 = 0;
    const tone = opts.tone ?? 185;
    this.add(start, 0.22, gain, (t) => {
      const w = rand() * 2 - 1;
      const hp = w - n1; // crude 1-pole high-pass
      n1 = n1 + 0.25 * (w - n1);
      const noise = hp * Math.exp(-t * (opts.snap ?? 24));
      const body = Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * 34) * 0.6;
      return noise + body;
    });
  }

  clap(start, gain = 1) {
    for (const [off, g] of [
      [0, 0.7],
      [0.011, 0.85],
      [0.023, 1],
    ]) {
      const rand = this.rand;
      let lp = 0;
      this.add(start + off * SR, 0.16, gain * g, (t) => {
        const w = rand() * 2 - 1;
        lp += 0.32 * (w - lp); // band-ish: LP then subtract
        return (w - lp) * Math.exp(-t * 26);
      });
    }
  }

  hat(start, gain = 1, open = false) {
    const rand = this.rand;
    let n1 = 0;
    this.add(start, open ? 0.28 : 0.07, gain, (t) => {
      const w = rand() * 2 - 1;
      const hp = w - n1;
      n1 = n1 + 0.55 * (w - n1);
      return hp * Math.exp(-t * (open ? 11 : 75));
    });
  }

  shaker(start, gain = 1) {
    const rand = this.rand;
    let n1 = 0;
    this.add(start, 0.09, gain, (t) => {
      const w = rand() * 2 - 1;
      const hp = w - n1;
      n1 = n1 + 0.4 * (w - n1);
      const env = Math.min(t * 90, 1) * Math.exp(-t * 45);
      return hp * env;
    });
  }

  tom(start, midi, gain = 1) {
    const f = midiHz(midi);
    let phase = 0;
    this.add(start, 0.3, gain, (t) => {
      const fNow = f * (1 + 0.7 * Math.exp(-t * 25));
      phase += (2 * Math.PI * fNow) / SR;
      return Math.sin(phase) * Math.exp(-t * 12);
    });
  }

  /* ── tonal voices ── */

  /** Filtered saw/square mono bass. */
  bass(start, midi, durSec, gain = 1, opts = {}) {
    const f = midiHz(midi);
    const square = opts.square ?? false;
    const cutBase = opts.cut ?? 180;
    const cutEnv = opts.cutEnv ?? 1400;
    const cutDecay = opts.cutDecay ?? 9;
    let lp = 0;
    this.add(start, durSec, gain, (t) => {
      const ph = (t * f) % 1;
      let x = square ? (ph < 0.5 ? 1 : -1) : 2 * ph - 1;
      x += Math.sin(2 * Math.PI * f * t) * 0.5; // fundamental reinforcement
      const cutoff = cutBase + cutEnv * Math.exp(-t * cutDecay);
      const k = Math.min(1, (2 * Math.PI * cutoff) / SR);
      lp += k * (x - lp);
      const rel = Math.min(1, Math.max(0, (durSec - t) * 30)); // 33 ms release
      const atk = Math.min(1, t * 300);
      return Math.tanh(lp * 1.7) * atk * rel;
    });
  }

  /** Detuned-saw chord stab with a closing low-pass — the "dance chord". */
  stab(start, midis, durSec, gain = 1, opts = {}) {
    const freqs = [];
    for (const m of midis) {
      const f = midiHz(m);
      freqs.push(f * 1.004, f * 0.996);
    }
    const decay = opts.decay ?? 7;
    let lp = 0;
    this.add(start, durSec, gain / freqs.length, (t) => {
      let x = 0;
      for (const f of freqs) x += 2 * ((t * f) % 1) - 1;
      const cutoff = 300 + (opts.bright ?? 2600) * Math.exp(-t * decay);
      const k = Math.min(1, (2 * Math.PI * cutoff) / SR);
      lp += k * (x - lp);
      return lp * Math.exp(-t * decay) * Math.min(1, t * 400);
    });
  }

  /** Soft sine-stack pad with slow attack. */
  pad(start, midis, durSec, gain = 1) {
    const freqs = midis.map(midiHz);
    this.add(start, durSec, gain / freqs.length, (t) => {
      let x = 0;
      for (const f of freqs) {
        x += Math.sin(2 * Math.PI * f * t);
        x += Math.sin(2 * Math.PI * f * 2 * t + 1.3) * 0.18; // gentle 2nd
      }
      const atk = Math.min(1, t / 0.55);
      const rel = Math.min(1, Math.max(0, (durSec - t) / 0.5));
      const trem = 1 + 0.06 * Math.sin(2 * Math.PI * 5.3 * t);
      return x * atk * rel * trem;
    });
  }

  /** Plucky triangle lead with two feedback echoes (folded into the loop). */
  pluck(start, midi, gain = 1, opts = {}) {
    const echoSec = opts.echoSec ?? 0.19;
    for (const [delay, g] of [
      [0, 1],
      [echoSec, 0.42],
      [echoSec * 2, 0.18],
    ]) {
      const f = midiHz(midi);
      this.add(start + delay * SR, 0.35, gain * g, (t) => {
        const ph = (t * f) % 1;
        const tri = 4 * Math.abs(ph - 0.5) - 1;
        const shimmer = Math.sin(2 * Math.PI * f * 3 * t) * 0.12 * Math.exp(-t * 24);
        return (tri * 0.8 + shimmer) * Math.exp(-t * (opts.decay ?? 11)) * Math.min(1, t * 500);
      });
    }
  }

  /* ── mixdown ── */

  toPcm16() {
    // soft limit → normalize → dither → 16-bit
    let peak = 0;
    const soft = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      soft[i] = Math.tanh(this.buf[i] * 1.15);
      peak = Math.max(peak, Math.abs(soft[i]));
    }
    const norm = peak > 0 ? 0.9 / peak : 1;
    const out = new Int16Array(this.n);
    const rand = this.rand;
    for (let i = 0; i < this.n; i++) {
      const dither = (rand() - rand()) / 65536; // TPDF, ±0.5 LSB
      let v = soft[i] * norm + dither;
      v = Math.max(-1, Math.min(1, v));
      out[i] = Math.round(v * 32767);
    }
    return out;
  }
}

/* ────────────────────────────── WAV writer ────────────────────────────── */

function writeWav(filePath, pcm) {
  const dataLen = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], 44 + i * 2);
  fs.writeFileSync(filePath, buf);
  return dataLen + 44;
}

/* ─────────────────────────── pattern sequencer ─────────────────────────── */

/**
 * Patterns are 16-char strings, one char per 16th-note step:
 *   "x" hard hit · "o" medium · "." rest · "O" open (hats) · "-" ghost
 * Per-bar overrides let bar 4/8 carry fills so the loop breathes.
 */
function stepsOf(pattern) {
  const out = [];
  for (let i = 0; i < 16; i++) {
    const c = pattern[i] ?? ".";
    if (c === "x") out.push([i, 1]);
    else if (c === "o") out.push([i, 0.68]);
    else if (c === "O") out.push([i, 1, true]);
    else if (c === "-") out.push([i, 0.34]);
  }
  return out;
}

function barPattern(base, overrides, bar) {
  return stepsOf((overrides && overrides[bar]) || base);
}

/**
 * Render one track from a declarative spec. Every section is optional, so
 * chill tracks simply omit voices.
 */
function renderTrack(spec) {
  const stepSec = 60 / spec.bpm / 4;
  const total = Math.round(SR * stepSec * 16 * spec.bars);
  const r = new Renderer(total, mulberry32(spec.seed));
  const stepSamp = (bar, step) => (bar * 16 + step) * stepSec * SR;

  for (let bar = 0; bar < spec.bars; bar++) {
    const chord = spec.progression[bar % spec.progression.length];
    const chordMidis = CHORDS[chord.q].map((s) => spec.root + chord.o + s);

    // drums
    if (spec.kick)
      for (const [st, v] of barPattern(spec.kick.p, spec.kick.f, bar))
        spec.kick.boom
          ? r.boom(stepSamp(bar, st), spec.root - 24 + chord.o, v * spec.kick.g, spec.kick.len ?? 0.55)
          : r.kick(stepSamp(bar, st), v * spec.kick.g, spec.kick.opts);
    if (spec.snare)
      for (const [st, v] of barPattern(spec.snare.p, spec.snare.f, bar))
        r.snare(stepSamp(bar, st), v * spec.snare.g, spec.snare.opts);
    if (spec.clap)
      for (const [st, v] of barPattern(spec.clap.p, spec.clap.f, bar))
        r.clap(stepSamp(bar, st), v * spec.clap.g);
    if (spec.hat)
      for (const [st, v, open] of barPattern(spec.hat.p, spec.hat.f, bar))
        r.hat(stepSamp(bar, st), v * spec.hat.g, !!open);
    if (spec.shaker)
      for (const [st, v] of barPattern(spec.shaker.p, spec.shaker.f, bar))
        r.shaker(stepSamp(bar, st), v * spec.shaker.g);
    if (spec.tom)
      for (const [st, v] of barPattern(spec.tom.p, spec.tom.f, bar))
        r.tom(stepSamp(bar, st), spec.root + chord.o - 12 + (st % 5), v * spec.tom.g);

    // bass — [step, semitone-from-chord-root, lengthInSteps]
    if (spec.bassline) {
      const line = (spec.bassline.f && spec.bassline.f[bar]) || spec.bassline.p;
      for (const [st, semi, len] of line)
        r.bass(
          stepSamp(bar, st),
          spec.root - 24 + chord.o + semi,
          len * stepSec * 0.92,
          spec.bassline.g,
          spec.bassline.opts,
        );
    }

    // chord stabs — [step, lengthInSteps]
    if (spec.stabs) {
      const line = (spec.stabs.f && spec.stabs.f[bar]) || spec.stabs.p;
      for (const [st, len] of line)
        r.stab(stepSamp(bar, st), chordMidis, len * stepSec, spec.stabs.g, spec.stabs.opts);
    }

    // pad — sustained chord per bar (skip when mask says so)
    if (spec.pad && !(spec.pad.skip || []).includes(bar % 4))
      r.pad(stepSamp(bar, 0), chordMidis.map((m) => m + (spec.pad.oct ?? 0) * 12), 16 * stepSec, spec.pad.g);

    // arp — cycles chord tones on masked 16ths
    if (spec.arp) {
      const mask = (spec.arp.f && spec.arp.f[bar]) || spec.arp.p;
      let k = 0;
      for (let st = 0; st < 16; st++) {
        if (mask[st] !== "x" && mask[st] !== "o") continue;
        const tone = chordMidis[spec.arp.order[k % spec.arp.order.length] % chordMidis.length];
        r.pluck(
          stepSamp(bar, st),
          tone + (spec.arp.oct ?? 1) * 12,
          (mask[st] === "x" ? 1 : 0.6) * spec.arp.g,
          { echoSec: stepSec * 3, decay: spec.arp.decay ?? 11 },
        );
        k++;
      }
    }
  }

  return r.toPcm16();
}

/* ───────────────────────────── track catalog ──────────────────────────────
 * 15 original compositions. Roots/keys, progressions and patterns are all
 * bespoke to Welliva — written note-by-note for this generator.
 */

const FOUR_FLOOR = "x...x...x...x...";
const BACKBEAT = "....x.......x...";
const OFFBEAT_OPEN = "..O...O...O...O.";
const HATS_8 = "x.o.x.o.x.o.x.o.";
const HATS_16 = "xoooxoooxoooxooo";

const TRACKS = [
  {
    id: "pop-cardio-pulse",
    title: "Pop Cardio Pulse",
    bpm: 120,
    bars: 8,
    seed: 101,
    root: 57, // A minor
    progression: [
      { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 8, q: "maj" }, { o: 8, q: "maj" },
      { o: 3, q: "maj" }, { o: 3, q: "maj" }, { o: 10, q: "maj" }, { o: 10, q: "sus4" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.0, f: { 7: "x...x...x...x.xx" } },
    clap: { p: BACKBEAT, g: 0.6 },
    hat: { p: HATS_8, g: 0.32, f: { 3: "x.o.x.o.x.o.xooo", 7: "x.o.x.o.xooooooo" } },
    bassline: { p: [[0, 0, 3], [4, 0, 2], [8, 0, 3], [12, 12, 2]], g: 0.62 },
    stabs: { p: [[4, 2], [12, 2]], g: 0.5, opts: { bright: 3000 } },
    energy: "high",
  },
  {
    id: "disco-sprint",
    title: "Disco Sprint",
    bpm: 122,
    bars: 8,
    seed: 202,
    root: 55, // G dorian-ish
    progression: [
      { o: 0, q: "min7" }, { o: 0, q: "min7" }, { o: 5, q: "maj7" }, { o: 5, q: "maj7" },
      { o: 0, q: "min7" }, { o: 0, q: "min7" }, { o: 10, q: "maj" }, { o: 7, q: "sus4" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.0 },
    snare: { p: BACKBEAT, g: 0.55, opts: { tone: 200 } },
    hat: { p: OFFBEAT_OPEN, g: 0.4, f: { 7: "..O...O...O.oooo" } },
    // classic octave-pump bass, rewritten with a passing 5th
    bassline: {
      p: [[0, 0, 1], [2, 12, 1], [4, 0, 1], [6, 12, 1], [8, 0, 1], [10, 12, 1], [12, 7, 1], [14, 12, 1]],
      g: 0.6,
    },
    stabs: { p: [[0, 1], [7, 1], [10, 1]], g: 0.42, opts: { decay: 9 } },
    energy: "high",
  },
  {
    id: "electro-strength",
    title: "Electro Strength",
    bpm: 100,
    bars: 8,
    seed: 303,
    root: 52, // E minor
    progression: [
      { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 0, q: "min" },
      { o: 8, q: "maj" }, { o: 8, q: "maj" }, { o: 10, q: "maj" }, { o: 10, q: "maj" },
    ],
    kick: { p: "x......x..x.....", g: 1.1, opts: { punch: 24, decay: 13 }, f: { 7: "x......x..x...xx" } },
    snare: { p: BACKBEAT, g: 0.8, opts: { snap: 18 } },
    hat: { p: "..x...x...x...x.", g: 0.3 },
    bassline: {
      p: [[0, 0, 4], [8, 0, 2], [10, -2, 2], [12, 0, 4]],
      g: 0.75,
      opts: { square: true, cut: 140, cutEnv: 900 },
    },
    stabs: { p: [[8, 3]], g: 0.4, opts: { bright: 1800, decay: 5 } },
    energy: "high",
  },
  {
    id: "funk-motion",
    title: "Funk Motion",
    bpm: 104,
    bars: 8,
    seed: 404,
    root: 50, // D dorian
    progression: [
      { o: 0, q: "min7" }, { o: 0, q: "min7" }, { o: 0, q: "min7" }, { o: 5, q: "maj7" },
    ],
    kick: { p: "x.....x...x...x.", g: 0.95, f: { 3: "x.....x...x..x.x" } },
    snare: { p: "....x..-..-.x..-", g: 0.62 },
    hat: { p: HATS_16, g: 0.24, f: { 3: "xoooxoooxooxxoxo" } },
    bassline: {
      p: [[0, 0, 1], [3, 0, 1], [6, 10, 1], [8, 12, 1], [11, 7, 1], [14, 5, 1]],
      g: 0.6,
      opts: { cut: 220, cutEnv: 1800, cutDecay: 12 },
    },
    stabs: { p: [[6, 1], [14, 1]], g: 0.36, opts: { bright: 3400, decay: 10 } },
    energy: "medium",
  },
  {
    id: "synth-run",
    title: "Synth Run",
    bpm: 118,
    bars: 8,
    seed: 505,
    root: 57, // A minor, synthwave
    progression: [
      { o: 0, q: "min" }, { o: 8, q: "maj" }, { o: 3, q: "maj" }, { o: 7, q: "min" },
    ],
    kick: { p: FOUR_FLOOR, g: 0.95 },
    snare: { p: BACKBEAT, g: 0.55 },
    hat: { p: HATS_8, g: 0.26 },
    pad: { g: 0.24, oct: 0 },
    arp: { p: HATS_16, order: [0, 1, 2, 1], oct: 1, g: 0.4, f: { 7: "xoooxoooxoooxxxx" } },
    bassline: { p: [[0, 0, 8], [8, 0, 8]], g: 0.5, opts: { cut: 160, cutEnv: 500 } },
    energy: "medium",
  },
  {
    id: "house-endurance",
    title: "House Endurance",
    bpm: 124,
    bars: 8,
    seed: 606,
    root: 53, // F minor-ish deep house
    progression: [
      { o: 0, q: "min9" }, { o: 0, q: "min9" }, { o: 8, q: "maj7" }, { o: 10, q: "sus2" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.0 },
    clap: { p: BACKBEAT, g: 0.5 },
    hat: { p: OFFBEAT_OPEN, g: 0.34 },
    shaker: { p: HATS_16, g: 0.16 },
    // offbeat house bass
    bassline: { p: [[2, 0, 2], [6, 0, 2], [10, 0, 2], [14, 0, 2]], g: 0.58, opts: { cut: 150, cutEnv: 700 } },
    stabs: { p: [[4, 1], [11, 1]], g: 0.34, opts: { bright: 2200, decay: 8 } },
    energy: "medium",
  },
  {
    id: "neon-hiit",
    title: "Neon HIIT",
    bpm: 145,
    bars: 8,
    seed: 707,
    root: 55, // G minor, hard interval driver
    progression: [
      { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 3, q: "maj" }, { o: 5, q: "min" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.1, opts: { punch: 34, decay: 19 }, f: { 3: "x...x...x...x.x.", 7: "x...x...x.x.x.xx" } },
    snare: { p: BACKBEAT, g: 0.7, f: { 7: "....x.......xxxx" } },
    hat: { p: HATS_16, g: 0.3 },
    bassline: {
      p: [[0, 0, 1], [2, 0, 1], [4, 0, 1], [6, 0, 1], [8, 0, 1], [10, 0, 1], [12, 3, 1], [14, 5, 1]],
      g: 0.66,
      opts: { square: true, cut: 200, cutEnv: 1500, cutDecay: 14 },
    },
    stabs: { p: [[0, 1], [6, 1], [10, 1]], g: 0.4, opts: { bright: 3600, decay: 11 } },
    energy: "high",
  },
  {
    id: "bass-boost",
    title: "Bass Boost",
    bpm: 95,
    bars: 8,
    seed: 808,
    root: 48, // C, half-time weight
    progression: [
      { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 10, q: "maj" },
    ],
    kick: { p: "x.......x.x.....", g: 1.0, boom: true, len: 0.7, f: { 3: "x.......x.x...x." } },
    snare: { p: "........x.......", g: 0.75, opts: { snap: 15, tone: 165 } },
    hat: { p: "x.x.x.x.x.x.xxx.", g: 0.22, f: { 3: "x.x.xxx.x.x.xxxx" } },
    pad: { g: 0.18, oct: 1, skip: [1, 3] },
    energy: "medium",
  },
  {
    id: "power-circuit",
    title: "Power Circuit",
    bpm: 130,
    bars: 8,
    seed: 909,
    root: 52, // E minor big-energy
    progression: [
      { o: 0, q: "min" }, { o: 8, q: "maj" }, { o: 0, q: "min" }, { o: 10, q: "maj" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.05, opts: { punch: 30 } },
    clap: { p: BACKBEAT, g: 0.62 },
    hat: { p: "..x...x...x...xx", g: 0.34 },
    bassline: { p: [[0, 0, 3], [4, 0, 3], [8, 0, 3], [12, 0, 2], [14, 7, 2]], g: 0.62 },
    stabs: { p: [[0, 2], [8, 2], [14, 2]], g: 0.46, opts: { bright: 3000, decay: 6 } },
    energy: "high",
  },
  {
    id: "rhythm-climb",
    title: "Rhythm Climb",
    bpm: 112,
    bars: 8,
    seed: 1010,
    root: 50, // D, percussion-forward
    progression: [
      { o: 0, q: "sus2" }, { o: 0, q: "sus2" }, { o: 3, q: "maj" }, { o: 5, q: "sus4" },
    ],
    kick: { p: "x..x..x...x..x..", g: 0.9 },
    snare: { p: "....x......x..-.", g: 0.5 },
    shaker: { p: HATS_16, g: 0.22 },
    tom: { p: "..x.....o....xo.", g: 0.5, f: { 3: "..x..o..o..xxxo." } },
    bassline: { p: [[0, 0, 2], [6, 0, 1], [10, 5, 2]], g: 0.52, opts: { cut: 170, cutEnv: 900 } },
    energy: "medium",
  },
  {
    id: "dance-burn",
    title: "Dance Burn",
    bpm: 126,
    bars: 8,
    seed: 1111,
    root: 58, // B♭ dance-pop
    progression: [
      { o: 0, q: "min" }, { o: 5, q: "min" }, { o: 8, q: "maj" }, { o: 3, q: "maj" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.0 },
    clap: { p: BACKBEAT, g: 0.58 },
    hat: { p: OFFBEAT_OPEN, g: 0.36, f: { 7: "..O...O.oooooooo" } },
    arp: { p: "x..x..x.x..x..x.", order: [0, 2, 1, 2], oct: 1, g: 0.42 },
    bassline: { p: [[0, 0, 2], [4, 0, 1], [6, 0, 1], [8, 0, 2], [12, 0, 2]], g: 0.6 },
    energy: "high",
  },
  {
    id: "victory-drive",
    title: "Victory Drive",
    bpm: 128,
    bars: 8,
    seed: 1212,
    root: 60, // C major — the uplifting one
    progression: [
      { o: 0, q: "maj" }, { o: 7, q: "maj" }, { o: 9, q: "min" }, { o: 5, q: "maj" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.0 },
    snare: { p: BACKBEAT, g: 0.5 },
    hat: { p: HATS_8, g: 0.3 },
    pad: { g: 0.22 },
    arp: { p: HATS_16, order: [0, 1, 2, 3], oct: 1, g: 0.36 },
    bassline: { p: [[0, 0, 4], [8, 0, 2], [10, 0, 2], [12, 0, 4]], g: 0.55 },
    energy: "high",
  },
  {
    id: "focus-flow",
    title: "Focus Flow",
    bpm: 90,
    bars: 6,
    seed: 1313,
    root: 55, // G, mellow broken beat
    progression: [
      { o: 0, q: "min9" }, { o: 5, q: "maj7" }, { o: 10, q: "maj7" }, { o: 0, q: "min9" },
      { o: 5, q: "maj7" }, { o: 8, q: "maj7" },
    ],
    kick: { p: "x.....x...x.....", g: 0.7 },
    snare: { p: "....o.......o..-", g: 0.36, opts: { snap: 30 } },
    hat: { p: "x.o.x.o.x.o.x.oo", g: 0.16 },
    pad: { g: 0.26 },
    pluckless: true,
    bassline: { p: [[0, 0, 6], [10, 0, 4]], g: 0.42, opts: { cut: 130, cutEnv: 300 } },
    energy: "low",
  },
  {
    id: "peak-energy",
    title: "Peak Energy",
    bpm: 140,
    bars: 8,
    seed: 1414,
    root: 57, // A minor peak driver
    progression: [
      { o: 0, q: "min" }, { o: 0, q: "min" }, { o: 8, q: "maj" }, { o: 10, q: "maj" },
    ],
    kick: { p: FOUR_FLOOR, g: 1.05, opts: { punch: 32, decay: 18 } },
    clap: { p: BACKBEAT, g: 0.6 },
    hat: { p: HATS_16, g: 0.3, f: { 7: "xxxxxxxxxxxxxxxx" } },
    stabs: { p: [[0, 1], [4, 1], [7, 1], [10, 1], [14, 1]], g: 0.48, opts: { bright: 3800, decay: 12 } },
    bassline: { p: [[2, 0, 1], [6, 0, 1], [10, 0, 1], [14, 0, 1]], g: 0.6, opts: { square: true } },
    energy: "high",
  },
  {
    id: "cooldown-groove",
    title: "Cooldown Groove",
    bpm: 80,
    bars: 6,
    seed: 1515,
    root: 53, // F, warm and slow
    progression: [
      { o: 0, q: "maj7" }, { o: 9, q: "min7" }, { o: 5, q: "maj7" }, { o: 7, q: "sus2" },
      { o: 0, q: "maj7" }, { o: 5, q: "maj7" },
    ],
    kick: { p: "x.......x.......", g: 0.55, opts: { punch: 14, decay: 11 } },
    shaker: { p: "..x...x...x...x.", g: 0.14 },
    pad: { g: 0.3 },
    arp: { p: "x.....x.....x...", order: [0, 2, 1], oct: 1, g: 0.26, decay: 6 },
    bassline: { p: [[0, 0, 8], [8, 0, 8]], g: 0.4, opts: { cut: 120, cutEnv: 250 } },
    energy: "low",
  },
];

/* ────────────────────────────────── main ───────────────────────────────── */

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let totalBytes = 0;
  for (const spec of TRACKS) {
    const pcm = renderTrack(spec);
    const file = path.join(OUT_DIR, `${spec.id}.wav`);
    const bytes = writeWav(file, pcm);
    totalBytes += bytes;
    const secs = (pcm.length / SR).toFixed(1);
    console.log(
      `✓ ${spec.id.padEnd(18)} ${String(spec.bpm).padStart(3)} BPM  ${secs.padStart(5)}s  ${(bytes / 1024).toFixed(0).padStart(4)} KB`,
    );
  }
  console.log(`\n${TRACKS.length} tracks, ${(totalBytes / (1024 * 1024)).toFixed(1)} MB total → ${OUT_DIR}`);
}

main();
