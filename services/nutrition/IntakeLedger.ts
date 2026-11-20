/**
 * INTAKE LEDGER — what the user actually ate, recorded when they said so.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The day's calories used to be derived by re-reading the plan document
 * (SCHEDULED_DIETS) and adding up whichever meals still carried
 * `isConsumed: true`. That makes the total a function of a document SIX
 * different code paths rewrite:
 *
 *   · the daily generator and the AI backend (a regenerated day)
 *   · the midnight rollover
 *   · the custom-menu projection, which re-runs on every single app open
 *   · a meal swap
 *   · the cloud sync adopting a remote copy
 *   · retention pruning
 *
 * Every one of those is a chance to hand back a day that no longer remembers
 * being eaten, and each one was fixed as it was found — which is not the same
 * as being fixed. A total that can only be as durable as the least careful
 * writer of an unrelated document is not durable; it is lucky.
 *
 * So the tick became its own record. Marking a meal eaten appends an immutable
 * line here, carrying the macros AS THEY WERE at that moment. The day's intake
 * is the sum of those lines. Nothing that rewrites the plan can change it,
 * because the plan is no longer what is being counted — and a plan regenerated
 * into completely different meals cannot erase this morning's breakfast, which
 * is the one thing every version of this bug had in common.
 *
 * ── IT ALSO HEALS THE PLAN ──────────────────────────────────────────────────
 * `healSchedule` runs on every schedule read and reconciles the two in BOTH
 * directions: ticks in the ledger are restored onto the plan (so a rewritten
 * day comes back ticked), and ticks on the plan that predate the ledger are
 * recorded into it (so existing users are migrated by simply opening the app,
 * with no migration step to forget or get wrong).
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * Not adherence. "How much of the plan did you follow?" is still counted off
 * the plan, because that question is ABOUT the plan. This answers the other
 * one: what went in. See services/nutrition/DayTotals, which sums this and the
 * free-form food log into the single number every screen shows.
 */

import type { DaySchedule, MealType, ScheduledMeal } from "../../models/diet";
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";
import { pruneDatedRecord, RETENTION_DAYS } from "../sync/retention";
import { markActivated, track, type FoodLogSource } from "../telemetry";
import { macrosOfMeal } from "./DayTotals";

/** One meal, eaten, with the numbers it had when it was eaten. */
export interface IntakeRecord {
  /** Slot it was eaten in. Snacks share a slot; they are separate records. */
  slot: MealType;
  /** The meal's name at the time — the identity the plan is matched on. */
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** ISO timestamp of the tick. Drives meal-time learning. */
  at: string;
  /**
   * How much of the planned meal she ate (0.5 = half, 2 = double). Absent = 1,
   * as planned. The macros above are ALREADY scaled by it — this is kept so
   * the plan can show "½×" and a later change can rescale from the base.
   */
  portion?: number;
  /**
   * Stable identity for the cloud merge (`slot#name#at`). Records written
   * before 2026-11-20 have none and merge by their whole content, as before.
   */
  id?: string;
  /** ISO time of the last change to this line (a portion edit): newest wins in a merge. */
  loggedAt?: string;
}

/** The portions offered after a tick ("Less", "As planned", "Double"…). */
export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type IntakeLedger = Record<string, IntakeRecord[]>;

/**
 * Name-keyed identity, matching the rule CustomMenuSchedule already carries
 * consumption by. Ids are re-minted every time a meal is written, so an id can
 * never survive the rewrites this module exists to be immune to; the name is
 * what the user actually ticked.
 */
const nameKey = (name: string): string => (name ?? "").trim().toLowerCase();
const identity = (slot: MealType, name: string): string => `${slot}#${nameKey(name)}`;

/**
 * Snapshot a meal as it is right now.
 *
 * Macros come from DayTotals.macrosOfMeal — the same reader every display path
 * uses — so a recorded number can never disagree with the number the meal
 * itself would have shown.
 */
