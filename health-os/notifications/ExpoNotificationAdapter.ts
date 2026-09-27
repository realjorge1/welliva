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

/** `data.source` on every notification this adapter schedules. */
export const PROACTIVE_SOURCE = "proactive";

/** Android channel for coaching — mirrors services/notifications/init. */
const COACH_CHANNEL_ID = "welliva-coach";

/** Id shapes the planner and story service mint (legacy, pre-tag notifications). */
const PROACTIVE_ID = /^(briefing|digest|ant|story|year|anniversary|five_year):/;

/** Is this pending notification one the proactive scheduler owns? */
export function isProactive(identifier: string, data: unknown): boolean {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.source === PROACTIVE_SOURCE) return true;
  // Anything another module scheduled says so in its `type`; never touch it.
  if (typeof d.type === "string") return false;
  return PROACTIVE_ID.test(identifier);
}

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
        content: {
          title: req.title,
          body: req.body,
          // The source tag is how cancelAll finds OURS in a queue shared with
          // every reminder the user scheduled (see cancelAll below).
          data: { ...(req.data ?? {}), source: PROACTIVE_SOURCE },
        },
        // `date` trigger on the coaching channel, so an Android user can quiet
        // Gozlin without losing their reminders. The cast keeps us tolerant of
        // expo-notifications' trigger typings across SDK versions.
        trigger: { date: fire, channelId: COACH_CHANNEL_ID } as unknown as Parameters<
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

  /**
   * Cancel every PROACTIVE notification — and nothing else.
   *
   * This used to be `cancelAllScheduledNotificationsAsync()`, which empties the
   * whole OS queue. The queue is shared: habit reminders, meal and water
   * reminders and fitness reminders all live in it. So switching Gozlin's
   * coaching off (or "forget everything") silently deleted every reminder the
   * user had set — and nothing told them. Now only notifications this adapter
   * scheduled are cancelled: tagged with `data.source`, or, for ones scheduled
   * before the tag existed, carrying one of the planner's id shapes.
   */
  async cancelAll(): Promise<void> {
    const N = await this.mod();
    if (!N) return;
    try {
      const pending = await N.getAllScheduledNotificationsAsync();
      for (const p of pending) {
        if (!isProactive(p.identifier, p.content?.data)) continue;
        await N.cancelScheduledNotificationAsync(p.identifier).catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

/** The default, app-wide notification adapter. */
export const expoNotificationAdapter = new ExpoNotificationAdapter();
