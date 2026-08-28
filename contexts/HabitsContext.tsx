/**
 * HabitsContext — state for the habit tracker.
 *
 * Manual habits complete by tap and persist to @welliva_habit_logs. Linked
 * habits (water / meals / workout) derive their done-dates from the histories
 * AppContext already maintains — marking a meal eaten or finishing a session
 * lights up the habit automatically, which is the whole Welliva adaptation.
 *
 * Sits under AppProvider and subscribes only to the narrow slices it needs.
 *
 * Completions can also arrive from OUTSIDE this tree — the "Mark as Done" button
 * on a lock-screen reminder writes the log blob directly, with no React involved.
 * Two paths bring that back in: `subscribeHabitLogsChanged` (the write happened
 * while this context was alive) and an AppState → active re-read (it happened
 * while the app was suspended). Both just reload the blob, so every derived
 * value — streaks, progress, heatmaps — recomputes the normal way.
 */
import * as Haptics from "@/utils/haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Habit, HabitLogs, HabitStats } from "../models/habit";
import {
  computeStats,
  isDueToday,
  loadHabits,
  loadLogs,
  saveHabits,
  saveLogs,
  seedDefaultHabits,
  syncReminders,
} from "../services/HabitService";
import { subscribeHabitLogsChanged } from "../services/notifications/habitActions";
import { writeWidgetSnapshot } from "../services/notifications/widgets";
import {
  getWaterHistory,
  type WaterHistoryEntry,
} from "../services/OfflineStorage";
import { useNutrition, useProfile, useSystem, useWorkout } from "./AppContext";

export interface HabitView {
  habit: Habit;
  stats: HabitStats;
  /** Every completed date (manual log or derived), for heatmaps. */
  done: Set<string>;
}

interface HabitsContextType {
  loading: boolean;
  views: HabitView[];
  getView: (id: string) => HabitView | undefined;
  /** Manual habits only — linked ones complete from app data. */
  toggleToday: (id: string) => Promise<void>;
  createHabit: (
    input: Omit<Habit, "id" | "order" | "createdAt" | "reminderIds">,
  ) => Promise<Habit>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  reorderHabits: (orderedIds: string[]) => Promise<void>;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const { currentDate } = useSystem();
  const { consumedNutrition, dietHistory } = useNutrition();
  const { workoutLog, workoutPlan } = useWorkout();
  const { userGoals, nutritionTargets } = useProfile();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLogs>({});
  const [waterHistory, setWaterHistory] = useState<WaterHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const waterGoalMl =
    userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;

