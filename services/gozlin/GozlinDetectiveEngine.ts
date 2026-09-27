/**
 * GOZLIN — Progress Detective (Phase 8).
 *
 * The Data-Scientist brain. It doesn't just surface findings — it builds a
 * *case*: it reads adherence, the weight trend, training volume and workout
 * performance together, then names the single most likely ROOT CAUSE of what
 * the numbers are doing, backed by an auditable metric strip.
 *
 * The hallmark read it's built for:
 *   "Your weight hasn't changed in 10 days, but your workout performance is up
 *    14% — that usually means muscle gain offsetting fat loss, plus water
 *    retention hiding it on the scale."
 *
 * Pure & deterministic over local history (inject `now` for tests). It composes
 * the Twin's body trajectory, the BodyLogService trend, and the lighter
 * `detectFindings` (hidden wins / correlations) for supporting evidence. It
 * introduces no new scoring — every number traces to a named source.
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { SessionSummaryData } from "../../models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import { computeWeightTrend } from "../BodyLogService";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import { detectFindings } from "./GozlinProgressEngine";
import type {
  DetectiveMetric,
  FindingKind,
  GozlinCheckin,
  GozlinDetectiveReport,
  GozlinTwin,
  ProgressFinding,
} from "./gozlin.types";

// ── Tunables ────────────────────────────────────────────────────────
const RECENT_DAYS = 14; // "now" window for performance + weight
const PRIOR_DAYS = 28; // outer edge of the comparison window
const FLAT_RATE = 0.2; // |kg/week| below this is "the scale is flat"
const RECOMP_PERF_GAIN = 0.08; // ≥8% more training volume → performance climbing
const PERF_DROP = 0.08; // ≥8% less training volume → output falling
const MIN_TRACKED = 4; // logged diet days needed to read nutrition
const MIN_SESSIONS = 2; // sessions per window needed to read performance
const MIN_SLEEP_NIGHTS = 3; // logged nights needed to call sleep a pattern
const SHORT_SLEEP_AVG = 6.5; // average hours below this reads as short sleep
const MIN_FATIGUE_ENTRIES = 3; // "Tired"/"Drained" check-ins needed to call it a pattern

/** Labels that describe the body running low (mirrors GozlinRecoveryEngine). */
const FATIGUE_LABELS = new Set(["Tired", "Drained"]);

/**
 * The outcome a question is about. investigate_progress has always taken one,
 * and the report used to ignore it: "why isn't my bench going up?" came back
 * with whichever candidate scored highest overall — often a weight plateau.
 * Now every candidate says which outcomes it bears on, and a focused report
 * picks its root cause from those alone, or says honestly that it found none.
 */
export type DetectiveFocus = "weight" | "strength" | "energy" | "adherence";

// ── small numeric helpers ───────────────────────────────────────────
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const sign = (n: number) => (n > 0.05 ? 1 : n < -0.05 ? -1 : 0);

function adhPct(h: DietHistoryEntry): number {
  return h.totalMeals > 0 ? h.mealsConsumed / h.totalMeals : 0;
}

function coeffVar(xs: number[]): number {
  const m = mean(xs);
  if (m <= 0) return 0;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m;
}

function inWindow(today: string, fromDaysAgo: number, toDaysAgo: number): Set<string> {
  const end = parseLocalDate(today);
  const out = new Set<string>();
  for (let i = fromDaysAgo; i < toDaysAgo; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.add(toLocalDateString(d));
  }
  return out;
}

/**
 * Per-session work proxy. Prefers reps (the real progression signal); falls back
 * to completion% for sessions that are entirely timed (zero reps logged).
 */
function sessionVolume(s: SessionSummaryData): number {
  return s.totalReps > 0 ? s.totalReps : s.completionPercent;
}

interface PerfRead {
  /** Signed fractional change in training volume, recent vs prior. Null if thin. */
  deltaPct: number | null;
  recentN: number;
  priorN: number;
}

/** Compare training volume in the recent window vs the prior window. */
function readPerformance(history: SessionSummaryData[], today: string): PerfRead {
  const recentSet = inWindow(today, 0, RECENT_DAYS);
  const priorSet = inWindow(today, RECENT_DAYS, PRIOR_DAYS);
  const recent = history.filter((s) => recentSet.has(s.date)).map(sessionVolume);
  const prior = history.filter((s) => priorSet.has(s.date)).map(sessionVolume);
  if (recent.length < MIN_SESSIONS || prior.length < MIN_SESSIONS) {
    return { deltaPct: null, recentN: recent.length, priorN: prior.length };
  }
  const pr = mean(prior);
  const deltaPct = pr > 0 ? (mean(recent) - pr) / pr : null;
  return { deltaPct, recentN: recent.length, priorN: prior.length };
}

