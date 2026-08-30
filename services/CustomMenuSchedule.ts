/**
 * CustomMenuSchedule — the bridge that makes a hand-planned day actually arrive.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * Custom menus were written to their own store (MealPlanService's CustomMenu)
 * and read back by exactly one screen: the planner that wrote them. Every other
 * part of the app — today's plan, ticking a meal off, the backlog prompt, day-end
 * history, the closing period report — reads SCHEDULED_DIETS via ScheduleService.
 * Nothing ever moved one to the other, so "Thursday dinner: mac and cheese" was
 * real on Tuesday and gone on Thursday. Worse: the rollover generator saw an
 * unscheduled day and filled it with a diet the user had explicitly opted out of.
 *
 * So a custom pick is MATERIALISED into a DaySchedule the moment it is made. The
 * planner stays the source of truth (it can be re-edited, copied, repeated); this
 * module projects that truth into the shape the rest of the app already speaks.
 *
 * ── WHY MATERIALISE RATHER THAN TEACH getTodayDiet ABOUT CUSTOM MENUS ───────
 * Because consumption is the point. A meal the user cannot TICK is decoration:
 * adherence, streaks, the backlog prompt and the period report are all computed
 * from ScheduledMeal.isConsumed inside a DaySchedule. Teaching the reader about
 * a second store would mean teaching every writer too. Projecting into the one
 * store means every existing behaviour works on custom days for free.
 *
 * ── THE INVARIANT CUSTOM MODE LIVES BY ──────────────────────────────────────
 * IT NEVER FILLS A GAP. A slot the user didn't pick is written as null, and a day
 * with no picks at all has its schedule REMOVED rather than left half-built —
 * which is also what stops an empty day from being scored as a failure.
 *
 * TWO THINGS MUST SURVIVE A RE-PROJECTION, and the repair pass runs on every
 * app open, so getting either wrong is silent daily data loss:
 *
 *  1. WHAT THE USER ALREADY ATE. Consumption is carried across by name, so
 *     re-planning tomorrow can't quietly un-eat today's breakfast.
 *
 *  2. FOOD THEY ADDED TO THE DAY THEMSELVES. Snacks reach a day from outside
 *     the planner too — Gozlin's "log that as a snack", the Foods catalog —
 *     and the projection used to rebuild `snacks` from the menu ALONE. Every
 *     one of those was therefore deleted, with its calories, by the next launch:
 *     logged, visibly counted, gone by morning. They are preserved below, keyed
 *     by name so an upgrade doesn't duplicate ones already on the day.
 */

import type { DaySchedule, MealType, ScheduledMeal } from "../models/diet";
import type { CustomMenuEntry, MealPlanPeriod } from "../models/mealPlan";
import { getCustomEntriesForDate, getPlannedDates } from "./MealPlanService";
import {
  clearScheduledDiet,
  getScheduleForDate,
  getScheduledDates,
  saveDaySchedule,
} from "./ScheduleService";

/**
 * The diet id every materialised custom day carries.
 *
 * Deliberately not a real catalog id. Screens that look a diet up by id get
 * `undefined` and fall back to their no-diet branch, which is correct — a
 * hand-picked menu follows no diet, and pretending otherwise would offer "swap
 * for another Mediterranean option" on a day the user built themselves.
 */
export const CUSTOM_DIET_ID = "custom-menu";

/** Is this day one we projected, rather than one the generator wrote? */
export function isCustomSchedule(schedule: { dietId: string } | null): boolean {
  return schedule?.dietId === CUSTOM_DIET_ID;
}

/**
 * Project one day of a custom period into the schedule store.
 *
 * Returns whether a schedule now exists for that date, so callers can report
 * "3 days planned" from what is actually on the calendar rather than from what
 * they hoped they wrote.
 */
export async function syncCustomDay(
  period: MealPlanPeriod,
  date: string,
  today: string,
): Promise<boolean> {
  const entries = await getCustomEntriesForDate(period.id, date);
  const existing = await getScheduleForDate(date);

  if (entries.length === 0) {
    // Nothing planned. Remove only a day WE wrote — a generated day belongs to
    // the generator, and deleting it here would silently erase a plan the user
    // may already have eaten from.
    if (!isCustomSchedule(existing)) return false;
    // …and not even ours, if the user has since logged food onto it. An emptied
    // menu means "I have no plan for this day", never "I ate nothing".
    const strays = adHocSnacks(existing, []);
    if (strays.length > 0) {
      await saveDaySchedule({
        ...emptyCustomDay(period, date, today),
        snacks: strays,
      });
      return true;
    }
    await clearScheduledDiet(date);
    return false;
  }

  await saveDaySchedule(buildDaySchedule(period, date, entries, existing, today));
  return true;
}

/** Project several days. Sequential — each write reads the store back. */
export async function syncCustomDays(
  period: MealPlanPeriod,
  dates: string[],
  today: string,
): Promise<number> {
  let planned = 0;
  for (const date of dates) {
    if (await syncCustomDay(period, date, today)) planned++;
  }
  return planned;
}

