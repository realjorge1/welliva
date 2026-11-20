/**
 * PORTION SOLVER — servings that make a day of meals actually feed her.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * Every dish came at a fixed, authored size (the largest about 400–740 kcal a
 * meal), and the planner only ever chose the authored size nearest a CALORIE
 * budget. So an 80 kg man on 2,701 kcal was planned 62% of it every day, a
 * muscle-builder 71%, while a 60 kg woman's days ran 142% of her fat target.
 * Eat This Much, the best-known plan generator, scales servings until the day
 * hits all the targets; this does the same, deterministically.
 *
 * ── HOW ─────────────────────────────────────────────────────────────────────
 * After the rotation has picked the dishes (mealVariety — untouched), each
 * meal gets a serving multiplier from SERVING_STEPS, mains up to 2×, snacks up
 * to 1½× so nothing becomes absurd. The (small) combination space is searched
 * exhaustively. Priorities, in order:
 *   1. calories within KCAL_BAND (5%) of the day's target;
 *   2. protein at PROTEIN_MIN (95%) of target or more;
 *   3. fat no more than FAT_MAX (125%) of target;
 *   4. carbohydrate as close to its target as what's left allows.
 * Ties go to servings nearest 1× and the most even spread across meals.
 *
 * If the best combination still falls short (calories under TOPUP_KCAL or
 * protein under TOPUP_PROTEIN), up to MAX_TOPUPS small extras are added from
 * the SAME safe pool the caller passes (the diet's own snacks, under the same
 * hard rules) — protein first. They are ordinary snacks with their own names.
 * What still can't be reached is said in one calm line (planShortfall), never
 * hidden.
 *
 * A meal's identity is slot + name (the intake ledger heals ticks by it), so a
 * serving NEVER renames a dish. A meal already ticked is never resized.
 *
 * Pure: no storage, no clock.
 */
import type { DaySchedule, MealType, ScheduledMeal } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import { macrosOfMeal, type MacroTotals } from "./DayTotals";

/** The serving multipliers a meal may take. */
export const SERVING_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
/** Mains may double; a snack stops at 1½× (two and a half bananas is not a snack). */
export const MAX_SERVINGS: Record<"main" | "snack", number> = { main: 2, snack: 1.5 };
/** Calories within this share of target count as on target. */
export const KCAL_BAND = 0.05;
/** Protein at this share of target or more counts as met. */
export const PROTEIN_MIN = 0.95;
/** Fat above this share of target is penalised. */
export const FAT_MAX = 1.25;
/** Below these after solving, a top-up is considered. */
export const TOPUP_KCAL = 0.92;
export const TOPUP_PROTEIN = 0.9;
/** At most this many extras a day. */
export const MAX_TOPUPS = 2;
/** The honest line appears when a day ends outside these. */
export const SHORTFALL_KCAL_LOW = 0.93;
export const SHORTFALL_PROTEIN_LOW = 0.9;

type Kind = "main" | "snack";
const kindOf = (slot: MealType): Kind => (slot === "snack" ? "snack" : "main");

/** One serving's macros, whatever servings the meal currently carries. */
export function baseMacros(meal: ScheduledMeal): MacroTotals {
  const m = macrosOfMeal(meal);
  const s = meal.servings && meal.servings > 0 ? meal.servings : 1;
  return { calories: m.calories / s, proteinG: m.proteinG / s, carbsG: m.carbsG / s, fatG: m.fatG / s };
}

const scaleRange = (r: { min: number; max: number }, k: number) => ({
  min: Math.round(r.min * k * 10) / 10,
  max: Math.round(r.max * k * 10) / 10,
});

/**
 * The same dish at `servings` (from whatever it carries now). The NAME is
 * never touched — identity is slot + name.
 */
export function withServings(meal: ScheduledMeal, servings: number): ScheduledMeal {
  const current = meal.servings && meal.servings > 0 ? meal.servings : 1;
  if (Math.abs(servings - current) < 1e-9) return meal;
  const k = servings / current;
  const out: ScheduledMeal = {
    ...meal,
    calories: scaleRange(meal.calories, k),
    proteinG: scaleRange(meal.proteinG, k),
    carbsG: scaleRange(meal.carbsG, k),
    fatG: scaleRange(meal.fatG, k),
  };
  if (Math.abs(servings - 1) < 1e-9) delete out.servings;
  else out.servings = servings;
  return out;
}