  // Load + one-time seed. Re-reads water history on day rollover so
  // yesterday's archived total is picked up.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, storedLogs, water] = await Promise.all([
        loadHabits(),
        loadLogs(),
        getWaterHistory(),
      ]);
      if (!alive) return;
      let all = stored;
      if (stored.length === 0) {
        const trainingDays = workoutPlan?.sessions
          ?.filter((s) => !s.isRestDay && s.dayOfWeek != null)
          .map((s) => s.dayOfWeek as number);
        const seeded = await seedDefaultHabits(currentDate, trainingDays);
        if (seeded) all = seeded;
      }
      if (!alive) return;
      setHabits(all);
      setLogs(storedLogs);
      setWaterHistory(water);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // Out-of-band completions: the notification "Mark as Done" action writes the
  // log blob straight to storage. Re-read it when that happens while we're alive,
  // and again on every return to the foreground — a suspended app can't receive
  // the in-process event, so the AppState pass is what covers "phone locked,
  // tapped the button, opened the app an hour later".
  useEffect(() => {
    let alive = true;
    const reload = () => {
      void loadLogs().then((stored) => {
        if (alive) setLogs(stored);
      });
    };

    const unsubscribe = subscribeHabitLogsChanged(reload);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });

    return () => {
      alive = false;
      unsubscribe();
      sub.remove();
    };
  }, []);

  // ── Derived done-dates for linked habits ──────────────────────────
  const waterDone = useMemo(() => {
    const s = new Set<string>();
    for (const e of waterHistory) {
      if (e.ml >= (e.goalMl ?? waterGoalMl)) s.add(e.date);
    }
    if (consumedNutrition.waterMl >= waterGoalMl) s.add(currentDate);
    else s.delete(currentDate);
    return s;
  }, [waterHistory, consumedNutrition.waterMl, waterGoalMl, currentDate]);

  const mealsDone = useMemo(() => {
    const s = new Set<string>();
    for (const e of dietHistory) {
      if (e.mealsConsumed > 0) s.add(e.date);
    }
    if (consumedNutrition.calories > 0) s.add(currentDate);
    return s;
  }, [dietHistory, consumedNutrition.calories, currentDate]);

  const workoutDone = useMemo(() => {
    const s = new Set<string>();
    for (const e of workoutLog) s.add(e.date);
    return s;
  }, [workoutLog]);

  const doneFor = useCallback(
    (habit: Habit): Set<string> => {
      switch (habit.source) {
        case "water":
          return waterDone;
        case "meals":
          return mealsDone;
        case "workout":
          return workoutDone;
        default:
          return new Set(logs[habit.id] ?? []);
      }
    },
    [waterDone, mealsDone, workoutDone, logs],
  );

  const views = useMemo<HabitView[]>(
    () =>
      habits.map((habit) => {
        const done = doneFor(habit);
        return { habit, done, stats: computeStats(habit, done, currentDate) };
      }),
    [habits, doneFor, currentDate],
  );

  const getView = useCallback(
    (id: string) => views.find((v) => v.habit.id === id),
    [views],
  );

  // Keep the home-screen widget's snapshot in step with fully-derived state.
  // This is the authoritative write; a background notification action only
  // patches the row it changed, and gets overwritten here on the next open.
  useEffect(() => {
    if (loading) return;
    const items = views.map((v) => ({
      id: v.habit.id,
      name: v.habit.name,
      icon: v.habit.icon,
      color: v.habit.color,
      streak: v.stats.currentStreak,
      doneToday: v.stats.doneToday,
      // "Due", not "scheduled" — a weekly-goal habit that already met its quota
      // must drop out of the widget's ring exactly as it drops out of the
      // screen's, or the two disagree about what today asks for.
      scheduledToday: isDueToday(v.habit, v.done, currentDate),
    }));
    const scheduled = items.filter((i) => i.scheduledToday);
    void writeWidgetSnapshot({
      date: currentDate,
      total: scheduled.length,
      completed: scheduled.filter((i) => i.doneToday).length,
      habits: items,
    });
  }, [views, currentDate, loading]);

  // ── Actions ───────────────────────────────────────────────────────
  const toggleToday = useCallback(
    async (id: string) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit || habit.source !== "manual") return;
      const dates = new Set(logs[id] ?? []);
      const completing = !dates.has(currentDate);
      if (completing) {
        dates.add(currentDate);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      } else {
        dates.delete(currentDate);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const next = { ...logs, [id]: [...dates].sort() };
      setLogs(next);
      await saveLogs(next);
    },
    [habits, logs, currentDate],
  );

  const createHabit = useCallback(
    async (
      input: Omit<Habit, "id" | "order" | "createdAt" | "reminderIds">,
    ): Promise<Habit> => {
      const habit: Habit = {
        ...input,
        id: `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        order: habits.reduce((m, h) => Math.max(m, h.order), -1) + 1,
        createdAt: currentDate,
      };
      habit.reminderIds = await syncReminders(habit);
      const next = [...habits, habit];
      setHabits(next);
      await saveHabits(next);
      return habit;
    },
    [habits, currentDate],
  );

  const updateHabit = useCallback(
    async (habit: Habit) => {
      const updated = { ...habit, reminderIds: await syncReminders(habit) };
      const next = habits.map((h) => (h.id === habit.id ? updated : h));
      setHabits(next);
      await saveHabits(next);
    },
    [habits],
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      const habit = habits.find((h) => h.id === id);
      if (habit) await syncReminders({ ...habit, reminder: null });
      const next = habits.filter((h) => h.id !== id);
      setHabits(next);
      await saveHabits(next);
      if (logs[id]) {
        const nextLogs = { ...logs };
        delete nextLogs[id];
        setLogs(nextLogs);
        await saveLogs(nextLogs);
      }
    },
    [habits, logs],
  );

  const reorderHabits = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(habits.map((h) => [h.id, h]));
      const next = orderedIds
        .map((id, i) => {
          const h = byId.get(id);
          return h ? { ...h, order: i } : null;
        })
        .filter((h): h is Habit => h !== null);
      setHabits(next);
      await saveHabits(next);
    },
    [habits],
  );

  const value = useMemo<HabitsContextType>(
    () => ({
      loading,
      views,
      getView,
      toggleToday,
      createHabit,
      updateHabit,
      deleteHabit,
      reorderHabits,
    }),
    [loading, views, getView, toggleToday, createHabit, updateHabit, deleteHabit, reorderHabits],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextType {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used within HabitsProvider");
  return ctx;
}
