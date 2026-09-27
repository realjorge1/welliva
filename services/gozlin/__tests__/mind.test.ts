import { describe, expect, it } from "vitest";

import {
  MIND_ASSOCIATIONS,
  MIND_LABELS,
  STOP_COUNT,
  STRESS_LABELS,
  VALENCE_COLORS,
  VALENCE_STOPS,
  associationLabel,
  clampValence,
  labelsForValence,
  legacyMoodFromValence,
  valenceAtStop,
  valenceColor,
  readEntryValence,
  valenceFromLegacyMood,
  valenceLabel,
  valenceStopIndex,
} from "../mind";

describe("valence scale", () => {
  it("has a colour and a name for every stop", () => {
    expect(VALENCE_STOPS).toHaveLength(STOP_COUNT);
    expect(VALENCE_COLORS).toHaveLength(STOP_COUNT);
  });

  it("names the ends and the middle", () => {
    expect(valenceLabel(-1)).toBe("Very Unpleasant");
    expect(valenceLabel(0)).toBe("Neutral");
    expect(valenceLabel(1)).toBe("Very Pleasant");
  });

  it("clamps out-of-range input rather than extrapolating", () => {
    expect(clampValence(-9)).toBe(-1);
    expect(clampValence(9)).toBe(1);
    expect(valenceLabel(42)).toBe("Very Pleasant");
    expect(valenceColor(-42)).toBe(VALENCE_COLORS[0]);
  });

  it("round-trips every stop index through its exact valence", () => {
    for (let i = 0; i < STOP_COUNT; i++) {
      expect(valenceStopIndex(valenceAtStop(i))).toBe(i);
    }
  });

  it("puts the neutral stop exactly at zero", () => {
    // The chart draws gaps on the midline, so a real "Neutral" reading has to be
    // genuinely 0 rather than merely near it.
    expect(valenceAtStop(3)).toBe(0);
  });

  it("spans the ends without a gap", () => {
    expect(valenceAtStop(0)).toBe(-1);
    expect(valenceAtStop(STOP_COUNT - 1)).toBe(1);
  });

  it("clamps a stop index that is out of bounds", () => {
    expect(valenceAtStop(-5)).toBe(-1);
    expect(valenceAtStop(99)).toBe(1);
  });
});

describe("legacy 1–5 bridge", () => {
  it("maps the old scale onto the documented stops", () => {
    expect(valenceLabel(valenceFromLegacyMood(1))).toBe("Very Unpleasant");
    expect(valenceLabel(valenceFromLegacyMood(2))).toBe("Slightly Unpleasant");
    expect(valenceLabel(valenceFromLegacyMood(3))).toBe("Neutral");
    expect(valenceLabel(valenceFromLegacyMood(4))).toBe("Slightly Pleasant");
    expect(valenceLabel(valenceFromLegacyMood(5))).toBe("Very Pleasant");
  });

  it("is SYMMETRIC about neutral", () => {
    // The regression this pins: (mood − 3) / 2 gives ±0.5, which sits exactly
    // between two stops, and rounding sent both halves upward — mood 2 landed
    // one stop nearer neutral than mood 4 did, tilting every average upward.
    expect(valenceFromLegacyMood(2)).toBeCloseTo(-valenceFromLegacyMood(4), 10);
    expect(valenceFromLegacyMood(1)).toBeCloseTo(-valenceFromLegacyMood(5), 10);
    expect(valenceStopIndex(valenceFromLegacyMood(2))).toBe(
      STOP_COUNT - 1 - valenceStopIndex(valenceFromLegacyMood(4)),
    );
  });

  it("never claims the strong stops the old scale could not express", () => {
    // 1–5 cannot distinguish "unpleasant" from "slightly unpleasant", so the
    // milder reading is the honest one; claiming the stronger stop would
    // overstate what the user said.
    const stops = new Set(
      [1, 2, 3, 4, 5].map((m) => valenceLabel(valenceFromLegacyMood(m))),
    );
    expect(stops.has("Unpleasant")).toBe(false);
    expect(stops.has("Pleasant")).toBe(false);
    expect(stops.size).toBe(5);
  });

  it("round-trips back to the old scale", () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      expect(legacyMoodFromValence(valenceFromLegacyMood(mood))).toBe(mood);
    }
  });
});

describe("readEntryValence — the one bridge every surface uses", () => {
  it("prefers a stored valence", () => {
    expect(readEntryValence({ valence: 0.5, mood: 1 })).toBe(0.5);
  });

  it("falls back to a legacy mood", () => {
    expect(readEntryValence({ mood: 5 })).toBe(1);
    expect(readEntryValence({ mood: 2 })).toBeCloseTo(-1 / 3, 10);
  });

  it("returns null for a record with no feeling, never Neutral", () => {
    // Neutral is a real answer somebody chose. A sleep-only check-in has not
    // answered at all, and rendering it as Neutral would invent a reading.
    expect(readEntryValence({})).toBeNull();
    expect(readEntryValence({ valence: Number.NaN })).toBeNull();
  });

  it("clamps a corrupt stored valence instead of trusting it", () => {
    expect(readEntryValence({ valence: 12 })).toBe(1);
    expect(readEntryValence({ valence: -12 })).toBe(-1);
  });
});

describe("labels", () => {
  it("keeps every word available at every valence", () => {
    for (let i = 0; i < STOP_COUNT; i++) {
      expect(labelsForValence(valenceAtStop(i))).toHaveLength(MIND_LABELS.length);
    }
  });

  it("leads with pleasant words on the pleasant side", () => {
    const first = labelsForValence(1)[0];
    expect(first.polarity).toBe(1);
  });

  it("leads with unpleasant words on the unpleasant side", () => {
    const first = labelsForValence(-1)[0];
    expect(first.polarity).toBe(-1);
  });

  it("leaves the neutral stop in its original order", () => {
    // Nudging someone toward a polarity they explicitly did not pick would be
    // answering the question for them.
    expect(labelsForValence(0)).toEqual(MIND_LABELS);
  });

  it("has no duplicate words", () => {
    const values = MIND_LABELS.map((l) => l.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("draws every stress label from the real vocabulary", () => {
    const known = new Set(MIND_LABELS.map((l) => l.value));
    for (const s of STRESS_LABELS) expect(known).toContain(s);
  });

  it("treats stress as pressure, not merely as low feeling", () => {
    // Sad and Lonely are unpleasant but are not the under-load state that drives
    // stress eating; folding them in would blur the pattern the coach reports.
    expect(STRESS_LABELS.has("Sad")).toBe(false);
    expect(STRESS_LABELS.has("Lonely")).toBe(false);
    expect(STRESS_LABELS.has("Stressed")).toBe(true);
    expect(STRESS_LABELS.has("Overwhelmed")).toBe(true);
  });
});

describe("associations", () => {
  it("has unique keys", () => {
    const values = MIND_ASSOCIATIONS.map((a) => a.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("resolves a key to its display name", () => {
    expect(associationLabel("self_care")).toBe("Self-Care");
    expect(associationLabel("work")).toBe("Work");
  });

  it("falls back to the key itself for anything unrecognised", () => {
    // A stored association from a future build must not render as blank.
    expect(associationLabel("gardening")).toBe("gardening");
  });
});
