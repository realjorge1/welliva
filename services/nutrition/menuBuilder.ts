/**
 * menuBuilder — "let me choose my own meals", as data.
 *
 * Onboarding offers two ways to plan meals: Gozlin plans every day from the
 * user's cuisine, or the user picks the dishes. This module is everything the
 * second answer needs that is not a screen:
 *
 *   1. DISHES, NOT PORTIONS. The catalog authors one dish several times at
 *      different sizes ("Akara (small) + Pap", "Akara (moderate) + Pap"). The
 *      user chooses the dish; we choose the portion that fits the slot's share
 *      of their calorie target (see {@link portionFor}). So the list they
 *      browse is about half as long, and nobody is asked to pick their own
 *      portion size before they have seen a single plan.
 *
 *   2. A WEEK, NOT A CALENDAR. Picks rotate across the seven weekdays and that
 *      rhythm repeats for however long they chose. Seven small decisions per
 *      meal instead of thirty-one, and every day is still editable later in the
 *      planner, which is where this menu is written.
 *
 *   3. NO GAPS. A weekday the user left to Gozlin — or a meal they skipped
 *      entirely — is filled from the same generator that plans a "plan it for
 *      me" day, in the same cuisine. Snacks too. A custom day that is missing
 *      its lunch would under-count the day it was meant to plan.
 *
 * Everything filters exactly as the generator does (mealRules): the cuisine
 * they chose, hard dietary restriction, allergies. A vegetarian is never shown
 * a dish they would then be served.
 */
import type { DietMealOption, MealCuisine } from "../../constants/DietDatabase";
import type { MealType, ScheduledMeal } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { CuisinePreference, DietaryRestriction, UserBio } from "../../models/user";
import {
  generateDietPlan,
  getMealCalorieSplit,
  mealOptionToScheduled,
} from "../DietPlanGenerator";
import type { MenuDayPick } from "../MealPlanService";
import { mealsForSlot, midpoint } from "./MealCatalog";
import {
  breaksRestriction,
  dishKey,
  dishTitle,
  hasAllergen,
  mealCuisine,
  preferredCuisine,
} from "./mealRules";

export type MainSlot = "breakfast" | "lunch" | "dinner";
export const MAIN_SLOTS: readonly MainSlot[] = ["breakfast", "lunch", "dinner"];

// ============================================================================
// DISHES
// ============================================================================

export interface Dish {
  /** `slot:dish` — unique within the catalog, stable across launches. */
  key: string;
  /** The dish without its portion notes: "Akara + Pap". */
  title: string;
  slot: MainSlot;
  cuisine: MealCuisine;
  /** Every authored size of this dish, smallest first. */
  portions: DietMealOption[];
  /** How many diets serve some version of it — a real measure of how standard it is. */
  reach: number;
}

export interface MenuFilter {
  cuisinePreference?: CuisinePreference;
  dietaryRestriction?: DietaryRestriction;
  allergies?: string[];
  foodDislikes?: string[];
}

/**
 * "cuisine" — the dishes of the kitchen the user chose (all of them under
 * "a bit of everything"). "staples" — the cuisine-neutral everyday options
 * (oats, eggs, salads), offered separately when the cuisine list runs short.
 */
export type DishScope = "cuisine" | "staples";

function allowed(name: string, filter: MenuFilter): boolean {
  if (breaksRestriction(name, filter.dietaryRestriction)) return false;
  if (hasAllergen(name, filter.allergies)) return false;
  const lower = name.toLowerCase();
  return !(filter.foodDislikes ?? []).some((d) => d.trim() && lower.includes(d.trim().toLowerCase()));
}

