/**
 * Small, pure formatting helpers for the Notifications screen.
 */
import { formatTime } from "@/services/notifications/mealReminders";

/** "Today, 7:30 PM" · "Tomorrow, 8:00 AM" · "Wed, 1:00 PM" · "Sep 30, 9:00 AM". */
export function whenLabel(when: Date, now: Date = new Date()): string {
  const time = formatTime(when.getHours(), when.getMinutes());
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(when) - day(now)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff > 1 && diff < 7) {
    return `${when.toLocaleDateString(undefined, { weekday: "short" })}, ${time}`;
  }
  return `${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

/**
 * {@link whenLabel} for the middle of a sentence: "next: today, 7:30 PM" but
 * "next: Wed, 1:00 PM" — only the relative words drop their capital.
 */
export function inlineWhen(when: Date, now: Date = new Date()): string {
  const label = whenLabel(when, now);
  return /^(Today|Tomorrow)\b/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

/** "just now" · "12 min ago" · "3 h ago" · "yesterday" · "Mon". */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((now.getTime() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** "1 reminder" / "3 reminders". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
