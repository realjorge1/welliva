/**
 * Migration 001 — backfill the Timeline from the existing storage silos.
 *
 * Reads diet_history, water_history, workout_log, session_history, body_logs,
 * gozlin check-ins, and gozlin episodes, and re-encodes each record as a HealthEvent
 * with a DETERMINISTIC id (ulidFromSeed) so re-running is a no-op (idempotent).
 *
 * The originals are NOT deleted — they remain the safety net until a later, guarded
 * retirement migration. A count mismatch THROWS, which leaves schema_version
 * unadvanced and the app on the legacy path: zero data loss either way.
 *
 * See docs/architecture/04-migration-strategy.md §4.
 */
import type { DietHistoryEntry } from "@/models/diet";
import type { SessionSummaryData } from "@/models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "@/models/workout";
import type { GozlinCheckin, GozlinEpisode } from "@/services/gozlin/gozlin.types";
import type { WaterHistoryEntry } from "@/services/OfflineStorage";

import { localMidnightISO, localMidnightMs } from "../clock";
import { ulidFromSeed } from "../id";
import { LEGACY } from "../storage/keys";
import type {
  BodyMeasurementPayload,
  CheckinPayload,
  CoachEpisodePayload,
  MealLoggedPayload,
  MealSkippedPayload,
  NutritionDayClosedPayload,
  WaterDayClosedPayload,
  WorkoutCompletedPayload,
  WorkoutSummaryPayload,
} from "../../timeline/catalog";
import { buildEvent } from "../../timeline/events";
import type { HealthEvent } from "../../timeline/events";
import { TimelineRepository } from "../../timeline/TimelineRepository";
import type { Migration, MigrationReport } from "./runner";

function countByType(events: HealthEvent[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const e of events) c[e.type] = (c[e.type] ?? 0) + 1;
  return c;
}

