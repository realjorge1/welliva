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
 * Pure — no imports, no platform. Trivially testable. The MEAL reminder copy at
 * the bottom of this file works the same way, but has far more of it: see the
 * note there for why a thrice-daily notification cannot reuse one sentence.
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

// ════════════════════════════════════════════════════════════════════
// MEAL REMINDERS — the tap-to-log lines
// ════════════════════════════════════════════════════════════════════

/**
 * ── WHY THERE ARE SO MANY OF THESE ──────────────────────────────────
 * A habit reminder repeats on a system trigger, so its body is written once and
 * shown forever; that is survivable for a nudge you glance at. A meal reminder
 * is different — it arrives three times a day, every day, and it is asking for
 * a TAP. The fourth time you read the identical sentence at 1pm you stop seeing
 * it, and a notification you have stopped seeing is a notification you have
 * started swiping away.
 *
 * So meal reminders are scheduled as a rolling window of individually-dated
 * notifications (see ./mealReminders), which means each day's copy can be
 * different. These are the words for it: a slot-specific line per day, picked
 * deterministically from the date so the same day always reads the same way —
 * a re-sync while the app is open must not rewrite a notification the user
 * already has on their lock screen.
 *
 * ── THE REGISTER ────────────────────────────────────────────────────
 * Every line here is a QUESTION or an OFFER, never an instruction. The user set
 * this time themselves; the app is checking, not telling. Nothing here counts,
 * scolds, mentions calories, or implies a meal is owed — a nutrition app that
 * sends "you haven't logged lunch" three times a day is a nagging app, and
 * people delete those.
 */

/** Titles, by slot. Short — a title is truncated hard on both platforms. */
const MEAL_TITLES: Record<MealSlotKey, readonly string[]> = {
  breakfast: [
    "Breakfast",
    "Morning fuel",
    "First meal",
    "Breakfast time",
    "Morning plate",
    "Start of the day",
    "Breakfast check",
  ],
  lunch: [
    "Lunch",
    "Midday plate",
    "Lunch time",
    "Halfway fuel",
    "Lunch check",
    "Midday meal",
    "The middle of the day",
  ],
  dinner: [
    "Dinner",
    "Evening plate",
    "Dinner time",
    "Last meal",
    "Dinner check",
    "Evening meal",
    "Winding down",
  ],
  snack: [
    "Snack",
    "Something small",
    "Snack time",
    "A little something",
    "Snack check",
    "In-between",
    "Small plate",
  ],
};

/**
 * The bodies. Seven per slot — one for each day of a rolling week, so a full
 * week passes before any line repeats, and the repeat lands on a different
 * weekday than it did before.
 */
const MEAL_BODIES: Record<MealSlotKey, readonly string[]> = {
  breakfast: [
    "Had it? One tap and it's counted.",
    "Eaten already? Log it from here — no need to open anything.",
    "Tap to log it and get on with your morning.",
    "If breakfast happened, I'll write it down.",
    "One tap and your morning's on the books.",
    "Done? Mark it and I'll do the rest.",
    "Breakfast in? Let me know and it's logged.",
  ],
  lunch: [
    "Eaten? Tap once and it's in.",
    "Log it without leaving what you're doing.",
    "If lunch is done, I'll take it from here.",
    "One tap keeps the day's numbers honest.",
    "Had it? Counted, just like that.",
    "Mark it done and get back to your afternoon.",
    "Lunch sorted? Tap and it's recorded.",
  ],
  dinner: [
    "Eaten? Tap and the day's complete.",
    "One tap closes out today's plate.",
    "If dinner's done, I'll log it for you.",
    "Mark it and today's food is fully counted.",
    "Had it? That's the day logged.",
    "Tap once — no need to open the app.",
    "Dinner in? Let me know and we're done for today.",
  ],
  snack: [
    "Had it? One tap and it's counted.",
    "Log it from right here.",
    "If you had it, I'll add it in.",
    "Tap once and it's on the books.",
    "Mark it done — takes a second.",
    "Counted the moment you tap.",
    "Had something? Let me know.",
  ],
};

/**
 * A line for when the plan actually knows what the meal IS.
 *
 * "Grilled chicken salad — had it?" is a fundamentally better notification than
 * "Lunch — had it?": it is answerable without opening anything, which is the
 * entire premise of a tap-to-log reminder. Only used when the schedule for that
 * date already exists at the time the notification is written.
 */
export function mealNamedBody(mealName: string, dayIndex: number): string {
  const shapes = [
    `${mealName} — had it? One tap and it's logged.`,
    `Today that's ${mealName}. Tap if it's done.`,
    `${mealName} on the plan. Had it?`,
    `If you've had ${mealName.toLowerCase()}, I'll count it.`,
    `${mealName} — tap once and it's in.`,
    `Was it ${mealName.toLowerCase()}? Mark it and I'll log it.`,
    `${mealName}. Done? One tap.`,
  ];
  return shapes[Math.abs(dayIndex) % shapes.length];
}

/** Which slot a meal reminder is for. Snacks share one slot, as everywhere. */
export type MealSlotKey = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * A stable index for a date — the day number since the epoch.
 *
 * Deterministic FROM THE DATE rather than from a counter, so re-scheduling the
 * same day (which happens on every app open, as the rolling window tops itself
 * up) produces byte-identical copy. A counter would give the user a different
 * sentence every time they opened the app, for a notification they have not
 * received yet.
 */
export function dayIndexOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** The title for one meal reminder. */
export function mealTitle(slot: MealSlotKey, date: string): string {
  const pool = MEAL_TITLES[slot];
  return pool[Math.abs(dayIndexOf(date) + hash(slot)) % pool.length];
}

/**
 * The body for one meal reminder.
 *
 * Names the meal when the plan for that date already exists, and falls back to
 * a slot line when it does not — a reminder written six days ahead usually has
 * no plan to read yet, and the next re-sync fills it in.
 */
export function mealBody(
  slot: MealSlotKey,
  date: string,
  mealName?: string | null,
): string {
  const i = dayIndexOf(date) + hash(slot);
  if (mealName && mealName.trim()) return mealNamedBody(mealName.trim(), i);
  const pool = MEAL_BODIES[slot];
  return pool[Math.abs(i) % pool.length];
}

/** What the confirmation toast says after a meal is logged from the lock screen. */
export const MEAL_LOGGED_LINES: readonly string[] = [
  "Logged. Nothing else needed.",
  "Counted — that's it.",
  "Got it. Written down.",
  "Done. Your day's up to date.",
];
