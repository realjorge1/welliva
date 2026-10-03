/**
 * VARIETY — a plan that stops serving the same three meals forever.
 *
 * Pins the reported bug ("on African vegetarian I can guess every meal the app
 * will pick — two breakfasts, two lunches, two dinners, forever") and the rules
 * that keep the fix honest: a dish stays in its slot, a borrowed dish stays
 * inside the diet, a restricted user is never served a guess, and the days
 * still add up to the target.
 *
 * Runs on the bundled diets only (the generated library is a remote catalog),
 * which is the harder case: fewer diets to borrow from.
 */
import { describe, expect, it } from "vitest";
import { DIET_DATABASE, type DietMealOption } from "../../../constants/DietDatabase";
import type { DaySchedule } from "../../../models/diet";
import type { UserBio } from "../../../models/user";
import { calculateDayNutrition, generateDietPlan } from "../../DietPlanGenerator";
import { calculateNutritionTargets } from "../../NutritionService";
import { breaksRestriction, dishKey, mealCuisine } from "../mealRules";
import { OPEN_DIETS, bagDraw, borrowSources, dayNumber } from "../mealVariety";

function bio(over: Partial<UserBio> = {}): UserBio {
  return {
    age: 30,
    sex: "female",
    heightCm: 168,
    weightKg: 78,
    activityLevel: "sedentary",
    exerciseLevel: "beginner",
    primaryGoal: "lose_weight",
    goals: ["lose_weight"],
    trainingEnabled: false,
    dietaryRestriction: "none",
    cuisinePreference: "african",
    equipment: ["none"],
    workoutDaysPerWeek: 3,
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    ...over,
  } as UserBio;
}