interface Item {
  base: MacroTotals;
  steps: readonly number[];
}

/**
 * A dish its author sized deliberately small ("… Boiled Yam (small)") reads
 * oddly doubled — "2× … (small)" — so it stops at the snack cap. Found by the
 * Phase 5 eyeball of every dish the solver doubled; the catalog authors some
 * such dishes at one size only, which is the real fix (content).
 */
const SMALL_BY_NAME = /\(small\)/i;

const stepsFor = (kind: Kind, name = ""): number[] => {
  const cap = kind === "main" && SMALL_BY_NAME.test(name) ? MAX_SERVINGS.snack : MAX_SERVINGS[kind];
  return SERVING_STEPS.filter((s) => s <= cap);
};

const ratio = (v: number, t: number) => (t > 0 ? v / t : 1);

type Targets4 = Pick<NutritionTargets, "calories" | "proteinG" | "carbsG" | "fatG">;

/**
 * The priority list as ONE number, lower = better, so the search compares a
 * scalar instead of building arrays (it runs tens of thousands of times a day
 * on a low-end phone). Each band is quantised to 0.5% and given its own range
 * of magnitude, so a higher priority always outweighs every lower one:
 *   calories outside ±5% ≫ protein under 95% ≫ fat over 125% ≫ carbs off
 *   ≫ servings far from 1× ≫ an uneven spread.
 */
function scalarScore(
  cal: number,
  pro: number,
  carb: number,
  fat: number,
  t: Targets4,
  near: number,
  spread: number,
): number {
  const k = ratio(cal, t.calories);
  const p = ratio(pro, t.proteinG);
  const f = ratio(fat, t.fatG);
  const c = ratio(carb, t.carbsG);
  const s1 = Math.min(999, Math.round(Math.max(0, Math.abs(k - 1) - KCAL_BAND) * 200));
  const s2 = Math.min(999, Math.round(Math.max(0, PROTEIN_MIN - p) * 200));
  const s3 = Math.min(999, Math.round(Math.max(0, f - FAT_MAX) * 200));
  const s4 = Math.min(999, Math.round(Math.abs(c - 1) * 200));
  return s1 * 1e12 + s2 * 1e9 + s3 * 1e6 + s4 * 1e3 + Math.min(99, near * 10) + Math.min(9.99, spread);
}

const better = (a: number, b: number) => a < b - 1e-9;

/** A step and its immediate neighbours in `steps`, for a local search around `at`. */
function neighbours(steps: readonly number[], at: number): number[] {
  const i = steps.indexOf(at);
  if (i < 0) return [...steps];
  return steps.slice(Math.max(0, i - 1), Math.min(steps.length, i + 2));
}

/**
 * The best servings for `items` against `targets`, deterministic. Exhaustive
 * over each item's steps — or, given `around`, over each item's current step
 * and its neighbours (a local search, used once extras are added; items past
 * `around`'s length get every step). `fixedTotal` is what meals that can't move
 * (already eaten) contribute.
 */
