/**
 * ReminderSyncRunner — keeps every reminder the user asked for actually pending,
 * and folds lock-screen writes back into the live screens.
 *
 * Headless; mounted once in the root layout, inside the data providers.
 *
 * ── HALF ONE: THE QUEUE ─────────────────────────────────────────────────────
 * Reminders are the one thing the app schedules and then does not hold: the OS
 * does. That queue drains (meal reminders are a rolling week of dated
 * notifications), and it gets emptied behind the app's back — a restore brings
 * storage back but not the schedule, permission granted later in OS Settings
 * means nothing was ever laid, an older build's "turn off coaching" cancelled
 * everything. A reminder that silently stopped firing looks exactly like one
 * that works. So on launch, on every return to the foreground and the moment
 * permission turns on, this re-lays each module from its stored settings:
 *
 *   meals · water · fitness — converging REPLACEs (cancel own ids, re-lay)
 *   habits — a compare-and-repair (HabitsContext.reconcileReminders), which
 *            only touches a habit whose reminders are actually missing
 *
 * Signed out, it does nothing at all: a reminder is scheduled against one
 * person's plan, and sign-out clears the queue (SupabaseAuthProvider).
 *
 * ── HALF TWO: LIVE UPDATES ──────────────────────────────────────────────────
 * A lock-screen press writes straight to storage and announces it on the
 * external-write bus. When the app is alive, this re-reads what moved — today's
 * diet for a meal, the water counter and streak for a glass or a meal — so the
 * ring fills and the meal checks off while the user watches. (Habits re-read in
 * HabitsContext; the suspended/killed case re-reads on foreground.)
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { onReminderPermissionGranted } from "@/components/notifications/useReminderPermission";
import { useNutrition } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { refreshFitnessReminders } from "@/fitness/services/FitnessNotifications";
import {
  commitExactAlarmStatus,
  exactAlarmStatus,
  exactAlarmStatusChanged,
} from "@/services/notifications/exactAlarms";
import { subscribeExternalWrites } from "@/services/notifications/externalWrites";
import { syncMealReminders } from "@/services/notifications/mealReminders";
import {
  NOTIFICATION_FORMAT,
  readNotificationFormat,
  writeNotificationFormat,
} from "@/services/notifications/format";
import { syncWaterReminders } from "@/services/notifications/waterReminders";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** A foreground within this long of the last full re-lay only re-checks permission. */
const RELAY_THROTTLE_MS = 5 * 60 * 1000;

export function ReminderSyncRunner(): null {
  const { user } = useAuth();
  const signedIn = !!user;
  const { refreshTodayDiet, syncLiveCounters } = useNutrition();
  const { reconcileReminders } = useHabits();
  const reconcileRef = useRef(reconcileReminders);
  reconcileRef.current = reconcileReminders;

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    let running = false;
    let lastGranted: boolean | null = null;
    let lastRelayAt = 0;

    const run = async (forceRelay = false) => {
      if (running) return;
      running = true;
      try {
        const perms = await Notifications.getPermissionsAsync().catch(() => null);
        const granted = !!perms?.granted;
        const justGranted = forceRelay || (lastGranted === false && granted);
        lastGranted = granted;
        if (!granted || !alive) return;

        // Android "Alarms & reminders" access changed (Android only). A grant
        // leaves every reminder laid BEFORE it inexact; a revoke makes Android
        // cancel every exact alarm while expo's record still lists them. Either
        // way, everything is re-laid — now, not after the throttle.
        const exact = exactAlarmStatus();
        const exactChanged = await exactAlarmStatusChanged(exact);

        if (!justGranted && !exactChanged && Date.now() - lastRelayAt < RELAY_THROTTLE_MS) {
          return;
        }

        // A notification-format change (new channel, owner stamp, identifiers,
        // exact alarms) re-lays every habit reminder once rather than waiting
        // for each one to go missing.
        const force =
          exactChanged || (await readNotificationFormat()) < NOTIFICATION_FORMAT;

        // Sequential on purpose: each module cancels its own ids and re-lays,
        // and interleaving them against one OS queue gains nothing.
        await syncMealReminders();
        await syncWaterReminders();
        await refreshFitnessReminders();
        await reconcileRef.current({ force });
        if (force) await writeNotificationFormat(NOTIFICATION_FORMAT);
        await commitExactAlarmStatus(exact);
        lastRelayAt = Date.now();
      } catch {
        // fail-soft: the next foreground tries again
      } finally {
        running = false;
      }
    };

    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (alive && state === "active") void run();
    });
    const offGrant = onReminderPermissionGranted(() => {
      if (alive) void run(true);
    });
    return () => {
      alive = false;
      sub.remove();
      offGrant();
    };
  }, [signedIn]);

  // Lock-screen writes made while this tree is alive.
  useEffect(
    () =>
      subscribeExternalWrites((w) => {
        if (w.kind === "meal") void refreshTodayDiet();
        if (w.kind === "water" || w.kind === "streak" || w.kind === "meal") {
          void syncLiveCounters();
        }
      }),
    [refreshTodayDiet, syncLiveCounters],
  );

  // The suspended/killed case — an in-process event can't cross a process that
  // wasn't running — is AppContext's foreground pass (useDayChange), which
  // re-reads the diet and then these same counters.

  return null;
}
