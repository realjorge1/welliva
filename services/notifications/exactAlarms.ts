/**
 * services/notifications/exactAlarms.ts
 *
 * ON THE MINUTE — whether Android will fire reminders exactly when they're set.
 *
 * expo-notifications schedules each reminder with an EXACT alarm when the app
 * holds Android's "Alarms & reminders" access, and with an inexact one when it
 * doesn't — and Android may hold an inexact alarm for several minutes while the
 * phone is idle. A 1:00 PM lunch reminder arriving at 1:09 is a reminder that
 * missed its moment.
 *
 * That access is SCHEDULE_EXACT_ALARM (declared by modules/welliva-alarms). It is
 * pre-granted on Android 12 and 13, but NOT on a fresh install on Android 14+,
 * where the user grants it on one settings page. This module reads the state
 * and opens that page; the native half is modules/welliva-alarms.
 *
 * Deliberately not USE_EXACT_ALARM: that one is auto-granted but Google Play
 * restricts it to alarm-clock and calendar apps.
 *
 * Two things follow from the platform rules, both handled by the reminder runner:
 *   · Alarms scheduled BEFORE the grant stay inexact, so a grant must re-lay them.
 *   · A REVOKE makes Android cancel every exact alarm the app had set (while
 *     expo's own record still lists them), so a revoke must re-lay them too.
 * Hence {@link exactAlarmStatusChanged}: any change in either direction forces a
 * full re-lay, and {@link commitExactAlarmStatus} records it once that's done.
 *
 * iOS always delivers on time, and a build without the native module can't
 * tell — both read as "not-applicable", which the UI treats as nothing to ask.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";

interface WellivaAlarmsNative {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
}

export type ExactAlarmStatus = "exact" | "inexact" | "not-applicable";

/** Last status the reminders were laid under. Device-local. */
export const EXACT_ALARM_STATE_KEY = "@welliva_exact_alarm_state";

let native: WellivaAlarmsNative | null | undefined;

function mod(): WellivaAlarmsNative | null {
  if (native === undefined) {
    try {
      native = requireOptionalNativeModule<WellivaAlarmsNative>("WellivaAlarms");
    } catch {
      native = null;
    }
  }
  return native ?? null;
}

/** Will reminders fire on the minute on this device right now? */
export function exactAlarmStatus(): ExactAlarmStatus {
  const m = mod();
  if (!m) return "not-applicable";
  try {
    return m.canScheduleExactAlarms() ? "exact" : "inexact";
  } catch {
    return "not-applicable";
  }
}

/**
 * Open welliva's "Alarms & reminders" page. Returns false when there is nothing
 * to open (iOS, or a build without the module).
 */
export function openExactAlarmSettings(): boolean {
  const m = mod();
  if (!m) return false;
  try {
    return m.openExactAlarmSettings();
  } catch {
    return false;
  }
}

/**
 * Has the status CHANGED since reminders were last laid (either direction —
 * see the header)? Read-only; a first-ever reading is not a change.
 */
export async function exactAlarmStatusChanged(
  now: ExactAlarmStatus = exactAlarmStatus(),
): Promise<boolean> {
  if (now === "not-applicable") return false;
  try {
    const previous = await AsyncStorage.getItem(EXACT_ALARM_STATE_KEY);
    return previous !== null && previous !== now;
  } catch {
    return false;
  }
}

/**
 * Record the status reminders are now laid under. Called only AFTER a re-lay
 * succeeds, so a re-lay that fails part-way is retried on the next run.
 */
export async function commitExactAlarmStatus(
  now: ExactAlarmStatus = exactAlarmStatus(),
): Promise<void> {
  if (now === "not-applicable") return;
  try {
    await AsyncStorage.setItem(EXACT_ALARM_STATE_KEY, now);
  } catch {
    // worst case: the next run re-lays once more
  }
}