export function solveServings(
  items: readonly Item[],
  targets: Targets4,
  fixedTotal: MacroTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  around?: readonly number[],
): { servings: number[]; total: MacroTotals; score: number } {
  const n = items.length;
  const options = items.map((it, i) =>
    around && i < around.length ? neighbours(it.steps, around[i]!) : [...it.steps],
  );
  const chosen: number[] = new Array(n).fill(1);
  let bestServings: number[] = items.map(() => 1);
  let best = { cal: fixedTotal.calories, pro: fixedTotal.proteinG, carb: fixedTotal.carbsG, fat: fixedTotal.fatG };
  let bestScore = Infinity;

  // PRUNING, exact: calories rank first, so once ANY combination sits inside
  // the band (its score is below the band term's unit), a branch whose
  // remaining items can't bring calories back inside the band can't win.
  // The band edge matches the score's 0.5% quantisation exactly.
  const sufMin = new Array<number>(n + 1).fill(0);
  const sufMax = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const kcal = items[i]!.base.calories;
    sufMin[i] = sufMin[i + 1]! + kcal * Math.min(...options[i]!);
    sufMax[i] = sufMax[i + 1]! + kcal * Math.max(...options[i]!);
  }
  const bandEdge = KCAL_BAND + 0.0025;
  const lo = targets.calories * (1 - bandEdge);
  const hi = targets.calories * (1 + bandEdge);
  const IN_BAND = 1e12;

  const walk = (
    i: number,
    cal: number,
    pro: number,
    carb: number,
    fat: number,
    near: number,
    top: number,
    bottom: number,
  ): void => {
    if (i === n) {
      const score = scalarScore(cal, pro, carb, fat, targets, near, n ? top - bottom : 0);
      if (better(score, bestScore)) {
        bestScore = score;
        bestServings = chosen.slice();
        best = { cal, pro, carb, fat };
      }
      return;
    }
    if (bestScore < IN_BAND && targets.calories > 0 && (cal + sufMin[i]! > hi || cal + sufMax[i]! < lo)) return;
    const b = items[i]!.base;
    const opts = options[i]!;
    for (let j = 0; j < opts.length; j++) {
      const s = opts[j]!;
      chosen[i] = s;
      walk(
        i + 1,
        cal + b.calories * s,
        pro + b.proteinG * s,
        carb + b.carbsG * s,
        fat + b.fatG * s,
        near + Math.abs(s - 1),
        s > top ? s : top,
        s < bottom ? s : bottom,
      );
    }
  };
  walk(0, fixedTotal.calories, fixedTotal.proteinG, fixedTotal.carbsG, fixedTotal.fatG, 0, -Infinity, Infinity);
  return {
    servings: bestServings,
    total: { calories: best.cal, proteinG: best.pro, carbsG: best.carb, fatG: best.fat },
    score: bestScore,
  };
}

/** Local search to a fixed point (a few rounds at most), from `start`. */
function polish(
  items: readonly Item[],
  targets: Targets4,
  fixedTotal: MacroTotals,
  start: readonly number[],
): ReturnType<typeof solveServings> {
  let at = solveServings(items, targets, fixedTotal, start);
  for (let round = 0; round < 2; round++) {
    const next = solveServings(items, targets, fixedTotal, at.servings);
    if (!better(next.score, at.score)) break;
    at = next;
  }
  return at;
}

export interface FitOptions {
  /**
   * Extras the day may add (the diet's own snack pool, already rule-filtered).
   * A function is called only on a day that needs one — most days don't, and
   * building the pool is the costly part of a 90-day menu.
   */
  topUps?: readonly ScheduledMeal[] | (() => readonly ScheduledMeal[]);
  /** Spreads which top-up a day prefers among near-equals (a date's day number). */
  seed?: number;
}

export interface FitResult {
  meals: ScheduledMeal[];
  total: MacroTotals;
  /** How many extras were added. */
  added: number;
}

/**
 * Size a day's meals to the targets. Ticked meals keep their size and count as
 * fixed; every other meal gets the best serving. Returns new meal objects in
 * the same order, extras appended.
 */
