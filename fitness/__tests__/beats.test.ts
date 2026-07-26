/**
 * Beats — catalog integrity and the generated audio assets on disk.
 * (The require() asset map is Metro-only, so tests verify the files directly.)
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEATS, defaultBeatForEnergy, nextBeatId } from "@/fitness/data/beatMeta";

const BEATS_DIR = join(__dirname, "..", "..", "assets", "audio", "beats");

describe("beat catalog", () => {
  it("ships exactly 15 tracks with unique ids", () => {
    expect(BEATS).toHaveLength(15);
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(15);
  });

  it("covers every energy level", () => {
    const energies = new Set(BEATS.map((b) => b.energy));
    expect(energies).toEqual(new Set(["low", "medium", "high"]));
  });

  it("declares plausible workout tempos", () => {
    for (const b of BEATS) {
      expect(b.bpm).toBeGreaterThanOrEqual(70);
      expect(b.bpm).toBeLessThanOrEqual(160);
    }
  });

  it("has a generated WAV on disk for every track", () => {
    for (const b of BEATS) {
      const file = join(BEATS_DIR, `${b.id}.wav`);
      expect(existsSync(file), file).toBe(true);
      // Sanity: a real rendered loop, not an empty stub (> 100 KB).
      expect(statSync(file).size).toBeGreaterThan(100_000);
    }
  });

  it("picks a sensible default per energy and cycles tracks", () => {
    expect(defaultBeatForEnergy("low").energy).toBe("low");
    expect(defaultBeatForEnergy("high").energy).toBe("high");

    // next() walks the whole catalog and wraps.
    let id = BEATS[0].id;
    const seen = new Set<string>();
    for (let i = 0; i < BEATS.length; i++) {
      seen.add(id);
      id = nextBeatId(id);
    }
    expect(seen.size).toBe(BEATS.length);
    expect(id).toBe(BEATS[0].id);
  });
});
