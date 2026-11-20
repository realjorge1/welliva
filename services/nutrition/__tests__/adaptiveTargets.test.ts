/**
 * ADAPTIVE TARGETS — the learned burn, offered as her numbers (Fix 2, part 2).
 *
 * The owner's decision (2026-11-20): ask first, one tap, at most once a week.
 * These pin every gate, the blend and its limits, and the wording.
 */
import { describe, expect, it } from "vitest";

import { buildEvent } from "../../../health-os/timeline/events";
import type { BodyMeasurementPayload, NutritionDayClosedPayload } from "../../../health-os/timeline/catalog";
import { buildSeries, recentEvidence } from "../../../health-os/learning/engine";
import { initKalman, read, runFilter, type TdeeReading } from "../../../health-os/learning/tdee";
import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { calculateNutritionTargets, maintenanceTdee } from "../../NutritionService";
import { proteinBasisKg } from "../bodyWeight";
import {
  ADAPT_STEP_KCAL,
  blendedMaintenance,
  MIN_COMPLETE_DAYS,
  MIN_WEIGH_INS,
  proposeAdjustment,
} from "../adaptiveTargets";
import type { TargetOffer } from "../targetOffers";

const person = (o: Partial<UserBio> = {}): UserBio =>
  ({
    ...DEFAULT_USER_BIO,
    allergies: [],
    medicalConditions: [],
    foodDislikes: [],
    sex: "female",
    age: 34,
    heightCm: 168,
    weightKg: 80,
    activityLevel: "light",
    primaryGoal: "lose_weight",
    pace: "steady",
    ...o,
  }) as UserBio;

const reading = (o: Partial<TdeeReading> = {}): TdeeReading => ({
  learnedTdee: 1900,
  uncertainty: 80,
  filteredWeightKg: 80,
  confident: true,
  observations: 20,
  ...o,
});

const base = {
  knownIntakeDays28: 24,
  weighIns28: 12,
  offers: [] as TargetOffer[],
  today: "2026-11-20",
};

describe("the gates", () => {
  it("offers nothing until the model is confident", () => {
    expect(proposeAdjustment({ ...base, bio: person(), reading: reading({ confident: false }) })).toBeNull();
  });

  it("offers nothing on too few whole days or weigh-ins in the last 4 weeks", () => {
    expect(
      proposeAdjustment({ ...base, bio: person(), reading: reading(), knownIntakeDays28: MIN_COMPLETE_DAYS - 1 }),
    ).toBeNull();
    expect(proposeAdjustment({ ...base, bio: person(), reading: reading(), weighIns28: MIN_WEIGH_INS - 1 })).toBeNull();
  });

  it.each([
    ["under 18", person({ age: 17 })],
    ["pregnant", person({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 })],
    ["postpartum", person({ medicalConditions: ["postpartum"] })],
    ["underweight", person({ weightKg: 50 })],
  ] as const)("never offers an adaptive change when %s", (_label, bio) => {
    expect(proposeAdjustment({ ...base, bio, reading: reading({ learnedTdee: 1500 }) })).toBeNull();
  });

  it("at most once a week, whatever she answered, and never on top of a pending one", () => {
    const first = proposeAdjustment({ ...base, bio: person(), reading: reading() })!;
    expect(first).not.toBeNull();
    const declined = { ...first, status: "declined" as const };
    expect(proposeAdjustment({ ...base, bio: person(), reading: reading(), offers: [declined], today: "2026-11-25" })).toBeNull();
    expect(proposeAdjustment({ ...base, bio: person(), reading: reading(), offers: [declined], today: "2026-11-27" })).not.toBeNull();
    const pending = { ...first, date: "2026-10-01" };
    expect(proposeAdjustment({ ...base, bio: person(), reading: reading(), offers: [pending], today: "2026-11-27" })).toBeNull();
  });

  it("offers nothing when the move would be too small to explain", () => {
    const bio = person();
    const near = reading({ learnedTdee: maintenanceTdee(bio) + 10 });
    expect(proposeAdjustment({ ...base, bio, reading: near })).toBeNull();
  });
});

