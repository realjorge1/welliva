/**
 * health-os/memory/compaction.ts
 *
 * The events → summaries pipeline, as PURE folds (no storage, no clock except the
 * injectable `computedAt`). This is where the core invariant lives:
 *
 *   a DaySummary equals the deterministic fold of its non-redacted,
 *   supersede-resolved events — `f(events) === f(events)`.
 *
 * `compactDay` resolves redaction + supersede-chains itself, so it is correct even on
 * a raw event slice (the TimelineRepository resolves too; double-resolution is a
 * harmless no-op). Weeks/months roll up FROM day summaries, never re-scanning L1.
 *
 * See docs/architecture/03-memory-architecture.md §3, 02-data-and-schema.md §8.
 */
import type {
  BodyMeasurementPayload,
  CheckinPayload,
  MealLoggedPayload,
  NutritionDayClosedPayload,
  WaterAddedPayload,
  WaterDayClosedPayload,
  WorkoutCompletedPayload,
  WorkoutSummaryPayload,
} from "../timeline/catalog";
import type { HealthEvent } from "../timeline/events";
import type {
  DayHydration,
  DayNutrition,
  DaySummary,
  DayWorkout,
  MonthSummary,
  PeriodBody,
  PeriodCheckins,
  PeriodHydration,
  PeriodNutrition,
  PeriodWorkout,
  WeekSummary,
} from "./layers";

// ── resolution (pure; mirrors TimelineRepository's redaction + supersede rules) ──