/** Every dish for a slot the user could be served, most widely-served first. */
export function dishesForSlot(
  slot: MainSlot,
  filter: MenuFilter,
  scope: DishScope = "cuisine",
): Dish[] {
  const want = preferredCuisine(filter.cuisinePreference);
  if (scope === "staples" && want === null) return [];

  const groups = new Map<string, { options: DietMealOption[]; diets: Set<string>; cuisine: MealCuisine }>();
  for (const idea of mealsForSlot(slot)) {
    if (idea.origin !== "diet") continue;
    const cuisine = mealCuisine(idea);
    if (scope === "cuisine" ? want !== null && cuisine !== want : cuisine !== "Universal") continue;
    if (!allowed(idea.name, filter)) continue;

    const k = dishKey(idea.name);
    if (!k) continue;
    const group = groups.get(k) ?? { options: [], diets: new Set<string>(), cuisine };
    group.options.push({
      name: idea.name,
      calories: idea.calories,
      protein: idea.protein,
      carbs: idea.carbs,
      fat: idea.fat,
      ...(idea.isNigerian ? { isNigerian: true } : {}),
      ...(idea.cuisine ? { cuisine: idea.cuisine } : {}),
    });
    idea.diets.forEach((d) => group.diets.add(d));
    groups.set(k, group);
  }

  const dishes: Dish[] = [];
  for (const [k, g] of groups) {
    const portions = [...g.options].sort((a, b) => midpoint(a.calories) - midpoint(b.calories));
    // The plainest-named version titles the dish: "Akara + Pap", not
    // "Akara (oven-baked) + Pap & Fresh Orange".
    const plainest = [...g.options].sort((a, b) => a.name.length - b.name.length)[0];
    dishes.push({
      key: `${slot}:${k}`,
      title: dishTitle(plainest.name),
      slot,
      cuisine: g.cuisine,
      portions,
      reach: g.diets.size,
    });
  }
  return dishes.sort((a, b) => b.reach - a.reach || a.title.localeCompare(b.title));
}

/** The authored size of a dish closest to the calories this slot should carry. */
export function portionFor(dish: Dish, targetKcal: number): DietMealOption {
  let best = dish.portions[0];
  let bestGap = Infinity;
  for (const p of dish.portions) {
    const gap = Math.abs(midpoint(p.calories) - targetKcal);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

/** Each main meal's share of the day's calories, exactly as the generator splits it. */
export function slotTargets(
  targets: Pick<NutritionTargets, "calories">,
  mealsPerDay: 3 | 4,
): Record<MainSlot, number> {
  const split = getMealCalorieSplit(targets.calories, mealsPerDay);
  return { breakfast: split.breakfast, lunch: split.lunch, dinner: split.dinner };
}

// ============================================================================
// THE WEEK — which dish lands on which weekday
// ============================================================================

/** Seven entries, MONDAY FIRST. A dish key, or null: "Gozlin picks this day". */
export type Week = (string | null)[];

export const DAYS_IN_WEEK = 7;

export function emptyWeek(): Week {
  return Array.from({ length: DAYS_IN_WEEK }, () => null);
}

/** Monday = 0 … Sunday = 6, for a local YYYY-MM-DD date. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** The weekdays a dish is on. */
export function daysOf(week: Week, key: string): number[] {
  return week.flatMap((k, i) => (k === key ? [i] : []));
}

const ringDistance = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, DAYS_IN_WEEK - d);
};

/**
 * Add a dish to the week, taking an even share of the days.
 *
 * Free days (left to Gozlin) are claimed first; after that the dish takes days
 * from whichever pick holds the most. Each claim goes to the candidate day
 * FARTHEST from the days the new dish already has, so two dishes alternate
 * rather than splitting the week into a block of each. Existing hand edits are
 * disturbed only as far as the new dish's share requires.
 */
export function withDish(week: Week, key: string): Week {
  const next = [...week];
  if (next.includes(key)) return next;

  const picks = [...new Set(next.filter((k): k is string => k !== null))];
  if (picks.length === 0 && next.every((k) => k === null)) {
    return next.map(() => key);
  }
  const share = Math.max(1, Math.floor(DAYS_IN_WEEK / (picks.length + 1)));

  for (let claimed = 0; claimed < share; claimed++) {
    const free = next.flatMap((k, i) => (k === null ? [i] : []));
    let candidates = free;
    if (candidates.length === 0) {
      const counts = picks
        .map((p) => ({ p, n: daysOf(next, p).length }))
        .filter((c) => c.n > 1)
        .sort((a, b) => b.n - a.n);
      if (counts.length === 0) break;
      candidates = daysOf(next, counts[0].p);
    }
    const mine = daysOf(next, key);
    const day =
      mine.length === 0
        ? candidates[Math.min(1, candidates.length - 1)]
        : candidates.reduce((best, c) =>
            Math.min(...mine.map((m) => ringDistance(c, m))) >
            Math.min(...mine.map((m) => ringDistance(best, m)))
              ? c
              : best,
          );
    next[day] = key;
  }
  return next;
}

