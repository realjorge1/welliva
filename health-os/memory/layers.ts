/**
 * health-os/memory/layers.ts
 *
 * The Layer-2 (Summaries) types — the bounded, pre-digested read-model the Context
 * builder and every AI feature consume instead of paging the raw Timeline (L1). A
 * DaySummary is the deterministic fold of one local date's non-redacted events; weeks
 * and months roll up *from day summaries*, never re-scanning L1.
 *
 * See docs/architecture/03-memory-architecture.md §1–3.
 */

/** One local date's compacted record — Memory layer 2, the default AI interface. */
export interface DaySummary {
  /** YYYY-MM-DD (local). */
  date: string;
  nutrition: DayNutrition;
  hydration: DayHydration;
  workout: DayWorkout;
  /** Latest body measurement of the day, if any. */
  body?: { weightKg?: number; waistCm?: number };
  /** Latest self-reported check-in of the day, if any. */
  checkin?: { mood?: number; energy?: number; stress?: number; sleepHours?: number };
  /** Coach milestone beats (`coach.episode`) recorded that day. */
  milestones: number;
  /** Epoch ms the summary was computed — drives staleness / recompaction. */
  computedAt: number;
  /** How many non-redacted events folded in — audit + dirty detection. */
  fromEventCount: number;
}

export interface DayNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Meals the user logged as eaten. */
  mealsLogged: number;
  /** Meals explicitly skipped. */
  mealsSkipped: number;
  /** From the day-close rollup (planned meals consumed / total). */
  mealsConsumed: number;
  totalMeals: number;
  /** 0–1, **meals-based** (mealsConsumed/totalMeals) — self-contained, no target needed. */
  adherence: number;
  status: "completed" | "partial" | "skipped" | "none";
  /** True when the day had any nutrition events at all. */
  tracked: boolean;
}

export interface DayHydration {
  ml: number;
  goalMl: number | null;
  metGoal: boolean;
  tracked: boolean;
}

export interface DayWorkout {
  completed: boolean;
  durationMin: number;
  /** 0–100, or null when not tracked. */
  completionPct: number | null;
  sessions: number;
  tracked: boolean;
}

/** A Monday-anchored week rollup (layer 2). */
export interface WeekSummary {
  /** YYYY-MM-DD of the Monday (the week key). */
  weekStart: string;
  nutrition: PeriodNutrition;
  hydration: PeriodHydration;
  workout: PeriodWorkout;
  body: PeriodBody;
  checkins: PeriodCheckins;
  computedAt: number;
  /** Day summaries that rolled in. */
  fromDayCount: number;
}

/** A calendar-month rollup (layer 2) — feeds MonthlyRecapService. */
export interface MonthSummary {
  /** YYYY-MM. */
  periodKey: string;
  nutrition: PeriodNutrition;
  hydration: PeriodHydration;
  workout: PeriodWorkout;
  body: PeriodBody;
  checkins: PeriodCheckins;
  computedAt: number;
  fromDayCount: number;
}

export interface PeriodNutrition {
  avgCalories: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  /** 0–1, mean adherence over tracked days. */
  adherence: number;
  trackedDays: number;
}

export interface PeriodHydration {
  avgMl: number;
  goalDays: number;
  trackedDays: number;
}

export interface PeriodWorkout {
  sessions: number;
  totalMinutes: number;
}

export interface PeriodBody {
  startWeightKg: number | null;
  endWeightKg: number | null;
  /** end − start, signed, or null with <2 weigh-ins. */
  netKg: number | null;
  weighIns: number;
}

export interface PeriodCheckins {
  count: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  avgSleepHours: number | null;
}

/**
 * The summary manifest: which day summaries exist + which days are dirty (need
 * recompaction after a correction/redaction). Kept tiny so the Memory Center and the
 * Context builder can answer "what's summarized" without loading any summary.
 */
export interface SummaryIndex {
  /** Day keys (YYYY-MM-DD) with a persisted DaySummary, ascending. */
  days: string[];
  /** Days whose events changed since last compaction — recomputed lazily on read. */
  dirtyDays: string[];
  updatedAt: number;
}

export const EMPTY_SUMMARY_INDEX: SummaryIndex = {
  days: [],
  dirtyDays: [],
  updatedAt: 0,
};
