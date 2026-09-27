/**
 * useNotificationCenter — everything the Notifications screen shows, kept LIVE.
 *
 * The screen makes claims ("9 lined up", "next: Lunch at 1:00 PM", "Meditate —
 * marked done from your lock screen at 7:14"), and a claim that is five minutes
 * stale is a small lie. So the queue and the journal re-read:
 *
 *   · when the screen gains focus
 *   · on every return to the foreground (permission may have changed in OS
 *     Settings; a reminder may have fired)
 *   · the moment a lock-screen press is applied while the screen is open
 *
 * Settings (meal / water) are owned here and written through their services,
 * which re-lay the OS queue — and the queue is then re-read, so the "lined up"
 * line always reflects what the OS actually holds after the change.
 */
import { useReminderPermission } from "@/components/notifications/useReminderPermission";
import { loadFitnessProfile } from "@/fitness/services/FitnessProfileStore";
import type { ReminderPrefs } from "@/fitness/types";
import { subscribeExternalWrites } from "@/services/notifications/externalWrites";
import { readJournal, type JournalEntry } from "@/services/notifications/journal";
import {
  DEFAULT_SETTINGS as DEFAULT_MEAL_SETTINGS,
  loadMealReminders,
  saveMealReminders,
  syncMealReminders,
  type MealReminderSettings,
} from "@/services/notifications/mealReminders";
import { subscribePipelineOutcomes } from "@/services/notifications/pipeline";
import { readPendingQueue, type QueuedNotification } from "@/services/notifications/queue";
import {
  DEFAULT_WATER_SETTINGS,
  loadWaterReminders,
  saveWaterReminders,
  syncWaterReminders,
  type WaterReminderSettings,
} from "@/services/notifications/waterReminders";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface FitnessReminderSummary {
  prefs: ReminderPrefs | null;
  days: number[];
}

export function useNotificationCenter() {
  const permission = useReminderPermission();

  const [meals, setMeals] = useState<MealReminderSettings>(DEFAULT_MEAL_SETTINGS);
  const [water, setWater] = useState<WaterReminderSettings>(DEFAULT_WATER_SETTINGS);
  const [fitness, setFitness] = useState<FitnessReminderSummary>({ prefs: null, days: [] });
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Re-read what changes on its own: the OS queue and the lock-screen receipts. */
  const refreshLive = useCallback(async () => {
    const [q, j] = await Promise.all([readPendingQueue(), readJournal()]);
    if (!alive.current) return;
    setQueue(q);
    setJournal(j);
  }, []);

  const refreshAll = useCallback(async () => {
    const [m, w, profile] = await Promise.all([
      loadMealReminders(),
      loadWaterReminders(),
      loadFitnessProfile().catch(() => null),
    ]);
    if (!alive.current) return;
    setMeals(m);
    setWater(w);
    setFitness({
      prefs: profile?.reminders ?? null,
      days: Array.isArray(profile?.daysAvailable) ? profile!.daysAvailable : [],
    });
    await refreshLive();
    if (alive.current) setLoaded(true);
  }, [refreshLive]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshLive();
    });
    const offWrites = subscribeExternalWrites(() => void refreshLive());
    const offOutcomes = subscribePipelineOutcomes(() => void refreshLive());
    return () => {
      sub.remove();
      offWrites();
      offOutcomes();
    };
  }, [refreshLive]);

  // Permission just turned on (primer, or OS Settings): lay what was waiting.
  const lastPermission = useRef(permission.status);
  useEffect(() => {
    const was = lastPermission.current;
    lastPermission.current = permission.status;
    if (was !== "granted" && permission.status === "granted" && loaded) {
      void (async () => {
        await syncMealReminders();
        await syncWaterReminders();
        await refreshLive();
      })();
    }
  }, [permission.status, loaded, refreshLive]);

  /** Persist meal settings, re-lay the window, then show what the OS now holds. */
  const applyMeals = useCallback(
    async (next: MealReminderSettings) => {
      setMeals(next);
      await saveMealReminders(next);
      await syncMealReminders(next);
      await refreshLive();
    },
    [refreshLive],
  );

  const applyWater = useCallback(
    async (next: WaterReminderSettings) => {
      setWater(next);
      await saveWaterReminders(next);
      await syncWaterReminders(next);
      await refreshLive();
    },
    [refreshLive],
  );

  return {
    loaded,
    permission,
    meals,
    water,
    fitness,
    queue,
    journal,
    applyMeals,
    applyWater,
    refreshLive,
  };
}

export type NotificationCenter = ReturnType<typeof useNotificationCenter>;
