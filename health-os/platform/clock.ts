/**
 * health-os/platform/clock.ts
 *
 * The single TIME authority for the Personal Health OS. Re-exports Welliva's
 * canonical LOCAL-time helpers (never UTC — see services/OfflineStorage) so every
 * domain has one import home, and adds the month-partition + offset-ISO helpers the
 * Timeline needs.
 *
 * See docs/architecture/02-data-and-schema.md §4 (partitioning) and §2 (the `ts`
 * field carries a local offset, never a bare `Z`).
 */

import { parseLocalDate } from "@/services/OfflineStorage";

export {
  toLocalDateString,
  parseLocalDate,
  todayDate,
  currentWeekStart,
} from "@/services/OfflineStorage";

/** The `YYYY-MM` month-partition key for a `YYYY-MM-DD` local date string. */
export function monthKeyOf(localDate: string): string {
  return localDate.slice(0, 7);
}

/**
 * The week-summary key for a `YYYY-MM-DD` local date: the Monday (week start) of
 * that date's week, as `YYYY-MM-DD`. Mirrors `currentWeekStart`'s Monday convention
 * so a week key derived from any of its days is identical.
 */
export function weekKeyOf(localDate: string): string {
  const d = parseLocalDate(localDate);
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateStringInternal(d);
}

/** Local YYYY-MM-DD (kept private here to avoid a circular re-export at module top). */
function toLocalDateStringInternal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as an ISO-8601 timestamp WITH its local offset (never bare UTC). */
export function toISOWithOffset(d: Date): string {
  const tzMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = tzMin >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}:${s}${sign}${pad(tzMin / 60)}:${pad(tzMin % 60)}`;
}

/** Now as a local-offset ISO timestamp. Injectable for determinism. */
export function localISONow(now: Date = new Date()): string {
  return toISOWithOffset(now);
}

/** Epoch ms for the LOCAL midnight of a `YYYY-MM-DD` string (stable, for event id time). */
export function localMidnightMs(localDate: string): number {
  return parseLocalDate(localDate).getTime();
}

/** A local-midnight ISO timestamp for a `YYYY-MM-DD` string (used when no real time exists). */
export function localMidnightISO(localDate: string): string {
  return toISOWithOffset(parseLocalDate(localDate));
}
