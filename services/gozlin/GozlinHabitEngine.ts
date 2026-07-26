/**
 * GOZLIN — Habit Awareness System (Phase 7).
 *
 * The Behavioral-Psychologist brain. It learns the user as a person — not just a
 * set of fitness metrics — across life domains: workouts, nutrition, hydration,
 * consistency, and (from optional self-reported check-ins) sleep and mood. From
 * those it builds:
 *
 *   • Behavior Scores   — a 0–100 read per domain, with the evidence behind it.
 *   • Habit Patterns    — learned, confidence-gated observations
 *                         ("you usually miss Wednesday workouts";
 *                          "your best weeks start with a Monday workout";
 *                          "you snack more on stressful days").
 *   • Habit Risks       — behavior prediction: the slips it sees coming.
 *   • Habit Rescues     — concrete recovery strategies for those slips.
 *
 * Pure & deterministic over local history + on-device check-ins (inject `now`).
 * Composes the existing detectHabits (nutrition slot mining) and the Twin — it
 * adds no new scoring of nutrition/recovery; it reads behavior, kindly and
 * specifically, so accountability feels understood rather than nagged.
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { GeneratedWorkoutPlan, WorkoutLogEntry } from "../../models/workout";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import { detectHabits } from "./GozlinProgressEngine";
import type {
  BehaviorScore,
  BehaviorTrend,
  GozlinCheckin,
  GozlinHabitReport,
  GozlinTone,
  GozlinTwin,
  HabitDomain,
  HabitPattern,
  HabitRescue,
  HabitRisk,
} from "./gozlin.types";

// ── Tunables ────────────────────────────────────────────────────────
const PATTERN_WINDOW = 28; // days of history for slot/skip mining
const ANCHOR_WINDOW = 49; // ~7 weeks for keystone-habit detection
const CHECKIN_WINDOW = 14; // days of check-ins for sleep/mood reads
const LINK_GAP = 0.15; // adherence gap that makes a mood/sleep link "real"
const SLEEP_SHORT = 6.5; // hours below which sleep is "short"

const DOW_LABEL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ── small helpers ───────────────────────────────────────────────────
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function adhPct(h: DietHistoryEntry): number {
  return h.totalMeals > 0 ? h.mealsConsumed / h.totalMeals : 0;
}

function datesBack(today: string, days: number): Set<string> {
  const end = parseLocalDate(today);
  const out = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.add(toLocalDateString(d));
  }
  return out;
}

/** Calendar dates (YYYY-MM-DD) within the last `days`, oldest→newest. */
function calendarBack(today: string, days: number): string[] {
  const end = parseLocalDate(today);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(toLocalDateString(d));
  }
  return out;
}

/** Monday-of-week key for a date (weeks are Monday-based, per Welliva). */
function weekKey(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const offset = (d.getDay() + 6) % 7; // 0 for Monday
  d.setDate(d.getDate() - offset);
  return toLocalDateString(d);
}

/** Plan dayOfWeek (0=Mon…6=Sun) → JS getDay() space (0=Sun…6=Sat). */
function planDayToGetDay(planIdx: number): number {
  return planIdx === 6 ? 0 : planIdx + 1;
}

function sessionsInRange(
  log: WorkoutLogEntry[],
  today: string,
  fromDaysAgo: number,
  toDaysAgo: number,
): number {
  const end = parseLocalDate(today);
  const win = new Set<string>();
  for (let i = fromDaysAgo; i < toDaysAgo; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    win.add(toLocalDateString(d));
  }
  return log.filter((l) => win.has(l.date)).length;
}

function trendFromDelta(curr: number, prev: number, eps: number): BehaviorTrend {
  if (curr > prev + eps) return "rising";
  if (curr < prev - eps) return "cooling";
  return "steady";
}

function band(score: number): string {
  return score >= 75 ? "Strong" : score >= 55 ? "Solid" : score >= 40 ? "Building" : "Fragile";
}

