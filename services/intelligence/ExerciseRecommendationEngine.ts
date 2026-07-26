/**
 * EXERCISE RECOMMENDATION ENGINE
 *
 * Explainability + adaptive guidance on top of the deterministic
 * WorkoutGenerator. It picks the session the user should do *today* and tells
 * them why, plus an adaptive note based on how their week is going.
 */

import { UserBio } from "../../models/user";
import { GeneratedWorkoutPlan, WorkoutSession } from "../../models/workout";

export interface ExerciseRecommendation {
  isRestDay: boolean;
  session: WorkoutSession | null;
  /** Explainable reasons (max 4). */
  reasons: string[];
  /** Adaptive, week-aware note. */
  note: string | null;
}

export interface ExerciseRecommendationInput {
  plan: GeneratedWorkoutPlan | null;
  bio: UserBio | null;
  /** 0 = Mon … 6 = Sun (local). */
  todayDayIndex: number;
  doneToday: boolean;
  workoutsThisWeek: number;
  weeklyTarget: number;
}

export function recommendTodayWorkout(
  input: ExerciseRecommendationInput,
): ExerciseRecommendation {
  const { plan, bio, todayDayIndex, doneToday, workoutsThisWeek, weeklyTarget } =
    input;

  if (!plan) {
    return {
      isRestDay: false,
      session: null,
      reasons: [],
      note: bio
        ? "No plan yet — generate one to get started."
        : "Complete onboarding to get your personalized plan.",
    };
  }

  const session =
    plan.sessions.find((s) => s.dayOfWeek === todayDayIndex) ?? null;

  // Rest day (no session scheduled for today).
  if (!session) {
    const hitTarget = workoutsThisWeek >= weeklyTarget;
    return {
      isRestDay: true,
      session: null,
      reasons: ["Scheduled rest day", "Recovery is when your body adapts"],
      note: hitTarget
        ? "You've hit your weekly target — enjoy the rest!"
        : "A light walk or stretch still keeps the streak alive.",
    };
  }

  const reasons: string[] = [];
  if (bio) reasons.push(`Matched to your ${bio.exerciseLevel} level`);
  reasons.push(`Part of your ${plan.sessions.length}-day split`);
  reasons.push(`Today's focus: ${session.focus}`);
  reasons.push(`About ${session.totalDurationMinutes} min`);

  let note: string | null = null;
  if (doneToday) {
    note = "Done for today — great work.";
  } else if (workoutsThisWeek + 1 >= weeklyTarget && weeklyTarget > 0) {
    note = "Finish this and you'll hit your weekly goal!";
  } else if (workoutsThisWeek === 0) {
    note = "First session of the week — let's build momentum.";
  }

  return { isRestDay: false, session, reasons: reasons.slice(0, 4), note };
}
