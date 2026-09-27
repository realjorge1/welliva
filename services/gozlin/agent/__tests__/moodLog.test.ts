/**
 * review_mood_log — the one thing users tell the app about themselves that the
 * coach could not read, now readable: as a summary, never as a diary.
 */

import { describe, expect, it } from "vitest";
import type { GozlinCheckin } from "../../gozlin.types";
import { clampMoodDays, summarizeMood } from "../moodLog";
import { findTool, type GozlinToolContext } from "../tools";

const NOW = new Date("2026-09-27T12:00:00");

function entry(daysAgo: number, over: Partial<GozlinCheckin> = {}): GozlinCheckin {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date, kind: "daily", createdAt: d.getTime(), ...over };
}

describe("summarizeMood", () => {
  it("says there is nothing, rather than guessing, when nothing was logged", () => {
    const s = summarizeMood([], 14, NOW);
    expect(s.available).toBe(false);
    expect(s).toHaveProperty("note");
  });

  it("reads only the window asked for", () => {
    const s = summarizeMood([entry(1, { valence: 0.5 }), entry(20, { valence: -0.9 })], 14, NOW);
    expect(s.entries).toBe(1);
    expect(s.averageValence).toBe(0.5);
  });

  it("averages valence and names it on the log's own scale", () => {
    const s = summarizeMood(
      [entry(1, { valence: 0.6 }), entry(2, { valence: 0.4 }), entry(3, { valence: 0.5 })],
      14,
      NOW,
    );
    expect(s.averageValence).toBe(0.5);
    expect(typeof s.averageFeeling).toBe("string");
  });

  it("calls a trend only with enough entries, and calls it by direction", () => {
    const falling = summarizeMood(
      [
        entry(6, { valence: 0.7 }),
        entry(5, { valence: 0.6 }),
        entry(2, { valence: -0.2 }),
        entry(1, { valence: -0.4 }),
      ],
      14,
      NOW,
    );
    expect(falling.trend).toBe("falling");
    expect(summarizeMood([entry(1, { valence: 0.1 })], 14, NOW).trend).toBe("not enough entries");
  });

  it("answers 'is it work?' — average feeling per part of life", () => {
    const s = summarizeMood(
      [
        entry(1, { valence: -0.6, associations: ["work"] }),
        entry(2, { valence: -0.4, associations: ["work"] }),
        entry(3, { valence: 0.8, associations: ["family"] }),
      ],
      14,
      NOW,
    );
    const work = s.tiedTo!.find((t) => t.times === 2)!;
    expect(work.averageValence).toBe(-0.5);
  });

  it("counts stress from the pressure labels and from legacy stress scores", () => {
    const s = summarizeMood(
      [entry(1, { labels: ["Stressed"] }), entry(2, { stress: 5 }), entry(3, { labels: ["Calm"] })],
      14,
      NOW,
    );
    expect(s.stressedEntries).toBe(2);
  });

  it("summarises sleep when it was logged", () => {
    const s = summarizeMood(
      [entry(1, { sleepHours: 5 }), entry(2, { sleepHours: 8 }), entry(3, { sleepHours: 5.5 })],
      14,
      NOW,
    );
    expect(s.sleep).toEqual({ nights: 3, averageHours: 6.2, nightsUnder6h: 2 });
  });

  it("NEVER sends the free-text note — a diary line is not a summary", () => {
    const s = summarizeMood(
      [entry(1, { valence: -0.8, note: "fought with my sister again, can't sleep" })],
      14,
      NOW,
    );
    expect(JSON.stringify(s)).not.toContain("sister");
  });

  it("clamps the window to 7–60 days, defaulting to 14", () => {
    expect(clampMoodDays(undefined)).toBe(14);
    expect(clampMoodDays(2)).toBe(7);
    expect(clampMoodDays(365)).toBe(60);
  });
});

describe("the review_mood_log tool", () => {
  it("reads the check-ins already in the coach's context", () => {
    const ctx = {
      checkins: [entry(1, { valence: 0.5 })],
      now: NOW,
    } as unknown as GozlinToolContext;
    const out = findTool("review_mood_log")!.run({ days: 14 }, ctx) as { available: boolean };
    expect(out.available).toBe(true);
  });
});
