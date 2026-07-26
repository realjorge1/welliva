/**
 * services/notifications/init.ts
 *
 * One-time startup wiring for local notifications, called from the root layout.
 * Two things a release build needs that a bare `scheduleNotificationAsync` call
 * does NOT set up on its own:
 *
 *   1. A foreground presentation handler, so a reminder that fires while the app
 *      is open still surfaces a banner (without one, foreground notifications are
 *      silently swallowed).
 *   2. The Android notification channel every scheduled reminder targets. Android
 *      8+ drops any notification posted to a channel that doesn't exist, so it
 *      must be created before the first schedule.
 *   3. The interactive action CATEGORIES ("Mark as Done" / "Later"). A category
 *      must be registered with the OS before a notification referencing it is
 *      delivered, or the banner arrives with no buttons.
 *
 * Everything here is fail-soft: on web / Expo Go / any platform where the native
 * module is unavailable, the calls no-op and boot is never blocked. Only
 * `expo-notifications` is imported (no `react-native`), so this module — and
 * anything that only needs the channel id — stays loadable under the Node test
 * runner without a react-native mock.
 */
import * as Notifications from "expo-notifications";
import { ensureNotificationCategories } from "./categories";

/** Channel id shared by every local reminder we schedule (Android). */
export const REMINDERS_CHANNEL_ID = "reminders";

let configured = false;

/**
 * Configure notifications once. Idempotent — safe to call on every mount.
 * `setNotificationChannelAsync` is a no-op on non-Android platforms, so no
 * `Platform` check (and thus no react-native import) is needed here.
 */
export function initNotifications(): void {
  if (configured) return;
  configured = true;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Handler is best-effort; a missing native module must never block boot.
  }

  void ensureRemindersChannel();
  void ensureNotificationCategories();
}

/**
 * Ensure the Android reminders channel exists. No-op off Android (and on any
 * failure). Scheduling code calls this too, so a reminder created before the
 * root layout mounts still lands on a real channel.
 */
export async function ensureRemindersChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // fail-soft
  }
}
