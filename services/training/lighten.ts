/**
 * LIGHTER TODAY (Pro) — today's session, eased to a low recovery score.
 *
 * The plan is built a week at a time; recovery is read each morning. On an
 * amber day (or red) this turns the SAME session into a lighter version of
 * itself rather than replacing it with something else, so the week keeps its
 * shape and the user keeps the moves they are progressing:
 *
 *   amber — supporting moves lose a set, rests grow 15 s, jumping moves become
 *           their low-impact versions
 *   red   — every move loses a set, rests grow 30 s, finishers go, jumps go
 *
 * Every change is listed in plain words, and each eased exercise says why.
 * Warm-up and cool-down are untouched: on a low day they matter more, not less.
 */

import type { ExerciseDBEntry } from "../../constants/ExerciseDatabase";
import type { UserBio } from "../../models/user";
import type { PlannedExercise, WorkoutSession } from "../../models/workout";
import { exerciseSeconds, parseReps } from "./dose";
import { buildContraindications, difficultyIndex, isContraindicated, type Contraindications } from "./safety";
import { HIGH_IMPACT } from "./vocabulary";

export interface Readiness {
  level: "green" | "amber" | "red";
  score: number;
}

export interface LighterSession {
  session: WorkoutSession;
  /** What changed, first line = the headline. */
  changes: string[];
}

function rating(ex: ExerciseDBEntry): number {
  return ex.effectiveness?.rating ?? 3;
}

function lowImpactAlternative(
  ex: ExerciseDBEntry,
  pool: ExerciseDBEntry[],
  byId: Map<string, ExerciseDBEntry>,
  contra: Contraindications,
  taken: Set<string>,
): ExerciseDBEntry | null {
  const ok = (c: ExerciseDBEntry | undefined): c is ExerciseDBEntry =>
    !!c &&
    !taken.has(c.id) &&
    !HIGH_IMPACT.has(c.id) &&
    !isContraindicated(c, contra) &&
    c.movementPattern === ex.movementPattern &&
    difficultyIndex(c.difficulty) <= difficultyIndex(ex.difficulty) &&
    c.equipment.every((eq) => ex.equipment.includes(eq));
  const m = /\(([a-z]+_\d+)\)/i.exec(ex.modifications?.easier ?? "");
  const authored = m ? byId.get(m[1]) : undefined;
  if (ok(authored)) return authored;
  return (
    pool
      .filter(ok)
      .sort((a, b) => rating(b) - rating(a) || a.id.localeCompare(b.id))[0] ?? null
  );
}

function secondsFor(p: PlannedExercise, ex: ExerciseDBEntry | undefined): number {
  const timed = ex?.exerciseType === "timed" || !!parseReps(p.reps)?.timed;
  return exerciseSeconds({ sets: p.sets, reps: p.reps, restSeconds: p.restSeconds }, p.category, timed);
}

export function lightenSession(
  session: WorkoutSession,
  readiness: Readiness,
  pool: ExerciseDBEntry[],
  bio: UserBio,
): LighterSession | null {
  if (readiness.level === "green") return null;
  const red = readiness.level === "red";
  const byId = new Map(pool.map((e) => [e.id, e]));
  const contra = buildContraindications(bio);
  const taken = new Set(session.exercises.map((e) => e.exerciseId));
  const restDelta = red ? 30 : 15;

  let swaps = 0;
  let setsCut = 0;
  let dropped = 0;
  const exercises: PlannedExercise[] = [];
  for (const p of session.exercises) {
    if ((p.block ?? "main") !== "main") {
      exercises.push(p);
      continue;
    }
    if (red && p.role === "finisher") {
      dropped += 1;
      continue;
    }
    let next: PlannedExercise = { ...p };
    let ex = byId.get(p.exerciseId);
    if (ex && HIGH_IMPACT.has(ex.id)) {
      const alt = lowImpactAlternative(ex, pool, byId, contra, taken);
      if (alt) {
        taken.add(alt.id);
        next = {
          ...next,
          exerciseId: alt.id,
          name: alt.name,
          category: alt.category,
          movementPattern: alt.movementPattern,
          difficulty: alt.difficulty,
          reps: alt.defaultReps,
          reason: `${alt.name} in place of ${ex.name} — no jumping on a low-recovery day`,
        };
        ex = alt;
        swaps += 1;
      }
    }
    if ((red || p.role !== "main") && next.sets > 1) {
      next.sets -= 1;
      setsCut += 1;
    }
    next.restSeconds = Math.min(240, next.restSeconds + restDelta);
    next.doseReason = `Eased for today's recovery (${readiness.score}/100)`;
    next.durationMinutes = Math.max(1, Math.round(secondsFor(next, ex) / 60));
    exercises.push(next);
  }

  const total = exercises.reduce((sum, p) => sum + secondsFor(p, byId.get(p.exerciseId)), 0);
  const changes = [
    red
      ? `Recovery ${readiness.score}/100 — a recovery version of today's session`
      : `Recovery ${readiness.score}/100 — a lighter version of today's session`,
    setsCut > 0 ? (red ? "One set less on every move" : "One set less on supporting moves") : null,
    `${restDelta} s more rest between sets`,
    swaps > 0 ? `${swaps} jumping ${swaps === 1 ? "move" : "moves"} swapped for low-impact ones` : null,
    dropped > 0 ? "Finisher left out today" : null,
  ].filter((c): c is string => c !== null);

  return {
    session: {
      ...session,
      exercises,
      totalDurationMinutes: Math.max(1, Math.round(total / 60)),
    },
    changes,
  };
}