function fmtKg(kg: number): string {
  const a = Math.abs(round1(kg));
  if (a < 0.1) return "flat";
  return `${kg < 0 ? "−" : "+"}${a} kg`;
}

function fmtPct(frac: number): string {
  const p = Math.round(frac * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

// ════════════════════════════════════════════════════════════════════

export interface DetectiveInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  bodyLogs: BodyLogEntry[];
  /** Sessions/week the user is aiming for (training-coverage read). */
  weeklyWorkoutTarget: number;
  /** What the question is about. Absent = the strongest read overall. */
  focus?: DetectiveFocus;
  /** The state-of-mind log — the only sleep and energy signal most users give. */
  checkins?: GozlinCheckin[] | null;
  now?: Date;
}

interface Candidate {
  finding: ProgressFinding;
  /** Higher = stronger claim on being THE root cause. */
  priority: number;
  /** Which outcomes this finding can explain. */
  bears: DetectiveFocus[];
}

/** Sleep and fatigue over the recent window, read from the check-in log. */
interface EnergyRead {
  entries: number;
  sleepNights: number;
  sleepAvg: number | null;
  nightsUnder6: number;
  fatigueEntries: number;
}

function readEnergy(checkins: GozlinCheckin[], window: Set<string>): EnergyRead {
  const recent = checkins.filter((c) => window.has(c.date));
  const nights = recent
    .map((c) => c.sleepHours)
    .filter((h): h is number => typeof h === "number" && Number.isFinite(h) && h > 0);
  return {
    entries: recent.length,
    sleepNights: nights.length,
    sleepAvg: nights.length > 0 ? round1(mean(nights)) : null,
    nightsUnder6: nights.filter((h) => h < 6).length,
    fatigueEntries: recent.filter((c) => (c.labels ?? []).some((l) => FATIGUE_LABELS.has(l))).length,
  };
}

export function buildDetectiveReport(input: DetectiveInput): GozlinDetectiveReport {
  const { twin, dietHistory, sessionHistory, bodyLogs, weeklyWorkoutTarget } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const adherence = twin.momentum.adherence7d;
  const trainingLoad = twin.momentum.trainingLoad7d;

  // ── Coverage: how much have we actually got to work with? ──
  const last14 = inWindow(today, 0, RECENT_DAYS);
  const trackedAdh = dietHistory
    .filter((h) => last14.has(h.date) && h.totalMeals > 0)
    .map(adhPct);
  const trackedDays = trackedAdh.length;

  // ── Weight: short-window trend (the scale's recent behaviour) ──
  const trend = computeWeightTrend(bodyLogs, today, RECENT_DAYS);
  const weighIns = trend.points;
  const weightDeltaKg =
    trend.perWeek !== null && trend.spanDays > 0
      ? round1(trend.perWeek * (trend.spanDays / 7))
      : null;
  const weightFlat = trend.perWeek !== null && Math.abs(trend.perWeek) < FLAT_RATE;
  const goalDir = goalDirection(twin);

  // ── Performance: training volume, recent vs prior ──
  const perf = readPerformance(sessionHistory, today);

  // ── Energy: sleep and fatigue, from the check-in log ──
  const focus = input.focus;
  const energy = readEnergy(input.checkins ?? [], last14);

  const dataLimited =
    trackedDays < MIN_TRACKED &&
    weighIns < 2 &&
    perf.deltaPct === null &&
    // An energy question can be read off the check-ins alone.
    !(focus === "energy" && energy.entries > 0);

  // ── Metric strip (auditable evidence) ──
  const metrics = orderMetrics(
    buildMetrics({
      adherence,
      trend,
      weighIns,
      weightDeltaKg,
      goalDir,
      trainingLoad,
      weeklyWorkoutTarget,
      perf,
      energy: focus === "energy" ? energy : null,
    }),
    focus,
  );

  if (dataLimited) {
    return {
      __kind: "detective",
      headline: "Not enough logged yet to investigate.",
      rootCause: null,
      metrics,
      findings: [
        {
          kind: "inconsistency",
          icon: "documents-outline",
          title: "Give me a week of signal",
          detail:
            "Log your meals, a couple of weigh-ins and your workouts for ~7 days and I can start explaining what's actually driving your results — not just describing them.",
          evidence: [
            `${trackedDays} days of meals logged`,
            `${weighIns} weigh-ins`,
            `${perf.recentN + perf.priorN} sessions recorded`,
          ],
        },
      ],
      dataLimited: true,
    };
  }

  // ── Candidate root causes (ranked) ──
  const candidates: Candidate[] = [];

  // 1) Recomposition — the marquee read: flat scale + climbing performance.
  if (
    weightFlat &&
    weighIns >= 2 &&
    perf.deltaPct !== null &&
    perf.deltaPct >= RECOMP_PERF_GAIN
  ) {
    candidates.push({
      priority: 100 + Math.round(perf.deltaPct * 100),
      bears: ["weight", "strength"],
      finding: {
        kind: "root_cause",
        icon: "git-branch-outline",
        title: "Likely recomposition — muscle up, fat down",
        detail: `Your weight's barely moved over ${trend.spanDays} days, but your training volume is up ${fmtPct(perf.deltaPct)}. That combination usually means you're adding muscle while losing fat — and day-to-day water shifts are hiding it on the scale.`,
        evidence: [
          `weight ${weightDeltaKg !== null ? fmtKg(weightDeltaKg) : "flat"} over ${trend.spanDays}d (${weighIns} weigh-ins)`,
          `training volume ${fmtPct(perf.deltaPct)} vs the prior 2 weeks`,
          `${adherence}/100 nutrition adherence`,
        ],
        lever:
          "Trust the trend, not the daily number. Track your waist and a monthly photo — and keep doing exactly this.",
      },
    });
  }

  // 2) True plateau — flat scale, performance NOT explaining it, goal unmet.
  if (
    weightFlat &&
    weighIns >= 2 &&
    !(perf.deltaPct !== null && perf.deltaPct >= RECOMP_PERF_GAIN) &&
    goalDir !== 0 &&
    (twin.body.goalProgress === null || twin.body.goalProgress < 0.95) &&
    adherence >= 45
  ) {
    candidates.push({
      priority: 80,
      bears: ["weight"],
      finding: {
        kind: "plateau",
        icon: "remove-circle-outline",
        title: "A genuine plateau",
        detail: `The scale's held flat for about ${trend.spanDays} days and your training isn't climbing enough to explain it. Your body's adapted to the current plan — this is a real stall, not recomposition.`,
        evidence: [
          `weight ${weightDeltaKg !== null ? fmtKg(weightDeltaKg) : "flat"} over ${trend.spanDays}d`,
          perf.deltaPct !== null
            ? `training volume ${fmtPct(perf.deltaPct)} (not rising)`
            : `${trainingLoad}/${weeklyWorkoutTarget} sessions/wk`,
          `${adherence}/100 adherence`,
        ],
        lever:
          goalDir < 0
            ? "Change one variable for 7 days — drop intake ~200 kcal or add a session — and let's watch the needle."
            : "Push one variable for 7 days — add ~150 kcal protein-first or a heavier set — to break the adaptation.",
      },
    });
  }

  // 3) Blocker — what's measurably holding progress back.
  const blocker = detectBlocker({
    adherence,
    trackedDays,
    trainingLoad,
    weeklyWorkoutTarget,
    weightFlat,
    weightDeltaKg,
    goalDir,
  });
  if (blocker) candidates.push(blocker);

  // 4) Accelerator — what's measurably moving you forward.
  const accel = detectAccelerator({
    twin,
    adherence,
    perf,
    weightDeltaKg,
    goalDir,
  });
  if (accel) candidates.push(accel);

  // 5) Inconsistency — effort that swings too much day-to-day.
  if (trackedDays >= 6) {
    const cv = coeffVar(trackedAdh);
    const strongDays = trackedAdh.filter((a) => a >= 0.8).length;
    const zeroDays = trackedAdh.filter((a) => a <= 0.25).length;
    if (cv >= 0.5 && zeroDays >= 2 && strongDays >= 2) {
      candidates.push({
        priority: 55,
        bears: ["adherence", "weight"],
        finding: {
          kind: "inconsistency",
          icon: "pulse-outline",
          title: "Your effort swings hard day-to-day",
          detail:
            "You have genuinely strong days and near-zero days back to back. The average looks mediocre, but it's really two different people — and the all-or-nothing pattern is what's capping results.",
          evidence: [
            `${strongDays} strong days vs ${zeroDays} near-zero days (last ${trackedDays})`,
          ],
          lever: "Set a floor, not a ceiling: one protein meal + water even on bad days keeps the average up.",
        },
      });
    }
  }

  // 6) Output falling — the read a strength question needs, and had none of.
  if (perf.deltaPct !== null && perf.deltaPct <= -PERF_DROP) {
    candidates.push({
      priority: 75,
      bears: ["strength", "energy"],
      finding: {
        kind: "blocker",
        icon: "trending-down-outline",
        title: "Your session output is down",
        detail: `You're doing ${fmtPct(Math.abs(perf.deltaPct))} less work per session than the two weeks before. That's rarely the program — it's usually what's around the sessions: sleep, days in a row without rest, or eating under what training needs.`,
        evidence: [
          `training volume ${fmtPct(perf.deltaPct)} vs the prior 2 weeks`,
          `${perf.recentN} sessions in the last 2 weeks`,
        ],
        lever: "Hold the load where it is for a week and protect sleep. If output doesn't come back, take a lighter week.",
      },
    });
  }

  // 7) Energy — sleep, felt fatigue, and training past the plan. Read from the
  //    check-in log; nothing else in the app sees sleep for a user without a watch.
  if (energy.sleepNights >= MIN_SLEEP_NIGHTS && energy.sleepAvg !== null && energy.sleepAvg < SHORT_SLEEP_AVG) {
    candidates.push({
      priority: 85,
      bears: ["energy", "strength"],
      finding: {
        kind: "blocker",
        icon: "moon-outline",
        title: "Short sleep is the likeliest drain",
        detail: `Your logged nights average ${energy.sleepAvg} hours. Energy, recovery and appetite all run through sleep, and nothing else in your logs explains a slump as well.`,
        evidence: [
          `${energy.sleepNights} nights logged, averaging ${energy.sleepAvg}h`,
          `${energy.nightsUnder6} under 6 hours`,
        ],
        lever: "Pick a fixed lights-out time for the next 7 nights. It's the cheapest energy there is.",
      },
    });
  }
  if (energy.fatigueEntries >= MIN_FATIGUE_ENTRIES) {
    candidates.push({
      priority: 68,
      bears: ["energy"],
      finding: {
        kind: "inconsistency",
        icon: "battery-dead-outline",
        title: "You've been logging tired, again and again",
        detail: "It isn't one bad day — you've named it repeatedly over the last two weeks. That's a pattern worth treating as real, not pushing through.",
        evidence: [`${energy.fatigueEntries} of ${energy.entries} check-ins said tired or drained`],
        lever: "Make one session this week easy on purpose, and see whether the next check-ins change.",
      },
    });
  }
  // Only when asked about energy or strength: in an open "how am I doing", a
  // keen week is not a blocker, and it would outrank the accelerators.
  if (
    (focus === "energy" || focus === "strength") &&
    weeklyWorkoutTarget > 0 &&
    trainingLoad >= weeklyWorkoutTarget + 2
  ) {
    candidates.push({
      priority: 62,
      bears: ["energy", "strength"],
      finding: {
        kind: "blocker",
        icon: "flame-outline",
        title: "You're training more than your plan",
        detail: "More sessions than the plan asks for means less recovery between them. Extra volume only helps when the body can absorb it.",
        evidence: [`${trainingLoad} sessions this week against a plan of ${weeklyWorkoutTarget}`],
        lever: "Swap one session for a walk this week and see whether energy comes back.",
      },
    });
  }

  // ── Pick the root cause; the rest become supporting findings ──
  // A focused question takes its root cause only from what can explain THAT
  // outcome. Off-focus candidates are dropped rather than demoted: a strength
  // question answered with a weight plateau was the bug this fixes.
  candidates.sort((a, b) => b.priority - a.priority);
  const eligible = focus ? candidates.filter((c) => c.bears.includes(focus)) : candidates;
  if (focus && eligible.length === 0) {
    return {
      __kind: "detective",
      headline: FOCUS_EMPTY_HEADLINE[focus],
      rootCause: null,
      metrics,
      findings: [nothingFound(focus, { perf, weighIns, trackedDays, adherence, energy })],
      dataLimited: false,
    };
  }
  const rootCause = eligible[0]?.finding ?? null;

  const supporting: ProgressFinding[] = eligible.slice(1).map((c) => c.finding);

  // Fold in the lighter detective findings (hidden wins / correlations), deduped.
  // Not for a focused question — they are about whatever they happen to be about.
  const extra = focus
    ? []
    : detectFindings({
        twin,
        dietHistory,
        workoutLog: input.workoutLog,
        now,
      });
  const seen = new Set<string>([rootCause?.title, ...supporting.map((f) => f.title)].filter(Boolean) as string[]);
  for (const f of extra) {
    if (seen.has(f.title)) continue;
    seen.add(f.title);
    supporting.push(f);
  }

  return {
    __kind: "detective",
    headline: buildHeadline(rootCause),
    rootCause,
    metrics,
    findings: supporting.slice(0, 4),
    dataLimited: false,
  };
}

// ════════════════════════════════════════════════════════════════════
// Sub-routines
// ════════════════════════════════════════════════════════════════════

/** Which way we WANT the scale to move: from the goal weight if set, else goal intent. */
function goalDirection(twin: GozlinTwin): number {
  const { goalWeightKg, currentWeightKg } = twin.body;
  if (goalWeightKg != null && currentWeightKg != null) {
    return sign(goalWeightKg - currentWeightKg);
  }
  switch (twin.goal) {
    case "lose_weight":
      return -1;
    case "build_muscle":
    case "increase_energy":
    case "athletic_performance":
      return 1;
    default:
      return 0;
  }
}

const FOCUS_EMPTY_HEADLINE: Record<DetectiveFocus, string> = {
  weight: "Nothing in your logs explains the scale right now.",
  strength: "Nothing in your logs is holding your training back.",
  energy: "Nothing in your logs points to what's draining you.",
  adherence: "Nothing in your logs says your consistency is slipping.",
};

/**
 * The honest answer when a focused question has no candidate: what the report
 * did look at, and what it would need to say more. Never a borrowed finding
 * about some other outcome.
 */
function nothingFound(
  focus: DetectiveFocus,
  a: {
    perf: PerfRead;
    weighIns: number;
    trackedDays: number;
    adherence: number;
    energy: EnergyRead;
  },
): ProgressFinding {
  const need = (title: string, detail: string, evidence: string[]): ProgressFinding => ({
    kind: "inconsistency",
    icon: "documents-outline",
    title,
    detail,
    evidence,
  });
  switch (focus) {
    case "strength":
      return a.perf.deltaPct === null
        ? need(
            "Not enough sessions to compare yet",
            "I read strength by comparing your session output across two fortnights, and I need at least two sessions in each.",
            [`${a.perf.recentN} sessions in the last 2 weeks`, `${a.perf.priorN} in the 2 weeks before`],
          )
        : need(
            "Your output is holding steady",
            "Session output is within a few percent of two weeks ago — steady, not falling. There's no drag to find; progress from here comes from adding load, not fixing something.",
            [`training volume ${fmtPct(a.perf.deltaPct)} vs the prior 2 weeks`],
          );
    case "energy":
      return a.energy.entries === 0
        ? need(
            "Energy isn't in your logs",
            "I can't see energy directly. A daily check-in with your sleep hours is what lets me read it — the training and eating side shows nothing draining you.",
            ["0 check-ins in the last 2 weeks"],
          )
        : need(
            "Sleep and check-ins look steady",
            "Your logged sleep and how you've said you feel don't show a pattern that would explain a slump.",
            [
              `${a.energy.entries} check-ins in the last 2 weeks`,
              ...(a.energy.sleepAvg !== null
                ? [`${a.energy.sleepNights} nights logged, averaging ${a.energy.sleepAvg}h`]
                : []),
            ],
          );
    case "weight":
      return a.weighIns < 2
        ? need(
            "Not enough weigh-ins to read a trend",
            "I need at least two weigh-ins in the last two weeks to say what the scale is doing.",
            [`${a.weighIns} weigh-ins in the last 2 weeks`],
          )
        : need(
            "No clear cause in the logs",
            "The scale, your eating and your training don't line up into a single explanation yet.",
            [`${a.weighIns} weigh-ins in the last 2 weeks`, `${a.adherence}/100 adherence`],
          );
    case "adherence":
      return a.trackedDays < MIN_TRACKED
        ? need(
            "Not enough days logged",
            "I read consistency from logged meal days, and there aren't enough recent ones to see a pattern.",
            [`${a.trackedDays} days of meals logged in the last 2 weeks`],
          )
        : need(
            "Your consistency is holding",
            "Your logged days don't show the swings or the drop-off that would explain slipping.",
            [`${a.adherence}/100 adherence`, `${a.trackedDays} days of meals logged`],
          );
  }
}

/** The metric the question is about goes first; the rest keep their order. */
const FOCUS_METRICS: Record<DetectiveFocus, string[]> = {
  weight: ["Weight"],
  strength: ["Performance", "Training"],
  energy: ["Sleep", "Training"],
  adherence: ["Adherence"],
};

function orderMetrics(metrics: DetectiveMetric[], focus?: DetectiveFocus): DetectiveMetric[] {
  if (!focus) return metrics;
  const lead = FOCUS_METRICS[focus];
  const rank = (m: DetectiveMetric) => {
    const i = lead.indexOf(m.label);
    return i === -1 ? lead.length : i;
  };
  return [...metrics].sort((a, b) => rank(a) - rank(b));
}

function detectBlocker(a: {
  adherence: number;
  trackedDays: number;
  trainingLoad: number;
  weeklyWorkoutTarget: number;
  weightFlat: boolean;
  weightDeltaKg: number | null;
  goalDir: number;
}): Candidate | null {
  // Reversing the wrong way is the loudest blocker.
  const driftingWrong =
    a.weightDeltaKg !== null && a.goalDir !== 0 && sign(a.weightDeltaKg) === -a.goalDir && Math.abs(a.weightDeltaKg) >= 0.4;
  if (driftingWrong) {
    return {
      priority: 90,
      bears: ["weight"],
      finding: {
        kind: "blocker",
        icon: "trending-down-outline",
        title: "You're drifting the wrong way",
        detail:
          "The scale's moving away from your goal, not toward it. Something in the daily intake has crept past where it needs to be.",
        evidence: [`weight ${fmtKg(a.weightDeltaKg!)} — wrong direction`, `${a.adherence}/100 adherence`],
        lever: "Reset this week: re-anchor your intake to plan and protect 5 clean days.",
      },
    };
  }

  // Low adherence while stalled — nutrition is the bottleneck.
  if (a.adherence < 55 && a.trackedDays >= MIN_TRACKED) {
    return {
      priority: 70,
      bears: ["weight", "adherence"],
      finding: {
        kind: "blocker",
        icon: "restaurant-outline",
        title: "Inconsistent nutrition is the bottleneck",
        detail:
          "Your training is showing up, but the plan only works as far as it's followed — and adherence is where the results are leaking out.",
        evidence: [`${a.adherence}/100 adherence`, `${a.trackedDays} days logged`],
        lever: "Pick the one meal slot you miss most and make it non-negotiable for 7 days.",
      },
    };
  }

  // Under-training relative to the target.
  if (a.trainingLoad < a.weeklyWorkoutTarget * 0.6) {
    const gap = Math.max(1, a.weeklyWorkoutTarget - a.trainingLoad);
    return {
      priority: 60,
      bears: ["weight", "strength", "adherence"],
      finding: {
        kind: "blocker",
        icon: "barbell-outline",
        title: "Training volume is short",
        detail: `You're running below your weekly training target, and that's the lever the scale is waiting on.`,
        evidence: [`${a.trainingLoad}/${a.weeklyWorkoutTarget} sessions this week`],
        lever: `Add ${gap} session${gap === 1 ? "" : "s"} this week — schedule them like appointments.`,
      },
    };
  }

  return null;
}

function detectAccelerator(a: {
  twin: GozlinTwin;
  adherence: number;
  perf: PerfRead;
  weightDeltaKg: number | null;
  goalDir: number;
}): Candidate | null {
  const movingRight =
    a.weightDeltaKg !== null && a.goalDir !== 0 && sign(a.weightDeltaKg) === a.goalDir && Math.abs(a.weightDeltaKg) >= 0.3;

  // Training clearly climbing — the strongest, most motivating accelerator.
  if (a.perf.deltaPct !== null && a.perf.deltaPct >= 0.1) {
    return {
      priority: 50,
      bears: ["strength"],
      finding: {
        kind: "accelerator",
        icon: "trending-up-outline",
        title: "Your training is on a clear upswing",
        detail: `You're doing ${fmtPct(a.perf.deltaPct)} more work in your sessions than two weeks ago. That's the engine of every result that follows — protect it.`,
        evidence: [`training volume ${fmtPct(a.perf.deltaPct)} vs prior 2 weeks`],
        lever: "Keep the progression gentle — small weekly bumps beat heroic jumps that force a deload.",
      },
    };
  }

  // Nutrition consistency driving real movement toward the goal.
  if (movingRight && a.adherence >= 65) {
    return {
      priority: 45,
      bears: ["weight", "adherence"],
      finding: {
        kind: "accelerator",
        icon: "rocket-outline",
        title: "Consistency is doing the heavy lifting",
        detail:
          "Your adherence is high and the scale is moving the way you want it to. This is exactly the loop that compounds — the boring part that works.",
        evidence: [`weight ${fmtKg(a.weightDeltaKg!)} toward goal`, `${a.adherence}/100 adherence`],
        lever: "Don't change a thing yet — let this run and we'll only adjust when it stalls.",
      },
    };
  }

  return null;
}

function buildMetrics(a: {
  adherence: number;
  trend: ReturnType<typeof computeWeightTrend>;
  weighIns: number;
  weightDeltaKg: number | null;
  goalDir: number;
  trainingLoad: number;
  weeklyWorkoutTarget: number;
  perf: PerfRead;
  /** Present only for an energy question — the strip stays as it was otherwise. */
  energy: EnergyRead | null;
}): DetectiveMetric[] {
  const metrics: DetectiveMetric[] = [];

  if (a.energy && a.energy.sleepAvg !== null) {
    metrics.push({
      icon: "moon-outline",
      label: "Sleep",
      value: `${a.energy.sleepAvg}h avg`,
      delta: `${a.energy.sleepNights} nights`,
      direction: a.energy.sleepAvg >= 7 ? "good" : a.energy.sleepAvg < 6 ? "bad" : "neutral",
    });
  }

  // Adherence
  metrics.push({
    icon: "pulse",
    label: "Adherence",
    value: `${a.adherence}/100`,
    direction: a.adherence >= 60 ? "good" : a.adherence < 40 ? "bad" : "neutral",
  });

  // Weight (only when we have a real trend)
  if (a.weighIns >= 2 && a.weightDeltaKg !== null) {
    const moving = Math.abs(a.weightDeltaKg) >= 0.1;
    const towardGoal = a.goalDir !== 0 && sign(a.weightDeltaKg) === a.goalDir;
    const direction: DetectiveMetric["direction"] = !moving
      ? a.goalDir === 0
        ? "good"
        : "neutral"
      : towardGoal
        ? "good"
        : "bad";
    metrics.push({
      icon: "scale-outline",
      label: "Weight",
      value: fmtKg(a.weightDeltaKg),
      delta: `${a.trend.spanDays}d`,
      direction,
    });
  } else {
    metrics.push({
      icon: "scale-outline",
      label: "Weight",
      value: "no trend",
      direction: "neutral",
    });
  }

  // Training load
  metrics.push({
    icon: "barbell",
    label: "Training",
    value: `${a.trainingLoad}/${a.weeklyWorkoutTarget}`,
    delta: "this wk",
    direction:
      a.trainingLoad >= a.weeklyWorkoutTarget
        ? "good"
        : a.trainingLoad < a.weeklyWorkoutTarget * 0.6
          ? "bad"
          : "neutral",
  });

  // Workout performance (only when comparable)
  if (a.perf.deltaPct !== null) {
    metrics.push({
      icon: "flash",
      label: "Performance",
      value: fmtPct(a.perf.deltaPct),
      delta: "vs 2 wks",
      direction: a.perf.deltaPct > 0.02 ? "good" : a.perf.deltaPct < -0.02 ? "bad" : "neutral",
    });
  }

  return metrics;
}

const HEADLINE_BY_KIND: Partial<Record<FindingKind, string>> = {
  root_cause: "The scale's misleading you — here's what's really happening.",
  plateau: "You've hit a real plateau. Let's break it.",
  blocker: "I found what's slowing you down.",
  accelerator: "I found what's working — let's protect it.",
  inconsistency: "Your results are hiding in the swings.",
};

function buildHeadline(rootCause: ProgressFinding | null): string {
  if (!rootCause) return "Here's the honest read on your progress.";
  return HEADLINE_BY_KIND[rootCause.kind] ?? "Here's what your data is telling me.";
}