/** Drop redacted events and any original that a later event supersedes. */
function resolve(events: HealthEvent[]): HealthEvent[] {
  const superseded = new Set<string>();
  for (const e of events) if (e.supersedes) superseded.add(e.supersedes);
  return events
    .filter((e) => !e.redacted && !superseded.has(e.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function pick<T>(events: HealthEvent[], type: string): HealthEvent<T>[] {
  return events.filter((e) => e.type === type) as HealthEvent<T>[];
}

function last<T>(events: HealthEvent<T>[]): T | undefined {
  return events.length ? events[events.length - 1].payload : undefined;
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ── nutrition ──

function foldNutrition(events: HealthEvent[]): DayNutrition {
  const logged = pick<MealLoggedPayload>(events, "nutrition.meal.logged");
  const skipped = pick(events, "nutrition.meal.skipped");
  const closed = last(pick<NutritionDayClosedPayload>(events, "nutrition.day.closed"));

  const mealsLogged = logged.length;
  const mealsSkipped = skipped.length;
  const tracked = mealsLogged > 0 || mealsSkipped > 0 || closed != null;

  // Calories/macros: prefer the authoritative day-close rollup; else sum logged meals.
  const sum = (k: keyof MealLoggedPayload) =>
    logged.reduce((t, e) => t + (typeof e.payload[k] === "number" ? (e.payload[k] as number) : 0), 0);

  const calories = closed?.consumedCalories ?? sum("calories");
  const proteinG = closed?.consumedProteinG ?? sum("proteinG");
  const carbsG = closed?.consumedCarbsG ?? sum("carbsG");
  const fatG = closed?.consumedFatG ?? sum("fatG");

  const mealsConsumed = closed?.mealsConsumed ?? mealsLogged;
  const totalMeals = closed?.totalMeals ?? mealsLogged + mealsSkipped;
  const adherence = totalMeals > 0 ? Math.min(1, mealsConsumed / totalMeals) : 0;

  const status: DayNutrition["status"] = closed
    ? closed.status
    : !tracked
      ? "none"
      : mealsLogged > 0 && mealsSkipped === 0
        ? "completed"
        : mealsLogged > 0
          ? "partial"
          : "skipped";

  return {
    calories: round(calories),
    proteinG: round(proteinG),
    carbsG: round(carbsG),
    fatG: round(fatG),
    mealsLogged,
    mealsSkipped,
    mealsConsumed,
    totalMeals,
    adherence: round(adherence, 3),
    status,
    tracked,
  };
}

// ── hydration ──

function foldHydration(events: HealthEvent[]): DayHydration {
  const closed = last(pick<WaterDayClosedPayload>(events, "hydration.day.closed"));
  const added = pick<WaterAddedPayload>(events, "hydration.water.added");
  const tracked = closed != null || added.length > 0;

  if (closed) {
    return {
      ml: round(closed.ml),
      goalMl: closed.goalMl ?? null,
      metGoal: closed.metGoal,
      tracked,
    };
  }
  // Forward (live) path: fold incremental water.added events.
  const lastAdded = last(added);
  const ml = lastAdded?.totalMl ?? added.reduce((t, e) => t + (e.payload.ml || 0), 0);
  const goalMl = lastAdded?.goalMl ?? null;
  return {
    ml: round(ml),
    goalMl,
    metGoal: goalMl != null ? ml >= goalMl : false,
    tracked,
  };
}

// ── workout ──

function foldWorkout(events: HealthEvent[]): DayWorkout {
  const completed = pick<WorkoutCompletedPayload>(events, "workout.session.completed");
  const summaries = pick<WorkoutSummaryPayload>(events, "workout.session.summary");
  const tracked = completed.length > 0 || summaries.length > 0;

  const durationMin =
    completed.reduce((t, e) => t + (e.payload.durationMinutes || 0), 0) ||
    round(summaries.reduce((t, e) => t + (e.payload.durationSeconds || 0), 0) / 60);

  const pcts = [
    ...completed.map((e) => e.payload.completionPercent),
    ...summaries.map((e) => e.payload.completionPercent),
  ].filter((p): p is number => typeof p === "number");
  const completionPct = pcts.length ? round(Math.max(...pcts)) : null;

  return {
    completed: completed.length > 0,
    durationMin: round(durationMin),
    completionPct,
    sessions: completed.length || summaries.length,
    tracked,
  };
}

// ── the day fold ──

export interface CompactDayOptions {
  /** Injectable for deterministic tests; defaults to Date.now(). */
  now?: number;
}

/** Fold one local date's events into a DaySummary. Pure + deterministic. */
export function compactDay(
  rawEvents: HealthEvent[],
  date: string,
  opts: CompactDayOptions = {},
): DaySummary {
  const events = resolve(rawEvents.filter((e) => e.localDate === date));

  const body = last(pick<BodyMeasurementPayload>(events, "body.measurement.logged"));
  const checkin = last(pick<CheckinPayload>(events, "checkin.logged"));
  const milestones = pick(events, "coach.episode").length;

  return {
    date,
    nutrition: foldNutrition(events),
    hydration: foldHydration(events),
    workout: foldWorkout(events),
    ...(body && (body.weightKg != null || body.waistCm != null)
      ? { body: { weightKg: body.weightKg, waistCm: body.waistCm } }
      : {}),
    ...(checkin &&
    (checkin.mood != null ||
      checkin.energy != null ||
      checkin.stress != null ||
      checkin.sleepHours != null)
      ? {
          checkin: {
            mood: checkin.mood,
            energy: checkin.energy,
            stress: checkin.stress,
            sleepHours: checkin.sleepHours,
          },
        }
      : {}),
    milestones,
    computedAt: opts.now ?? Date.now(),
    fromEventCount: events.length,
  };
}

// ── period rollups (from day summaries, never from L1) ──

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function rollNutrition(days: DaySummary[]): PeriodNutrition {
  const tracked = days.filter((d) => d.nutrition.tracked);
  return {
    avgCalories: round(avg(tracked.map((d) => d.nutrition.calories))),
    avgProteinG: round(avg(tracked.map((d) => d.nutrition.proteinG))),
    avgCarbsG: round(avg(tracked.map((d) => d.nutrition.carbsG))),
    avgFatG: round(avg(tracked.map((d) => d.nutrition.fatG))),
    adherence: round(avg(tracked.map((d) => d.nutrition.adherence)), 3),
    trackedDays: tracked.length,
  };
}

function rollHydration(days: DaySummary[]): PeriodHydration {
  const tracked = days.filter((d) => d.hydration.tracked);
  return {
    avgMl: round(avg(tracked.map((d) => d.hydration.ml))),
    goalDays: tracked.filter((d) => d.hydration.metGoal).length,
    trackedDays: tracked.length,
  };
}

function rollWorkout(days: DaySummary[]): PeriodWorkout {
  return {
    sessions: days.reduce((t, d) => t + d.workout.sessions, 0),
    totalMinutes: round(days.reduce((t, d) => t + d.workout.durationMin, 0)),
  };
}

function rollBody(daysAsc: DaySummary[]): PeriodBody {
  const weighed = daysAsc.filter((d) => d.body?.weightKg != null);
  const startWeightKg = weighed[0]?.body?.weightKg ?? null;
  const endWeightKg = weighed[weighed.length - 1]?.body?.weightKg ?? null;
  const netKg =
    weighed.length >= 2 && startWeightKg != null && endWeightKg != null
      ? round(endWeightKg - startWeightKg, 2)
      : null;
  return { startWeightKg, endWeightKg, netKg, weighIns: weighed.length };
}

function rollCheckins(days: DaySummary[]): PeriodCheckins {
  const withCheckin = days.filter((d) => d.checkin);
  const meanOf = (k: "mood" | "energy" | "stress" | "sleepHours") => {
    const vals = withCheckin
      .map((d) => d.checkin?.[k])
      .filter((v): v is number => typeof v === "number");
    return vals.length ? round(avg(vals), 1) : null;
  };
  return {
    count: withCheckin.length,
    avgMood: meanOf("mood"),
    avgEnergy: meanOf("energy"),
    avgStress: meanOf("stress"),
    avgSleepHours: meanOf("sleepHours"),
  };
}

function sortAsc(days: DaySummary[]): DaySummary[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Roll a set of day summaries into a WeekSummary (`weekStart` = the Monday key). */
export function compactWeek(
  days: DaySummary[],
  weekStart: string,
  opts: CompactDayOptions = {},
): WeekSummary {
  const asc = sortAsc(days);
  return {
    weekStart,
    nutrition: rollNutrition(asc),
    hydration: rollHydration(asc),
    workout: rollWorkout(asc),
    body: rollBody(asc),
    checkins: rollCheckins(asc),
    computedAt: opts.now ?? Date.now(),
    fromDayCount: asc.length,
  };
}

/** Roll a set of day summaries into a MonthSummary (`periodKey` = YYYY-MM). */
export function compactMonth(
  days: DaySummary[],
  periodKey: string,
  opts: CompactDayOptions = {},
): MonthSummary {
  const asc = sortAsc(days);
  return {
    periodKey,
    nutrition: rollNutrition(asc),
    hydration: rollHydration(asc),
    workout: rollWorkout(asc),
    body: rollBody(asc),
    checkins: rollCheckins(asc),
    computedAt: opts.now ?? Date.now(),
    fromDayCount: asc.length,
  };
}
