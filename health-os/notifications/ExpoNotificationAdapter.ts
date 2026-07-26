/**
 * health-os/notifications/ExpoNotificationAdapter.ts
 *
 * The ONLY code that touches `expo-notifications` — imported LAZILY and guarded, so the
 * app boots where the module isn't present (Expo Go / web): it reports `unavailable` and
 * every method is a safe no-op. No push server is needed for v1 — daily briefings,
 * anticipations and anniversaries are all locally schedulable.
 *
 * ⚠️ Requires an EAS dev/prod build with the expo-notifications config plugin (not Expo
 * Go). See docs/companion/00-proactive-companion-blueprint.md §3.4 + §7.
 */
import type { NotifPermission, NotifStatus, NotificationPort, ScheduleRequest } from "./NotificationPort";

type ExpoNotifications = typeof import("expo-notifications");

function mapPermission(granted: boolean | undefined, canAskAgain: boolean | undefined): NotifPermission {
  if (granted) return "granted";
  if (canAskAgain === false) return "denied";
  return "undetermined";
}

function toStatus(p: NotifPermission): NotifStatus {
  return { permission: p, ready: p === "granted" };
}

export class ExpoNotificationAdapter implements NotificationPort {
  private async mod(): Promise<ExpoNotifications | null> {
    try {
      return await import("expo-notifications");
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<NotifStatus> {
    const N = await this.mod();
    if (!N) return toStatus("unavailable");
    try {
      const res = await N.getPermissionsAsync();
      return toStatus(mapPermission(res.granted, res.canAskAgain));
    } catch {
      return toStatus("unavailable");
    }
  }

  async requestAccess(): Promise<NotifStatus> {
    const N = await this.mod();
    if (!N) return toStatus("unavailable");
    try {
      const res = await N.requestPermissionsAsync();
      return toStatus(mapPermission(res.granted, res.canAskAgain));
    } catch {
      return toStatus("unavailable");
    }
  }

  async schedule(req: ScheduleRequest): Promise<string | null> {
    const N = await this.mod();
    if (!N) return null;
    try {
      const fire = new Date(req.fireAt);
      if (Number.isNaN(fire.getTime()) || fire.getTime() <= Date.now()) return null;
      // Overwrite any existing one with the same id (idempotent re-plans).
      await N.cancelScheduledNotificationAsync(req.id).catch(() => {});
      return await N.scheduleNotificationAsync({
        identifier: req.id,
        content: { title: req.title, body: req.body, data: req.data ?? {} },
        // `date` trigger; cast keeps us tolerant of expo-notifications' trigger typings
        // across SDK versions without pinning to one shape here.
        trigger: { date: fire } as unknown as Parameters<
          ExpoNotifications["scheduleNotificationAsync"]
        >[0]["trigger"],
      });
    } catch {
      return null;
    }
  }

  async cancel(id: string): Promise<void> {
    const N = await this.mod();
    if (!N) return;
    try {
      await N.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }

  async cancelAll(): Promise<void> {
    const N = await this.mod();
    if (!N) return;
    try {
      await N.cancelAllScheduledNotificationsAsync();
    } catch {
      // ignore
    }
  }
}

/** The default, app-wide notification adapter. */
export const expoNotificationAdapter = new ExpoNotificationAdapter();
