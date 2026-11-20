/**
 * WEIGHT FOLLOW — her target follows her weight trend, in explained steps.
 *
 * The 2026-11-16 audit: weigh-ins from the quick-log card and Gozlin never
 * reached the weight her target is calculated from, so someone who lost 10 kg
 * kept eating her day-one number. These replay weigh-ins through the same pure
 * pass the app runs after every weigh-in (planWeightFollow) and hold it to:
 * moves happen, in steps, each explained once, and never on one noisy reading.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { DaySchedule } from "../../../models/diet";
import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { generateDietPlan } from "../../DietPlanGenerator";
import { calculateNutritionTargets } from "../../NutritionService";
import { KEYS } from "../../OfflineStorage";
import { getScheduleForDate, getStoredSchedules, saveDaySchedule } from "../../ScheduleService";
import { getIntakeForDate, recordFor, recordIntake } from "../IntakeLedger";
import { refitPlansToTargets } from "../retargetPlans";
import type { TargetOffer } from "../targetOffers";
import {
  addMove,
  makeMove,
  MOVES_CAP,
  planWeightFollow,
  RETARGET_KCAL,
  RETARGET_PROTEIN_G,
  type TargetMove,
} from "../weightRetarget";
import { weightTrend, type WeighInPoint } from "../weightTrend";

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

const date = (i: number, from = "2026-09-01") => {
  const [y, m, d] = from.split("-").map(Number);
  const x = new Date(y!, m! - 1, d! + i);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** Deterministic ±noise. */
const wobble = (i: number) => [0.3, -0.4, 0.1, 0.5, -0.2, -0.5, 0.2, 0.4, -0.3, 0][i % 10]!;

/**
 * Ten weeks, 80 → 70 kg, a weigh-in every other day on a wobbling scale.
 * Each weigh-in runs the real pass against the bio as the last move left it.
 */
function replay(opts: { spikeOn?: number } = {}) {
  let bio = person();
  const readings: WeighInPoint[] = [];
  const moves: TargetMove[] = [];
  const movedOn: number[] = [];
  const offers: TargetOffer[] = [];
  for (let i = 0; i <= 70; i += 2) {
    const trueKg = 80 - (10 * i) / 70;
    const kg = i === opts.spikeOn ? trueKg - 4 : trueKg + wobble(i);
    readings.push({ date: date(i), kg: Math.round(kg * 10) / 10 });
    const plan = planWeightFollow({ bio, readings, offers, today: date(i), now: new Date(2026, 8, 1 + i, 9) });
    if (plan.decision && plan.move) {
      moves.push(plan.move);
      movedOn.push(i);
      bio = plan.decision.nextBio;
    }
  }
  return { bio, moves, movedOn };
}

