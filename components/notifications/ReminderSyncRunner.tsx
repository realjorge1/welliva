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
 *   meals · water · fitness · cycle — converging REPLACEs (cancel own ids, re-lay)
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
 *
 * ── HALF THREE: REMINDERS THAT KNOW WHAT'S DONE ─────────────────────────────
 * A glass logged in the app re-plans the water check-ins (the next one names
 * the time of this glass and the next 90 minutes stay quiet); a meal ticked or
 * logged re-lays the meal window, which drops today's reminder for it. The
 * water goal is cached here for the lock-screen path, which has no bio to
 * derive one from. And "Pause notifications" clears or re-lays everything.
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { onReminderPermissionGranted } from "@/components/notifications/useReminderPermission";
import { useNutrition, useProfile } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { refreshFitnessReminders } from "@/fitness/services/FitnessNotifications";
import type { DaySchedule } from "@/models/diet";
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
import { subscribeNotificationPause } from "@/services/notifications/pause";
import { rememberWaterGoal, syncWaterReminders } from "@/services/notifications/waterReminders";
import { relayCycleReminders } from "@/services/cycle/reminders";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** A foreground within this long of the last full re-lay only re-checks permission. */
const RELAY_THROTTLE_MS = 5 * 60 * 1000;

/** How long a burst of logging settles before the reminders are re-planned. */
const REPLAN_DEBOUNCE_MS = 1500;

export function ReminderSyncRunner(): null {
  const { user } = useAuth();
  const signedIn = !!user;
  const { refreshTodayDiet, syncLiveCounters, consumedNutrition, todayDiet } = useNutrition();
  const { userGoals, nutritionTargets } = useProfile();
  const { reconcileReminders } = useHabits();
  const reconcileRef = useRef(reconcileReminders);
  reconcileRef.current = reconcileReminders;

  // The same goal every water surface uses (Home, Diet, the streak).
  const waterGoalMl = userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;
  const waterGoalRef = useRef(waterGoalMl);
  waterGoalRef.current = waterGoalMl;
  useEffect(() => {
    if (signedIn) void rememberWaterGoal(waterGoalMl).catch(() => {});
  }, [signedIn, waterGoalMl]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    let running = false;
    let queued: { forceRelay: boolean; forceHabits: boolean } | null = null;
    let lastGranted: boolean | null = null;
    let lastRelayAt = 0;

    const run = async (forceRelay = false, forceHabits = false) => {
      if (running) {
        // A pause/resume mid-run must not be lost: run again once this one ends.
        if (forceRelay) {
          queued = {
            forceRelay: true,
            forceHabits: forceHabits || !!queued?.forceHabits,
          };
        }
        return;
      }
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
        // for each one to go missing. So does a resume from "Pause".
        const force =
          forceHabits ||
          exactChanged ||
          (await readNotificationFormat()) < NOTIFICATION_FORMAT;

        // Sequential on purpose: each module cancels its own ids and re-lays,
        // and interleaving them against one OS queue gains nothing.
        await syncMealReminders();
        // The goal first, so today's check-ins can tell whether it's met.
        await rememberWaterGoal(waterGoalRef.current).catch(() => {});
        await syncWaterReminders();
        await refreshFitnessReminders();
        // Cycle: read straight from storage, so it holds even when the cycle
        // screen hasn't been opened in weeks (services/cycle/reminders).
        await relayCycleReminders();
        await reconcileRef.current({ force });
        if (force) await writeNotificationFormat(NOTIFICATION_FORMAT);
        await commitExactAlarmStatus(exact);
        lastRelayAt = Date.now();
      } catch {
        // fail-soft: the next foreground tries again
      } finally {
        running = false;
        const next = queued;
        queued = null;
        if (next && alive) void run(next.forceRelay, next.forceHabits);
      }
    };

    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (alive && state === "active") void run();
    });
    const offGrant = onReminderPermissionGranted(() => {
      if (alive) void run(true);
    });
    // Pause: every module cancels its own and lays nothing (each checks the
    // flag). Resume: everything comes back from its stored settings, habits
    // included — their repair is forced, since the queue was emptied under them.
    const offPause = subscribeNotificationPause(() => {
      if (alive) void run(true, true);
    });
    return () => {
      alive = false;
      sub.remove();
      offGrant();
      offPause();
    };
  }, [signedIn]);

  // ── re-plan around what was just logged ───────────────────────────
  // Skips the first value of each (that's the mount, which `run` covers) and
  // waits for a burst of taps to settle before touching the queue.
  const waterMl = consumedNutrition.waterMl;
  const mealSignature = mealProgressSignature(todayDiet?.schedule, consumedNutrition.calories);
  const seenWater = useRef<number | null>(null);
  const seenMeals = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    if (seenWater.current === null || seenWater.current === waterMl) {
      seenWater.current = waterMl;
      return;
    }
    seenWater.current = waterMl;
    const timer = setTimeout(() => {
      void (async () => {
        await rememberWaterGoal(waterGoalRef.current).catch(() => {});
        await syncWaterReminders();
      })();
    }, REPLAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [signedIn, waterMl]);

  useEffect(() => {
    if (!signedIn) return;
    if (seenMeals.current === null || seenMeals.current === mealSignature) {
      seenMeals.current = mealSignature;
      return;
    }
    seenMeals.current = mealSignature;
    const timer = setTimeout(() => void syncMealReminders(), REPLAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [signedIn, mealSignature]);

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

/**
 * Changes whenever a meal is ticked/unticked or food is logged today: which
 * planned meals are eaten, plus the day's calories (the food log moves only
 * those). Cheap enough to compute every render.
 */
function mealProgressSignature(
  schedule: DaySchedule | null | undefined,
  calories: number,
): string {
  const ticks = schedule
    ? [
        schedule.breakfast?.isConsumed ? 1 : 0,
        schedule.lunch?.isConsumed ? 1 : 0,
        schedule.dinner?.isConsumed ? 1 : 0,
        (schedule.snacks ?? []).filter((s) => s?.isConsumed).length,
      ].join("")
    : "-";
  return `${schedule?.date ?? ""}:${ticks}:${Math.round(calories)}`;
}
