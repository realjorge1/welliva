/**
 * PLAYER PARAMS — how a session from the user's plan is handed to the
 * guided-session player.
 *
 * The Fitness screen's Start button and the Deck's gold action both launch the
 * day's session; they used to build the route params separately, and the Deck
 * dropped the plan's prescribed rests on the way. One builder, so neither can
 * pass something the other doesn't. (Library workouts use
 * `workoutToPlayerParams` in WorkoutCatalog — same contract.)
 *
 * Type-only imports: the Deck is mounted app-wide and must not pull the
 * workout catalogue in at launch.
 */
import type { WorkoutSession } from "@/models/workout";

// A type alias, not an interface: route params must be assignable to a string record.
export type PlanPlayerParams = {
  exerciseIds: string;
  sets: string;
  reps: string;
  rest: string;
  /** Warm-up / main / cool-down per move, so the player can speak in blocks. */
  blocks: string;
  sessionLabel: string;
  workoutSessionId: string;
};

export function planSessionToPlayerParams(session: WorkoutSession): PlanPlayerParams {
  const moves = session.exercises;
  return {
    exerciseIds: moves.map((e) => e.exerciseId).join(","),
    sets: moves.map((e) => e.sets).join(","),
    reps: moves.map((e) => e.reps).join(","),
    rest: moves.map((e) => e.restSeconds).join(","),
    blocks: moves.map((e) => e.block ?? "main").join(","),
    sessionLabel: session.dayLabel,
    workoutSessionId: session.id,
  };
}