export function recordFor(
  meal: ScheduledMeal,
  slot: MealType,
  at: string,
  portion: number = meal.portionEaten ?? 1,
): IntakeRecord {
  const p = Number.isFinite(portion) && portion > 0 ? portion : 1;
  const m = macrosOfMeal(meal);
  return {
    slot,
    name: meal.name,
    calories: m.calories * p,
    proteinG: m.proteinG * p,
    carbsG: m.carbsG * p,
    fatG: m.fatG * p,
    at,
    ...(p !== 1 ? { portion: p } : {}),
    id: recordId(slot, meal.name, at),
    loggedAt: at,
  };
}

/** The merge identity of a tick: what was eaten, in which slot, when. */
export function recordId(slot: MealType, name: string, at: string): string {
  return `${identity(slot, name)}#${at}`;
}

// ============================================================================
// STORE
// ============================================================================

let opChain: Promise<unknown> = Promise.resolve();

/** Serialize read-modify-write cycles, exactly as the schedule store does. */
function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readLedger(): Promise<IntakeLedger> {
  return readJSON<IntakeLedger>(KEYS.INTAKE_LEDGER, {});
}

async function writeLedger(ledger: IntakeLedger): Promise<void> {
  const pruned = await pruneDatedRecord(ledger, RETENTION_DAYS.FOOD_LOG);
  await writeJSON(KEYS.INTAKE_LEDGER, pruned);
}

/** Everything recorded as eaten on a date. */
export async function getIntakeForDate(date: string): Promise<IntakeRecord[]> {
  const ledger = await readLedger();
  const day = ledger[date];
  return Array.isArray(day) ? day : [];
}

/**
 * Record one meal as eaten.
 *
 * `source` is for analytics only and never touches the ledger. It defaults to
 * "manual" so no existing caller changes behaviour; the paths that know better
 * (the menu tick, a barcode scan, a photo, the coach) pass their own. Nothing
 * about the FOOD is reported — see services/telemetry/events.ts.
 */
export async function recordIntake(
  date: string,
  record: IntakeRecord,
  source: FoodLogSource = "manual",
): Promise<void> {
  await withLock(async () => {
    const ledger = await readLedger();
    const day = Array.isArray(ledger[date]) ? [...ledger[date]] : [];
    day.push(record);
    ledger[date] = day;
    await writeLedger(ledger);
  });

  // After the write, so a logging failure is never counted as a log. This is the
  // one place every food path converges, which makes it the honest place to ask
  // "has this install started using the product?".
  track("food_logged", { source });
  void markActivated();
}

/**
 * Un-record one meal. Removes the most recent line matching slot + name, so
 * un-ticking one of two identical snacks removes one of them rather than both.
 */
export async function unrecordIntake(
  date: string,
  slot: MealType,
  name: string,
): Promise<void> {
  return withLock(async () => {
    const ledger = await readLedger();
    const day = ledger[date];
    if (!Array.isArray(day) || day.length === 0) return;
    const key = identity(slot, name);
    for (let i = day.length - 1; i >= 0; i--) {
      if (identity(day[i].slot, day[i].name) === key) {
        const next = [...day.slice(0, i), ...day.slice(i + 1)];
        if (next.length === 0) delete ledger[date];
        else ledger[date] = next;
        await writeLedger(ledger);
        return;
      }
    }
  });
}

/**
 * Change how much of a ticked meal she ate. Rescales the most recent matching
 * line from its own base (macros ÷ old portion × new), keeps its tick time,
 * and stamps `loggedAt` so the edit wins a cloud merge against the old copy.
 *
 * The merge limit, stated: a line ticked BEFORE 2026-11-20 on another phone
 * has no `id`, so an edit here and the old copy there both survive a merge (the
 * same way an un-tick can come back today). Lines ticked since carry an id and
 * merge as one, newest edit winning.
 */
export async function setIntakePortion(
  date: string,
  slot: MealType,
  name: string,
  portion: number,
  now: Date = new Date(),
): Promise<IntakeRecord | null> {
  if (!(Number.isFinite(portion) && portion > 0)) return null;
  return withLock(async () => {
    const ledger = await readLedger();
    const day = Array.isArray(ledger[date]) ? [...ledger[date]] : [];
    const key = identity(slot, name);
    for (let i = day.length - 1; i >= 0; i--) {
      const r = day[i]!;
      if (identity(r.slot, r.name) !== key) continue;
      const old = r.portion && r.portion > 0 ? r.portion : 1;
      if (old === portion) return r;
      const k = portion / old;
      const next: IntakeRecord = {
        ...r,
        calories: r.calories * k,
        proteinG: r.proteinG * k,
        carbsG: r.carbsG * k,
        fatG: r.fatG * k,
        portion,
        id: r.id ?? recordId(r.slot, r.name, r.at),
        loggedAt: now.toISOString(),
      };
      if (portion === 1) delete next.portion;
      day[i] = next;
      ledger[date] = day;
      await writeLedger(ledger);
      return next;
    }
    return null;
  });
}