// ════════════════════════════════════════════════════════════════════

export interface HabitReportInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  workoutPlan: GeneratedWorkoutPlan | null;
  checkins: GozlinCheckin[];
  weeklyWorkoutTarget: number;
  now?: Date;
}

// ════════════════════════════════════════════════════════════════════
// 1. PATTERN MINING
// ════════════════════════════════════════════════════════════════════

export function detectHabitPatterns(input: HabitReportInput): HabitPattern[] {
  const { twin, dietHistory, workoutLog, workoutPlan, checkins } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const patterns: HabitPattern[] = [];

  // ── Nutrition slot patterns (reuse the existing miner, tag the domain) ──
  for (const p of detectHabits({ dietHistory, workoutLog, twin, now })) {
    const domain: HabitDomain = p.kind === "consistency" ? "consistency" : "nutrition";
    patterns.push({ ...p, domain });
  }

  // ── Workout skip pattern — "you usually miss Wednesday workouts" ──
  const skip = detectWorkoutSkip(workoutLog, workoutPlan, today);
  if (skip) patterns.push(skip);

  // ── Keystone / anchor — "your best weeks start with a Monday workout" ──
  const anchor = detectAnchor(dietHistory, workoutLog, workoutPlan, today);
  if (anchor) patterns.push(anchor);

  // ── Mood link — "you snack more on stressful days" ──
  const mood = detectMoodLink(dietHistory, checkins, today);
  if (mood) patterns.push(mood);

  // ── Sleep link — "short nights cost you the next day" ──
  const sleep = detectSleepLink(dietHistory, checkins, today);
  if (sleep) patterns.push(sleep);

  // ── Bad habit — recurring calorie creep against a deficit goal ──
  const bad = detectCalorieCreep(dietHistory, twin, today);
  if (bad) patterns.push(bad);

  // Confidence-gated (Phase 2 §9), strongest first.
  return patterns
    .filter((p) => p.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

function detectWorkoutSkip(
  log: WorkoutLogEntry[],
  plan: GeneratedWorkoutPlan | null,
  today: string,
): HabitPattern | null {
  if (!plan) return null;
  const trainingDays = new Set(
    plan.sessions.filter((s) => !s.isRestDay && s.dayOfWeek != null).map((s) => planDayToGetDay(s.dayOfWeek as number)),
  );
  if (trainingDays.size === 0) return null;

  const logDates = new Set(log.map((l) => l.date));
  const windowDates = calendarBack(today, PATTERN_WINDOW);

  // Bucket every planned weekday's occurrences in the window → completion rate.
  let worst: { gd: number; observed: number; done: number; rate: number } | null = null;
  for (const gd of trainingDays) {
    const occurrences = windowDates.filter((d) => parseLocalDate(d).getDay() === gd);
    if (occurrences.length < 2) continue;
    const done = occurrences.filter((d) => logDates.has(d)).length;
    const rate = done / occurrences.length;
    if (!worst || rate < worst.rate) worst = { gd, observed: occurrences.length, done, rate };
  }
  if (!worst || worst.rate >= 0.5) return null;

  const day = DOW_LABEL[worst.gd];
  const missed = worst.observed - worst.done;
  return {
    kind: "skip",
    domain: "workout",
    slot: `${day} workout`,
    rate: worst.rate,
    window: worst.observed,
    confidence: clamp(worst.observed / 3, 0, 1),
    icon: "barbell-outline",
    message: `I've noticed ${day} workouts tend to slip — you've missed ${missed} of the last ${worst.observed}. That's not willpower, it's scheduling. Want to move that session to a day that sticks?`,
  };
}

function detectAnchor(
  dietHistory: DietHistoryEntry[],
  log: WorkoutLogEntry[],
  plan: GeneratedWorkoutPlan | null,
  today: string,
): HabitPattern | null {
  // The anchor is the earliest planned training day in the week (else Monday).
  let anchorGd = 1; // Monday
  if (plan) {
    const trainingPlanDays = plan.sessions
      .filter((s) => !s.isRestDay && s.dayOfWeek != null)
      .map((s) => s.dayOfWeek as number)
      .sort((a, b) => a - b);
    if (trainingPlanDays.length > 0) anchorGd = planDayToGetDay(trainingPlanDays[0]);
  }

  const windowSet = datesBack(today, ANCHOR_WINDOW);
  const logDates = new Set(log.filter((l) => windowSet.has(l.date)).map((l) => l.date));

  // Group adherence by week; flag which weeks completed the anchor workout.
  const byWeek = new Map<string, { adh: number[]; anchorDone: boolean }>();
  for (const h of dietHistory) {
    if (!windowSet.has(h.date) || h.totalMeals === 0) continue;
    const wk = weekKey(h.date);
    const slot = byWeek.get(wk) ?? { adh: [], anchorDone: false };
    slot.adh.push(adhPct(h));
    byWeek.set(wk, slot);
  }
  for (const d of logDates) {
    if (parseLocalDate(d).getDay() !== anchorGd) continue;
    const wk = weekKey(d);
    const slot = byWeek.get(wk) ?? { adh: [], anchorDone: false };
    slot.anchorDone = true;
    byWeek.set(wk, slot);
  }

  const doneWeeks: number[] = [];
  const missWeeks: number[] = [];
  for (const { adh, anchorDone } of byWeek.values()) {
    if (adh.length < 2) continue; // need a few logged days to read the week
    (anchorDone ? doneWeeks : missWeeks).push(mean(adh));
  }
  if (doneWeeks.length < 2 || missWeeks.length < 2) return null;

  const lift = mean(doneWeeks) - mean(missWeeks);
  if (lift < LINK_GAP) return null;

  const day = DOW_LABEL[anchorGd];
  return {
    kind: "anchor",
    domain: "consistency",
    slot: `${day} workout`,
    rate: mean(doneWeeks),
    window: doneWeeks.length + missWeeks.length,
    confidence: clamp((doneWeeks.length + missWeeks.length) / 5, 0, 1),
    icon: "key-outline",
    message: `Your strongest weeks almost always start with a ${day} workout — when you get that one in, the rest of the week follows (about ${Math.round(lift * 100)}% more on-plan). That session is your keystone; protect it above all others.`,
  };
}

function detectMoodLink(
  dietHistory: DietHistoryEntry[],
  checkins: GozlinCheckin[],
  today: string,
): HabitPattern | null {
  const windowSet = datesBack(today, CHECKIN_WINDOW * 3);
  const adhByDate = new Map<string, number>();
  for (const h of dietHistory) {
    if (h.totalMeals > 0) adhByDate.set(h.date, adhPct(h));
  }

  const high: number[] = []; // high-stress / low-mood days
  const calm: number[] = []; // calm / good-mood days
  for (const c of checkins) {
    if (!windowSet.has(c.date)) continue;
    const adh = adhByDate.get(c.date);
    if (adh === undefined) continue;
    const stressed = (c.stress ?? 0) >= 4 || (c.mood ?? 5) <= 2;
    const easy = (c.stress ?? 5) <= 2 && (c.mood ?? 0) >= 4;
    if (stressed) high.push(adh);
    else if (easy) calm.push(adh);
  }
  if (high.length < 2 || calm.length < 2) return null;

  const gap = mean(calm) - mean(high);
  if (gap < LINK_GAP) return null;

  return {
    kind: "mood_link",
    domain: "mood",
    slot: "Stressful days",
    rate: mean(high),
    window: high.length + calm.length,
    confidence: clamp((high.length + calm.length) / 6, 0, 1),
    icon: "rainy-outline",
    message: `On your higher-stress days your eating slips noticeably — about ${Math.round(gap * 100)}% less on-plan than your calm days. That's stress reaching for food, and it's beatable with a plan B you decide in advance.`,
  };
}

function detectSleepLink(
  dietHistory: DietHistoryEntry[],
  checkins: GozlinCheckin[],
  today: string,
): HabitPattern | null {
  const windowSet = datesBack(today, CHECKIN_WINDOW * 3);
  const adhByDate = new Map<string, number>();
  for (const h of dietHistory) {
    if (h.totalMeals > 0) adhByDate.set(h.date, adhPct(h));
  }

  const short: number[] = [];
  const rested: number[] = [];
  for (const c of checkins) {
    if (!windowSet.has(c.date) || c.sleepHours === undefined) continue;
    const adh = adhByDate.get(c.date);
    if (adh === undefined) continue;
    (c.sleepHours < SLEEP_SHORT ? short : rested).push(adh);
  }
  if (short.length < 2 || rested.length < 2) return null;

  const gap = mean(rested) - mean(short);
  if (gap < LINK_GAP) return null;

  return {
    kind: "sleep_link",
    domain: "sleep",
    slot: "Short nights",
    rate: mean(short),
    window: short.length + rested.length,
    confidence: clamp((short.length + rested.length) / 6, 0, 1),
    icon: "moon-outline",
    message: `Short nights cost you the next day — after under ${SLEEP_SHORT}h sleep your on-plan rate drops about ${Math.round(gap * 100)}%. Protecting sleep isn't separate from your goal; it's part of the training.`,
  };
}

function detectCalorieCreep(
  dietHistory: DietHistoryEntry[],
  twin: GozlinTwin,
  today: string,
): HabitPattern | null {
  const target = twin.today.calories.target;
  if (target <= 0) return null;
  // Only a "bad habit" against a deficit/maintenance goal.
  if (twin.goal === "build_muscle" || twin.goal === "athletic_performance") return null;

  const windowSet = datesBack(today, CHECKIN_WINDOW);
  let logged = 0;
  let over = 0;
  for (const h of dietHistory) {
    if (!windowSet.has(h.date) || typeof h.consumedCalories !== "number") continue;
    logged++;
    if (h.consumedCalories > target * 1.12) over++;
  }
  if (logged < 5 || over < 3) return null;

  return {
    kind: "bad_habit",
    domain: "nutrition",
    slot: "Calorie creep",
    rate: over / logged,
    window: logged,
    confidence: clamp(over / 4, 0, 1),
    icon: "trending-up-outline",
    message: `${over} of your last ${logged} logged days ran well over your calorie target. That's not the occasional treat — it's a pattern that quietly stalls fat loss. Worth catching the slot it usually happens in.`,
  };
}

// ════════════════════════════════════════════════════════════════════
// 2. BEHAVIOR SCORING
// ════════════════════════════════════════════════════════════════════

export function scoreBehavior(input: HabitReportInput): BehaviorScore[] {
  const { twin, workoutLog, checkins, weeklyWorkoutTarget } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const scores: BehaviorScore[] = [];

  // ── Training ──
  const load = twin.momentum.trainingLoad7d;
  const lastWeekLoad = sessionsInRange(workoutLog, today, 7, 14);
  const trainingScore = Math.round(clamp(load / Math.max(1, weeklyWorkoutTarget), 0, 1) * 100);
  scores.push({
    domain: "workout",
    icon: "barbell",
    label: "Training",
    score: trainingScore,
    band: band(trainingScore),
    trend: trendFromDelta(load, lastWeekLoad, 0.5),
    drivers: [`${load}/${weeklyWorkoutTarget} sessions this week`],
  });

  // ── Nutrition ──
  const nutritionScore = Math.round(twin.momentum.adherence7d);
  scores.push({
    domain: "nutrition",
    icon: "nutrition",
    label: "Nutrition",
    score: nutritionScore,
    band: band(nutritionScore),
    trend: momentumTrend(twin),
    drivers: [`${twin.momentum.adherence7d}/100 adherence (7d)`],
  });

  // ── Consistency ──
  const streak = twin.momentum.streak;
  const consistencyScore = Math.round(
    clamp(streak / 14, 0, 1) * 55 + (twin.momentum.adherence7d / 100) * 45,
  );
  scores.push({
    domain: "consistency",
    icon: "flame",
    label: "Consistency",
    score: consistencyScore,
    band: band(consistencyScore),
    trend: momentumTrend(twin),
    drivers: [`${streak}-day streak`, `${twin.momentum.adherence7d}/100 adherence`],
  });

  // ── Hydration (today-only signal — honest about that) ──
  if (twin.today.water.target > 0) {
    const hydrationScore = Math.round(clamp(twin.today.water.pct, 0, 1) * 100);
    scores.push({
      domain: "hydration",
      icon: "water",
      label: "Hydration",
      score: hydrationScore,
      band: band(hydrationScore),
      trend: "steady",
      drivers: [`${Math.round(twin.today.water.pct * 100)}% of today's water goal`],
    });
  }

  // ── Sleep (self-reported) ──
  const sleep = scoreCheckinDomain(checkins, today, "sleepHours");
  if (sleep) {
    const avg = sleep.avg;
    const score = Math.round(sleepHoursToScore(avg));
    scores.push({
      domain: "sleep",
      icon: "moon",
      label: "Sleep",
      score,
      band: band(score),
      trend: sleep.trend,
      drivers: [`avg ${avg.toFixed(1)}h over ${sleep.n} night${sleep.n === 1 ? "" : "s"}`],
    });
  }

  // ── Mood (self-reported) ──
  const mood = scoreCheckinDomain(checkins, today, "mood");
  if (mood) {
    const score = Math.round(clamp((mood.avg - 1) / 4, 0, 1) * 100);
    scores.push({
      domain: "mood",
      icon: "happy",
      label: "Mood",
      score,
      band: band(score),
      trend: mood.trend,
      drivers: [`avg ${mood.avg.toFixed(1)}/5 over ${mood.n} day${mood.n === 1 ? "" : "s"}`],
    });
  }

  return scores;
}

function momentumTrend(twin: GozlinTwin): BehaviorTrend {
  return twin.momentum.trend === "rising"
    ? "rising"
    : twin.momentum.trend === "cooling"
      ? "cooling"
      : "steady";
}

function sleepHoursToScore(h: number): number {
  if (h >= 7 && h <= 9) return 95;
  if (h >= 6.5) return 80;
  if (h >= 6) return 65;
  if (h >= 5) return 45;
  if (h > 9) return 78;
  return 25;
}

/** Average a numeric check-in field over the window + a recent-vs-prior trend. */
function scoreCheckinDomain(
  checkins: GozlinCheckin[],
  today: string,
  field: "sleepHours" | "mood",
): { avg: number; n: number; trend: BehaviorTrend } | null {
  const recentSet = datesBack(today, CHECKIN_WINDOW);
  const recent: number[] = [];
  const prior: number[] = [];
  const priorSet = new Set<string>();
  const end = parseLocalDate(today);
  for (let i = CHECKIN_WINDOW; i < CHECKIN_WINDOW * 2; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    priorSet.add(toLocalDateString(d));
  }
  for (const c of checkins) {
    const v = c[field];
    if (typeof v !== "number") continue;
    if (recentSet.has(c.date)) recent.push(v);
    else if (priorSet.has(c.date)) prior.push(v);
  }
  if (recent.length < 2) return null;
  const trend = prior.length >= 2 ? trendFromDelta(mean(recent), mean(prior), 0.2) : "steady";
  return { avg: mean(recent), n: recent.length, trend };
}

// ════════════════════════════════════════════════════════════════════
// 3. RISK PREDICTION + RESCUES
// ════════════════════════════════════════════════════════════════════

function daysUntilWeekday(targetGd: number, today: string): { days: number; label: string } {
  const todayGd = parseLocalDate(today).getDay();
  const days = (targetGd - todayGd + 7) % 7;
  const label = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return { days, label };
}

export function predictRisks(
  input: HabitReportInput,
  patterns: HabitPattern[],
): HabitRisk[] {
  const { twin } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const todayGd = parseLocalDate(today).getDay();
  const risks: HabitRisk[] = [];

  // Predicted workout slips from the skip pattern.
  for (const p of patterns) {
    if (p.kind !== "skip" || p.domain !== "workout") continue;
    const gd = DOW_LABEL.indexOf(p.slot.replace(" workout", ""));
    if (gd < 0) continue;
    const when = daysUntilWeekday(gd, today);
    risks.push({
      domain: "workout",
      icon: "barbell-outline",
      slot: p.slot,
      title: `${p.slot} is at risk`,
      likelihood: clamp(1 - p.rate, 0, 1),
      whenLabel: when.label,
      why: [`completed only ${Math.round(p.rate * 100)}% of recent ${p.slot}s`],
      rescueId: `rescue_workout_${gd}`,
    });
  }

  // Weekend nutrition dip — flag it as the weekend approaches.
  const weekendDip = patterns.find((p) => p.kind === "weekend_dip");
  if (weekendDip && (todayGd === 4 || todayGd === 5 || todayGd === 6 || todayGd === 0)) {
    risks.push({
      domain: "nutrition",
      icon: "fast-food-outline",
      slot: "Weekend nutrition",
      title: "Weekend eating is the danger zone",
      likelihood: clamp(1 - weekendDip.rate, 0, 1),
      whenLabel: todayGd === 6 || todayGd === 0 ? "right now" : "this weekend",
      why: [`weekends run about ${Math.round(weekendDip.rate * 100)}% on-plan`],
      rescueId: "rescue_weekend",
    });
  }

  // Streak / setback risk for today.
  if (twin.flags.includes("SETBACK")) {
    risks.push({
      domain: "consistency",
      icon: "flame-outline",
      slot: "Today's reset",
      title: "Today's the day the slide either stops or deepens",
      likelihood: 0.75,
      whenLabel: "today",
      why: ["adherence and streak both bottomed out"],
      rescueId: "rescue_streak",
    });
  } else if (
    twin.momentum.streak >= 3 &&
    twin.today.dayProgress >= 0.55 &&
    (twin.flags.includes("WORKOUT_PENDING") ||
      twin.flags.includes("PROTEIN_LAG") ||
      twin.flags.includes("LOW_WATER") ||
      twin.flags.includes("BEHIND_CALORIES"))
  ) {
    risks.push({
      domain: "consistency",
      icon: "flame-outline",
      slot: "Your streak",
      title: `Your ${twin.momentum.streak}-day streak is on the line`,
      likelihood: 0.55,
      whenLabel: "today",
      why: ["the day's getting on and today's targets aren't closed yet"],
      rescueId: "rescue_streak",
    });
  }

  return risks.sort((a, b) => b.likelihood - a.likelihood).slice(0, 3);
}

export function buildRescues(risks: HabitRisk[]): HabitRescue[] {
  const out: HabitRescue[] = [];
  const seen = new Set<string>();
  for (const r of risks.slice(0, 2)) {
    if (!r.rescueId || seen.has(r.rescueId)) continue;
    seen.add(r.rescueId);

    if (r.rescueId.startsWith("rescue_workout")) {
      out.push({
        id: r.rescueId,
        icon: "barbell-outline",
        title: `Rescue your ${r.slot}`,
        forSlot: r.slot,
        steps: [
          "Pre-pick a 20-minute minimum version of that session — something you'd never skip.",
          "Lay your kit out the night before so starting takes zero decisions.",
          "Block it in your calendar like a meeting, not a 'maybe'.",
          "If the day still gets away, do 10 minutes — momentum beats perfection.",
        ],
        tone: "gentle",
      });
    } else if (r.rescueId === "rescue_weekend") {
      out.push({
        id: r.rescueId,
        icon: "shield-checkmark-outline",
        title: "Hold the line this weekend",
        forSlot: r.slot,
        steps: [
          "Set a weekend minimum: protein at every meal + your full water goal.",
          "Pre-log Saturday's breakfast on Friday night.",
          "Pick one social meal to enjoy fully — plan around it instead of fighting it.",
        ],
        tone: "warm",
      });
    } else if (r.rescueId === "rescue_streak") {
      out.push({
        id: r.rescueId,
        icon: "refresh-outline",
        title: "Protect today",
        forSlot: r.slot,
        steps: [
          "Do the smallest win right now — one logged meal or one glass of water.",
          "Don't try to 'make up' for anything; just don't zero the day.",
          "Tell me when it's done and we keep the chain alive.",
        ],
        tone: "gentle",
      });
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════
// 4. THE REPORT
// ════════════════════════════════════════════════════════════════════

const DOMAIN_WEIGHT: Record<HabitDomain, number> = {
  workout: 0.25,
  nutrition: 0.3,
  consistency: 0.25,
  hydration: 0.07,
  sleep: 0.07,
  mood: 0.06,
};

export function buildHabitReport(input: HabitReportInput): GozlinHabitReport {
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const patterns = detectHabitPatterns(input);
  const behaviorScores = scoreBehavior(input);
  const risks = predictRisks(input, patterns);
  const rescues = buildRescues(risks);

  // Weighted composite across the domains we actually have data for.
  let weighted = 0;
  let weightSum = 0;
  for (const s of behaviorScores) {
    const w = DOMAIN_WEIGHT[s.domain];
    weighted += s.score * w;
    weightSum += w;
  }
  const overallScore = weightSum > 0 ? Math.round(weighted / weightSum) : 0;
  const scoreLabel = band(overallScore);

  // Coverage check — be honest when we barely know them yet.
  const trackedDays = input.dietHistory.filter(
    (h) => datesBack(today, CHECKIN_WINDOW).has(h.date) && h.totalMeals > 0,
  ).length;
  const recentSessions = sessionsInRange(input.workoutLog, today, 0, PATTERN_WINDOW);
  const dataLimited =
    patterns.length === 0 && trackedDays < 3 && recentSessions < 2 && input.checkins.length === 0;

  const headline = buildHeadline({ patterns, overallScore, dataLimited });
  const tone: GozlinTone = dataLimited
    ? "warm"
    : risks.length > 0 || patterns.some((p) => p.kind === "skip" || p.kind === "bad_habit")
      ? "honest"
      : overallScore >= 75
        ? "proud"
        : "warm";

  return {
    __kind: "habit",
    headline,
    overallScore,
    scoreLabel,
    behaviorScores,
    patterns,
    risks,
    rescues,
    dataLimited,
    tone,
  };
}

function buildHeadline(a: {
  patterns: HabitPattern[];
  overallScore: number;
  dataLimited: boolean;
}): string {
  if (a.dataLimited) {
    return "I'm still learning your rhythms — keep logging and check in a few times, and I'll start to really know you.";
  }
  const anchor = a.patterns.find((p) => p.kind === "anchor");
  if (anchor) return `Your whole week pivots on one habit: ${anchor.slot.toLowerCase()}.`;
  const skip = a.patterns.find((p) => p.kind === "skip");
  if (skip) return "I've spotted exactly where your week tends to slip — and it's fixable.";
  const moodOrSleep = a.patterns.find((p) => p.kind === "mood_link" || p.kind === "sleep_link");
  if (moodOrSleep) return "Your habits don't live in a vacuum — how you sleep and feel is shaping them.";
  if (a.overallScore >= 75) return "You're more consistent than you give yourself credit for.";
  return "Here's the honest read on the rhythms behind your results.";
}
