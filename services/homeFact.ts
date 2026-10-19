/**
 * HOME FACT — the one line on Home's top bar.
 *
 * It replaced a rotating greeting. A greeting says something TO you; this says
 * something ABOUT you — one true, specific thing from the last day, picked
 * because it is the most notable of what is known right now.
 *
 * Rules, all of them about trust:
 *   · Every candidate is read from a record. A day with nothing logged yields NO
 *     candidate — never "0 kcal yesterday" for a day the user simply skipped.
 *   · Deterministic: same inputs, same line. No Math.random at render.
 *   · Nothing evaluative. "112% protein", not "great job".
 *   · Short — it sits in a display face on one line between two buttons.
 *
 * Pure: no React, no storage. The screen gathers the inputs.
 */

export interface HomeFactInput {
  /** Local hour 0–23 — only used to decide when an open streak is worth stating. */
  hour: number;
  /** Local "today" and "yesterday", YYYY-MM-DD. */
  today: string;
  yesterday: string;

  streak: number;
  keptToday: boolean;
  atRisk: boolean;
  totalDays: number;

  /** Yesterday's intake, or null when nothing was logged (or it couldn't be read). */
  yesterdayIntake: { calories: number; proteinG: number } | null;
  targets: { calories: number; proteinG: number } | null;

  /** Sessions logged, each with its completion instant (ISO) and minutes. */
  workouts: readonly { completedAt: string; durationMinutes: number }[];
  nowMs: number;

  waterMl: number;
  waterGoalMl: number | null;

  weighIns: readonly { date: string; weightKg: number }[];
}

export interface HomeFact {
  /** Stable id of the candidate that won — for tests and analytics, not display. */
  key: string;
  /** Already upper-cased, ready for the display face. */
  text: string;
}

interface Candidate extends HomeFact {
  score: number;
}

const HOUR_MS = 3_600_000;

const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function hoursSince(iso: string, nowMs: number): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (nowMs - t) / HOUR_MS : null;
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", { day: "numeric", month: "short" })
    .toUpperCase();
}

function litres(ml: number): string {
  return (Math.round(ml / 100) / 10).toFixed(1);
}

export function pickHomeFact(i: HomeFactInput): HomeFact {
  const c: Candidate[] = [];
  const add = (key: string, score: number, text: string) =>
    c.push({ key, score, text: text.toUpperCase() });

  // ── Training in the last 24 hours ─────────────────────────────────────
  const recent = i.workouts.filter((w) => {
    const h = hoursSince(w.completedAt, i.nowMs);
    return h !== null && h >= 0 && h <= 24;
  });
  const minutes = Math.round(recent.reduce((s, w) => s + (w.durationMinutes || 0), 0));
  if (recent.length > 0 && minutes > 0) {
    add("trained", 80, `Trained ${minutes} min`);
  }

  // ── Streak ─────────────────────────────────────────────────────────────
  if (i.streak > 0 && MILESTONES.includes(i.streak) && i.keptToday) {
    add("streak-milestone", 95, `${i.streak} days kept`);
  }
  if (i.atRisk && i.hour >= 18) {
    add("streak-risk", 90, `${i.streak}-day run ends at midnight`);
  }
  if (i.streak >= 2) add("streak", 50, `${i.streak} days kept`);

  // ── Yesterday's intake against the targets, only if it was actually logged ──
  const y = i.yesterdayIntake;
  const t = i.targets;
  if (y && t && y.calories > 0) {
    if (t.proteinG > 0) {
      const pct = Math.round((y.proteinG / t.proteinG) * 100);
      if (pct >= 100) add("protein-hit", 70, `Protein ${pct}% yesterday`);
    }
    if (t.calories > 0) {
      const off = (y.calories - t.calories) / t.calories;
      if (Math.abs(off) <= 0.05) add("kcal-on-target", 72, "Yesterday: calories on target");
      else add("kcal-yesterday", 40, `${Math.round(y.calories).toLocaleString()} kcal yesterday`);
    }
  }

  // ── Water today ────────────────────────────────────────────────────────
  if (i.waterGoalMl && i.waterGoalMl > 0 && i.waterMl > 0) {
    const done = i.waterMl >= i.waterGoalMl;
    add(
      "water",
      done ? 65 : 45,
      done ? `Water goal met · ${litres(i.waterMl)} L` : `Water ${litres(i.waterMl)} / ${litres(i.waterGoalMl)} L`,
    );
  }

  // ── Weight: the newest weigh-in against the one before it ──────────────
  const w = [...i.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  if (w.length >= 2) {
    const last = w[w.length - 1];
    const prev = w[w.length - 2];
    const delta = Math.round((last.weightKg - prev.weightKg) * 10) / 10;
    const fresh = last.date === i.today || last.date === i.yesterday;
    if (delta !== 0 && fresh) {
      const sign = delta < 0 ? "-" : "+";
      add("weight", 75, `${sign}${Math.abs(delta).toFixed(1)} kg since ${shortDate(prev.date)}`);
    }
  }

  // ── Fallbacks: always something true ───────────────────────────────────
  if (i.totalDays > 0) add("total-days", 10, `${i.totalDays} days kept`);
  add("fresh-day", 1, "Fresh day · nothing logged");

  c.sort((a, b) => b.score - a.score);
  return { key: c[0].key, text: c[0].text };
}
