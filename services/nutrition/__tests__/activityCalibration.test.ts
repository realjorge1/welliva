/**
 * ACTIVITY CALIBRATION — her logged training offered as her activity level
 * (Fix 9, the owner's 2026-11-20 choice: suggest a level, one tap; never add
 * exercise calories back, which would count training twice).
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { calculateNutritionTargets } from "../../NutritionService";
import { levelForSessions, proposeActivityLevel, weeklySessions } from "../activityCalibration";
import type { TargetOffer } from "../targetOffers";

const TODAY = "2026-11-30"; // a Monday; the four closed weeks are Nov 2–29

const person = (o: Partial<UserBio> = {}): UserBio =>
  ({
    ...DEFAULT_USER_BIO,
    allergies: [],
    medicalConditions: [],
    foodDislikes: [],
    sex: "female",
    age: 32,
    heightCm: 168,
    weightKg: 68,
    activityLevel: "light",
    primaryGoal: "improve_fitness",
    ...o,
  }) as UserBio;

/** `perWeek[i]` sessions in week i (oldest first), spread over that week's days. */
const log = (perWeek: number[]) =>
  perWeek.flatMap((n, w) =>
    Array.from({ length: n }, (_, k) => {
      const d = new Date(2026, 10, 2 + w * 7 + k);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
    }),
  );

const propose = (bio: UserBio, perWeek: number[], extra: Partial<Parameters<typeof proposeActivityLevel>[0]> = {}) =>
  proposeActivityLevel({ bio, log: log(perWeek), offers: [], learningConfident: false, today: TODAY, ...extra });

describe("the ladder", () => {
  it("maps sessions a week onto the levels, never to 'very active'", () => {
    expect(levelForSessions(0.5)).toBe("sedentary");
    expect(levelForSessions(2)).toBe("light");
    expect(levelForSessions(4)).toBe("moderate");
    expect(levelForSessions(7)).toBe("active");
  });

  it("counts closed weeks only, never today", () => {
    expect(weeklySessions(log([4, 4, 4, 4]), TODAY)).toEqual([4, 4, 4, 4]);
  });
});

describe("who gets an offer", () => {
  it("a consistent trainer: four steady weeks of 4 sessions on 'light' → one step up, with her numbers", () => {
    const bio = person();
    const offer = propose(bio, [4, 4, 5, 4])!;
    expect(offer.change).toEqual({ activityLevel: "moderate" });
    expect(offer.to.calories).toBe(calculateNutritionTargets({ ...bio, activityLevel: "moderate" }).calories);
    expect(offer.to.calories).toBeGreaterThan(offer.from.calories);
    expect(offer.message).toMatch(/logged about 4\.5 workouts a week, which fits "moderate" better than "light"/);
  });

  it("one step at a time: a 'sedentary' daily trainer is offered 'light', not 'active'", () => {
    expect(propose(person({ activityLevel: "sedentary" }), [7, 6, 7, 7])!.change).toEqual({ activityLevel: "light" });
  });

  it("a step down when she logs every week, but less than her level", () => {
    expect(propose(person({ activityLevel: "active" }), [2, 2, 3, 2])!.change).toEqual({ activityLevel: "moderate" });
  });

  it("an irregular trainer gets nothing (bursts say more about logging than her week)", () => {
    expect(propose(person(), [6, 1, 6, 1])).toBeNull();
  });

  it("a lapsed trainer gets nothing (a week with no log is no evidence)", () => {
    expect(propose(person({ activityLevel: "moderate" }), [4, 4, 0, 0])).toBeNull();
  });

  it("someone who logged too little gets nothing", () => {
    expect(propose(person({ activityLevel: "moderate" }), [0, 1, 0, 1])).toBeNull();
  });

  it("'very active' (a physical job too) is never moved", () => {
    expect(propose(person({ activityLevel: "very_active" }), [1, 1, 1, 1])).toBeNull();
  });

  it("is silent once the learning model is confident (it measures the real burn)", () => {
    expect(propose(person(), [4, 4, 4, 4], { learningConfident: true })).toBeNull();
  });

  it.each([
    ["under 18", person({ age: 16 })],
    ["pregnant", person({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 })],
    ["underweight", person({ weightKg: 48 })],
  ] as const)("no adaptive change when %s", (_l, bio) => {
    expect(propose(bio, [5, 5, 5, 5])).toBeNull();
  });

  it("a declined offer is remembered for four weeks", () => {
    const first = propose(person(), [4, 4, 4, 4])!;
    const declined: TargetOffer = { ...first, status: "declined", date: "2026-11-20" };
    expect(propose(person(), [4, 4, 4, 4], { offers: [declined] })).toBeNull();
    expect(propose(person(), [4, 4, 4, 4], { offers: [{ ...declined, date: "2026-10-20" }] })).not.toBeNull();
  });
});