describe("the blend and its limits", () => {
  it("weighs the learned figure by its certainty", () => {
    const sure = blendedMaintenance(2000, 1800, 50);
    const unsure = blendedMaintenance(2000, 1800, 300);
    expect(sure).toBeLessThan(unsure);
    expect(unsure).toBeCloseTo(1900, 0); // equal certainty: halfway
  });

  it("never strays more than 25% from the formula", () => {
    expect(blendedMaintenance(2000, 900, 10)).toBe(1500);
    expect(blendedMaintenance(2000, 3500, 10)).toBe(2500);
  });

  it("one step never moves her target more than 150 kcal", () => {
    const bio = person();
    const offer = proposeAdjustment({ ...base, bio, reading: reading({ learnedTdee: 1300, uncertainty: 40 }) })!;
    expect(Math.abs(offer.to.calories - offer.from.calories)).toBeLessThanOrEqual(ADAPT_STEP_KCAL);
    expect(Math.abs(offer.change.maintenanceAdjustKcal!)).toBeLessThanOrEqual(ADAPT_STEP_KCAL);
  });

  it("the next step builds on the one she accepted", () => {
    const bio = person({ maintenanceAdjustKcal: -150 });
    const offer = proposeAdjustment({ ...base, bio, reading: reading({ learnedTdee: 1300, uncertainty: 40 }) })!;
    expect(offer.change.maintenanceAdjustKcal).toBe(-300);
  });

  it("the clinical pass still has the last word", () => {
    const bio = person({ medicalConditions: ["renal_issues"] });
    const offer = proposeAdjustment({ ...base, bio, reading: reading({ learnedTdee: 1500 }) })!;
    const accepted = calculateNutritionTargets({ ...bio, ...offer.change });
    expect(accepted.proteinG).toBeLessThanOrEqual(Math.round(proteinBasisKg(bio) * 0.8));
  });
});

describe("the sentence", () => {
  it("says what was watched, the numbers, and never calls it her metabolism", () => {
    const bio = person();
    const offer = proposeAdjustment({ ...base, bio, reading: reading({ learnedTdee: 1900 }) })!;
    expect(offer.message).toMatch(/I've watched 4 weeks of your meals and weigh-ins/);
    expect(offer.message).toMatch(/Going by what you log/);
    expect(offer.message).toContain(`${offer.from.calories.toLocaleString()} → ${offer.to.calories.toLocaleString()} kcal`);
    expect(offer.message).not.toMatch(/your metabolism is|slow metabolism/i);
  });
});

describe("an under-logger gets targets right for HER logging", () => {
  // She truly burns ~2,050 and eats 1,700, but logs 75% of it (1,275). The
  // model learns a burn ~430 low; the offer moves her target the same way, so
  // logging to the new target yields the deficit her pace asked for.
  const date = (i: number) => {
    const d = new Date(2026, 8, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const events = (() => {
    const out = [];
    let kg = 80;
    for (let i = 0; i < 56; i++) {
      out.push(
        buildEvent<NutritionDayClosedPayload>({
          type: "nutrition.day.closed",
          id: `d${i}`,
          localDate: date(i),
          payload: { dietId: "x", dietName: "x", mealsConsumed: 3, totalMeals: 3, status: "completed", consumedCalories: 1275, consumedProteinG: 70 },
        }),
      );
      kg += (1700 - 2050) / 7700;
      if (i % 2 === 0) {
        out.push(
          buildEvent<BodyMeasurementPayload>({
            type: "body.measurement.logged",
            id: `w${i}`,
            localDate: date(i),
            payload: { weightKg: Number((kg + [0.2, -0.3, 0.1, -0.1][i % 4]!).toFixed(1)) },
          }),
        );
      }
    }
    return out;
  })();

  it("lowers her number, explained as 'less', within the step", () => {
    const bio = person();
    const series = buildSeries(events, date(55), { targetKcal: calculateNutritionTargets(bio).calories });
    const state = runFilter(initKalman(80, maintenanceTdee(bio)), series.map((r) => ({ intakeKcal: r.intakeKcal, scaleKg: r.weightKg })));
    const ev = recentEvidence(series, 28);
    const offer = proposeAdjustment({
      ...base,
      bio,
      reading: read(state),
      knownIntakeDays28: ev.knownIntakeDays,
      weighIns28: ev.weighIns,
    })!;
    expect(read(state).learnedTdee).toBeLessThan(maintenanceTdee(bio));
    expect(offer.to.calories).toBeLessThan(offer.from.calories);
    expect(offer.message).toMatch(/kcal less than the formula/);
  });
});
