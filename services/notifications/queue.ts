/**
 * services/notifications/queue.ts
 *
 * WHAT IS ACTUALLY GOING TO ARRIVE — read from the OS queue, not from settings.
 *
 * The Notifications screen says "9 lined up · next: Lunch at 1:00 PM". That
 * sentence is only worth showing if it is TRUE, and settings can't vouch for it:
 * settings say what the user asked for, the OS queue says what will happen, and
 * the gap between the two (no permission, a queue emptied by a restore) is
 * exactly what the screen exists to expose. So every number here is counted off
 * `getAllScheduledNotificationsAsync`, and each entry's next fire time is
 * computed from the trigger the OS is holding.
 *
 * The trigger shapes differ by platform — Android reports `daily` / `weekly` /
 * `date` / `timeInterval`; iOS reports everything schedulable as `calendar`
 * with date components (a DATE trigger becomes a full year/month/day/hour
 * calendar trigger) — and {@link nextFireOf} reads both.
 */
import * as Notifications from "expo-notifications";

export type QueueKind = "habit" | "meal" | "water" | "workout" | "coach" | "other";

export interface QueuedNotification {
  id: string;
  kind: QueueKind;
  title: string;
  body: string;
  /** Next fire time, when the trigger says; null for "after N seconds". */
  next: Date | null;
  repeats: boolean;
  /** True when it carries lock-screen action buttons. */
  actionable: boolean;
}

/** Which part of the app a pending notification belongs to. */
export function kindOf(data: unknown): QueueKind {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.source === "proactive") return "coach";
  switch (d.type) {
    case "habit-reminder":
      return "habit";
    case "meal-reminder":
      return "meal";
    case "water-reminder":
      return "water";
    case "fitness-reminder":
      return d.kind === "hydration" ? "water" : "workout";
    default:
      return typeof d.route === "string" && !d.type ? "coach" : "other";
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The next time-of-day `hour:minute` at or after `now` (today or tomorrow). */
function nextDaily(now: Date, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Next `weekday` (1 = Sunday … 7 = Saturday, expo's convention) at `hour:minute`. */
function nextWeekly(now: Date, weekday: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  const target = (weekday - 1 + 7) % 7; // JS: 0 = Sunday
  let add = (target - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= now.getTime()) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

/** Next month-day `day` at `hour:minute`. */
function nextMonthly(now: Date, day: number, hour: number, minute: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setMonth(d.getMonth() + 1);
  return d;
}

/** When a pending trigger fires next, or null when the OS won't say. */
export function nextFireOf(trigger: unknown, now: Date = new Date()): Date | null {
  const t = (trigger ?? {}) as Record<string, unknown>;
  const hour = num(t.hour);
  const minute = num(t.minute) ?? 0;
  switch (t.type) {
    case "date": {
      const v = num(t.value) ?? (t.date instanceof Date ? t.date.getTime() : num(t.date));
      return v !== null ? new Date(v) : null;
    }
    case "daily":
      return hour !== null ? nextDaily(now, hour, minute) : null;
    case "weekly": {
      const weekday = num(t.weekday);
      return hour !== null && weekday !== null ? nextWeekly(now, weekday, hour, minute) : null;
    }
    case "monthly": {
      const day = num(t.day);
      return hour !== null && day !== null ? nextMonthly(now, day, hour, minute) : null;
    }
    case "calendar": {
      const c = (t.dateComponents ?? {}) as Record<string, unknown>;
      const ch = num(c.hour);
      const cm = num(c.minute) ?? 0;
      const year = num(c.year);
      const month = num(c.month);
      const day = num(c.day);
      const weekday = num(c.weekday);
      if (year !== null && month !== null && day !== null && ch !== null) {
        return new Date(year, month - 1, day, ch, cm, 0, 0);
      }
      if (weekday !== null && ch !== null) return nextWeekly(now, weekday, ch, cm);
      if (day !== null && ch !== null) return nextMonthly(now, day, ch, cm);
      if (ch !== null) return nextDaily(now, ch, cm);
      return null;
    }
    default:
      return null;
  }
}

function repeatsOf(trigger: unknown): boolean {
  const t = (trigger ?? {}) as Record<string, unknown>;
  if (t.type === "daily" || t.type === "weekly" || t.type === "monthly") return true;
  return t.repeats === true;
}

/** Shape one raw pending request. Pure — the screen and the tests share it. */
export function toQueued(
  request: { identifier: string; content?: Record<string, unknown> | null; trigger?: unknown },
  now: Date = new Date(),
): QueuedNotification {
  const content = (request.content ?? {}) as Record<string, unknown>;
  return {
    id: request.identifier,
    kind: kindOf(content.data),
    title: typeof content.title === "string" ? content.title : "",
    body: typeof content.body === "string" ? content.body : "",
    next: nextFireOf(request.trigger, now),
    repeats: repeatsOf(request.trigger),
    actionable: typeof content.categoryIdentifier === "string" && !!content.categoryIdentifier,
  };
}

/**
 * Everything pending on this device, soonest first (unknown times last).
 * Empty — never a throw — when the native module isn't there.
 */
export async function readPendingQueue(now: Date = new Date()): Promise<QueuedNotification[]> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    return pending
      .map((p) =>
        toQueued(
          {
            identifier: p.identifier,
            content: p.content as unknown as Record<string, unknown>,
            trigger: p.trigger,
          },
          now,
        ),
      )
      .filter((q) => q.next === null || q.next.getTime() > now.getTime() - 60_000)
      .sort((a, b) => {
        if (a.next && b.next) return a.next.getTime() - b.next.getTime();
        return a.next ? -1 : b.next ? 1 : 0;
      });
  } catch {
    return [];
  }
}