// ============================================================================
// HEALING — the two documents reconciled, in both directions
// ============================================================================

export interface HealResult {
  /** The schedule with its ticks restored. Same object identity when unchanged. */
  schedule: DaySchedule;
  /** Ticks found on the plan that the ledger had never heard of. */
  missing: IntakeRecord[];
  /** Whether any tick was restored ONTO the schedule. */
  restored: boolean;
}

/**
 * Reconcile a schedule against the day's ledger.
 *
 * Pure — it returns what should be written rather than writing it, so the
 * ordering and locking stay with the store that owns each document.
 *
 * Matching is by slot + name, positionally within a group: the second "Banana"
 * snack on the plan pairs with the second banana record, so a day with repeats
 * neither loses a tick nor invents one. A record with no meal left to pair with
 * (the plan was regenerated into something else entirely) simply keeps its
 * calories in the ledger, where the day's total is read from.
 */
export function healSchedule(
  schedule: DaySchedule,
  records: readonly IntakeRecord[],
): HealResult {
  // How many records are available per identity, and the timestamp of each.
  const available = new Map<string, IntakeRecord[]>();
  for (const record of records) {
    const key = identity(record.slot, record.name);
    const list = available.get(key);
    if (list) list.push(record);
    else available.set(key, [record]);
  }

  const missing: IntakeRecord[] = [];
  let restored = false;

  const reconcile = (
    meal: ScheduledMeal | null,
    slot: MealType,
  ): ScheduledMeal | null => {
    if (!meal) return meal;
    const key = identity(slot, meal.name);
    const list = available.get(key);
    const record = list && list.length > 0 ? list.shift() : undefined;

    if (record) {
      // The plan mirrors how much she ate, so the row can say "½×".
      const portion = record.portion && record.portion > 0 ? record.portion : 1;
      if (meal.isConsumed && (meal.portionEaten ?? 1) === portion) return meal;
      // The ledger says this was eaten and the plan has forgotten — the exact
      // damage every rewrite of the plan used to do. Put the tick back (and
      // the portion with it).
      restored = true;
      const healed: ScheduledMeal = {
        ...meal,
        isConsumed: true,
        consumedAt: meal.isConsumed ? meal.consumedAt : record.at,
      };
      if (portion !== 1) healed.portionEaten = portion;
      else delete healed.portionEaten;
      return healed;
    }

    if (meal.isConsumed) {
      // Ticked on the plan, absent from the ledger: either a tick that predates
      // this module (every existing user, on their next app open) or one written
      // by a path that hasn't been taught to record. Adopt it.
      missing.push(recordFor(meal, slot, meal.consumedAt ?? new Date().toISOString()));
    }
    return meal;
  };

  const healed: DaySchedule = {
    ...schedule,
    breakfast: reconcile(schedule.breakfast, "breakfast"),
    lunch: reconcile(schedule.lunch, "lunch"),
    dinner: reconcile(schedule.dinner, "dinner"),
    snacks: Array.isArray(schedule.snacks)
      ? schedule.snacks.map((s) => reconcile(s, "snack")).filter((s): s is ScheduledMeal => !!s)
      : [],
  };

  return { schedule: restored ? healed : schedule, missing, restored };
}

/** Append records the plan knew about and the ledger did not. */
export async function adoptMissing(
  date: string,
  missing: readonly IntakeRecord[],
): Promise<void> {
  if (missing.length === 0) return;
  return withLock(async () => {
    const ledger = await readLedger();
    const day = Array.isArray(ledger[date]) ? [...ledger[date]] : [];
    ledger[date] = [...day, ...missing];
    await writeLedger(ledger);
  });
}