describe("the 80 → 70 kg replay (Fix 1 acceptance)", () => {
  it("moves her calorie and protein targets along the way", () => {
    // The whole 10 kg is worth 1,671 → 1,561 kcal for her (steady pace).
    // The trend trails the scale a little and a move waits until it is worth
    // a sentence, so the last step lands within one threshold of the end.
    const start = calculateNutritionTargets(person());
    const atSeventy = calculateNutritionTargets(person({ weightKg: 70 }));
    const { bio } = replay();
    const end = calculateNutritionTargets(bio);
    expect(end.calories).toBeLessThanOrEqual(start.calories - 70);
    expect(end.calories - atSeventy.calories).toBeLessThan(RETARGET_KCAL + 15);
    expect(end.proteinG).toBeLessThan(start.proteinG - 10);
    // At 1 kg a week the trend runs ~1.3 kg behind the scale (a 10%/day
    // smoothing), and a move waits for ~2 kg of change: most of the way.
    expect(bio.weightKg).toBeLessThan(74);
  });

  it("moves in steps, never by a trivial amount", () => {
    const { moves } = replay();
    expect(moves.length).toBeGreaterThanOrEqual(3);
    for (const m of moves) {
      const big =
        Math.abs(m.to.calories - m.from.calories) >= RETARGET_KCAL ||
        Math.abs(m.to.proteinG - m.from.proteinG) >= RETARGET_PROTEIN_G;
      expect(big, m.message).toBe(true);
    }
  });

  it("explains every move once, with the real numbers", () => {
    const { moves } = replay();
    expect(new Set(moves.map((m) => m.id)).size).toBe(moves.length);
    for (const m of moves) {
      expect(m.seen).toBe(false);
      expect(m.message).toMatch(/You've lost \d+\.\d kg, so I updated your numbers/);
      expect(m.message).toContain(m.from.calories.toLocaleString());
      expect(m.message).toContain(m.to.calories.toLocaleString());
      expect(m.message).not.toMatch(/correct/i); // a weight move is not "a correction"
    }
  });

  it("never moves on a single noisy reading", () => {
    // A reading 4 kg low on day 30: the typo guard holds it, nothing confirms
    // it, so the moves are exactly those of the run without it.
    const plain = replay();
    const spiked = replay({ spikeOn: 30 });
    expect(spiked.movedOn).toEqual(plain.movedOn);
    expect(spiked.bio.weightKg).toBe(plain.bio.weightKg);
  });
});

describe("the trend", () => {
  it("drops a typo outright (760 for 76.0)", () => {
    const t = weightTrend([
      { date: date(0), kg: 76 },
      { date: date(1), kg: 760 },
      { date: date(2), kg: 75.8 },
    ]);
    expect(t.rejected.map((r) => r.kg)).toContain(760);
    expect(t.trendKg!).toBeGreaterThan(75.5);
    expect(t.trendKg!).toBeLessThan(76.1);
  });

  it("treats two weigh-ins on one day as one (the later)", () => {
    const t = weightTrend([
      { date: date(0), kg: 76 },
      { date: date(1), kg: 76.4 },
      { date: date(1), kg: 75.9 },
    ]);
    expect(t.path).toHaveLength(2);
  });

  it("lets a reading after a long gap count for more", () => {
    const close = weightTrend([{ date: date(0), kg: 80 }, { date: date(1), kg: 78 }]).trendKg!;
    const gap = weightTrend([{ date: date(0), kg: 80 }, { date: date(30), kg: 78 }]).trendKg!;
    expect(80 - gap).toBeGreaterThan(80 - close);
    expect(gap).toBeLessThan(78.2); // 30 days: the trend has nearly caught up
  });

  it("accepts a real jump once a second reading agrees", () => {
    const t = weightTrend([
      { date: date(0), kg: 80 },
      { date: date(1), kg: 73 },
      { date: date(2), kg: 73.2 },
    ]);
    expect(t.rejected).toHaveLength(0);
    expect(t.trendKg!).toBeLessThan(80);
  });

  it("down-weights a water day, never invents it away", () => {
    const readings = [
      { date: date(0), kg: 70 },
      { date: date(1), kg: 70 },
      { date: date(2), kg: 71.5 },
    ];
    const plain = weightTrend(readings).trendKg!;
    const told = weightTrend(readings, { noisyDates: [date(2)] }).trendKg!;
    expect(told).toBeLessThan(plain);
    expect(told).toBeGreaterThan(70); // still a reading
  });

  it("restarts from an explicit Profile weight", () => {
    const t = weightTrend([
      { date: date(0), kg: 90 },
      { date: date(5), kg: 89 },
      { date: date(6), kg: 82, explicit: true },
    ]);
    expect(t.trendKg).toBe(82);
  });
});

describe("who never moves by themselves", () => {
  it.each([
    ["pregnancy", person({ medicalConditions: ["pregnancy"], pregnancyTrimester: 2 })],
    ["postpartum", person({ medicalConditions: ["postpartum"] })],
    ["under 18", person({ age: 17 })],
    ["underweight", person({ weightKg: 50 })], // BMI 17.7
  ] as const)("%s", (_label, bio) => {
    const plan = planWeightFollow({
      bio,
      readings: [{ date: date(0), kg: bio.weightKg - 3 }],
      offers: [],
      today: date(0),
      now: new Date(),
    });
    expect(plan.decision).toBeNull();
  });
});

describe("near her goal, the cut halves (taper)", () => {
  it("switches the taper on within 2 kg and says so", () => {
    const bio = person({ weightKg: 66 });
    const plan = planWeightFollow({
      bio,
      goalWeightKg: 64.5,
      readings: [{ date: date(0), kg: 66 }],
      offers: [],
      today: date(0),
      now: new Date(),
    });
    expect(plan.decision?.nextBio.nearGoalTaper).toBe(true);
    expect(plan.move!.message).toMatch(/within 2 kg of your goal weight, so I've halved your calorie cut/);
    expect(plan.decision!.after.calories).toBeGreaterThan(plan.decision!.before.calories);
  });
});

describe("the pace guard", () => {
  // 1.2 kg a week off 80 kg: faster than 1% a week, for three weeks and more.
  const fast = Array.from({ length: 29 }, (_, i) => ({ date: date(i), kg: Math.round((80 - (1.2 * i) / 7) * 10) / 10 }));

  it("offers once to ease up, calmly", () => {
    const bio = person({ weightKg: 75.3, pace: "faster" });
    const plan = planWeightFollow({ bio, readings: fast, offers: [], today: date(28), now: new Date() });
    expect(plan.offer).not.toBeNull();
    expect(plan.offer!.change).toEqual({ pace: "steady" });
    expect(plan.offer!.to.calories).toBeGreaterThan(plan.offer!.from.calories);
    expect(plan.offer!.message).toMatch(/faster than about 1% a week for three weeks/);
    expect(plan.offer!.message).not.toMatch(/too well|great job|amazing/i);
  });

  it("stays quiet for 8 weeks after offering, whatever she answered", () => {
    const bio = person({ weightKg: 75.3, pace: "faster" });
    const first = planWeightFollow({ bio, readings: fast, offers: [], today: date(28), now: new Date() });
    const declined = { ...first.offer!, status: "declined" as const };
    const again = planWeightFollow({ bio, readings: fast, offers: [declined], today: date(40), now: new Date() });
    expect(again.offer).toBeNull();
  });

  it("is silent at a sustainable pace", () => {
    const slow = Array.from({ length: 29 }, (_, i) => ({ date: date(i), kg: Math.round((80 - (0.5 * i) / 7) * 10) / 10 }));
    const plan = planWeightFollow({ bio: person({ weightKg: 78 }), readings: slow, offers: [], today: date(28), now: new Date() });
    expect(plan.offer).toBeNull();
  });
});

describe("two phones", () => {
  it("the same move made on both phones is one record; the list stays capped", () => {
    const before = { calories: 1760, proteinG: 110 };
    const after = { calories: 1720, proteinG: 106 };
    const phone = makeMove("weight", "2026-11-10", before, after, "You've lost 2.4 kg…", new Date(2026, 10, 10, 8));
    const tablet = makeMove("weight", "2026-11-10", before, after, "You've lost 2.4 kg…", new Date(2026, 10, 10, 8, 5));
    expect(phone.id).toBe(tablet.id);
    let list = addMove([], phone);
    list = addMove(list, tablet);
    expect(list).toHaveLength(1);
    for (let i = 0; i < 20; i++) {
      list = addMove(list, makeMove("weight", date(i), before, { calories: 1700 - i, proteinG: 100 }, "…", new Date(2026, 8, 1 + i)));
    }
    expect(list).toHaveLength(MOVES_CAP);
  });
});

describe("refitting plans never touches what she already ate", () => {
  const today = "2026-11-20";
  const bio = person();

  beforeEach(async () => {
    await AsyncStorage.removeItem(KEYS.SCHEDULED_DIETS);
    await AsyncStorage.removeItem(KEYS.INTAKE_LEDGER);
  });

  const planFor = (d: string): DaySchedule => generateDietPlan(bio, calculateNutritionTargets(bio), d)!.schedule;

  it("leaves a day with a ticked meal exactly as it was", async () => {
    const day = planFor(today);
    day.breakfast = { ...day.breakfast!, isConsumed: true, consumedAt: `${today}T08:00:00.000Z` };
    await saveDaySchedule(day);
    await recordIntake(today, recordFor(day.breakfast!, "breakfast", `${today}T08:00:00.000Z`));

    const lighter = calculateNutritionTargets({ ...bio, weightKg: 72 });
    await refitPlansToTargets({ ...bio, weightKg: 72 }, lighter, today);

    const after = await getScheduleForDate(today);
    expect(after!.breakfast!.name).toBe(day.breakfast!.name);
    expect(after!.breakfast!.isConsumed).toBe(true);
    expect(after!.lunch!.name).toBe(day.lunch!.name);
    expect(await getIntakeForDate(today)).toHaveLength(1);
  });

  it("resizes the days to come in place — same dishes — and leaves her picked menu alone", async () => {
    // Changed deliberately (Phase 5): days to come used to be DROPPED and
    // rebuilt by the rollover; they are now resized, so an AI-written day keeps
    // its dishes and costs no new request.
    await saveDaySchedule(planFor(today));
    const generated = planFor("2026-11-21");
    const picked = { ...planFor("2026-11-22"), dietId: "custom-menu", dietName: "Your menu" };
    await saveDaySchedule(generated);
    await saveDaySchedule(picked);

    const heavier = { ...bio, weightKg: 95 };
    await refitPlansToTargets(heavier, calculateNutritionTargets(heavier), today);

    const stored = await getStoredSchedules(["2026-11-21", "2026-11-22"]);
    const resized = stored.get("2026-11-21")!;
    expect(resized.breakfast!.name).toBe(generated.breakfast!.name);
    expect(resized.lunch!.name).toBe(generated.lunch!.name);
    expect(resized.dinner!.name).toBe(generated.dinner!.name);
    expect(stored.get("2026-11-22")).toEqual(picked);
  });
});
