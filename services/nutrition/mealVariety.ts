/**
 * mealVariety — what a planned day may be made of, and the order it comes round in.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * The day generator sorted a slot's options by distance from the calorie target
 * and picked one of the THREE closest. The catalog authors one dish at several
 * sizes ("Akara (small) + Pap", "Akara (moderate) + Pap"), so those three were
 * usually two dishes: over 28 days an African vegetarian was served two or three
 * breakfasts while their diet held nineteen, and could name tomorrow's plate
 * before it arrived. Every diet, every cuisine, the same.
 *
 * ── WHAT A SLOT MAY SERVE (the pool) ────────────────────────────────────────
 *  1. The diet's own options — always, in full.
 *  2. Dishes BORROWED from other diets, when the diet is an everyday pattern
 *     (OPEN_DIETS) and the dish stays inside it:
 *       • the same slot — a breakfast is never served as a dinner;
 *       • the diet's macro character: the protein/carb/fat energy shares of its
 *         own options, padded a little, so keto stays keto and a high-protein
 *         plan stays high-protein;
 *       • a diet named for a kitchen borrows only from that kitchen;
 *       • under a restriction (the user's, or the diet's own) only from diets
 *         WRITTEN for it — see WRITTEN_FOR for why a name check is not enough.
 *  3. The user's hard rules over everything: restriction and allergies never
 *     relax. Dislikes and cuisine narrow the pool without ever starving it.
 *
 * ── IN WHAT ORDER (the rotation) ────────────────────────────────────────────
 * A shuffle-bag per slot, indexed by the calendar day: the dishes in a seeded
 * order, one per day, and every dish comes round once before any comes round
 * twice. It is stateless — any date computes its own dish — so the onboarding
 * preview, the midnight rollover and a ninety-day menu all agree on Tuesday. A
 * new cycle never opens on the dish the last one closed with, and lunch and
 * dinner never serve the same dish on one day.
 *
 * ── HOW MUCH (the portion) ──────────────────────────────────────────────────
 * The rotation picks the DISH; the portion is the authored size closest to what
 * the day still needs, so a heavier breakfast makes for a lighter lunch and the
 * day lands near its target even though the dishes vary.
 */
import {
  DIET_DATABASE,
  type DietData,
  type DietMealOption,
  type DietSnackOption,
  type MealCuisine,
} from "../../constants/DietDatabase";
import type { MealType } from "../../models/diet";
import type { DietaryRestriction, UserBio } from "../../models/user";
import { mealsForSlot } from "./MealCatalog";
import {
  CUISINE_NAMED_DIETS,
  breaksRestriction,
  cuisineTiers,
  dishKey,
  hasAllergen,
  hasDislike,
  mealCuisine,
} from "./mealRules";

export type Option = DietMealOption | DietSnackOption;
export type MainSlot = "breakfast" | "lunch" | "dinner";

// ============================================================================
// WHICH DIETS MAY SHARE
// ============================================================================

/**
 * Everyday eating patterns — the diets whose identity a meal's name and macros
 * can actually show: a restriction (vegetarian, halal…), a macro shape (keto,
 * high-protein…), a kitchen (traditional African), or nothing beyond balance
 * (everyday, budget…). Only these borrow, and only from each other.
 *
 * Left out on purpose:
 *  • every clinical diet — sodium, potassium, purines, FODMAPs and texture are
 *    invisible in a name and in four macros, so a borrowed dish could break the
 *    very rule the diet exists for;
 *  • the premise plans (no-added-sugar, debloat-light, whole-food-reset,
 *    wellness-detox, blue-zones, paleo) — their premise is about ingredients no
 *    name check can verify.
 * Those still rotate through EVERY one of their own options, which alone is
 * several times the variety the old top-three pick gave them.
 */