/**
 * Re-project every day that has picks.
 *
 * The repair path: it fixes menus planned before this bridge existed, and it is
 * what a bulk action ("copy to the rest of the week") calls rather than tracking
 * which of thirty dates it touched.
 */
export async function syncWholeCustomPeriod(
  period: MealPlanPeriod,
  today: string,
): Promise<number> {
  const planned = await getPlannedDates(period.id);
  // Also visit days INSIDE this period that we previously projected but which
  // no longer have picks — otherwise emptying a day in the planner leaves its
  // old projection standing, still serving meals the user just deleted, with
  // nothing left in the menu to lead us back to it.
  const scheduled = (await getScheduledDates()).filter(
    (date) => date >= period.startDate && date <= period.endDate,
  );
  const dates = [...new Set([...planned, ...scheduled])].sort();
  return syncCustomDays(period, dates, today);
}

// ============================================================================
// BUILD
// ============================================================================

function buildDaySchedule(
  period: MealPlanPeriod,
  date: string,
  entries: CustomMenuEntry[],
  existing: DaySchedule | null,
  today: string,
): DaySchedule {
  const carry = consumptionIndex(existing);
  const pick = (slot: Exclude<MealType, "snack">): ScheduledMeal | null => {
    const entry = entries.find((e) => e.slot === slot);
    return entry ? restore(entry.meal, slot, carry) : null;
  };

  const planned = entries
    .filter((e) => e.slot === "snack")
    .map((e) => restore(e.meal, "snack", carry));

  return {
    ...emptyCustomDay(period, date, today),
    breakfast: pick("breakfast"),
    lunch: pick("lunch"),
    dinner: pick("dinner"),
    // Planned snacks first, then anything the user logged onto the day from
    // outside the planner. Dropping the second group is what used to erase a
    // logged food on the next launch.
    snacks: [...planned, ...adHocSnacks(existing, planned)],
  };
}

/** The shell of a projected day: identity and status, no meals. */
function emptyCustomDay(
  period: MealPlanPeriod,
  date: string,
  today: string,
): DaySchedule {
  return {
    date,
    dietId: CUSTOM_DIET_ID,
    dietName: period.label,
    breakfast: null,
    lunch: null,
    dinner: null,
    snacks: [],
    // Matches scheduleDietForDay's rule. Past days are left "active" rather than
    // pre-closed: processDayEnd is what closes a day, and stamping the status
    // here would let a re-edit of yesterday skip the sweep that writes history.
    status: date > today ? "upcoming" : "active",
  };
}

/**
 * Snacks already on the day that the menu did not put there.
 *
 * Matched by name against what we are about to write, for the same reason
 * consumption is: ids are re-minted on every edit, so an id comparison would
 * class every planned snack as a stray and duplicate the whole list on the
 * first launch after this shipped.
 */
function adHocSnacks(
  existing: DaySchedule | null,
  planned: ScheduledMeal[],
): ScheduledMeal[] {
  if (!existing || !Array.isArray(existing.snacks)) return [];
  const plannedNames = new Set(planned.map((m) => nameKey(m.name)));
  const seen = new Set<string>();
  return existing.snacks.filter((snack) => {
    const key = nameKey(snack?.name ?? "");
    if (!key || plannedNames.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * What was already eaten on this date, keyed by slot + meal name.
 *
 * Name-keyed rather than id-keyed on purpose: MealPlanService mints a fresh
 * entry id on every edit, so ids never survive a re-projection, while the name is
 * exactly what the user ticked. Swapping a slot's meal for a different one
 * correctly loses the tick — that meal was not the one they ate.
 */
function consumptionIndex(schedule: DaySchedule | null): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  if (!schedule) return map;
  const add = (meal: ScheduledMeal | null) => {
    if (meal?.isConsumed) map.set(consumptionKey(meal.mealType, meal.name), meal.consumedAt);
  };
  add(schedule.breakfast);
  add(schedule.lunch);
  add(schedule.dinner);
  for (const snack of schedule.snacks) add(snack);
  return map;
}

const consumptionKey = (slot: MealType, name: string) =>
  `${slot}:${name.trim().toLowerCase()}`;

function restore(
  meal: ScheduledMeal,
  slot: MealType,
  carry: Map<string, string | undefined>,
): ScheduledMeal {
  const key = consumptionKey(slot, meal.name);
  if (!carry.has(key)) {
    // `consumedAt` is dropped, not just flagged false: a stored entry can carry a
    // stale timestamp, and a meal that reads "not eaten" while still naming the
    // minute it was eaten is the kind of contradiction day-end learning trusts.
    const { consumedAt: _dropped, ...rest } = meal;
    return { ...rest, mealType: slot, isConsumed: false };
  }
  const consumedAt = carry.get(key);
  return {
    ...meal,
    mealType: slot,
    isConsumed: true,
    ...(consumedAt ? { consumedAt } : {}),
  };
}