export function fitMeals(
  meals: readonly ScheduledMeal[],
  targets: Pick<NutritionTargets, "calories" | "proteinG" | "carbsG" | "fatG">,
  opts: FitOptions = {},
): FitResult {
  if (!(targets.calories > 0)) {
    const total = sum(meals.map(macrosOfMeal));
    return { meals: [...meals], total, added: 0 };
  }
  const fixed = sum(meals.filter((m) => m.isConsumed).map(macrosOfMeal));
  const movable = meals.map((m, i) => ({ m, i })).filter(({ m }) => !m.isConsumed);
  const items: Item[] = movable.map(({ m }) => ({ base: baseMacros(m), steps: stepsFor(kindOf(m.mealType), m.name) }));

  let solved = solveServings(items, targets, fixed);
  let extras: ScheduledMeal[] = [];

  // An extra is worth considering when the day misses: calories short, protein
  // short, or fat over (an extra lean, protein-rich snack lets the fattier
  // dishes come down a serving). One is kept only if it makes the day better.
  const misses = (t: MacroTotals) =>
    ratio(t.calories, targets.calories) < TOPUP_KCAL ||
    ratio(t.proteinG, targets.proteinG) < TOPUP_PROTEIN ||
    ratio(t.fatG, targets.fatG) > FAT_MAX;

  const pool = misses(solved.total) && opts.topUps
    ? typeof opts.topUps === "function"
      ? opts.topUps()
      : opts.topUps
    : [];
  if (pool.length > 0) {
    const taken = new Set(meals.map((m) => m.name.trim().toLowerCase()));
    for (let round = 0; round < MAX_TOPUPS && misses(solved.total); round++) {
      const current = [...items, ...extras.map((m) => ({ base: baseMacros(m), steps: stepsFor("snack") }))];
      // A quick look first — the day as solved, plus each candidate at each of
      // its steps — then the full local search for only the two that look best.
      const quick = (candidate: ScheduledMeal): number => {
        const b = baseMacros(candidate);
        let low = Infinity;
        for (const s of stepsFor("snack")) {
          const t = solved.total;
          low = Math.min(
            low,
            scalarScore(t.calories + b.calories * s, t.proteinG + b.proteinG * s, t.carbsG + b.carbsG * s, t.fatG + b.fatG * s, targets, Math.abs(s - 1), 0),
          );
        }
        return low;
      };
      const shortlist = topUpShortlist(pool, taken, solved.total, targets, opts.seed ?? 0)
        .map((m) => ({ m, q: quick(m) }))
        .sort((a, b) => a.q - b.q)
        .slice(0, 2)
        .map((x) => x.m);
      let best: { meal: ScheduledMeal; solved: ReturnType<typeof solveServings> } | null = null;
      for (const candidate of shortlist) {
        // Local search from the day as solved: every meal may move one step
        // either way while the candidate tries all of its own.
        const trial = polish(
          [...current, { base: baseMacros(candidate), steps: stepsFor("snack") }],
          targets,
          fixed,
          solved.servings,
        );
        if (!best || better(trial.score, best.solved.score)) best = { meal: candidate, solved: trial };
      }
      if (!best || !better(best.solved.score, solved.score)) break;
      taken.add(best.meal.name.trim().toLowerCase());
      extras = [...extras, { ...best.meal, isConsumed: false }];
      solved = best.solved;
    }
  }

  const out = [...meals];
  movable.forEach(({ i }, j) => {
    out[i] = withServings(meals[i]!, solved.servings[j]!);
  });
  extras.forEach((m, j) => {
    out.push(withServings(m, solved.servings[items.length + j]!));
  });
  return { meals: out, total: solved.total, added: extras.length };
}

/** How many extras are tried in full each round (a cap that keeps a 90-day menu quick). */
export const TOPUP_SHORTLIST = 4;

/**
 * The extras worth trying — protein first, lean before fatty — from those not
 * already on the day and not bigger than the day can use. The date's seed
 * rotates which near-equal leads, so one snack doesn't top up every day; the
 * solver then keeps whichever actually makes the day best.
 */