export const OPEN_DIETS: ReadonlySet<string> = new Set([
  // Core & popular
  "mediterranean", "calorie-counting", "keto", "low-carb", "intermittent-fasting",
  "flexitarian", "high-protein", "weight-gain",
  // Ethical, cultural & plant-based
  "vegetarian", "vegan", "pescatarian", "halal", "kosher", "whole-food-plant-based",
  "traditional-african", "traditional-asian",
  // Fitness & body composition
  "bodybuilding", "cutting-fat-loss", "athlete-endurance", "strength-athlete",
  "post-workout-recovery",
  // Lifestyle & goal-based
  "clean-eating", "metabolism-lean", "glow-skin", "budget-balanced", "meal-prep",
  "family-balanced", "student-quick", "healthy-weight-gain", "mindful-eating",
  "high-energy-vitality", "everyday-balanced", "weight-loss", "gluten-free-lifestyle",
  "lactose-free-lifestyle",
]);

/** Diets that ARE a restriction — what defines them is what they leave out. */
const DIET_RESTRICTION: Readonly<Record<string, DietaryRestriction>> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  "whole-food-plant-based": "vegan",
  pescatarian: "pescatarian",
  halal: "halal",
  kosher: "kosher",
  "gluten-free-lifestyle": "gluten_free",
  "lactose-free-lifestyle": "dairy_free",
};

/**
 * The diets WRITTEN for a restriction — the only safe source of borrowed dishes
 * under it.
 *
 * A name shows what it says and nothing more. Fifty Nigerian dishes in the
 * catalog pass the vegetarian name check while being, as cooked, meat or fish
 * dishes: "Ofada Rice + Ayamase", "Eba + Egusi", a plain "Efo Riro". Inside a
 * plan authored vegetarian those dishes were written meatless ("Efo Riro (no
 * meat/fish)"); borrowed from anywhere else, they are a guess. So a restricted
 * plate borrows only from plans authored to the restriction.
 */
const WRITTEN_FOR: Readonly<Record<Exclude<DietaryRestriction, "none">, readonly string[]>> = {
  vegetarian: ["vegetarian", "vegan", "whole-food-plant-based"],
  vegan: ["vegan", "whole-food-plant-based"],
  pescatarian: ["pescatarian", "vegetarian", "vegan", "whole-food-plant-based"],
  halal: ["halal"],
  kosher: ["kosher"],
  gluten_free: ["gluten-free", "gluten-free-lifestyle"],
  dairy_free: ["dairy-free", "lactose-free-lifestyle", "vegan", "whole-food-plant-based"],
};

/** The diets a diet may borrow dishes from, for this user. Empty when it may not borrow. */
export function borrowSources(dietId: string, restriction?: DietaryRestriction): string[] {
  if (!OPEN_DIETS.has(dietId)) return [];
  const rules = [DIET_RESTRICTION[dietId], restriction].filter(
    (r): r is Exclude<DietaryRestriction, "none"> => !!r && r !== "none",
  );
  const sources =
    rules.length === 0
      ? [...OPEN_DIETS]
      : rules
          .map((r) => [...WRITTEN_FOR[r]])
          .reduce((acc, list) => acc.filter((id) => list.includes(id)));
  return sources.filter((id) => id !== dietId);
}

// ============================================================================
// THE DIET'S MACRO CHARACTER
// ============================================================================

interface Shares {
  p: number;
  c: number;
  f: number;
}

interface Envelope {
  lo: Shares;
  hi: Shares;
}

/** How far outside its own options' range a borrowed dish may sit, per share. */
const ENVELOPE_PAD = 0.05;

const mid = (r: { min: number; max: number }) => (r.min + r.max) / 2;

/** Protein/carb/fat shares of the energy a portion's macros account for. */
function sharesOf(o: Option): Shares | null {
  if (!o.protein || !o.carbs || !o.fat) return null;
  const p = 4 * mid(o.protein);
  const c = 4 * mid(o.carbs);
  const f = 9 * mid(o.fat);
  const total = p + c + f;
  return total > 0 ? { p: p / total, c: c / total, f: f / total } : null;
}

