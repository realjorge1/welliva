/**
 * services/notifications/init.ts
 *
 * One-time startup wiring for local notifications. Runs at MODULE SCOPE from the
 * app entry (services/notifications/boot), before React mounts, and again from
 * the root layout — it is idempotent. Three things a release build needs that a
 * bare `scheduleNotificationAsync` call does NOT set up on its own:
 *
 *   1. A foreground presentation handler, so a reminder that fires while the app
 *      is open still surfaces a banner (without one, foreground notifications are
 *      silently swallowed).
 *   2. The Android notification CHANNELS every scheduled notification targets.
 *      Android 8+ routes a notification by its channel, and the channel decides
 *      whether it may interrupt — so there are two, on purpose:
 *
 *        · REMINDERS (high importance) — the things the USER scheduled: habit,
 *          meal and water reminders. High importance is what makes Android show
 *          them heads-up WITH their action buttons, which is the whole point of
 *          a reminder you can finish without opening the app. A default-
 *          importance channel only drops them silently into the shade.
 *        · COACHING (default importance) — what Gozlin decides to send. Its own
 *          channel so a user can quiet the coach from Android's settings
 *          without also losing the reminders they asked for.
 *
 *   3. The interactive action CATEGORIES ("Mark as Done" / "Ate it" / "Drank a
 *      glass" / "Later"). A category must be registered with the OS before a
 *      notification referencing it is delivered, or the banner arrives with no
 *      buttons.
 *
 * ── WHY THE REMINDERS CHANNEL ID CHANGED ────────────────────────────────────
 * Android never lets an app raise a channel's importance after creating it —
 * the user owns it from that point. The original `reminders` channel was made at
 * default importance, so the only way to heads-up is a NEW channel id. The old
 * one is deleted so Settings doesn't list two "Reminders"; anything still pending
 * on it is re-laid on the new channel by the boot reconcile, and expo falls back
 * to its default channel for any straggler rather than dropping it.
 *
 * Everything here is fail-soft: on web / Expo Go / any platform where the native
 * module is unavailable, the calls no-op and boot is never blocked. Only
 * `expo-notifications` is imported (no `react-native`), so this module — and
 * anything that only needs the channel ids — stays loadable under the Node test
 * runner without a react-native mock.
 */
import * as Notifications from "expo-notifications";
import { ensureNotificationCategories } from "./categories";

/** Channel for everything the user scheduled (Android). Heads-up, with buttons. */
export const REMINDERS_CHANNEL_ID = "welliva-reminders";

/** Channel for what Gozlin sends on its own (Android). */
export const COACH_CHANNEL_ID = "welliva-coach";

/** Channels from earlier builds, removed once the current ones exist. */
export const LEGACY_CHANNEL_IDS: readonly string[] = ["reminders"];

/** The brand accent Android tints the small icon and action text with. */
export const NOTIFICATION_ACCENT = "#E67E22";

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

let channels: Promise<void> | null = null;

/** Lock-screen visibility PUBLIC, or undefined where the enum isn't exposed. */
function publicVisibility(): Notifications.AndroidNotificationVisibility | undefined {
  try {
    return Notifications.AndroidNotificationVisibility.PUBLIC;
  } catch {
    return undefined;
  }
}

async function createChannels(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: "Reminders",
    description:
      "Habit, meal and water reminders you set — with buttons that log them for you.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: NOTIFICATION_ACCENT,
    lockscreenVisibility: publicVisibility(),
    showBadge: false,
  });
  await Notifications.setNotificationChannelAsync(COACH_CHANNEL_ID, {
    name: "Coaching from Gozlin",
    description: "Your morning briefing and the occasional timely nudge.",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: NOTIFICATION_ACCENT,
    showBadge: false,
  });
  for (const legacy of LEGACY_CHANNEL_IDS) {
    try {
      await Notifications.deleteNotificationChannelAsync(legacy);
    } catch {
      // never existed on this install — nothing to remove
    }
  }
}

/**
 * Ensure the Android channels exist. No-op off Android (and on any failure).
 * Scheduling code calls this too, so a reminder created before the root layout
 * mounts still lands on a real channel. Memoised; a failure clears the memo so
 * the next caller retries.
 */
export function ensureRemindersChannel(): Promise<void> {
  if (!channels) {
    channels = createChannels().catch(() => {
      channels = null;
    });
  }
  return channels;
}
