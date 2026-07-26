/**
 * FITNESS RECOMMENDATION ENGINE — "what should I do today, and why?"
 *
 * A transparent, scoring-based daily recommendation. Signals:
 *   • the weekly plan (a scheduled session wins unless recovery says no)
 *   • recovery level (from the existing GozlinRecoveryEngine, injected)
 *   • recent body-region load (balance: yesterday upper → today lower)
 *   • the user's preferences (styles, duration window, goals, equipment)
 *   • adaptation memory (skipped recommendations get demoted, not repeated)
 *
 * Pure + deterministic for a given date: same inputs → same recommendation
 * (the tiebreaker is seeded by the date), so the dashboard never flickers
 * between renders and tests can pin behaviour.
 */

import type { SessionSummaryData } from "@/models/session";
import type {
  GeneratedWorkoutPlan,
  WorkoutLogEntry,
  WorkoutSession,
} from "@/models/workout";
import type { UserBio } from "@/models/user";
import { getAllWorkouts, workoutFitsEquipment } from "./WorkoutCatalog";
import type {
  BodyFocus,
  FitnessProfile,
  FitnessRecommendation,
  ResolvedWorkout,
} from "../types";

export type RecoveryLevel = "green" | "amber" | "red";

export interface RecommendationInput {
  /** YYYY-MM-DD (local). */
  date: string;
  /** 0 = Mon … 6 = Sun. */
  dayIndex: number;
  bio: UserBio | null;
  profile: FitnessProfile;
  plan: GeneratedWorkoutPlan | null;
  todaySession: WorkoutSession | null;
  doneToday: boolean;
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  recoveryLevel: RecoveryLevel;
  /** Overrides profile.typicalDurationMin ("I only have 15 today"). */
  minutesAvailable?: number;
}

/* ─────────────────────── body-region load model ─────────────────────── */

export type BodyRegion = "upper" | "lower" | "core" | "cardio";

const CATEGORY_TO_REGION: Record<string, BodyRegion | null> = {
  push: "upper",
  pull: "upper",
  legs: "lower",
  core: "core",
  cardio: "cardio",
  flexibility: null, // mobility doesn't load a region
};

const FOCUS_TO_REGIONS: Record<BodyFocus, BodyRegion[]> = {
  full_body: ["upper", "lower", "core"],
  upper: ["upper"],
  chest_arms: ["upper"],
  back: ["upper"],
  lower: ["lower"],
  glutes_legs: ["lower"],
  core: ["core"],
};

/**
 * How much each body region was worked in the last `days` days, from the
 * per-exercise session summaries (0 = untouched).
 */
export function recentRegionLoad(
  sessionHistory: SessionSummaryData[],
  date: string,
  days: number = 2,
): Record<BodyRegion, number> {
  const load: Record<BodyRegion, number> = { upper: 0, lower: 0, core: 0, cardio: 0 };
  const cutoff = shiftDate(date, -days);
  for (const s of sessionHistory) {
    if (s.date <= cutoff || s.date > date) continue;
    for (const r of s.exerciseResults) {
      if (r.skipped) continue;
      const region = CATEGORY_TO_REGION[r.category];
      if (region) load[region] += 1;
    }
  }
  return load;
}

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/* ────────────────────────── skip adaptation ────────────────────────── */

/** Times this workout was recommended and not done, in the last week. */
function recentSkips(profile: FitnessProfile, workoutId: string, date: string): number {
  const cutoff = shiftDate(date, -7);
  return profile.recommendationHistory.filter(
    (m) => m.workoutId === workoutId && !m.completed && m.date > cutoff && m.date < date,
  ).length;
}

/** Whether the plan itself keeps getting skipped (2+ misses this week). */
export function planFatigue(profile: FitnessProfile, date: string): boolean {
  return recentSkips(profile, "plan", date) >= 2;
}

/* ──────────────────────────── main engine ──────────────────────────── */

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

function hashDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function recommendToday(input: RecommendationInput): FitnessRecommendation {
  const { profile, bio, recoveryLevel } = input;
  const minutes = input.minutesAvailable ?? profile.typicalDurationMin;

  // 1) Already trained → protect the win, offer nothing heavy.
  if (input.doneToday) {
    return {
      kind: "rest",
      title: "Done for today",
      reasons: ["You've already completed a session today", "Consistency beats volume — let it land"],
      insight: "Session banked. A short stretch tonight would be a bonus, not a requirement.",
    };
  }

  // 2) Recovery red → actively steer to restorative movement.
  if (recoveryLevel === "red") {
    const gentle = pickLibrary(input, minutes, { onlyLowEnergy: true });
    if (gentle) {
      return {
        kind: "library_workout",
        workoutId: gentle.id,
        title: gentle.name,
        reasons: [
          "Your recent training load is high — recovery day",
          "Low-intensity movement speeds recovery more than full rest",
          `${gentle.durationMinutes} min, nothing explosive`,
        ],
        insight: "The strongest move today is the gentle one. Recover on purpose.",
      };
    }
    return {
      kind: "rest",
      title: "Recovery day",
      reasons: ["Recent training load is high", "Adaptation happens between sessions"],
      insight: "Rest is training too — today it's the part that makes you stronger.",
    };
  }

  // 3) A scheduled plan session leads — unless the user keeps skipping it.
  if (input.todaySession && !planFatigue(profile, input.date)) {
    const s = input.todaySession;
    const reasons: string[] = [];
    if (bio) reasons.push(`Matched to your ${bio.exerciseLevel} level`);
    reasons.push(`Today's focus: ${s.focus}`);
    reasons.push(`About ${s.totalDurationMinutes} min`);
    if (recoveryLevel === "amber") reasons.push("Keep intensity moderate — recovery is mid-range");
    return {
      kind: "plan_session",
      title: s.dayLabel,
      reasons: reasons.slice(0, 4),
      insight:
        recoveryLevel === "amber"
          ? "You're cleared to train — leave one rep in the tank on every set."
          : "This is the session your week was built around. Make it count.",
    };
  }

  // 4) Otherwise pick the best library workout for today.
  const pick = pickLibrary(input, minutes, {
    onlyLowEnergy: false,
    capEnergy: recoveryLevel === "amber" ? "medium" : undefined,
  });
  if (pick) {
    return {
      kind: "library_workout",
      workoutId: pick.id,
      title: pick.name,
      reasons: buildReasons(pick, input, minutes),
      insight: input.todaySession
        ? "Your plan session kept slipping this week, so here's a fresher angle at the same goal."
        : "No plan session today — this keeps the momentum without overreaching.",
    };
  }

  // 5) Nothing fits (extreme filters) → honest rest suggestion.
  return {
    kind: "rest",
    title: "Rest day",
    reasons: ["Nothing on the plan today", "Recovery is part of the program"],
    insight: "A walk and water still count. Tomorrow we go again.",
  };
}

/* ───────────────────────────── scoring ───────────────────────────── */

function pickLibrary(
  input: RecommendationInput,
  minutes: number,
  opts: { onlyLowEnergy: boolean; capEnergy?: "medium" },
): ResolvedWorkout | null {
  const { bio, profile } = input;
  const owned = bio?.equipment ?? ["none"];
  const userRank = DIFFICULTY_RANK[bio?.exerciseLevel ?? "beginner"];
  const load = recentRegionLoad(input.sessionHistory, input.date);
  const recentlyDone = new Set(
    input.workoutLog
      .filter((l) => l.date > shiftDate(input.date, -3))
      .map((l) => l.sessionId),
  );
  const seed = hashDate(input.date);

  let best: ResolvedWorkout | null = null;
  let bestScore = -Infinity;

  for (const w of getAllWorkouts()) {
    if (!workoutFitsEquipment(w, owned)) continue;
    if (DIFFICULTY_RANK[w.difficulty] > userRank + (opts.onlyLowEnergy ? 0 : 1)) continue;
    if (opts.onlyLowEnergy && w.energy !== "low") continue;
    if (opts.capEnergy === "medium" && w.energy === "high") continue;
    if (w.durationMinutes > minutes + 12) continue;

    let score = 0;

    // Duration fit: closer to the user's window is better.
    score += 20 - Math.abs(w.durationMinutes - minutes);

    // Style preference.
    if (profile.preferredStyles.includes(w.style)) score += 12;

    // Goal alignment.
    if (bio && w.goalFit.includes(bio.primaryGoal)) score += 10;

    // Level match (at-level beats below-level beats stretch).
    score += DIFFICULTY_RANK[w.difficulty] === userRank ? 8 : 0;

    // Body balance: reward hitting the least-loaded regions.
    const regions = FOCUS_TO_REGIONS[w.focus];
    const avgLoad = regions.reduce((s, r) => s + load[r], 0) / regions.length;
    score += Math.max(0, 10 - avgLoad * 3);

    // Variety: demote what was just done or repeatedly skipped.
    if (recentlyDone.has(`lib_${w.id}`)) score -= 25;
    score -= recentSkips(profile, w.id, input.date) * 15;

    // Favorites get a nudge, not a lock-in.
    if (profile.favorites.includes(w.id)) score += 4;

    // Deterministic per-day tiebreaker keeps rotation feeling alive.
    score += ((seed + hashDate(w.id + input.date)) % 7) * 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best;
}

function buildReasons(
  w: ResolvedWorkout,
  input: RecommendationInput,
  minutes: number,
): string[] {
  const reasons: string[] = [];
  const load = recentRegionLoad(input.sessionHistory, input.date);
  const regions = FOCUS_TO_REGIONS[w.focus];

  // Lead with balance when it's the driving signal.
  const most = (Object.entries(load) as [BodyRegion, number][]).sort((a, b) => b[1] - a[1])[0];
  if (most && most[1] >= 3 && !regions.includes(most[0])) {
    const label = most[0] === "upper" ? "upper body" : most[0] === "lower" ? "lower body" : most[0];
    reasons.push(`You trained your ${label} recently — this balances it out`);
  }

  reasons.push(`${w.durationMinutes} min — fits your ${minutes}-minute window`);
  if (input.profile.preferredStyles.includes(w.style))
    reasons.push(`Matches your ${w.style} preference`);
  if (input.bio && w.goalFit.includes(input.bio.primaryGoal))
    reasons.push(`Serves your ${input.bio.primaryGoal.replace(/_/g, " ")} goal`);
  if (w.equipment.length === 0) reasons.push("No equipment needed");

  return reasons.slice(0, 4);
}
