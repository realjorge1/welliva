/**
 * services/nutrition/waterPours.ts
 *
 * THE DRINKS BEHIND TODAY'S TOTAL — pure, no storage, no React.
 *
 * The day's water has always been ONE number (waterStore's counter). That is the
 * right thing to total and sync, and the wrong thing to correct: a glass tapped
 * twice by accident could only be fixed by eating into a number nobody could
 * see the parts of. So every glass that reaches the counter now also leaves a
 * "pour" — how much, and when — and a pour can be taken back out.
 *
 * THE COUNTER STAYS THE TRUTH. The list is a record of what built the total, not
 * a second total. Anything that moved the counter without leaving a pour (water
 * logged before this list existed) simply shows as "earlier", and if the two
 * ever disagree the counter wins — see {@link reconcilePours}.
 *
 * One day at a time: the log holds the pours of the counter's own day and is
 * replaced when a pour arrives for a different one, so nothing has to reset it
 * at midnight and a stale list can never be shown against a fresh day.
 */

export interface Pour {
  id: string;
  /** Millilitres this drink added to the day. */
  ml: number;
  /** ISO time it was recorded (a lock-screen press keeps the time it was pressed). */
  at: string;
}

export interface PourLog {
  /** Local YYYY-MM-DD the pours belong to. */
  date: string;
  /** In the order they were recorded. */
  pours: Pour[];
}

/** A day's cap. A hundred drinks is far beyond a person; it only bounds a runaway. */
export const MAX_POURS_PER_DAY = 100;

/** A stored value as a log, or null when it is anything else. Never throws. */
export function asPourLog(value: unknown): PourLog | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { date?: unknown; pours?: unknown };
  if (typeof v.date !== "string" || !Array.isArray(v.pours)) return null;
  const pours = v.pours.filter(
    (p): p is Pour =>
      !!p &&
      typeof (p as Pour).id === "string" &&
      typeof (p as Pour).at === "string" &&
      Number.isFinite((p as Pour).ml) &&
      (p as Pour).ml > 0,
  );
  return { date: v.date, pours };
}

/** A fresh id. `now` and `nonce` are passed in so a test can pin them. */
export function newPourId(now: number, nonce: number): string {
  return `${Math.floor(now).toString(36)}-${Math.floor(nonce * 1_679_616).toString(36)}`;
}

/**
 * The log with one more pour in it. A log for a different day is replaced, not
 * added to — that is the whole of the midnight rollover.
 */
export function appendPour(log: PourLog | null, date: string, pour: Pour): PourLog {
  const same = log && log.date === date ? log.pours : [];
  return { date, pours: [...same, pour].slice(-MAX_POURS_PER_DAY) };
}

/** The log without pour `id`, and the pour it removed (null if there was none). */
export function dropPour(
  log: PourLog | null,
  id: string,
): { log: PourLog | null; removed: Pour | null } {
  if (!log) return { log: null, removed: null };
  const removed = log.pours.find((p) => p.id === id) ?? null;
  if (!removed) return { log, removed: null };
  return { log: { date: log.date, pours: log.pours.filter((p) => p.id !== id) }, removed };
}

/** The pours that belong to `date` — none when the stored log is another day's. */
export function poursOn(log: PourLog | null, date: string): Pour[] {
  return log && log.date === date ? log.pours : [];
}

export interface DrinkRows {
  /** Newest first. Fitted to the total — see {@link reconcilePours}. */
  pours: Pour[];
  /** Water in the total that no pour accounts for. */
  earlierMl: number;
}

/**
 * The drinks to show for a day whose counter reads `totalMl`.
 *
 * Normally the pours add up to the total, or fall short of it (water that was
 * logged before the list existed): the shortfall is `earlierMl`. If they add up
 * to MORE than the counter — it was lowered somewhere this list did not see —
 * the oldest pours are dropped until they fit, because a list that claims more
 * water than the day's total is a number the user would rightly distrust.
 */
export function reconcilePours(totalMl: number, pours: readonly Pour[]): DrinkRows {
  const total = Math.max(0, Math.round(totalMl) || 0);
  const byTime = [...pours].sort((a, b) => a.at.localeCompare(b.at));
  let sum = byTime.reduce((s, p) => s + p.ml, 0);
  while (byTime.length > 0 && sum > total) {
    sum -= byTime[0].ml;
    byTime.shift();
  }
  return { pours: byTime.reverse(), earlierMl: Math.max(0, total - sum) };
}