export const migration001: Migration = {
  version: 1,
  name: "backfill-timeline",

  async up({ store }): Promise<MigrationReport> {
    const repo = new TimelineRepository(store);

    const [diet, water, workouts, sessions, body, checkins, episodes] =
      await Promise.all([
        store.get<DietHistoryEntry[]>(LEGACY.DIET_HISTORY, []),
        store.get<WaterHistoryEntry[]>(LEGACY.WATER_HISTORY, []),
        store.get<WorkoutLogEntry[]>(LEGACY.WORKOUT_LOG, []),
        store.get<SessionSummaryData[]>(LEGACY.SESSION_HISTORY, []),
        store.get<BodyLogEntry[]>(LEGACY.BODY_LOGS, []),
        store.get<GozlinCheckin[]>(LEGACY.GOZLIN_CHECKINS, []),
        store.get<GozlinEpisode[]>(LEGACY.GOZLIN_EPISODIC, []),
      ]);

    const events: HealthEvent[] = [];

    // ── diet history → meal.logged / meal.skipped / day.closed ──
    for (const d of diet) {
      if (!d?.date) continue;
      const ms = localMidnightMs(d.date);
      const ts = localMidnightISO(d.date);
      for (const name of d.consumedMeals ?? []) {
        events.push(
          buildEvent<MealLoggedPayload>({
            type: "nutrition.meal.logged",
            id: ulidFromSeed(`diet:${d.date}:consumed:${name}`, ms),
            localDate: d.date,
            ts,
            source: "import",
            payload: { name, dietId: d.dietId },
          }),
        );
      }
      for (const name of d.skippedMeals ?? []) {
        events.push(
          buildEvent<MealSkippedPayload>({
            type: "nutrition.meal.skipped",
            id: ulidFromSeed(`diet:${d.date}:skipped:${name}`, ms),
            localDate: d.date,
            ts,
            source: "import",
            payload: { name },
          }),
        );
      }
      events.push(
        buildEvent<NutritionDayClosedPayload>({
          type: "nutrition.day.closed",
          id: ulidFromSeed(`diet:${d.date}:dayclosed`, ms),
          localDate: d.date,
          ts,
          source: "import",
          payload: {
            dietId: d.dietId,
            dietName: d.dietName,
            mealsConsumed: d.mealsConsumed,
            totalMeals: d.totalMeals,
            status: d.status,
            consumedCalories: d.consumedCalories,
            consumedProteinG: d.consumedProteinG,
            consumedCarbsG: d.consumedCarbsG,
            consumedFatG: d.consumedFatG,
          },
        }),
      );
    }

    // ── water history → hydration.day.closed ──
    for (const w of water) {
      if (!w?.date) continue;
      events.push(
        buildEvent<WaterDayClosedPayload>({
          type: "hydration.day.closed",
          id: ulidFromSeed(`water:${w.date}`, localMidnightMs(w.date)),
          localDate: w.date,
          ts: localMidnightISO(w.date),
          source: "import",
          payload: {
            ml: w.ml,
            goalMl: w.goalMl,
            metGoal: w.goalMl != null ? w.ml >= w.goalMl : false,
          },
        }),
      );
    }

    // ── workout logs → workout.session.completed ──
    for (const wl of workouts) {
      if (!wl?.date || !wl?.id) continue;
      events.push(
        buildEvent<WorkoutCompletedPayload>({
          type: "workout.session.completed",
          id: ulidFromSeed(`workout:${wl.id}`, localMidnightMs(wl.date)),
          localDate: wl.date,
          ts: wl.completedAt ?? localMidnightISO(wl.date),
          source: "import",
          payload: {
            sessionId: wl.sessionId,
            sessionLabel: wl.sessionLabel,
            durationMinutes: wl.durationMinutes,
            completionPercent: wl.completionPercent,
            exercisesCompleted: wl.exercisesCompleted,
            totalExercises: wl.totalExercises,
            completedAt: wl.completedAt,
          },
        }),
      );
    }

    // ── session summaries → workout.session.summary ──
    for (const s of sessions) {
      if (!s?.date || !s?.sessionRunId) continue;
      events.push(
        buildEvent<WorkoutSummaryPayload>({
          type: "workout.session.summary",
          id: ulidFromSeed(`session:${s.sessionRunId}`, localMidnightMs(s.date)),
          localDate: s.date,
          ts: s.completedAt ?? localMidnightISO(s.date),
          source: "import",
          payload: {
            sessionRunId: s.sessionRunId,
            sessionLabel: s.sessionLabel,
            totalReps: s.totalReps,
            setsCompleted: s.setsCompleted,
            totalSets: s.totalSets,
            completionPercent: s.completionPercent,
            durationSeconds: s.durationSeconds,
          },
        }),
      );
    }

    // ── body logs → body.measurement.logged ──
    body.forEach((b, i) => {
      if (!b?.date) return;
      events.push(
        buildEvent<BodyMeasurementPayload>({
          type: "body.measurement.logged",
          id: ulidFromSeed(`body:${i}:${b.date}`, localMidnightMs(b.date)),
          localDate: b.date,
          ts: localMidnightISO(b.date),
          source: "import",
          payload: { weightKg: b.weightKg, waistCm: b.waistCm, notes: b.notes },
        }),
      );
    });

    // ── gozlin check-ins → checkin.logged ──
    for (const c of checkins) {
      if (!c?.date) continue;
      events.push(
        buildEvent<CheckinPayload>({
          type: "checkin.logged",
          id: ulidFromSeed(`checkin:${c.date}`, localMidnightMs(c.date)),
          localDate: c.date,
          ts: localMidnightISO(c.date),
          source: "import",
          payload: {
            mood: c.mood,
            energy: c.energy,
            stress: c.stress,
            sleepHours: c.sleepHours,
            note: c.note,
          },
        }),
      );
    }

    // ── gozlin episodes → coach.episode (mirrors L3 into L1; episodes stay in L3 too) ──
    for (const ep of episodes) {
      if (!ep?.date || !ep?.id) continue;
      events.push(
        buildEvent<CoachEpisodePayload>({
          type: "coach.episode",
          id: ulidFromSeed(`episode:${ep.id}`, localMidnightMs(ep.date)),
          localDate: ep.date,
          ts: localMidnightISO(ep.date),
          source: "import",
          payload: { summary: ep.summary, kind: ep.kind },
        }),
      );
    }

    await repo.appendMany(events);

    // ── validation gate: assert nothing was dropped (throws → version not committed) ──
    const stored = await repo.query({ includeRedacted: true });
    const got = countByType(stored);
    const expected: Record<string, number> = {
      "nutrition.day.closed": diet.filter((d) => d?.date).length,
      "hydration.day.closed": water.filter((w) => w?.date).length,
      "workout.session.completed": workouts.filter((w) => w?.date && w?.id).length,
      "workout.session.summary": sessions.filter((s) => s?.date && s?.sessionRunId)
        .length,
      "body.measurement.logged": body.filter((b) => b?.date).length,
      "checkin.logged": checkins.filter((c) => c?.date).length,
      "coach.episode": episodes.filter((e) => e?.date && e?.id).length,
    };
    for (const [type, want] of Object.entries(expected)) {
      if ((got[type] ?? 0) < want) {
        throw new Error(
          `backfill mismatch for ${type}: have ${got[type] ?? 0}, expected ≥ ${want}`,
        );
      }
    }

    return {
      mealLogged: got["nutrition.meal.logged"] ?? 0,
      mealSkipped: got["nutrition.meal.skipped"] ?? 0,
      daysClosed: got["nutrition.day.closed"] ?? 0,
      waterDays: got["hydration.day.closed"] ?? 0,
      workouts: got["workout.session.completed"] ?? 0,
      sessions: got["workout.session.summary"] ?? 0,
      bodyLogs: got["body.measurement.logged"] ?? 0,
      checkins: got["checkin.logged"] ?? 0,
      episodes: got["coach.episode"] ?? 0,
      totalEvents: stored.length,
    };
  },
};
