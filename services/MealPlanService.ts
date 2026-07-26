/**
 * MealPlanService — owns plan PERIODS and hand-picked menus.
 *
 * The app previously had no notion of committing to a plan for a stretch of
 * time: there were per-date schedules and a `planState.activeDietId`, so
 * "I'm doing keto for six weeks" was indistinguishable from "keto happens to be
 * today's diet". This service supplies the missing entity, which is what makes
 * both custom durations and a meaningful end-of-period report possible.
 *
 * INVARIANT: at most one period is active at any moment. Starting a new one
 * closes the incumbent. Everything else in the app asks this service "what plan
 * governs date D?" rather than reading a global active-diet flag.
 *
 * Custom menus live here rather than in ScheduleService on purpose: a generated
 * schedule may be regenerated at will (preference changes, buffer refills), and
 * a user's hand-picked "Thursday dinner: mac and cheese" must survive every one
 * of those regenerations. Separate stores make that structurally guaranteed
 * rather than a thing we have to remember.
 */

import type { MealType, ScheduledMeal } from "../models/diet";
import {
  addDays,
  dateRange,
  isDateInPeriod,
  resolveEndDate,
  toLocalDate,
  type CustomMenu,
  type CustomMenuEntry,
  type MealPlanPeriod,
  type PeriodBaseline,
  type PlanDuration,
  type PlanMode,
  type SavedMeal,
} from "../models/mealPlan";
import type { NutrientPanel } from "../models/nutrients";
import { KEYS, readJSON, writeJSON } from "./OfflineStorage";

// ============================================================================
// WRITE LOCK
// ============================================================================
// Same rationale as ScheduleService: every mutation is a read-modify-write of a
// whole array, so concurrent calls (a rollover sweep racing a user tap) would
// otherwise lose one of the two writes.

let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

const today = (): string => toLocalDate(new Date());

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// PERIODS
// ============================================================================

export async function getAllPeriods(): Promise<MealPlanPeriod[]> {
  return readJSON<MealPlanPeriod[]>(KEYS.MEAL_PLAN_PERIODS, []);
}

async function savePeriods(periods: MealPlanPeriod[]): Promise<void> {
  // Newest start first — the archive reads chronologically backwards.
  periods.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  await writeJSON(KEYS.MEAL_PLAN_PERIODS, periods);
}

/**
 * The period governing today, if any. Returns null once a period's end date has
 * passed — that's the signal the diet screen uses to show the closing report
 * instead of a plan.
 */
export async function getActivePeriod(): Promise<MealPlanPeriod | null> {
  const date = today();
  const periods = await getAllPeriods();
  return (
    periods.find((p) => p.status === "active" && isDateInPeriod(p, date)) ?? null
  );
}

/** The period that governed a given date, active or archived. */
export async function getPeriodForDate(
  date: string,
): Promise<MealPlanPeriod | null> {
  const periods = await getAllPeriods();
  return periods.find((p) => isDateInPeriod(p, date)) ?? null;
}

export async function getPeriodById(id: string): Promise<MealPlanPeriod | null> {
  const periods = await getAllPeriods();
  return periods.find((p) => p.id === id) ?? null;
}

export interface StartPeriodInput {
  mode: PlanMode;
  dietId?: string | null;
  dietName?: string | null;
  label?: string;
  durationKind: PlanDuration;
  /** Defaults to today. Allows scheduling a plan to begin later. */
  startDate?: string;
  /** Required when durationKind is "custom". */
  customEndDate?: string;
  baseline?: Partial<PeriodBaseline>;
  restartedFromId?: string;
}

/**
 * Begin a new period, closing whatever was running.
 *
 * The incumbent is closed as "ended-early" rather than deleted so its report
 * survives — switching diets halfway is a normal thing to do, and the user
 * should still get to see how the abandoned stretch went.
 */
