/**
 * GOZLIN — Progress Detective, Weekly Review & Habit Awareness (Phase 2 §6, §7, §9).
 *
 * Deterministic pattern-mining over local history. Finds the non-obvious story
 * (hidden wins, observed correlations, stalls), rolls the week up into a coach
 * "sit-down," and learns behavioral patterns for fair, specific accountability.
 *
 * Correlations are reported as *observations*, never causal claims — every
 * finding carries `evidence[]` so the UI can always answer "why are you telling
 * me this?". Composes computeWeeklySummary; introduces no new scoring.
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { WorkoutLogEntry } from "../../models/workout";
import { computeWeeklySummary } from "../intelligence";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import type {
  GozlinTwin,
  GozlinWeeklyReview,
  HabitPattern,
  ProgressFinding,
  WeeklyReviewLine,
} from "./gozlin.types";

// ── Helpers ──────────────────────────────────────────────────────

function adhPct(h: DietHistoryEntry): number {
  return h.totalMeals > 0 ? h.mealsConsumed / h.totalMeals : 0;
}

function datesBack(today: string, from: number, to: number): Set<string> {
  const end = parseLocalDate(today);
  const out = new Set<string>();
  for (let i = from; i < to; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.add(toLocalDateString(d));
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ════════════════════════════════════════════════════════════════
// Progress Detective
// ════════════════════════════════════════════════════════════════

export interface ProgressInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  now?: Date;
}

export function detectFindings(input: ProgressInput): ProgressFinding[] {
  const { twin, dietHistory, workoutLog } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const findings: ProgressFinding[] = [];

  // ── A) Training trending up (hidden win) ──
  const thisWeek = datesBack(today, 0, 7);
  const prevWeek = datesBack(today, 7, 14);
  const thisWeekSessions = workoutLog.filter((l) => thisWeek.has(l.date)).length;
  const prevWeekSessions = workoutLog.filter((l) => prevWeek.has(l.date)).length;
  if (thisWeekSessions >= 2 && thisWeekSessions > prevWeekSessions) {
    findings.push({
      kind: "hidden_win",
      icon: "trending-up",
      title: "Training is trending up",
      detail: `You've trained more this week than last — momentum you might not have clocked.`,
      evidence: [
        `${thisWeekSessions} sessions this week`,
        `${prevWeekSessions} the week before`,
      ],
    });
  }

  // ── B) Consistency climbing (hidden win) ──
  if (twin.momentum.trend === "rising" && twin.momentum.adherence7d >= 55) {
    findings.push({
      kind: "hidden_win",
      icon: "ribbon-outline",
      title: "Your consistency is climbing",
      detail: "Your last few days are tighter than the days before them. That compounds.",
      evidence: [`${twin.momentum.adherence7d}/100 adherence, trend rising`],
    });
  }

  // ── C) Training-day eating correlation (observation) ──
  const last14 = datesBack(today, 0, 14);
  const trainDates = new Set(workoutLog.map((l) => l.date));
  const trainAdh: number[] = [];
  const restAdh: number[] = [];
  for (const h of dietHistory) {
    if (!last14.has(h.date) || h.totalMeals === 0) continue;
    (trainDates.has(h.date) ? trainAdh : restAdh).push(adhPct(h));
  }
  if (trainAdh.length >= 2 && restAdh.length >= 2) {
    const diff = mean(trainAdh) - mean(restAdh);
    if (diff >= 0.2) {
      findings.push({
        kind: "correlation",
        icon: "git-compare-outline",
        title: "You eat better on training days",
        detail:
          "On days you train, your meal adherence is noticeably higher. Worth noticing — not a coincidence to lean on.",
        evidence: [
          `${Math.round(mean(trainAdh) * 100)}% adherence on training days`,
          `${Math.round(mean(restAdh) * 100)}% on rest days`,
        ],
        lever: "On a rest day, a short walk can carry the same 'on-track' mindset.",
      });
    }
  }

  // ── D) Plateau / stall (honest) ──
  if (
    twin.momentum.trend === "steady" &&
    twin.momentum.adherence7d >= 40 &&
    twin.momentum.adherence7d < 72
  ) {
    findings.push({
      kind: "stall",
      icon: "remove-circle-outline",
      title: "Consistency has plateaued",
      detail:
        "You're steady but stuck in the middle — solid, not yet compounding. One reliable habit breaks this open.",
      evidence: [`${twin.momentum.adherence7d}/100 adherence, flat trend`],
      lever: "Pick the one thing you miss most and protect it for 7 days.",
    });
  }

  // ── Fallback so the detective always has something true to say ──
  if (findings.length === 0) {
    findings.push({
      kind: "hidden_win",
      icon: "leaf-outline",
      title: twin.momentum.streak > 0 ? "Quietly stacking days" : "Clean slate",
      detail:
        twin.momentum.streak > 0
          ? "Nothing dramatic in the data — just steady, repeatable choices. That's the good kind of boring."
          : "Not much history yet. Log a few days and I'll start finding the story in it.",
      evidence: [
        twin.momentum.streak > 0
          ? `${twin.momentum.streak}-day streak`
          : "awaiting more data",
      ],
    });
  }

  return findings.slice(0, 4);
}

// ════════════════════════════════════════════════════════════════
// Weekly Review
// ════════════════════════════════════════════════════════════════

export interface WeeklyReviewInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  weekStart: string;
  weeklyWorkoutTarget: number;
  now?: Date;
}

export function buildWeeklyReview(input: WeeklyReviewInput): GozlinWeeklyReview {
  const { twin, dietHistory, workoutLog, weekStart, weeklyWorkoutTarget } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const summary = computeWeeklySummary(dietHistory, weekStart, today);
  const adherence = Math.round(summary.avgAdherence * 100);

  // Sessions logged within the week window.
  const weekDates = new Set(summary.perDay.map((d) => d.date));
  const sessionsThisWeek = workoutLog.filter((l) => weekDates.has(l.date)).length;

  // ── Wins ──
  const wins: WeeklyReviewLine[] = [];
  if (summary.daysCompleted > 0)
    wins.push({
      icon: "checkmark-done-outline",
      text: `${summary.daysCompleted} full day${summary.daysCompleted === 1 ? "" : "s"} on plan`,
    });
  if (sessionsThisWeek > 0)
    wins.push({
      icon: "barbell-outline",
      text: `${sessionsThisWeek} workout${sessionsThisWeek === 1 ? "" : "s"} done`,
    });
  if (twin.momentum.streak >= 3)
    wins.push({ icon: "flame", text: `${twin.momentum.streak}-day streak alive` });
  if (summary.avgProteinG)
    wins.push({
      icon: "leaf-outline",
      text: `Averaged ${summary.avgProteinG}g protein/day`,
    });
  if (wins.length === 0)
    wins.push({ icon: "footsteps-outline", text: "You showed up to look — that counts." });

  // ── Watchouts (each carries a candidate focus) ──
  const watchouts: WeeklyReviewLine[] = [];
  const focusCandidates: { severity: number; focus: string }[] = [];

  if (summary.avgAdherence < 0.6 && summary.daysLogged > 0) {
    watchouts.push({
      icon: "restaurant-outline",
      text: `Meal adherence sat at ${adherence}%`,
    });
    focusCandidates.push({
      severity: (0.6 - summary.avgAdherence) * 100,
      focus: "Protect one meal slot you keep missing — make it non-negotiable.",
    });
  }
  if (sessionsThisWeek < weeklyWorkoutTarget) {
    const gap = weeklyWorkoutTarget - sessionsThisWeek;
    watchouts.push({
      icon: "barbell-outline",
      text: `${sessionsThisWeek}/${weeklyWorkoutTarget} planned workouts`,
    });
    focusCandidates.push({
      severity: gap * 15,
      focus: `Lock in ${gap} more session${gap === 1 ? "" : "s"} — schedule them like appointments.`,
    });
  }
  if (twin.flags.includes("LOW_WATER")) {
    watchouts.push({ icon: "water-outline", text: "Hydration ran light most days" });
    focusCandidates.push({
      severity: 20,
      focus: "Tie water to a daily anchor — a glass with every meal.",
    });
  }
  if (watchouts.length === 0)
    watchouts.push({ icon: "sparkles-outline", text: "Honestly, not much to flag. Nice." });

  // ── Trajectory line ──
  const trajectoryLine =
    twin.momentum.trend === "rising"
      ? "Trajectory's pointing up — keep doing what you're doing."
      : twin.momentum.trend === "cooling"
        ? "Trajectory cooled a little this week — one focus turns it back around."
        : "Holding steady. Steady plus one upgrade is how the next level happens.";

  // ── The single next-week focus (impact × feasibility → pick top severity) ──
  focusCandidates.sort((a, b) => b.severity - a.severity);
  const oneFocusNextWeek =
    focusCandidates[0]?.focus ??
    "Keep the streak alive — you've earned an easy, consistent week.";

  return {
    __kind: "weekly-review",
    weekStart,
    title: "Your week with Gozlin",
    adherence,
    wins,
    watchouts,
    trajectoryLine,
    oneFocusNextWeek,
  };
}

// ════════════════════════════════════════════════════════════════
// Habit Awareness
// ════════════════════════════════════════════════════════════════

export interface HabitInput {
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  twin: GozlinTwin;
  now?: Date;
}

const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function detectHabits(input: HabitInput): HabitPattern[] {
  const { dietHistory, twin } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const patterns: HabitPattern[] = [];

  const last21 = datesBack(today, 0, 21);
  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const h of dietHistory) {
    if (!last21.has(h.date) || h.totalMeals === 0) continue;
    const dow = parseLocalDate(h.date).getDay();
    (dow === 0 || dow === 6 ? weekend : weekday).push(adhPct(h));
  }

  // ── Weekend dip ──
  if (weekday.length >= 3 && weekend.length >= 2) {
    const diff = mean(weekday) - mean(weekend);
    if (diff >= 0.2) {
      patterns.push({
        kind: "weekend_dip",
        slot: "Weekends",
        rate: mean(weekend),
        window: weekend.length,
        confidence: Math.min(1, weekend.length / 4),
        message:
          "Weekends are where the plan slips most. A loose 'weekend minimum' keeps the week from unraveling.",
      });
    }
  }

  // ── Lowest-adherence weekday (skip pattern) ──
  const byDay: Record<number, number[]> = {};
  for (const h of dietHistory) {
    if (!last21.has(h.date) || h.totalMeals === 0) continue;
    const dow = parseLocalDate(h.date).getDay();
    (byDay[dow] ??= []).push(adhPct(h));
  }
  let worst: { dow: number; rate: number; n: number } | null = null;
  for (const [k, arr] of Object.entries(byDay)) {
    if (arr.length < 2) continue;
    const rate = mean(arr);
    if (!worst || rate < worst.rate) worst = { dow: Number(k), rate, n: arr.length };
  }
  if (worst && worst.rate < 0.5) {
    patterns.push({
      kind: "skip",
      slot: `${WEEKDAY_LABEL[worst.dow]}s`,
      rate: worst.rate,
      window: worst.n,
      confidence: Math.min(1, worst.n / 3),
      message: `${WEEKDAY_LABEL[worst.dow]}s are consistently your toughest day — maybe the plan needs to fit ${WEEKDAY_LABEL[worst.dow]}, not the other way around.`,
    });
  }

  // ── Positive consistency ──
  if (twin.momentum.streak >= 5) {
    patterns.push({
      kind: "consistency",
      slot: "Daily",
      rate: 1,
      window: twin.momentum.streak,
      confidence: 1,
      message: "You rarely miss two days in a row — that reliability is your superpower.",
    });
  }

  // Only surface confident patterns (gate per Phase 2 §9).
  return patterns.filter((p) => p.confidence >= 0.5);
}
