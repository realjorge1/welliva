/**
 * services/notifications/copy.ts
 *
 * The words on the lock screen. A reminder body has one job: make the next small
 * action feel light. These lines are short, warm, never scolding, and never
 * mention a number the user might have missed — a nudge, not a report card.
 *
 * The line is chosen DETERMINISTICALLY from the habit id, because a repeating
 * daily/weekly trigger bakes its content in at schedule time: a random pick would
 * be re-rolled on every edit and be identical every day anyway. Deterministic
 * selection means each habit keeps its own voice, and re-syncing reminders never
 * silently changes what the user sees.
 *
 * Pure — no imports, no platform. Trivially testable.
 */

/** The nudge lines, in the "keep the ember burning" register. */
export const REMINDER_LINES: readonly string[] = [
  "A small step keeps the ember burning.",
  "Two minutes now is the whole win.",
  "The streak only asks for today.",
  "Start smaller than you think you should.",
  "Show up messy — showing up is the point.",
  "This is the one that keeps the chain intact.",
  "Future you is already grateful.",
  "Momentum is quieter than motivation. Use it.",
  "One rep of anything counts.",
  "Keep the ember lit — that's all today needs.",
];

/** Line used when a streak is genuinely on the line. */
export const STREAK_LINE = (days: number): string =>
  `${days} days going. Keep the ember burning.`;

/** Stable 32-bit hash so the same habit always draws the same line. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The body copy for a habit reminder. `variant` lets a caller spread lines
 * across the several notifications a weekly habit schedules (one per weekday),
 * so a Mon/Wed/Fri habit reads differently on each of its days.
 */
export function reminderBody(habitId: string, variant = 0): string {
  const i = (hash(habitId) + variant) % REMINDER_LINES.length;
  return REMINDER_LINES[i];
}