export async function startPeriod(
  input: StartPeriodInput,
): Promise<MealPlanPeriod> {
  return withLock(async () => {
    const periods = await getAllPeriods();
    const start = input.startDate ?? today();
    const now = new Date().toISOString();

    // Close any period still marked active.
    for (const p of periods) {
      if (p.status === "active" || p.status === "scheduled") {
        p.status = "ended-early";
        p.closedAt = now;
        // Truncate its window so history queries don't overlap the new period.
        if (p.endDate >= start) p.endDate = addDays(start, -1);
        // A period truncated to before its own start never really ran.
        if (p.endDate < p.startDate) p.endDate = p.startDate;
      }
    }

    const endDate = resolveEndDate(start, input.durationKind, input.customEndDate);
    const label =
      input.label ??
      input.dietName ??
      (input.mode === "custom" ? "My menu" : "Meal plan");

    const period: MealPlanPeriod = {
      id: newId("period"),
      mode: input.mode,
      dietId: input.dietId ?? null,
      dietName: input.dietName ?? null,
      label,
      durationKind: input.durationKind,
      startDate: start,
      endDate,
      status: start > today() ? "scheduled" : "active",
      baseline: { capturedAt: now, ...input.baseline },
      createdAt: now,
      ...(input.restartedFromId ? { restartedFromId: input.restartedFromId } : {}),
    };

    periods.push(period);
    await savePeriods(periods);
    return period;
  });
}

/** Stop the running period now. Its end date becomes today. */
export async function endPeriodEarly(periodId: string): Promise<void> {
  return withLock(async () => {
    const periods = await getAllPeriods();
    const period = periods.find((p) => p.id === periodId);
    if (!period) return;
    period.status = "ended-early";
    period.closedAt = new Date().toISOString();
    const date = today();
    if (period.endDate > date) period.endDate = date;
    await savePeriods(periods);
  });
}

/**
 * Roll periods forward to `date`: promote scheduled → active, and close any
 * active period whose window has passed.
 *
 * Returns the periods that just finished, so the caller can surface their
 * reports. Written as a sweep over ALL periods rather than a check on "the"
 * current one because the app may have been closed for days — reopening it
 * after a week must not leave a finished period pretending it's still running.
 */
export async function advancePeriods(
  date: string = today(),
): Promise<{ justCompleted: MealPlanPeriod[] }> {
  return withLock(async () => {
    const periods = await getAllPeriods();
    const justCompleted: MealPlanPeriod[] = [];
    let changed = false;

    for (const p of periods) {
      if (p.status === "scheduled" && p.startDate <= date) {
        p.status = "active";
        changed = true;
      }
      if (p.status === "active" && p.endDate < date) {
        p.status = "completed";
        p.closedAt = new Date().toISOString();
        justCompleted.push(p);
        changed = true;
      }
    }

    if (changed) await savePeriods(periods);
    return { justCompleted };
  });
}

/** Periods that have finished and whose report the user hasn't dismissed. */
export async function getUnseenFinishedPeriods(): Promise<MealPlanPeriod[]> {
  const periods = await getAllPeriods();
  return periods.filter(
    (p) =>
      (p.status === "completed" || p.status === "ended-early") && !p.reportSeenAt,
  );
}

export async function markReportSeen(periodId: string): Promise<void> {
  return withLock(async () => {
    const periods = await getAllPeriods();
    const period = periods.find((p) => p.id === periodId);
    if (!period || period.reportSeenAt) return;
    period.reportSeenAt = new Date().toISOString();
    await savePeriods(periods);
  });
}

/** Extend a running period's end date — "give me another two weeks of this". */
export async function extendPeriod(
  periodId: string,
  newEndDate: string,
): Promise<void> {
  return withLock(async () => {
    const periods = await getAllPeriods();
    const period = periods.find((p) => p.id === periodId);
    if (!period || newEndDate < period.endDate) return;
    period.endDate = newEndDate;
    period.durationKind = "custom";
    if (period.status === "completed") {
      period.status = "active";
      delete period.closedAt;
    }
    await savePeriods(periods);
  });
}

// ============================================================================
// CUSTOM MENUS
// ============================================================================

async function getAllMenus(): Promise<Record<string, CustomMenu>> {
  return readJSON<Record<string, CustomMenu>>(KEYS.CUSTOM_MENUS, {});
}

async function saveAllMenus(menus: Record<string, CustomMenu>): Promise<void> {
  await writeJSON(KEYS.CUSTOM_MENUS, menus);
}

export async function getCustomMenu(periodId: string): Promise<CustomMenu | null> {
  const menus = await getAllMenus();
  return menus[periodId] ?? null;
}

