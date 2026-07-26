import { describe, expect, it } from "vitest";

import type { LifeEvent } from "../lifecontext/lifecontext.types";
import type { WeatherSnapshot } from "../signals/weather/openmeteo";
import {
  buildAnticipations,
  type AnticipationInput,
} from "../../services/gozlin/GozlinAnticipationEngine";
import type { GozlinTwin } from "../../services/gozlin/gozlin.types";
import type { UserBio } from "../../models/user";

const NOW = new Date(2026, 5, 29); // 2026-06-29 local

function twin(p: Partial<{ level: "green" | "amber" | "red"; score: number; flags: string[] }> = {}): GozlinTwin {
  return {
    recovery: { level: p.level ?? "green", score: p.score ?? 80 },
    flags: p.flags ?? [],
  } as unknown as GozlinTwin;
}

function bio(p: Partial<UserBio>): UserBio {
  return {
    age: 30,
    sex: "female",
    heightCm: 170,
    weightKg: 65,
    activityLevel: "moderate",
    exerciseLevel: "beginner",
    primaryGoal: "better_health",
    dietaryRestriction: "none",
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    ...p,
  } as UserBio;
}

function life(p: Partial<LifeEvent> & Pick<LifeEvent, "kind" | "window">): LifeEvent {
  return {
    id: "e1",
    title: "Event",
    source: "user",
    confidence: 1,
    status: "active",
    createdAt: "",
    updatedAt: "",
    expiresAt: "2099-01-01",
    ...p,
  } as LifeEvent;
}

function run(input: Partial<AnticipationInput>) {
  return buildAnticipations({
    twin: input.twin ?? twin(),
    bio: input.bio ?? null,
    lifeEvents: input.lifeEvents ?? [],
    healthConstraints: input.healthConstraints,
    weather: input.weather,
    weatherHint: input.weatherHint,
    now: NOW,
  });
}

const byId = (r: ReturnType<typeof run>, id: string) =>
  r.anticipations.find((a) => a.id === id);

describe("anticipation — modes", () => {
  it("normal when nothing is going on", () => {
    expect(run({}).mode).toBe("normal");
  });

  it("pregnancy → prenatal, and it outranks a travel event", () => {
    const r = run({
      bio: bio({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 }),
      lifeEvents: [life({ kind: "travel", title: "Rome", window: { start: "2026-07-01" } })],
    });
    expect(r.mode).toBe("prenatal");
  });

  it("competition within 10 days → event_taper", () => {
    const r = run({ lifeEvents: [life({ kind: "competition", title: "10k", window: { start: "2026-07-05" } })] });
    expect(r.mode).toBe("event_taper");
  });

  it("imminent travel → travel mode", () => {
    const r = run({ lifeEvents: [life({ kind: "travel", title: "Lagos", window: { start: "2026-07-01" } })] });
    expect(r.mode).toBe("travel");
  });

  it("red recovery → recovery mode", () => {
    expect(run({ twin: twin({ level: "red", score: 40 }) }).mode).toBe("recovery");
  });
});