function topUpShortlist(
  pool: readonly ScheduledMeal[],
  taken: ReadonlySet<string>,
  total: MacroTotals,
  targets: Pick<NutritionTargets, "calories" | "proteinG" | "carbsG" | "fatG">,
  seed: number,
): ScheduledMeal[] {
  const kcalGap = Math.max(0, targets.calories - total.calories);
  // An extra may take a third more than the calories left, or a sixth of the
  // day when the day is full (it will push a fattier serving down instead).
  const cap = Math.max(kcalGap * 1.33, targets.calories / 6);
  const seen = new Set<string>();
  const scored = pool
    .filter((m) => {
      const key = m.name.trim().toLowerCase();
      if (taken.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((m) => {
      const b = baseMacros(m);
      if (!(b.calories > 0) || b.calories > cap) return null;
      // Leanness: protein's share of the snack's energy, less half of fat's.
      const lean = (b.proteinG * 4 - 0.5 * b.fatG * 9) / b.calories;
      return { m, lean };
    })
    .filter((x): x is { m: ScheduledMeal; lean: number } => x !== null)
    .sort((a, b) => b.lean - a.lean || (a.m.name < b.m.name ? -1 : 1));
  if (scored.length <= TOPUP_SHORTLIST) return scored.map((x) => x.m);
  // Keep the leanest few, rotated by the date among the top band.
  const head = scored.slice(0, TOPUP_SHORTLIST * 2);
  const offset = Math.abs(seed) % head.length;
  return [...head.slice(offset), ...head.slice(0, offset)].slice(0, TOPUP_SHORTLIST).map((x) => x.m);
}

/**
 * One dish sized to a single slot's budget (a swap): the step whose calories
 * land nearest the budget, protein deciding a tie, then the step nearest 1×.
 * Same steps and caps as a whole day.
 */
export function servingsForBudget(
  base: MacroTotals,
  slot: MealType,
  budget: { calories: number; proteinG: number } | null,
  name = "",
): number {
  if (!budget || !(budget.calories > 0) || !(base.calories > 0)) return 1;
  let best = 1;
  let bestScore = Infinity;
  for (const s of stepsFor(kindOf(slot), name)) {
    const k = (base.calories * s) / budget.calories;
    const p = budget.proteinG > 0 ? (base.proteinG * s) / budget.proteinG : 1;
    const score =
      Math.round(Math.max(0, Math.abs(k - 1) - KCAL_BAND) * 200) * 1e6 +
      Math.round(Math.max(0, PROTEIN_MIN - p) * 200) * 1e3 +
      Math.abs(s - 1);
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** A day's schedule, sized. Identity (slot + name) of every planned meal kept. */
export function fitDaySchedule(
  schedule: DaySchedule,
  targets: Pick<NutritionTargets, "calories" | "proteinG" | "carbsG" | "fatG">,
  opts: FitOptions = {},
): DaySchedule {
  const mains = (["breakfast", "lunch", "dinner"] as const).filter((s) => schedule[s]);
  const list: ScheduledMeal[] = [
    ...mains.map((s) => schedule[s]!),
    ...(schedule.snacks ?? []),
  ];
  const fit = fitMeals(list, targets, opts);
  const out: DaySchedule = { ...schedule, snacks: [] };
  mains.forEach((s, i) => {
    out[s] = fit.meals[i]!;
  });
  out.snacks = fit.meals.slice(mains.length);
  return out;
}

/** The day's planned totals (midpoints, servings included). */
export function plannedTotals(schedule: DaySchedule): MacroTotals {
  return sum(
    [schedule.breakfast, schedule.lunch, schedule.dinner, ...(schedule.snacks ?? [])]
      .filter((m): m is ScheduledMeal => !!m)
      .map(macrosOfMeal),
  );
}

/**
 * The honest line, or null. Calories first (the number she plans by), then
 * protein. Never pretends: a diet that can't feed her says by how much.
 */
export function planShortfall(
  schedule: DaySchedule,
  targets: Pick<NutritionTargets, "calories" | "proteinG">,
): string | null {
  const t = plannedTotals(schedule);
  const k = ratio(t.calories, targets.calories);
  const p = ratio(t.proteinG, targets.proteinG);
  if (k < SHORTFALL_KCAL_LOW) return `Today's plan reaches ${Math.round(k * 100)}% of your calories.`;
  if (p < SHORTFALL_PROTEIN_LOW) return `Today's plan reaches ${Math.round(p * 100)}% of your protein.`;
  return null;
}

function sum(list: readonly MacroTotals[]): MacroTotals {
  return list.reduce(
    (a, b) => ({
      calories: a.calories + b.calories,
      proteinG: a.proteinG + b.proteinG,
      carbsG: a.carbsG + b.carbsG,
      fatG: a.fatG + b.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