/** The user's picks for one date. Empty array when they planned nothing. */
export async function getCustomEntriesForDate(
  periodId: string,
  date: string,
): Promise<CustomMenuEntry[]> {
  const menu = await getCustomMenu(periodId);
  return menu?.entriesByDate[date] ?? [];
}

export interface SetCustomMealInput {
  periodId: string;
  date: string;
  slot: MealType;
  meal: ScheduledMeal;
  nutrients?: NutrientPanel;
  /** Which snack to replace; omit to append a new one. */
  snackIndex?: number;
}

/**
 * Pick a meal for a specific day and slot. Replaces an existing pick in the
 * same slot (snacks stack instead, since a day can have several).
 */
export async function setCustomMeal(
  input: SetCustomMealInput,
): Promise<CustomMenuEntry> {
  return withLock(async () => {
    const menus = await getAllMenus();
    const menu: CustomMenu = menus[input.periodId] ?? {
      periodId: input.periodId,
      entriesByDate: {},
      updatedAt: new Date().toISOString(),
    };

    const existing = menu.entriesByDate[input.date] ?? [];
    const entry: CustomMenuEntry = {
      id: newId("cm"),
      date: input.date,
      slot: input.slot,
      ...(input.slot === "snack" && input.snackIndex !== undefined
        ? { snackIndex: input.snackIndex }
        : {}),
      meal: { ...input.meal, mealType: input.slot },
      ...(input.nutrients ? { nutrients: input.nutrients } : {}),
      createdAt: new Date().toISOString(),
    };

    let next: CustomMenuEntry[];
    if (input.slot === "snack") {
      if (input.snackIndex !== undefined) {
        next = existing.map((e) =>
          e.slot === "snack" && e.snackIndex === input.snackIndex ? entry : e,
        );
        if (!next.some((e) => e.id === entry.id)) next = [...existing, entry];
      } else {
        next = [...existing, entry];
      }
    } else {
      // One breakfast/lunch/dinner per day — a new pick replaces the old one.
      next = [...existing.filter((e) => e.slot !== input.slot), entry];
    }

    menu.entriesByDate[input.date] = next;
    menu.updatedAt = new Date().toISOString();
    menus[input.periodId] = menu;
    await saveAllMenus(menus);
    return entry;
  });
}

/** Remove a single pick. Leaves the slot genuinely empty — custom never refills. */
export async function removeCustomMeal(
  periodId: string,
  entryId: string,
): Promise<void> {
  return withLock(async () => {
    const menus = await getAllMenus();
    const menu = menus[periodId];
    if (!menu) return;
    for (const [date, entries] of Object.entries(menu.entriesByDate)) {
      const next = entries.filter((e) => e.id !== entryId);
      if (next.length !== entries.length) {
        if (next.length === 0) delete menu.entriesByDate[date];
        else menu.entriesByDate[date] = next;
        menu.updatedAt = new Date().toISOString();
        menus[periodId] = menu;
        await saveAllMenus(menus);
        return;
      }
    }
  });
}

/**
 * Copy one day's picks onto other dates. Planning a month by hand is only
 * bearable if "same as Monday" is one action, so this is a first-class
 * operation rather than something the user repeats forty times.
 */
export async function copyDayTo(
  periodId: string,
  sourceDate: string,
  targetDates: string[],
): Promise<number> {
  return withLock(async () => {
    const menus = await getAllMenus();
    const menu = menus[periodId];
    const source = menu?.entriesByDate[sourceDate];
    if (!menu || !source || source.length === 0) return 0;

    let copied = 0;
    for (const date of targetDates) {
      if (date === sourceDate) continue;
      menu.entriesByDate[date] = source.map((e) => ({
        ...e,
        id: newId("cm"),
        date,
        meal: { ...e.meal, id: newId("meal"), isConsumed: false, consumedAt: undefined },
        createdAt: new Date().toISOString(),
      }));
      copied++;
    }
    menu.updatedAt = new Date().toISOString();
    menus[periodId] = menu;
    await saveAllMenus(menus);
    return copied;
  });
}

/**
 * Repeat a week's pattern across the rest of the period — "every Monday is
 * moi-moi". Maps each target date onto the source week's matching weekday.
 */