function envelopeOf(options: readonly Option[]): Envelope | null {
  let env: Envelope | null = null;
  for (const o of options) {
    const s = sharesOf(o);
    if (!s) continue;
    if (!env) {
      env = { lo: { ...s }, hi: { ...s } };
      continue;
    }
    env.lo = { p: Math.min(env.lo.p, s.p), c: Math.min(env.lo.c, s.c), f: Math.min(env.lo.f, s.f) };
    env.hi = { p: Math.max(env.hi.p, s.p), c: Math.max(env.hi.c, s.c), f: Math.max(env.hi.f, s.f) };
  }
  return env;
}

function fitsEnvelope(o: Option, env: Envelope): boolean {
  const s = sharesOf(o);
  if (!s) return false;
  return (["p", "c", "f"] as const).every(
    (k) => s[k] >= env.lo[k] - ENVELOPE_PAD && s[k] <= env.hi[k] + ENVELOPE_PAD,
  );
}

// ============================================================================
// THE POOL
// ============================================================================

/** One dish a slot may serve, however many sizes it is authored at. */
export interface PoolDish<T extends Option = Option> {
  /** {@link dishKey} — the comparison identity. */
  key: string;
  /** The plainest (shortest) authored name — what a list should title it. */
  name: string;
  cuisine: MealCuisine;
  /** Every authored size, smallest first. */
  portions: T[];
  /** Authored by this diet, as opposed to borrowed. */
  own: boolean;
  /** How many diets in the catalog serve some version of it — how standard it is. */
  reach: number;
}

/** The user's rules that never relax. */
export interface HardRules {
  restriction?: DietaryRestriction;
  allergies?: string[];
}

function slotOptions(diet: DietData, slot: MealType): Option[] {
  switch (slot) {
    case "breakfast":
      return diet.breakfastOptions ?? [];
    case "lunch":
      return diet.lunchOptions ?? [];
    case "dinner":
      return diet.dinnerOptions ?? [];
    case "snack":
      return diet.snackOptions ?? [];
  }
}

const kcalOf = (o: Option) => mid(o.calories);

/*
 * Both catalogs fill DIET_DATABASE in place after a remote fetch, so anything
 * derived from it is keyed on its length and rebuilt when the library lands.
 */
let stamp = -1;
const pools = new Map<string, PoolDish[]>();
const reaches = new Map<MealType, Map<string, number>>();

function fresh(): void {
  if (stamp === DIET_DATABASE.length) return;
  stamp = DIET_DATABASE.length;
  pools.clear();
  reaches.clear();
}

/** dishKey → how many diets serve it, for one slot. */
function reachIndex(slot: MealType): Map<string, number> {
  const hit = reaches.get(slot);
  if (hit) return hit;
  const diets = new Map<string, Set<string>>();
  for (const diet of DIET_DATABASE) {
    for (const o of slotOptions(diet, slot)) {
      const k = dishKey(o.name);
      if (!k) continue;
      const set = diets.get(k) ?? new Set<string>();
      set.add(diet.id);
      diets.set(k, set);
    }
  }
  const index = new Map([...diets].map(([k, set]) => [k, set.size] as const));
  reaches.set(slot, index);
  return index;
}