/**
 * Take a dish off the week. Its days go to the remaining picks, fewest-days
 * first, so the week stays balanced; with nothing left they go back to Gozlin.
 */
export function withoutDish(week: Week, key: string, remaining: string[]): Week {
  const next = [...week];
  const freed = daysOf(next, key);
  for (const day of freed) {
    if (remaining.length === 0) {
      next[day] = null;
      continue;
    }
    const neediest = [...remaining].sort(
      (a, b) => daysOf(next, a).length - daysOf(next, b).length,
    )[0];
    next[day] = neediest;
  }
  return next;
}

/** A tap on a weekday: the next pick in order, then Gozlin, then round again. */
export function cycleDay(week: Week, day: number, picks: string[]): Week {
  const order: (string | null)[] = [...picks, null];
  const at = order.indexOf(week[day] ?? null);
  const next = [...week];
  next[day] = order[(at + 1) % order.length] ?? null;
  return next;
}

// ============================================================================
// WRITING IT DOWN
// ============================================================================

export interface MenuDraft {
  weeks: Record<MainSlot, Week>;
  /** The dishes the user picked, by key. Lookups only — order is the week's. */
  dishes: Record<string, Dish>;
}

export function emptyDraft(): MenuDraft {
  return {
    weeks: { breakfast: emptyWeek(), lunch: emptyWeek(), dinner: emptyWeek() },
    dishes: {},
  };
}

/** Picked dishes in one slot, in the order they were picked. */
export function picksFor(draft: MenuDraft, slot: MainSlot): Dish[] {
  return Object.values(draft.dishes).filter((d) => d.slot === slot);
}

export interface BuildMenuInput {
  draft: MenuDraft;
  bio: UserBio;
  targets: NutritionTargets;
  dates: string[];
  /** The eating style that fills the gaps — the diet the reveal showed. */
  dietId?: string;
}

/**
 * Every day of the menu, ready for {@link setCustomMenuDays}.
 *
 * A weekday with a picked dish gets that dish at the portion that fits; any
 * other slot, and every snack, comes from the generator's plan for that same
 * date — so a filled gap is exactly what "plan it for me" would have served.
 */
export function buildMenuDays(input: BuildMenuInput): Record<string, MenuDayPick[]> {
  const { draft, bio, targets, dates } = input;
  const per = slotTargets(targets, bio.mealsPerDay);
  const days: Record<string, MenuDayPick[]> = {};
  if (dates.length === 0) return days;

  // Resolve the eating style ONCE. Left to the generator, every date would
  // re-score the whole diet catalog to arrive at the same answer ninety times.
  const dietId = input.dietId ?? generateDietPlan(bio, targets, dates[0])?.diet.id;

  for (const date of dates) {
    const weekday = weekdayIndex(date);
    const generated = generateDietPlan(bio, targets, date, dietId)?.schedule ?? null;
    const picks: MenuDayPick[] = [];

    for (const slot of MAIN_SLOTS) {
      const key = draft.weeks[slot][weekday];
      const dish = key ? draft.dishes[key] : undefined;
      const meal: ScheduledMeal | null = dish
        ? mealOptionToScheduled(portionFor(dish, per[slot]), slot)
        : (generated?.[slot] ?? null);
      if (meal) picks.push({ slot, meal: { ...meal, mealType: slot, isConsumed: false } });
    }

    (generated?.snacks ?? []).forEach((snack, i) => {
      picks.push({
        slot: "snack" as MealType,
        snackIndex: i,
        meal: { ...snack, mealType: "snack", isConsumed: false },
      });
    });

    days[date] = picks;
  }
  return days;
}

/** How many of the week's main-meal slots the user filled themselves (0–21). */
export function pickedSlotCount(draft: MenuDraft): number {
  return MAIN_SLOTS.reduce((n, s) => n + draft.weeks[s].filter((k) => k !== null).length, 0);
}

// ============================================================================
// HOW LONG
// ============================================================================

export interface MenuLength {
  days: number;
  label: string;
}

/** The lengths offered. The week is the unit; these are how many times it repeats. */
export const MENU_LENGTHS: readonly MenuLength[] = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
];
