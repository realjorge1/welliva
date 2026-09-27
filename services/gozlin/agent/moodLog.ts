/**
 * GOZLIN AGENT — the mood log, as evidence.
 *
 * The state-of-mind log (services/gozlin/mind.ts, MindService.ts) was the one
 * thing the user tells the app about themselves that the coach could not read.
 * get_habit_report folded check-ins into a "mood" domain score, but nothing
 * could answer "how have I been feeling?" or "does work get to me?" — so the
 * model either said it couldn't see that, or, worse, guessed.
 *
 * WHAT GOES UP, AND WHAT DOESN'T. A compact summary: valence (−1…+1, the
 * Apple state-of-mind axis the log records), the feelings they chose, the
 * parts of life they tied them to, and hours slept. NEVER the free-text note —
 * app/privacy.tsx promises only short summaries leave the phone, and a diary
 * line is not a summary. Nor any interpretation: this is self-report, and the
 * clinical screen and system prompt already forbid reading a condition off it.
 *
 * Pure and `now`-injected, like every engine the tools wrap.
 */

import type { GozlinCheckin } from "../gozlin.types";
import { associationLabel, readEntryValence, STRESS_LABELS, valenceLabel } from "../mind";

export const MOOD_DAYS_DEFAULT = 14;
const MOOD_DAYS_MIN = 7;
const MOOD_DAYS_MAX = 60;

/** Fewer entries than this and a "trend" is two data points and a hope. */
const MIN_FOR_TREND = 4;
/** Valence moves smaller than this between halves are called steady. */
const TREND_THRESHOLD = 0.15;

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clampMoodDays(days: unknown): number {
  const n = typeof days === "number" && Number.isFinite(days) ? Math.round(days) : MOOD_DAYS_DEFAULT;
  return Math.min(MOOD_DAYS_MAX, Math.max(MOOD_DAYS_MIN, n));
}

function isStressed(e: GozlinCheckin): boolean {
  if ((e.labels ?? []).some((l) => STRESS_LABELS.has(l))) return true;
  return typeof e.stress === "number" && e.stress >= 4;
}

function topCounts(values: string[], limit: number): { value: string; times: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, times]) => ({ value, times }));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** What the tool hands the model. Every field past `entries` is absent when there is nothing to say. */
export interface MoodSummary {
  available: boolean;
  days: number;
  entries: number;
  /** Present only when nothing was logged — tells the model not to guess. */
  note?: string;
  daysWithAnEntry?: number;
  averageValence?: number;
  averageFeeling?: string;
  trend?: "rising" | "steady" | "falling" | "not enough entries";
  feelings?: { name: string; times: number }[];
  tiedTo?: { name: string; times: number; averageValence: number; averageFeeling: string }[];
  stressedEntries?: number;
  sleep?: { nights: number; averageHours: number; nightsUnder6h: number };
  recent?: {
    date: string;
    kind: string;
    feeling?: string;
    named: string[];
    about: string[];
    sleepHours?: number;
  }[];
}

export function summarizeMood(checkins: GozlinCheckin[], days: number, now: Date): MoodSummary {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  const from = localDate(start);
  const to = localDate(now);

  const inWindow = checkins
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  if (inWindow.length === 0) {
    return {
      available: false,
      days,
      entries: 0,
      note: "No mood entries in this window. Say so plainly; do not guess how they feel.",
    };
  }

  const withValence = inWindow
    .map((e) => ({ e, v: readEntryValence(e) }))
    .filter((x): x is { e: GozlinCheckin; v: number } => x.v !== null);

  const avg = withValence.length > 0 ? mean(withValence.map((x) => x.v)) : null;

  let trend: "rising" | "steady" | "falling" | "not enough entries" = "not enough entries";
  if (withValence.length >= MIN_FOR_TREND) {
    const half = Math.floor(withValence.length / 2);
    const earlier = mean(withValence.slice(0, half).map((x) => x.v));
    const later = mean(withValence.slice(withValence.length - half).map((x) => x.v));
    const delta = later - earlier;
    trend = delta > TREND_THRESHOLD ? "rising" : delta < -TREND_THRESHOLD ? "falling" : "steady";
  }

  // What each part of life tends to come with — the question people actually
  // ask ("is it work?"). Average valence per association, where there is one.
  const byAssociation = new Map<string, number[]>();
  for (const { e, v } of withValence) {
    for (const a of e.associations ?? []) {
      const list = byAssociation.get(a) ?? [];
      list.push(v);
      byAssociation.set(a, list);
    }
  }
  const tiedTo = [...byAssociation.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([key, vs]) => {
      const av = mean(vs);
      return {
        name: associationLabel(key),
        times: vs.length,
        averageValence: round2(av),
        averageFeeling: valenceLabel(av),
      };
    });

  const slept = inWindow.filter(
    (e) => typeof e.sleepHours === "number" && Number.isFinite(e.sleepHours),
  );

  return {
    available: true,
    days,
    entries: inWindow.length,
    daysWithAnEntry: new Set(inWindow.map((e) => e.date)).size,
    ...(avg !== null
      ? { averageValence: round2(avg), averageFeeling: valenceLabel(avg) }
      : {}),
    trend,
    feelings: topCounts(inWindow.flatMap((e) => e.labels ?? []), 5).map((f) => ({
      name: f.value,
      times: f.times,
    })),
    tiedTo,
    stressedEntries: inWindow.filter(isStressed).length,
    ...(slept.length > 0
      ? {
          sleep: {
            nights: slept.length,
            averageHours: round1(mean(slept.map((e) => e.sleepHours as number))),
            nightsUnder6h: slept.filter((e) => (e.sleepHours as number) < 6).length,
          },
        }
      : {}),
    recent: [...inWindow]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((e) => {
        const v = readEntryValence(e);
        return {
          date: e.date,
          kind: e.kind ?? "daily",
          ...(v !== null ? { feeling: valenceLabel(v) } : {}),
          named: (e.labels ?? []).slice(0, 3),
          about: (e.associations ?? []).slice(0, 3).map(associationLabel),
          ...(typeof e.sleepHours === "number" ? { sleepHours: e.sleepHours } : {}),
        };
      }),
  };
}