describe("anticipation — health profile (time-aware)", () => {
  it("third-trimester guidance + due-date countdown, no add CTA when the date exists", () => {
    const r = run({
      bio: bio({ medicalConditions: ["pregnancy"], pregnancyTrimester: 3 }),
      lifeEvents: [life({ id: "due1", kind: "pregnancy_due", title: "Due", window: { start: "2026-08-10" } })],
    });
    const a = byId(r, "health_pregnancy")!;
    expect(a.message).toContain("Third trimester");
    expect(a.message).toContain("6 weeks"); // 2026-06-29 → 2026-08-10 ≈ 6 wks
    expect(a.cta).toBeUndefined();
    // the pregnancy_due life event must NOT also appear as a generic life card
    expect(byId(r, "life_due1")).toBeUndefined();
  });

  it("pregnancy with no due date prompts to add it", () => {
    const a = byId(run({ bio: bio({ medicalConditions: ["pregnancy"], pregnancyTrimester: 1 }) }), "health_pregnancy")!;
    expect(a.cta).toBe("Add your due date");
    expect(a.addKind).toBe("pregnancy_due");
  });

  it("injury becomes 'it's been N weeks' when a recovery date exists", () => {
    const r = run({
      bio: bio({ injuries: ["left wrist"] }),
      lifeEvents: [life({ kind: "illness_recovery", title: "wrist", window: { start: "2026-05-11" } })],
    });
    const a = byId(r, "health_injury")!;
    expect(a.message).toContain("left wrist");
    expect(a.message).toContain("7 weeks"); // 2026-05-11 → 2026-06-29 = 49 days
    expect(a.cta).toBeUndefined();
  });

  it("injury with no date prompts to log when it started", () => {
    const a = byId(run({ bio: bio({ injuries: ["knee"] }) }), "health_injury")!;
    expect(a.cta).toBe("Log when it started");
    expect(a.addKind).toBe("illness_recovery");
  });

  it("medication is category-aware and counts down to course end", () => {
    const r = run({
      bio: bio({ medicationCategories: ["antidepressants"] }),
      lifeEvents: [life({ kind: "medication_course", title: "course", window: { start: "2026-06-20", end: "2026-07-06" } })],
    });
    const a = byId(r, "health_medication")!;
    expect(a.message).toContain("antidepressants");
    expect(a.message).toContain("energy, sleep and mood");
    expect(a.message).toContain("7 days"); // → 2026-07-06
    expect(a.cta).toBeUndefined();
  });

  it("covers OTHER conditions (hypertension)", () => {
    const a = byId(run({ bio: bio({ medicalConditions: ["hypertension"] }) }), "health_condition_hypertension")!;
    expect(a).toBeDefined();
    expect(a.title).toMatch(/blood pressure/i);
  });

  it("considers free-text health facts the user told Gozlin (even with no bio)", () => {
    const a = byId(run({ bio: null, healthConstraints: ["asthma", "bad left knee"] }), "health_constraints")!;
    expect(a).toBeDefined();
    expect(a.message).toContain("asthma");
    expect(a.message).toContain("bad left knee");
  });
});

describe("anticipation — life events, weather, recovery", () => {
  it("templates a travel event with a countdown", () => {
    const a = byId(
      run({ lifeEvents: [life({ id: "t9", kind: "travel", title: "Tokyo", window: { start: "2026-07-20" } })] }),
      "life_t9",
    )!;
    expect(a.message).toContain("Tokyo");
    expect(a.message).toContain("in 21 days");
  });

  it("suggests indoor when rain meets a pending workout", () => {
    const weather = {
      tempC: 12, code: 61, condition: "Rain", icon: "rainy", group: "rain",
      highC: 14, lowC: 9, precipChance: 80, fetchedAt: NOW.toISOString(),
    } as WeatherSnapshot;
    const r = run({
      twin: twin({ flags: ["WORKOUT_PENDING"] }),
      weather,
      weatherHint: { indoor: true, reason: "High chance of rain (80%)." },
    });
    const a = byId(r, "weather_indoor")!;
    expect(a).toBeDefined();
    expect(a.cta).toBe("Make it indoor");
  });

  it("red recovery raises a recovery anticipation", () => {
    expect(byId(run({ twin: twin({ level: "red", score: 38 }) }), "recovery_red")).toBeDefined();
  });

  it("caps the list at six", () => {
    const r = run({
      bio: bio({
        medicalConditions: ["pregnancy", "hypertension", "diabetes_type2"],
        injuries: ["knee"],
        medicationCategories: ["thyroid"],
        pregnancyTrimester: 2,
      }),
      healthConstraints: ["asthma"],
      lifeEvents: [
        life({ id: "a", kind: "travel", title: "A", window: { start: "2026-07-02" } }),
        life({ id: "b", kind: "wedding", title: "B", window: { start: "2026-07-10" } }),
      ],
      twin: twin({ level: "red", score: 30 }),
    });
    expect(r.anticipations.length).toBeLessThanOrEqual(6);
  });
});
