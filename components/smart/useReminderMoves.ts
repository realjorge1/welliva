/**
 * Reminders that move themselves — the screen half.
 *
 * `useReminderMoves` reads the routine clock against every reminder the user
 * set (habits; and, where the screen has them, the meal slots and the first
 * water check-in) and returns the moves worth offering. The quiet layer then
 * decides whether any of them is shown today (useSmartMoment).
 *
 * `useReminderMoveActions` is what the two answers do. A move goes through the
 * SAME path the user's own edit would — the habit's reminder through
 * `updateHabit` (which cancels the stale notifications), a meal or water time
 * through the Notifications screen's own `apply` — and always leaves an Undo.
 */
import { useHabits } from "@/contexts/HabitsContext";
import { MEAL_SLOTS, anyEnabled, type MealReminderSettings } from "@/services/notifications/mealReminders";
import { waterRemindersOn, type WaterReminderSettings } from "@/services/notifications/waterReminders";
import { todayDate } from "@/services/OfflineStorage";
import {
  EMPTY_ROUTINE_SOURCES,
  firstWaterSamples,
  habitSamples,
  loadRoutineSources,
  mealSlotSamples,
  readRoutine,
  type RoutineSources,
} from "@/services/routine";
import {
  MOVE_KEEP_DAYS,
  answerFor,
  answerSmart,
  markEchoesAfter,
  moveCopy,
  suggestMove,
  type MoveSuggestion,
} from "@/services/smart";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Receipt } from "./receipt";
import { useSmartLedger } from "./useSmartMoment";

/**
 * The routine records, re-read every time the screen comes into focus — and on
 * `reload()`, for a screen that just wrote one of them.
 */
export function useRoutineSources(): { sources: RoutineSources; ready: boolean; reload: () => void } {
  const [state, setState] = useState<{ sources: RoutineSources; ready: boolean }>({
    sources: EMPTY_ROUTINE_SOURCES,
    ready: false,
  });
  const alive = useRef(true);
  const reload = useCallback(() => {
    void loadRoutineSources().then((sources) => {
      if (alive.current) setState({ sources, ready: true });
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      reload();
      return () => {
        alive.current = false;
      };
    }, [reload]),
  );
  return { ...state, reload };
}

export function useReminderMoves(input: {
  meals?: MealReminderSettings | null;
  water?: WaterReminderSettings | null;
} = {}): MoveSuggestion[] {
  const { views } = useHabits();
  const { sources, ready } = useRoutineSources();
  const { answers } = useSmartLedger();
  const { meals, water } = input;

  return useMemo(() => {
    if (!ready) return [];
    const today = todayDate();
    const out: MoveSuggestion[] = [];

    for (const v of views) {
      const r = v.habit.reminder;
      if (v.habit.source !== "manual" || !r) continue;
      const target = { kind: "habit" as const, habitId: v.habit.id, name: v.habit.name };
      const s = suggestMove({
        target,
        reading: readRoutine(habitSamples(sources.tickTimes, v.habit.id), today),
        reminderMinute: r.hour * 60 + r.minute,
        previous: answerFor(answers, `reminder-move:habit:${v.habit.id}`),
        today,
      });
      if (s) out.push(s);
    }

    if (meals && anyEnabled(meals)) {
      // Not the snack: a day can hold three of them, so "your usual snack time"
      // is not one time, and a reminder can't be moved to two.
      for (const slot of MEAL_SLOTS) {
        const r = meals.slots[slot];
        if (slot === "snack" || !r.enabled) continue;
        const at = r.hour * 60 + r.minute;
        const samples = markEchoesAfter(mealSlotSamples(sources.intake, sources.foodLog, slot), at);
        const s = suggestMove({
          target: { kind: "meal", slot },
          reading: readRoutine(samples, today),
          reminderMinute: at,
          previous: answerFor(answers, `reminder-move:meal:${slot}`),
          today,
        });
        if (s) out.push(s);
      }
    }

    // Water: only ever the FIRST check-in of the day, to just before the first
    // glass. Never past the second check-in — a move that reorders the day is
    // a different setting, and the user can make it themselves.
    if (water && waterRemindersOn(water) && water.times.length > 0) {
      const first = water.times[0];
      const samples = markEchoesAfter(firstWaterSamples(sources.waterHistory, sources.pours), first);
      const s = suggestMove({
        target: { kind: "water" },
        reading: readRoutine(samples, today),
        reminderMinute: first,
        previous: answerFor(answers, "reminder-move:water"),
        today,
      });
      const second = water.times[1];
      if (s && (second == null || s.suggestedMinute < second) && !water.times.includes(s.suggestedMinute)) {
        out.push(s);
      }
    }

    return out;
  }, [views, sources, ready, answers, meals, water]);
}

export function useReminderMoveActions(input: {
  show: (receipt: Receipt) => void;
  meals?: MealReminderSettings | null;
  water?: WaterReminderSettings | null;
  applyMeals?: (next: MealReminderSettings) => Promise<void>;
  applyWater?: (next: WaterReminderSettings) => Promise<void>;
}) {
  const { getView, updateHabit } = useHabits();
  // Undo runs seconds later: it must act on the state as it is THEN, not as it
  // was when the move was made (the habit has new notification ids by then).
  const latest = useRef(input);
  latest.current = input;
  const views = useRef(getView);
  views.current = getView;

  const keep = useCallback(async (s: MoveSuggestion) => {
    await answerSmart({
      id: s.id,
      feature: "reminder-move",
      answer: "declined",
      coolDownDays: MOVE_KEEP_DAYS,
      value: s.suggestedMinute,
    });
  }, []);

  const setTime = useCallback(async (s: MoveSuggestion, minute: number, from?: number) => {
    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    const { meals, water, applyMeals, applyWater } = latest.current;
    switch (s.target.kind) {
      case "habit": {
        const habit = views.current(s.target.habitId)?.habit;
        if (habit) await updateHabit({ ...habit, reminder: { hour, minute: min } });
        return;
      }
      case "meal": {
        if (!meals || !applyMeals) return;
        const slot = s.target.slot;
        await applyMeals({ ...meals, slots: { ...meals.slots, [slot]: { ...meals.slots[slot], hour, minute: min } } });
        return;
      }
      case "water": {
        if (!water || !applyWater) return;
        const old = from ?? water.times[0];
        const times = water.times.map((t) => (t === old ? minute : t));
        await applyWater({ ...water, times });
        return;
      }
    }
  }, [updateHabit]);

  const move = useCallback(
    async (s: MoveSuggestion) => {
      await setTime(s, s.suggestedMinute, s.reminderMinute);
      await answerSmart({ id: s.id, feature: "reminder-move", answer: "accepted", value: s.suggestedMinute });
      latest.current.show({
        message: moveCopy(s).moved,
        onUndo: async () => {
          await setTime(s, s.reminderMinute, s.suggestedMinute);
          // Undone is a "keep", and held the same 30 days.
          await answerSmart({
            id: s.id,
            feature: "reminder-move",
            answer: "declined",
            coolDownDays: MOVE_KEEP_DAYS,
            value: s.suggestedMinute,
          });
        },
      });
    },
    [setTime],
  );

  return { move, keep };
}
