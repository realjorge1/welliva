import { describe, expect, it } from "vitest";
import type { UserBio } from "../../../models/user";
import { calculateNutritionTargets } from "../../NutritionService";
import { midpoint } from "../MealCatalog";
import {
  buildMenuDays,
  cycleDay,
  cycleDayIn,
  daysOf,
  dietDishesForSlot,
  dishesForSlot,
  emptyDraft,
  emptyWeek,
  picksFor,
  portionFor,
  toggleDishIn,
  weekdayIndex,
  weekdaysOf,
  withDish,
  withoutDish,
  type Dish,
  type MenuDraft,
} from "../menuBuilder";
import { mainSlotPool } from "../mealVariety";
import { DIET_DATABASE } from "../../../constants/DietDatabase";
import { breaksRestriction, mealCuisine } from "../mealRules";

function bio(over: Partial<UserBio> = {}): UserBio {
  return {
    age: 30,
    sex: "male",
    heightCm: 178,
    weightKg: 82,
    activityLevel: "moderate",
    exerciseLevel: "beginner",
    primaryGoal: "better_health",
    goals: ["better_health"],
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

describe("dishesForSlot", () => {
  it("lists only the chosen cuisine, one row per dish", () => {
    const dishes = dishesForSlot("breakfast", { cuisinePreference: "african" });
    expect(dishes.length).toBeGreaterThan(20);
    for (const d of dishes) expect(d.cuisine).toBe("Nigerian");
    const titles = dishes.map((d) => d.title);
    expect(new Set(titles.map((t) => t.toLowerCase())).size).toBe(titles.length);
    // Portions of one dish collapse into it rather than listing separately.
    const akaraPap = dishes.find((d) => d.title === "Akara + Pap");
    expect(akaraPap?.portions.length ?? 0).toBeGreaterThan(1);
  });

  it("never offers a dish that breaks the restriction or an allergy", () => {
    const filter = { cuisinePreference: "african" as const, dietaryRestriction: "vegetarian" as const, allergies: ["peanuts"] };
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      for (const d of dishesForSlot(slot, filter)) {
        for (const p of d.portions) {
          expect(breaksRestriction(p.name, "vegetarian"), p.name).toBe(false);
          expect(p.name.toLowerCase()).not.toMatch(/groundnut|peanut/);
        }
      }
    }
  });

  it("keeps staples apart from the cuisine, and has none under 'everything'", () => {
    for (const d of dishesForSlot("breakfast", { cuisinePreference: "african" }, "staples")) {
      expect(d.cuisine).toBe("Universal");
    }
    expect(dishesForSlot("breakfast", { cuisinePreference: "mixed" }, "staples")).toHaveLength(0);
  });
});

describe("portionFor", () => {
  it("serves the authored size nearest the slot's share of the day", () => {
    const dish = dishesForSlot("breakfast", { cuisinePreference: "african" }).find((d) => d.portions.length > 2)!;
    const small = portionFor(dish, 0);
    const large = portionFor(dish, 5000);
    expect(midpoint(small.calories)).toBe(midpoint(dish.portions[0].calories));
    expect(midpoint(large.calories)).toBe(midpoint(dish.portions[dish.portions.length - 1].calories));
  });
});

describe("the week", () => {
  it("gives a first pick every day", () => {
    expect(withDish(emptyWeek(), "a")).toEqual(Array(7).fill("a"));
  });

  it("alternates picks rather than splitting the week into blocks", () => {
    let week = withDish(emptyWeek(), "a");
    week = withDish(week, "b");
    const b = daysOf(week, "b");
    expect(b).toHaveLength(3);
    // No two of b's days are adjacent.
    for (let i = 1; i < b.length; i++) expect(b[i] - b[i - 1]).toBeGreaterThan(1);
  });

  it("stays balanced as picks come and go", () => {
    let week = withDish(emptyWeek(), "a");
    week = withDish(week, "b");
    week = withDish(week, "c");
    const counts = ["a", "b", "c"].map((k) => daysOf(week, k).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(week.every((k) => k !== null)).toBe(true);

    week = withoutDish(week, "b", ["a", "c"]);
    expect(daysOf(week, "b")).toHaveLength(0);
    expect(week.every((k) => k === "a" || k === "c")).toBe(true);

    week = withoutDish(withoutDish(week, "a", ["c"]), "c", []);
    expect(week.every((k) => k === null)).toBe(true);
  });

  it("cycles a tapped day through the picks and then Gozlin", () => {
    const week = withDish(emptyWeek(), "a");
    const one = cycleDay(week, 0, ["a", "b"]);
    expect(one[0]).toBe("b");
    const two = cycleDay(one, 0, ["a", "b"]);
    expect(two[0]).toBeNull();
    expect(cycleDay(two, 0, ["a", "b"])[0]).toBe("a");
  });

  it("reads weekdays Monday-first", () => {
    expect(weekdayIndex("2026-09-28")).toBe(0); // a Monday
    expect(weekdayIndex("2026-10-04")).toBe(6); // a Sunday
  });
});

describe("buildMenuDays", () => {
  const b = bio();
  const targets = calculateNutritionTargets(b);
  const dates = Array.from({ length: 14 }, (_, i) => `2026-10-${String(5 + i).padStart(2, "0")}`);

  function draftWith(slot: "breakfast" | "lunch" | "dinner", count: number): MenuDraft {
    const draft = emptyDraft();
    for (const dish of dishesForSlot(slot, { cuisinePreference: "african" }).slice(0, count)) {
      draft.dishes[dish.key] = dish;
      draft.weeks[slot] = withDish(draft.weeks[slot], dish.key);
    }
    return draft;
  }

  it("puts each picked dish on its weekdays, every week", () => {
    const draft = draftWith("breakfast", 2);
    const days = buildMenuDays({ draft, bio: b, targets, dates });
    for (const date of dates) {
      const key = draft.weeks.breakfast[weekdayIndex(date)]!;
      const breakfast = days[date].find((p) => p.slot === "breakfast")!;
      expect(draft.dishes[key].portions.map((p) => p.name)).toContain(breakfast.meal.name);
    }
  });

  it("fills every slot the user left open — in their cuisine — plus snacks", () => {
    const draft = draftWith("lunch", 1);
    const days = buildMenuDays({ draft, bio: b, targets, dates });
    for (const date of dates) {
      const slots = days[date].map((p) => p.slot);
      expect(slots).toEqual(expect.arrayContaining(["breakfast", "lunch", "dinner", "snack"]));
      for (const p of days[date].filter((x) => x.slot !== "snack")) {
        expect(mealCuisine(p.meal), p.meal.name).toBe("Nigerian");
      }
    }
  });

  it("plans nothing as already eaten", () => {
    const days = buildMenuDays({ draft: draftWith("dinner", 3), bio: b, targets, dates });
    for (const picks of Object.values(days)) {
      for (const p of picks) expect(p.meal.isConsumed).toBe(false);
    }
  });
});

describe("dietDishesForSlot — choosing from inside one diet", () => {
  it("offers only what that diet may serve, its own dishes first", () => {
    const filter = { cuisinePreference: "african" as const };
    const diet = DIET_DATABASE.find((d) => d.id === "traditional-african")!;
    const pool = new Set(mainSlotPool(diet, "lunch", {}).map((d) => `lunch:${d.key}`));
    const { dishes, staples } = dietDishesForSlot("lunch", "traditional-african", filter);
    expect(dishes.length).toBeGreaterThan(diet.lunchOptions.length / 2);
    for (const d of [...dishes, ...staples]) expect(pool.has(d.key), d.title).toBe(true);
    for (const d of dishes) expect(d.cuisine).toBe("Nigerian");
    // The diet's own lunches lead the list.
    const own = new Set(diet.lunchOptions.map((o) => o.name));
    expect(dishes[0]!.portions.some((p) => own.has(p.name))).toBe(true);
  });

  it("never offers a vegetarian a dish that breaks it, whichever diet they picked", () => {
    const filter = { cuisinePreference: "african" as const, dietaryRestriction: "vegetarian" as const };
    for (const id of ["flexitarian", "traditional-african", "vegetarian", "mediterranean"]) {
      for (const slot of ["breakfast", "lunch", "dinner"] as const) {
        const { dishes, staples } = dietDishesForSlot(slot, id, filter);
        for (const d of [...dishes, ...staples]) {
          for (const p of d.portions) expect(breaksRestriction(p.name, "vegetarian"), `${id}: ${p.name}`).toBe(false);
        }
      }
    }
  });

  it("leaves out what the user dislikes", () => {
    const { dishes } = dietDishesForSlot("breakfast", "traditional-african", {
      cuisinePreference: "african",
      foodDislikes: ["legume"],
    });
    for (const d of dishes) expect(d.title.toLowerCase()).not.toMatch(/bean|akara|moi-?moi/);
  });

  it("is empty for a diet that does not exist rather than throwing", () => {
    expect(dietDishesForSlot("dinner", "no-such-diet", {})).toEqual({ dishes: [], staples: [] });
  });
});

describe("a plan shorter than a week", () => {
  const dish = (key: string, slot: "breakfast" | "lunch" | "dinner" = "breakfast"): Dish => ({
    key: `${slot}:${key}`,
    title: key,
    slot,
    cuisine: "Nigerian",
    portions: [],
    reach: 1,
  });

  it("knows which weekdays it reaches", () => {
    // 2026-10-08 is a Thursday.
    expect(weekdaysOf(["2026-10-08"])).toEqual([3]);
    expect(weekdaysOf(["2026-10-08", "2026-10-09", "2026-10-10"])).toEqual([3, 4, 5]);
    const nine = Array.from({ length: 9 }, (_, i) => `2026-10-${String(5 + i).padStart(2, "0")}`);
    expect(weekdaysOf(nine)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("only ever puts a pick on a day the plan has", () => {
    const active = [3, 4, 5];
    let draft = emptyDraft();
    for (const k of ["akara", "pap", "moimoi"]) draft = toggleDishIn(draft, dish(k), 3, active);
    draft.weeks.breakfast.forEach((key, day) => {
      if (!active.includes(day)) expect(key, `day ${day}`).toBeNull();
    });
    // Three picks, three days: each gets one.
    for (const k of ["akara", "pap", "moimoi"]) {
      expect(daysOf(draft.weeks.breakfast, `breakfast:${k}`)).toHaveLength(1);
    }
  });

  it("swaps the one pick of a one-day plan instead of refusing the next", () => {
    let draft = toggleDishIn(emptyDraft(), dish("akara"), 1, [3]);
    draft = toggleDishIn(draft, dish("pap"), 1, [3]);
    expect(picksFor(draft, "breakfast").map((d) => d.key)).toEqual(["breakfast:pap"]);
    expect(draft.weeks.breakfast[3]).toBe("breakfast:pap");
  });

  it("refuses a pick past the cap when there is more than one to give", () => {
    let draft = emptyDraft();
    draft = toggleDishIn(draft, dish("akara"), 2, [3, 4]);
    draft = toggleDishIn(draft, dish("pap"), 2, [3, 4]);
    const full = toggleDishIn(draft, dish("moimoi"), 2, [3, 4]);
    expect(full).toBe(draft);
  });

  it("cycles a tapped day through the slot's own picks", () => {
    let draft = toggleDishIn(emptyDraft(), dish("akara"), 6);
    draft = toggleDishIn(draft, dish("pap"), 6);
    const day = draft.weeks.breakfast.findIndex((k) => k === "breakfast:akara");
    const next = cycleDayIn(draft, "breakfast", day);
    expect(next.weeks.breakfast[day]).toBe("breakfast:pap");
    // A slot with no picks is left alone.
    expect(cycleDayIn(draft, "dinner", 0)).toBe(draft);
  });
});