export async function repeatWeekPattern(
  periodId: string,
  weekStartDate: string,
  through: string,
): Promise<number> {
  return withLock(async () => {
    const menus = await getAllMenus();
    const menu = menus[periodId];
    if (!menu) return 0;

    const sourceWeek = dateRange(weekStartDate, addDays(weekStartDate, 6));
    const sourceByWeekday = new Map<number, CustomMenuEntry[]>();
    for (const date of sourceWeek) {
      const entries = menu.entriesByDate[date];
      if (entries?.length) {
        const [y, m, d] = date.split("-").map(Number);
        sourceByWeekday.set(new Date(y, m - 1, d).getDay(), entries);
      }
    }
    if (sourceByWeekday.size === 0) return 0;

    let filled = 0;
    for (const date of dateRange(addDays(weekStartDate, 7), through)) {
      const [y, m, d] = date.split("-").map(Number);
      const template = sourceByWeekday.get(new Date(y, m - 1, d).getDay());
      if (!template) continue;
      menu.entriesByDate[date] = template.map((e) => ({
        ...e,
        id: newId("cm"),
        date,
        meal: { ...e.meal, id: newId("meal"), isConsumed: false, consumedAt: undefined },
        createdAt: new Date().toISOString(),
      }));
      filled++;
    }

    menu.updatedAt = new Date().toISOString();
    menus[periodId] = menu;
    await saveAllMenus(menus);
    return filled;
  });
}

/** Dates in a period that have at least one pick — drives the calendar dots. */
export async function getPlannedDates(periodId: string): Promise<string[]> {
  const menu = await getCustomMenu(periodId);
  if (!menu) return [];
  return Object.entries(menu.entriesByDate)
    .filter(([, entries]) => entries.length > 0)
    .map(([date]) => date)
    .sort();
}

/** Drop a period's menu entirely (used when a period is deleted). */
export async function clearCustomMenu(periodId: string): Promise<void> {
  return withLock(async () => {
    const menus = await getAllMenus();
    if (!menus[periodId]) return;
    delete menus[periodId];
    await saveAllMenus(menus);
  });
}

// ============================================================================
// SAVED MEALS
// ============================================================================

export async function listSavedMeals(): Promise<SavedMeal[]> {
  const meals = await readJSON<SavedMeal[]>(KEYS.SAVED_MEALS, []);
  // Most-used first, then most-recent — the picker should feel like it knows you.
  return meals.sort(
    (a, b) => b.useCount - a.useCount || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
  );
}

export async function saveMeal(
  input: Omit<SavedMeal, "id" | "useCount" | "createdAt">,
): Promise<SavedMeal> {
  return withLock(async () => {
    const meals = await readJSON<SavedMeal[]>(KEYS.SAVED_MEALS, []);
    // Same name + slot is the same meal — bump it instead of duplicating.
    const existing = meals.find(
      (m) =>
        m.name.trim().toLowerCase() === input.name.trim().toLowerCase() &&
        m.defaultSlot === input.defaultSlot,
    );
    if (existing) {
      existing.meal = input.meal;
      if (input.nutrients) existing.nutrients = input.nutrients;
      await writeJSON(KEYS.SAVED_MEALS, meals);
      return existing;
    }

    const meal: SavedMeal = {
      ...input,
      id: newId("saved"),
      useCount: 0,
      createdAt: new Date().toISOString(),
    };
    meals.push(meal);
    await writeJSON(KEYS.SAVED_MEALS, meals);
    return meal;
  });
}

export async function touchSavedMeal(id: string): Promise<void> {
  return withLock(async () => {
    const meals = await readJSON<SavedMeal[]>(KEYS.SAVED_MEALS, []);
    const meal = meals.find((m) => m.id === id);
    if (!meal) return;
    meal.useCount += 1;
    meal.lastUsedAt = new Date().toISOString();
    await writeJSON(KEYS.SAVED_MEALS, meals);
  });
}

export async function deleteSavedMeal(id: string): Promise<void> {
  return withLock(async () => {
    const meals = await readJSON<SavedMeal[]>(KEYS.SAVED_MEALS, []);
    await writeJSON(
      KEYS.SAVED_MEALS,
      meals.filter((m) => m.id !== id),
    );
  });
}
