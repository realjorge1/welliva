/**
 * Keeps the home-screen widget's day current. Renders nothing.
 *
 * Whenever something that changes today's word or line changes — a meal, a
 * food log, water, a workout, a mood, a habit, a weigh-in, the streak, a rough
 * day, or the date itself — it gathers today's facts, stores the snapshot the
 * widget reads (services/widget/todaySnapshot.ts) and asks Android to redraw.
 *
 * Entirely OFF on a build without the native widget module: no reads, no
 * writes, no timers. The work is one short burst per change, settled so a
 * flurry of writes costs one rebuild, and nothing runs while idle.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { useRoughToday } from "@/components/smart/useRoughDay";
import { loadCheckins } from "@/services/gozlin/GozlinMemoryStore";
import { subscribeMindEntries } from "@/services/gozlin/MindService";
import { subscribeExternalWrites } from "@/services/notifications/externalWrites";
import { getIntakeForDate } from "@/services/nutrition/IntakeLedger";
import { getFoodLogForDate } from "@/services/nutrition/foodLogStore";
import { poursOn } from "@/services/nutrition/waterPours";
import { readWaterPours, subscribeWaterPours } from "@/services/nutrition/waterStore";
import { toLocalDateString } from "@/services/OfflineStorage";
import { onCommitmentKept } from "@/services/StreakService";
import { shiftDay } from "@/services/commitment";
import {
  buildTodaySnapshot,
  readTodaySnapshot,
  writeTodaySnapshot,
} from "@/services/widget/todaySnapshot";
import { refreshTodayWidget, todayWidgetAvailable } from "@/widgets";
import { withHeat } from "@/services/weather/today";

/** Let a burst of writes land before rebuilding once. */
const SETTLE_MS = 1200;
/** The same fallback the water goal uses when it keeps a day (useNutritionState). */
const DEFAULT_WATER_GOAL_ML = 2500;

export function TodayWidgetSync(): null {
  const enabled = todayWidgetAvailable();
  const app = useApp();
  const habits = useHabits();
  const rough = useRoughToday();
  const [tick, setTick] = useState(0);

  // Writes made outside React (lock-screen buttons, the water store, check-ins,
  // the streak) and coming back to the app all ask for a rebuild.
  useEffect(() => {
    if (!enabled) return;
    const bump = () => setTick((t) => t + 1);
    const offs = [
      subscribeWaterPours(bump),
      subscribeMindEntries(bump),
      onCommitmentKept(bump),
      subscribeExternalWrites(bump),
    ];
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") bump();
    });
    return () => {
      offs.forEach((off) => off());
      sub.remove();
    };
  }, [enabled]);

  const habitsDone = useMemo(
    () => habits.views.filter((v) => v.stats.doneToday && v.habit.source === "manual").map((v) => v.habit.id),
    [habits.views],
  );

  // The latest values, read when the settled rebuild runs.
  const latest = useRef({ app, habitsDone, rough });
  useEffect(() => {
    latest.current = { app, habitsDone, rough };
  });

  const c = app.consumedNutrition;
  const signature = [
    app.currentDate,
    app.streakData.lastActiveDate,
    app.streakData.currentStreak,
    Math.round(c.calories),
    Math.round(c.proteinG),
    Math.round(c.waterMl),
    app.workoutLog.length,
    app.bodyLogs.length,
    habitsDone.join(","),
    rough ? 1 : 0,
    tick,
  ].join("|");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const now = new Date();
        const date = toLocalDateString(now);
        const [foodLogs, mealTicks, pourLog, moods, previous] = await Promise.all([
          getFoodLogForDate(date),
          getIntakeForDate(date),
          readWaterPours(),
          loadCheckins(),
          readTodaySnapshot(),
        ]);
        if (!live) return;
        const { app: a, habitsDone: done, rough: r } = latest.current;
        const targets = a.nutritionTargets;
        const snap = buildTodaySnapshot({
          now,
          foodLogs,
          mealTicks,
          pours: poursOn(pourLog, date),
          waterGoalMl: withHeat(a.userGoals?.dailyWaterMl ?? targets?.waterMl ?? DEFAULT_WATER_GOAL_ML),
          workouts: a.workoutLog,
          moods,
          habitsDone: done,
          weighedToday: a.bodyLogs.some((b) => b.date === date),
          streak: a.streakData,
          rough: !!r,
          // A streak freeze covered yesterday (services/commitment): the word "held".
          freezeHeld: (a.streakData.frozen ?? []).includes(shiftDay(date, -1)),
          calories: targets ? { consumed: a.consumedNutrition.calories, target: targets.calories } : null,
          protein: targets ? { consumed: a.consumedNutrition.proteinG, target: targets.proteinG } : null,
          previous,
        });
        await writeTodaySnapshot(snap);
        await refreshTodayWidget();
      } catch (e) {
        console.log("[widget] could not update Today", e);
      }
    }, SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [enabled, signature]);

  return null;
}
