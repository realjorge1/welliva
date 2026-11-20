/**
 * health-os/timeline/writers.ts — the LIVE writers of the two events the
 * learning model eats: a closed food day and a weigh-in.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * `nutrition.day.closed` and `body.measurement.logged` reached the timeline
 * ONLY through migration 001, the one-time first-launch backfill. Nothing wrote
 * them afterwards, so for anyone who installed after that import shipped the
 * calorie model (learning/tdee.ts) had never seen a meal or a weigh-in, and
 * for everyone else it stopped learning on the day of the import.
 *
 * ── IDEMPOTENT BY CONSTRUCTION ──────────────────────────────────────────────
 * Day-close runs on every app open for every open day (it recomputes the
 * history row), and a weigh-in can be re-logged the same day. So each writer:
 *   · builds the event with migration 001's own deterministic id seed for a
 *     closed day (`diet:<date>:dayclosed`), so a re-emit is a no-op and never
 *     duplicates a backfilled row (append is idempotent on id);
 *   · if the day already has its event with the SAME payload, does nothing;
 *   · if the payload changed (a back-logged meal, "That's everything", a
 *     re-weigh), CORRECTS the existing head by append (supersede) — the
 *     timeline's own audited edit — so the resolved read is always the latest.
 * Weigh-ins: 001 seeded them by array INDEX (`body:<i>:<date>`), which a live
 * writer can't reproduce, so a weigh-in is matched by DATE instead (the store
 * keeps one per date) and a new one is seeded `body:live:<date>`.
 *
 * Writers never throw into the caller: a failure logs once and is dropped
 * (migration 005 catches any day the timeline is missing on the next launch).
 */
import type { DietHistoryEntry } from "@/models/diet";
import type { BodyLogEntry } from "@/models/workout";

import { localMidnightISO, localMidnightMs } from "../platform/clock";
import { ulidFromSeed } from "../platform/id";
import type { BodyMeasurementPayload, NutritionDayClosedPayload } from "./catalog";
import { buildEvent, type EventSource, type HealthEvent } from "./events";
import { timeline, type TimelineRepository } from "./TimelineRepository";

/* ─────────────────────────────── builders ─────────────────────────────────*/

/** The day-closed payload — exactly migration 001's, plus day status when known. */
export function dayClosedPayload(d: DietHistoryEntry): NutritionDayClosedPayload {
  return {
    dietId: d.dietId,
    dietName: d.dietName,
    mealsConsumed: d.mealsConsumed,
    totalMeals: d.totalMeals,
    status: d.status,
    consumedCalories: d.consumedCalories,
    consumedProteinG: d.consumedProteinG,
    consumedCarbsG: d.consumedCarbsG,
    consumedFatG: d.consumedFatG,
    ...(d.loggedness ? { loggedness: d.loggedness } : {}),
    ...(typeof d.targetCalories === "number" ? { targetCalories: d.targetCalories } : {}),
  };
}

export const dayClosedSeed = (date: string) => `diet:${date}:dayclosed`;

export function dayClosedEvent(
  d: DietHistoryEntry,
  source: EventSource,
): HealthEvent<NutritionDayClosedPayload> {
  return buildEvent<NutritionDayClosedPayload>({
    type: "nutrition.day.closed",
    id: ulidFromSeed(dayClosedSeed(d.date), localMidnightMs(d.date)),
    localDate: d.date,
    ts: localMidnightISO(d.date),
    source,
    payload: dayClosedPayload(d),
  });
}

export function bodyPayload(b: BodyLogEntry): BodyMeasurementPayload {
  return { weightKg: b.weightKg, waistCm: b.waistCm, notes: b.notes };
}

/** 001's seed (by position in the stored array) — kept for the backfill only. */
export const backfillBodySeed = (index: number, date: string) => `body:${index}:${date}`;
/** The live writer's seed: one weigh-in per date. */
export const liveBodySeed = (date: string) => `body:live:${date}`;

export function bodyEvent(
  b: BodyLogEntry,
  seed: string,
  source: EventSource,
): HealthEvent<BodyMeasurementPayload> {
  return buildEvent<BodyMeasurementPayload>({
    type: "body.measurement.logged",
    id: ulidFromSeed(seed, localMidnightMs(b.date)),
    localDate: b.date,
    ts: localMidnightISO(b.date),
    source,
    payload: bodyPayload(b),
  });
}

/* ──────────────────────────────── live writers ─────────────────────────────*/

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

let logged = false;
function logOnce(what: string, e: unknown) {
  if (logged) return;
  logged = true;
  console.log(`[timeline] ${what} not written (migration 005 will catch the day up)`, e);
}

/**
 * Put one event for a date in place: nothing if it's already there as-is, a
 * correction of the current head if it changed, an append if it's new.
 */
async function upsertForDay<T>(
  repo: TimelineRepository,
  type: HealthEvent["type"],
  fresh: HealthEvent<T>,
): Promise<void> {
  const existing = (await repo.byDay(fresh.localDate)).filter((e) => e.type === type);
  if (existing.some((e) => same(e.payload, fresh.payload))) return;
  if (existing.length > 0) {
    // The newest head (ids sort by time; corrections append "~cN").
    const head = [...existing].sort((a, b) => (a.id < b.id ? 1 : -1))[0]!;
    await repo.correct(head.id, fresh.payload);
    return;
  }
  await repo.append(fresh);
}

/** Write (or update) a closed food day. Never throws. */
export async function emitDayClosed(d: DietHistoryEntry, repo: TimelineRepository = timeline): Promise<void> {
  try {
    if (!d?.date) return;
    await upsertForDay(repo, "nutrition.day.closed", dayClosedEvent(d, "app"));
  } catch (e) {
    logOnce("closed day", e);
  }
}

/** Write (or update) a weigh-in. Never throws. */
export async function emitBodyMeasurement(b: BodyLogEntry, repo: TimelineRepository = timeline): Promise<void> {
  try {
    if (!b?.date || !(typeof b.weightKg === "number" || typeof b.waistCm === "number")) return;
    await upsertForDay(repo, "body.measurement.logged", bodyEvent(b, liveBodySeed(b.date), "app"));
  } catch (e) {
    logOnce("weigh-in", e);
  }
}