function groupDishes(entries: { option: Option; own: boolean }[], slot: MealType): PoolDish[] {
  const reach = reachIndex(slot);
  const groups = new Map<string, { options: Option[]; names: Set<string>; own: boolean; cuisine: MealCuisine }>();
  for (const { option, own } of entries) {
    const k = dishKey(option.name);
    if (!k) continue;
    const g = groups.get(k);
    if (!g) {
      groups.set(k, { options: [option], names: new Set([option.name]), own, cuisine: mealCuisine(option) });
      continue;
    }
    if (!g.names.has(option.name)) {
      g.options.push(option);
      g.names.add(option.name);
    }
    g.own = g.own || own;
  }
  const dishes: PoolDish[] = [];
  for (const [k, g] of groups) {
    dishes.push({
      key: k,
      name: [...g.options].sort((a, b) => a.name.length - b.name.length)[0]!.name,
      cuisine: g.cuisine,
      portions: [...g.options].sort((a, b) => kcalOf(a) - kcalOf(b)),
      own: g.own,
      reach: reach.get(k) ?? 1,
    });
  }
  // A canonical order, so everything derived from the pool is deterministic.
  return dishes.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function buildPool(diet: DietData, slot: MealType, rules: HardRules): PoolDish[] {
  const safe = (o: { name: string }) =>
    !breaksRestriction(o.name, rules.restriction) && !hasAllergen(o.name, rules.allergies);

  const own = slotOptions(diet, slot);
  const entries = own.filter(safe).map((option) => ({ option, own: true }));

  const sources = borrowSources(diet.id, rules.restriction);
  const env = sources.length > 0 ? envelopeOf(own) : null;
  if (env) {
    const kitchen = CUISINE_NAMED_DIETS[diet.id];
    const dietRule = DIET_RESTRICTION[diet.id];
    const wanted = new Set(sources);
    for (const source of DIET_DATABASE) {
      if (!wanted.has(source.id)) continue;
      for (const option of slotOptions(source, slot)) {
        if (!safe(option)) continue;
        if (dietRule && breaksRestriction(option.name, dietRule)) continue;
        if (kitchen && mealCuisine(option) !== kitchen) continue;
        if (!fitsEnvelope(option, env)) continue;
        entries.push({ option, own: false });
      }
    }
  }

  if (entries.length === 0) {
    // Nothing on this diet is safe for this user in this slot. Borrow from the
    // whole catalog rather than serve a violation — the generator's standing rule.
    for (const idea of mealsForSlot(slot)) {
      if (idea.origin !== "diet" || !safe(idea)) continue;
      entries.push({
        option: {
          name: idea.name,
          calories: idea.calories,
          protein: idea.protein,
          carbs: idea.carbs,
          fat: idea.fat,
          ...(idea.isNigerian ? { isNigerian: true } : {}),
          ...(idea.cuisine ? { cuisine: idea.cuisine } : {}),
        },
        own: false,
      });
    }
  }
  if (entries.length === 0) {
    // Only when the catalog has nothing either does the diet's own list come back.
    own.forEach((option) => entries.push({ option, own: true }));
  }
  return groupDishes(entries, slot);
}

/**
 * Every dish this diet may serve this user in one slot: its own, plus what it
 * may borrow, after the rules that never relax. Cached — a ninety-day menu asks
 * for the same pool ninety times.
 */
function slotPool(diet: DietData, slot: MealType, rules: HardRules): PoolDish[] {
  fresh();
  const allergies = (rules.allergies ?? [])
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  const key = `${diet.id}|${slot}|${rules.restriction ?? "none"}|${allergies}`;
  const hit = pools.get(key);
  if (hit) return hit;
  const pool = buildPool(diet, slot, rules);
  pools.set(key, pool);
  return pool;
}

/** {@link slotPool} for a main meal, whose portions always carry full macros. */
export function mainSlotPool(
  diet: DietData,
  slot: MainSlot,
  rules: HardRules,
): PoolDish<DietMealOption>[] {
  return slotPool(diet, slot, rules) as PoolDish<DietMealOption>[];
}

// ============================================================================
// NARROWING — preferences that shape the pool without starving it
// ============================================================================

/** The fewest dishes a preference may narrow a slot to. Two is the bug this file closes. */
const MIN_KEEP = 3;

/** A week of dishes: the rotation the calorie band holds out for before it tightens. */
const ROTATION_TARGET = 7;

/** How far (± share of the slot's calories) a dish's closest portion may sit from the target. */
const CALORIE_BANDS = [0.2, 0.3, 0.45] as const;

/**
 * A snack's budget is small — about 66 kcal on a 1,300 kcal three-meal day — so
 * a share of it is a few dozen kcal and nearly every snack would miss. Snacks
 * are drawn first and the main meals are sized around what they came to (see
 * planDay), so the bands can be generous; the widest still turns away anything
 * past three and a half times the budget.
 */
const SNACK_BANDS = [0.75, 1.5, 2.5] as const;

function withoutDislikes<T extends Option>(pool: PoolDish<T>[], dislikes: string[] | undefined, minKeep: number): PoolDish<T>[] {
  if (!dislikes || dislikes.length === 0) return pool;
  const kept = pool.filter((d) => !d.portions.some((p) => hasDislike(p.name, dislikes)));
  return kept.length >= Math.min(minKeep, pool.length) ? kept : pool;
}

function narrowByCuisine<T extends Option>(
  pool: PoolDish<T>[],
  pref: UserBio["cuisinePreference"],
  minKeep: number,
): PoolDish<T>[] {
  const tiers = cuisineTiers(pref);
  if (!tiers || pool.length === 0) return pool;
  const need = Math.min(minKeep, pool.length);
  for (const tier of tiers) {
    const narrowed = pool.filter((d) => tier.includes(d.cuisine));
    if (narrowed.length >= need) return narrowed;
  }
  return pool;
}

/** The authored size of a dish closest to `targetKcal`. */
function closestPortion<T extends Option>(dish: PoolDish<T>, targetKcal: number): T {
  let best = dish.portions[0]!;
  let gap = Infinity;
  for (const p of dish.portions) {
    const g = Math.abs(kcalOf(p) - targetKcal);
    if (g < gap) {
      best = p;
      gap = g;
    }
  }
  return best;
}

const fitOf = (dish: PoolDish, target: number) =>
  Math.abs(kcalOf(closestPortion(dish, target)) - target) / target;

/**
 * The dishes that take turns in a slot: the narrowest calorie band that still
 * holds a week of them, widening as far as ±45%. A slot that can't muster three
 * dishes even then falls back to its three closest — what the old generator
 * served, so a thin diet is never worse off than it was.
 */
function inRotation<T extends Option>(
  pool: PoolDish<T>[],
  target: number,
  bands: readonly number[] = CALORIE_BANDS,
  minKeep = MIN_KEEP,
): PoolDish<T>[] {
  if (pool.length <= 1 || !(target > 0)) return pool;
  for (const band of bands) {
    const inBand = pool.filter((d) => fitOf(d, target) <= band);
    if (inBand.length >= Math.min(ROTATION_TARGET, pool.length)) return inBand;
  }
  const widest = pool.filter((d) => fitOf(d, target) <= bands[bands.length - 1]!);
  if (widest.length >= Math.min(minKeep, pool.length)) return widest;
  return [...pool].sort((a, b) => fitOf(a, target) - fitOf(b, target)).slice(0, minKeep);
}

// ============================================================================
// THE ROTATION — a seeded shuffle-bag over calendar days
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** A Lehmer seed: never 0, which would pin the generator at zero forever. */
const seedOf = (text: string) => (hashString(text) % 2147483646) + 1;

function seededRandom(seed: number): () => number {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  // Nearby seeds open on nearby values; a few draws separate them.
  next();
  next();
  return next;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Cycle `cycle` of the bag: a fresh order that never opens on the dish the last one closed with. */
function cycleOrder<T>(items: readonly T[], seed: string, cycle: number): T[] {
  const order = shuffled(items, seedOf(`${seed}#${cycle}`));
  if (cycle > 0 && order.length >= 3) {
    const previous = shuffled(items, seedOf(`${seed}#${cycle - 1}`));
    if (order[0] === previous[previous.length - 1]) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

/** The `index`-th draw from the bag: each item once per cycle, in a seeded order. */
export function bagDraw<T>(items: readonly T[], seed: string, index: number): T {
  const m = items.length;
  if (m <= 2) {
    // Two can only alternate; one can only repeat.
    return items[(index + (seedOf(seed) % m)) % m]!;
  }
  const cycle = Math.floor(index / m);
  return cycleOrder(items, seed, cycle)[index - cycle * m]!;
}

/** Day 0 = 1970-01-01. Calendar arithmetic only, so no daylight-saving drift. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

// ============================================================================
// A DAY
// ============================================================================

export interface DayPlanInput {
  diet: DietData;
  bio: Pick<
    UserBio,
    "dietaryRestriction" | "allergies" | "foodDislikes" | "cuisinePreference" | "primaryGoal"
  >;
  /** Calories each main meal should carry, and each snack. */
  split: { breakfast: number; lunch: number; dinner: number; snack: number };
  snackCount: number;
  /** YYYY-MM-DD. */
  date: string;
}

export interface PlannedDay {
  breakfast: DietMealOption;
  lunch: DietMealOption;
  dinner: DietMealOption;
  snacks: DietSnackOption[];
}

/** A target nudged by what the day has already used, kept within ±30% of the slot's own share. */
const steer = (target: number, base: number) => Math.min(Math.max(target, base * 0.7), base * 1.3);

/**
 * One day of a diet, for one user: the dishes from the rotation, the portions
 * from the budget. Null only for a diet with no meals at all in some slot.
 */
export function planDay(input: DayPlanInput): PlannedDay | null {
  const { diet, bio, split, date } = input;
  const rules: HardRules = { restriction: bio.dietaryRestriction, allergies: bio.allergies };
  const dislikes = bio.foodDislikes;
  const seedBase = [
    diet.id,
    bio.primaryGoal,
    bio.dietaryRestriction,
    bio.cuisinePreference ?? "mixed",
    (dislikes ?? []).slice().sort().join(","),
  ].join("|");
  const n = dayNumber(date);

  const rotation = (slot: MainSlot) =>
    inRotation(
      narrowByCuisine(withoutDislikes(mainSlotPool(diet, slot, rules), dislikes, MIN_KEEP), bio.cuisinePreference, MIN_KEEP),
      split[slot],
    );

  const breakfasts = rotation("breakfast");
  const lunches = rotation("lunch");
  const dinners = rotation("dinner");
  if (breakfasts.length === 0 || lunches.length === 0 || dinners.length === 0) return null;

  const breakfastDish = bagDraw(breakfasts, `${seedBase}|breakfast`, n);
  const lunchDish = bagDraw(lunches, `${seedBase}|lunch`, n);
  let dinnerDish = bagDraw(dinners, `${seedBase}|dinner`, n);
  if (dinnerDish.key === lunchDish.key && dinners.length > 1) {
    // Never the same dish twice in a day: take the one half a cycle away, which
    // the rotation would only have served days from now anyway.
    const half = Math.max(1, Math.floor(dinners.length / 2));
    for (let i = 0; i < dinners.length - 1 && dinnerDish.key === lunchDish.key; i++) {
      dinnerDish = bagDraw(dinners, `${seedBase}|dinner`, n + half + i);
    }
  }

  // Snacks first: they are the least flexible part of the day (one size each,
  // mostly), so the main meals are sized around what they actually came to.
  const snackCount = Math.max(0, input.snackCount);
  const snackRotation = inRotation(
    narrowByCuisine(
      withoutDislikes(slotPool(diet, "snack", rules), dislikes, snackCount),
      bio.cuisinePreference,
      Math.max(snackCount, MIN_KEEP),
    ),
    split.snack,
    SNACK_BANDS,
    Math.max(snackCount, MIN_KEEP),
  ) as PoolDish<DietSnackOption>[];
  const snacks: DietSnackOption[] = [];
  for (let j = 0; j < Math.min(snackCount, snackRotation.length); j++) {
    const dish = bagDraw(snackRotation, `${seedBase}|snack`, n * snackCount + j);
    snacks.push(closestPortion(dish, split.snack));
  }

  // The main meals share whatever the snacks left of the day, in their usual
  // proportions, and each one's portion is steered by what the meal before it
  // came to — a heavier breakfast makes for a lighter lunch.
  const mainsShare = split.breakfast + split.lunch + split.dinner;
  const day = mainsShare + snackCount * split.snack;
  let left = day - snacks.reduce((sum, s) => sum + kcalOf(s), 0);
  const breakfast = closestPortion(breakfastDish, steer((left * split.breakfast) / mainsShare, split.breakfast));
  left -= kcalOf(breakfast);
  const lunch = closestPortion(
    lunchDish,
    steer((left * split.lunch) / (split.lunch + split.dinner), split.lunch),
  );
  left -= kcalOf(lunch);
  const dinner = closestPortion(dinnerDish, steer(left, split.dinner));

  return { breakfast, lunch, dinner, snacks };
}
