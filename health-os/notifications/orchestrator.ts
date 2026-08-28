/**
 * health-os/notifications/orchestrator.ts
 *
 * The attention-budget scheduler — PURE and deterministic (inject `now`/`forDate`, no
 * storage, no native). Candidate notifications (from anticipations, the daily briefing,
 * and ready story recaps) compete for a small daily budget under quiet hours, a
 * per-category cadence cap, priority preemption, and de-duplication. The result is the
 * concrete set of `PlannedNotification`s to hand to the NotificationPort.
 *
 * This is the "intelligent notification orchestration that respects user attention" the
 * vision asks for — implemented as a policy over existing signals, never a firehose.
 * See docs/companion/00-proactive-companion-blueprint.md §3.4.
 */
import { parseLocalDate, toISOWithOffset } from "../platform/clock";

export type NotificationCategory =
  | "briefing"
  | "anticipation"
  | "story"
  /** The subscriber's weekly read — see services/WeeklyDigestService.ts. */
  | "digest"
  | "reminder";

export interface NotificationCandidate {
  /** Stable across days so the same nudge isn't re-sent (de-dupe + cadence key). */
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Leverage rank — same scale as anticipations/moments (higher wins the budget). */
  priority: number;
  /** Preferred local delivery time, "HH:MM". The orchestrator shifts it out of quiet hours. */
  preferredTime: string;
  /** Optional deep-link route opened on tap. */
  route?: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  /** Quiet-hours window, "HH:MM"–"HH:MM"; may wrap past midnight (e.g. 21:30→07:30). */
  quietStart: string;
  quietEnd: string;
  /** Max notifications delivered in a day. */
  dailyBudget: number;
  /** Minimum whole days between sends of the same category. */
  cadenceDays: Partial<Record<NotificationCategory, number>>;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  quietStart: "21:30",
  quietEnd: "07:30",
  dailyBudget: 3,
  cadenceDays: { briefing: 1, story: 7, digest: 7, anticipation: 0 },
};

export interface SentRecord {
  id: string;
  category: NotificationCategory;
  /** Local `YYYY-MM-DD` the notification was delivered/planned for. */
  date: string;
}

export interface NotificationLedger {
  sent: SentRecord[];
}

export interface PlannedNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  route?: string;
  /** Concrete local fire instant, ISO-8601 with offset (never bare UTC). */
  fireAt: string;
}

// ── time helpers (minutes-of-day; pure) ──

/** "HH:MM" → minutes since local midnight, clamped to a valid day. */
export function minutesOfDay(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

/** True when `mins` falls inside the (possibly midnight-wrapping) quiet window. */
export function inQuietHours(mins: number, prefs: NotificationPrefs): boolean {
  const start = minutesOfDay(prefs.quietStart);
  const end = minutesOfDay(prefs.quietEnd);
  if (start === end) return false; // empty window
  if (start < end) return mins >= start && mins < end; // same-day window
  return mins >= start || mins < end; // wraps midnight
}

/**
 * The delivery minute for a preferred time: the preferred minute itself, or — if it sits
 * inside quiet hours — the first minute after quiet hours end. Returns null when the
 * shifted time would land on the NEXT day (we don't bump a notification across midnight;
 * it simply isn't planned for `forDate`).
 */
export function deliveryMinute(preferred: string, prefs: NotificationPrefs): number | null {
  const mins = minutesOfDay(preferred);
  if (!inQuietHours(mins, prefs)) return mins;
  const end = minutesOfDay(prefs.quietEnd);
  const start = minutesOfDay(prefs.quietStart);
  // If quiet hours wrap midnight and the preferred time is in the late-night tail
  // (>= start), the next allowed slot is tomorrow morning — skip for today.
  if (start > end && mins >= start) return null;
  return end;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000,
  );
}

function fireAtFor(forDate: string, minute: number): string {
  const d = parseLocalDate(forDate);
  d.setMinutes(d.getMinutes() + minute);
  return toISOWithOffset(d);
}

export interface PlanInput {
  candidates: NotificationCandidate[];
  prefs: NotificationPrefs;
  ledger: NotificationLedger;
  /** The local date the plan is for (`YYYY-MM-DD`). */
  forDate: string;
  /** Now, for skipping slots already in the past on `forDate`. */
  now?: Date;
}

/**
 * Decide what to actually deliver on `forDate`. Deterministic policy:
 *  1. nothing if disabled;
 *  2. drop candidates already sent (same id) or within their category's cadence window;
 *  3. shift each out of quiet hours (or drop if it would cross midnight);
 *  4. drop slots already in the past relative to `now`;
 *  5. highest priority first, capped at the daily budget.
 */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { prefs, ledger, forDate } = input;
  if (!prefs.enabled || prefs.dailyBudget <= 0) return [];

  const now = input.now ?? new Date();
  const nowIso = toISOWithOffset(now);

  const lastByCategory = new Map<NotificationCategory, string>();
  const everSent = new Set<string>();
  for (const s of ledger.sent) {
    everSent.add(s.id);
    const prev = lastByCategory.get(s.category);
    if (!prev || s.date > prev) lastByCategory.set(s.category, s.date);
  }

  const ranked = [...input.candidates].sort((a, b) =>
    b.priority - a.priority || (a.id < b.id ? -1 : 1),
  );

  const planned: PlannedNotification[] = [];
  for (const c of ranked) {
    if (planned.length >= prefs.dailyBudget) break;
    if (everSent.has(c.id)) continue; // already delivered, ever

    const cadence = prefs.cadenceDays[c.category] ?? 0;
    if (cadence > 0) {
      const last = lastByCategory.get(c.category);
      if (last && daysBetween(last, forDate) < cadence) continue;
    }

    const minute = deliveryMinute(c.preferredTime, prefs);
    if (minute === null) continue;

    const fireAt = fireAtFor(forDate, minute);
    if (fireAt <= nowIso) continue; // can't schedule the past

    planned.push({
      id: c.id,
      category: c.category,
      title: c.title,
      body: c.body,
      ...(c.route ? { route: c.route } : {}),
      fireAt,
    });
    // Reserve this category's slot so a lower-priority same-category candidate this run
    // respects cadence too.
    lastByCategory.set(c.category, forDate);
  }

  return planned;
}

/** Append delivered notifications to the ledger, pruning entries older than `keepDays`. */
export function recordSent(
  ledger: NotificationLedger,
  planned: PlannedNotification[],
  forDate: string,
  keepDays = 30,
): NotificationLedger {
  const cutoff = (() => {
    const d = parseLocalDate(forDate);
    d.setDate(d.getDate() - keepDays);
    return d;
  })();
  const kept = ledger.sent.filter(
    (s) => parseLocalDate(s.date).getTime() >= cutoff.getTime(),
  );
  for (const p of planned) {
    kept.push({ id: p.id, category: p.category, date: forDate });
  }
  return { sent: kept };
}