/** `n` consecutive dates from `from`, local calendar. */
function days(n: number, from = "2026-10-05"): string[] {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(y, m - 1, d + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}

function plan(b: UserBio, dates: string[], dietId?: string): DaySchedule[] {
  const targets = calculateNutritionTargets(b);
  return dates.map((date) => generateDietPlan(b, targets, date, dietId)!.schedule);
}

const MAINS = ["breakfast", "lunch", "dinner"] as const;
const distinct = (week: DaySchedule[], slot: (typeof MAINS)[number]) =>
  new Set(week.map((d) => dishKey(d[slot]!.name))).size;

const dietOf = (id: string) => DIET_DATABASE.find((d) => d.id === id)!;

describe("the rotation", () => {
  it("serves every dish once per cycle, in a fresh order each cycle", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const orders: string[] = [];
    for (let cycle = 0; cycle < 6; cycle++) {
      const drawn = items.map((_, i) => bagDraw(items, "seed", cycle * items.length + i));
      expect([...drawn].sort()).toEqual(items);
      orders.push(drawn.join(""));
    }
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("never draws the same item twice in a row, even across cycles", () => {
    for (const m of [2, 3, 4, 7, 12]) {
      const items = Array.from({ length: m }, (_, i) => `dish${i}`);
      for (let n = 1; n < 200; n++) {
        expect(bagDraw(items, `s${m}`, n), `m=${m} n=${n}`).not.toBe(bagDraw(items, `s${m}`, n - 1));
      }
    }
  });

  it("counts days by the calendar, untouched by daylight saving", () => {
    // Both of 2026's European DST switches, and an ordinary month end.
    for (const [a, b] of [
      ["2026-03-28", "2026-03-29"],
      ["2026-03-29", "2026-03-30"],
      ["2026-10-24", "2026-10-25"],
      ["2026-10-25", "2026-10-26"],
      ["2026-01-31", "2026-02-01"],
    ]) {
      expect(dayNumber(b!) - dayNumber(a!)).toBe(1);
    }
  });
});

describe("the meals a user is served", () => {
  it("are no longer the same few dishes forever", () => {
    // Was 3 breakfasts, 3 lunches, 3 dinners in four weeks — whatever the diet held.
    const month = plan(bio(), days(28), "traditional-african");
    expect(distinct(month, "breakfast")).toBeGreaterThanOrEqual(8);
    expect(distinct(month, "lunch")).toBeGreaterThanOrEqual(12);
    expect(distinct(month, "dinner")).toBeGreaterThanOrEqual(10);
  });

  it("give an Asian user a different plate most days of the month", () => {
    const month = plan(bio({ cuisinePreference: "asian" }), days(28), "traditional-asian");
    expect(distinct(month, "breakfast")).toBeGreaterThanOrEqual(8);
    expect(distinct(month, "lunch")).toBeGreaterThanOrEqual(8);
    expect(distinct(month, "dinner")).toBeGreaterThanOrEqual(8);
  });

  it("give an African vegetarian every breakfast their plan can offer, not two", () => {
    const b = bio({ dietaryRestriction: "vegetarian" });
    const month = plan(b, days(28), "vegetarian");
    const season = plan(b, days(112), "vegetarian");
    // Four weeks already reach every dish the rotation will ever serve…
    expect(distinct(month, "breakfast")).toBe(distinct(season, "breakfast"));
    expect(distinct(month, "breakfast")).toBeGreaterThanOrEqual(4);
    // …and every one of them is African and vegetarian.
    for (const day of season) {
      for (const slot of MAINS) {
        expect(mealCuisine(day[slot]!), day[slot]!.name).toBe("Nigerian");
        expect(breaksRestriction(day[slot]!.name, "vegetarian"), day[slot]!.name).toBe(false);
      }
    }
  });

  it("never serve a dish two days running, or one dish at lunch and dinner", () => {
    const profiles = [
      bio(),
      bio({ dietaryRestriction: "vegetarian" }),
      bio({ cuisinePreference: "mixed" }),
      bio({ cuisinePreference: "western", mealsPerDay: 4 }),
    ];
    for (const b of profiles) {
      for (const diet of DIET_DATABASE) {
        const run = plan(b, days(21), diet.id);
        run.forEach((day, i) => {
          const where = `${diet.id} ${day.date}`;
          expect(dishKey(day.lunch!.name), where).not.toBe(dishKey(day.dinner!.name));
          if (i === 0) return;
          for (const slot of MAINS) {
            const before = run[i - 1]![slot]!.name;
            // Only a diet with a single dish for the slot may repeat it.
            if (dishKey(before) === dishKey(day[slot]!.name)) {
              expect(distinct(run, slot), `${where} ${slot}`).toBe(1);
            }
          }
        });
      }
    }
  });

  it("are the same for the same day, every time", () => {
    const b = bio({ cuisinePreference: "mixed" });
    const first = plan(b, days(10), "mediterranean");
    const again = plan(b, days(10), "mediterranean");
    expect(again).toEqual(first);
  });

  it("still add up to the day's target", () => {
    const b = bio();
    const targets = calculateNutritionTargets(b);
    const month = plan(b, days(28), "traditional-african");
    const meanMiss =
      month.reduce((sum, day) => sum + Math.abs(calculateDayNutrition(day).calories - targets.calories), 0) /
      month.length /
      targets.calories;
    expect(meanMiss).toBeLessThan(0.12);
  });

  it("always fill all three main meals, for every diet and restriction", () => {
    for (const dietaryRestriction of ["none", "vegetarian", "vegan", "gluten_free", "dairy_free"] as const) {
      const b = bio({ dietaryRestriction, cuisinePreference: "mixed" });
      for (const diet of DIET_DATABASE) {
        for (const day of plan(b, days(3), diet.id)) {
          for (const slot of MAINS) expect(day[slot], `${diet.id} ${slot}`).toBeTruthy();
        }
      }
    }
  });
});

describe("staying inside the diet", () => {
  // Only the bundled diets: plans that live in the remote library contribute nothing here.
  const namesIn = (ids: string[], slot: (typeof MAINS)[number]) =>
    new Set(
      ids.flatMap((id) => {
        const diet = DIET_DATABASE.find((d) => d.id === id);
        if (!diet) return [];
        const options: DietMealOption[] =
          slot === "breakfast" ? diet.breakfastOptions : slot === "lunch" ? diet.lunchOptions : diet.dinnerOptions;
        return options.map((o) => o.name);
      }),
    );

  it("lets a clinical diet serve only what it was written with", () => {
    const b = bio({ cuisinePreference: "mixed" });
    for (const id of ["renal-friendly", "low-sodium", "diabetic-friendly", "ulcer-gerd-friendly"]) {
      for (const day of plan(b, days(21), id)) {
        for (const slot of MAINS) {
          expect(namesIn([id], slot).has(day[slot]!.name), `${id} borrowed "${day[slot]!.name}"`).toBe(true);
        }
      }
    }
  });

  it("borrows for a restricted user only from diets written for the restriction", () => {
    // Flexitarian may borrow — but for a vegetarian, only from vegetarian-authored plans,
    // because "Egusi" or a plain "Efo Riro" from anywhere else may be cooked with meat.
    const b = bio({ dietaryRestriction: "vegetarian" });
    const sources = ["flexitarian", ...borrowSources("flexitarian", "vegetarian")];
    for (const day of plan(b, days(28), "flexitarian")) {
      for (const slot of MAINS) {
        expect(namesIn(sources, slot).has(day[slot]!.name), `served "${day[slot]!.name}"`).toBe(true);
      }
    }
  });

  it("keeps keto keto: no borrowed dish carries more carbs than keto's own", () => {
    const keto = dietOf("keto");
    const carbShare = (o: { protein: { min: number; max: number }; carbs: { min: number; max: number }; fat: { min: number; max: number } }) => {
      const mid = (r: { min: number; max: number }) => (r.min + r.max) / 2;
      const p = 4 * mid(o.protein);
      const c = 4 * mid(o.carbs);
      const f = 9 * mid(o.fat);
      return c / (p + c + f);
    };
    const ceiling = Math.max(
      ...[...keto.breakfastOptions, ...keto.lunchOptions, ...keto.dinnerOptions].map(carbShare),
    );
    for (const day of plan(bio({ cuisinePreference: "mixed" }), days(28), "keto")) {
      for (const slot of MAINS) {
        const meal = day[slot]!;
        expect(
          carbShare({ protein: meal.proteinG, carbs: meal.carbsG, fat: meal.fatG }),
          meal.name,
        ).toBeLessThanOrEqual(ceiling + 0.05 + 1e-9);
      }
    }
  });

  it("keeps a diet named for a kitchen in that kitchen", () => {
    // Its own authored dishes are its own (a stir-fry with tofu is one of them);
    // anything it BORROWS must be West African.
    for (const day of plan(bio({ cuisinePreference: "mixed" }), days(28), "traditional-african")) {
      for (const slot of MAINS) {
        const meal = day[slot]!;
        if (namesIn(["traditional-african"], slot).has(meal.name)) continue;
        expect(mealCuisine(meal), meal.name).toBe("Nigerian");
      }
    }
  });
});

describe("which diets may share", () => {
  it("closes every clinical and premise plan", () => {
    for (const id of ["renal-friendly", "low-sodium", "gluten-free", "wellness-detox", "diabetic-friendly"]) {
      expect(OPEN_DIETS.has(id), id).toBe(false);
      expect(borrowSources(id), id).toEqual([]);
    }
  });

  it("opens an everyday diet to every other everyday diet", () => {
    const sources = borrowSources("mediterranean");
    expect(sources).not.toContain("mediterranean");
    expect(sources.length).toBe(OPEN_DIETS.size - 1);
  });

  it("narrows to the plans written for a restriction — the user's or the diet's own", () => {
    expect(borrowSources("flexitarian", "vegetarian").sort()).toEqual(
      ["vegan", "vegetarian", "whole-food-plant-based"].sort(),
    );
    expect(borrowSources("vegetarian")).toEqual(["vegan", "whole-food-plant-based"]);
    // Vegan diet, vegetarian user: the stricter of the two decides.
    expect(borrowSources("vegan", "vegetarian")).toEqual(["whole-food-plant-based"]);
    // Two restrictions with no plan written for both: nothing to borrow.
    expect(borrowSources("vegetarian", "kosher")).toEqual([]);
  });
});
