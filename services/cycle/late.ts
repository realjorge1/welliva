/**
 * services/cycle/late.ts — "why am I late?", answered from this month.
 *
 * When a period is late, a period app can only shrug: "stress, travel, illness
 * and training changes can all shift a cycle". welliva holds her sleep, her
 * training, what she ate, her weight, her mood and her trips — so it can say
 * which of those actually CHANGED this cycle, in her numbers, against her own
 * previous cycles over the same stretch of days.
 *
 * THE RULES IT KEEPS:
 *   · ONLY WHAT GENUINELY CHANGED. Each signal has a gate (the constants below)
 *     and a minimum of data on BOTH sides of the comparison; below it, nothing is
 *     said. "Nothing stands out" is an honest, reassuring answer, not a failure.
 *   · NEVER A CAUSE. These are changes that CAN delay a period. Nothing here says
 *     "this is why", names a condition, or reads a phase stereotype.
 *   · A MISSING VALUE IS NOT ZERO. Calories come only from days that recorded
 *     intake (services/nutrition/recordedIntake); a night with no check-in is
 *     not a short night.
 *   · THE NEXT STEPS USE THE APP'S OWN LINES: the 90-day rule from ./flags and
 *     the test advice of the late-period page — never a new threshold.
 *
 * Where she is late at all is ./predict's business, so the logging-only and
 * paused modes never get here: there is no "late" on hormonal contraception,
 * in pregnancy or with menopause. After a birth the words adapt.
 *
 * Pure: the cycle screen's hook (components/cycle/useCycleInsights) gathers the
 * logs, so nothing here reads storage and the coach's brief gets the same lines.
 */

import { addDays, daysBetween } from "./dates";
import { MISSED_AFTER_DAYS } from "./flags";
import type { MindPoint } from "./patterns";
import type { CycleMode, CycleRecord, CycleToday } from "./predict";

/** Her previous completed cycles the comparison reads: enough to be "usual", recent enough to be her now. */
export const BASELINE_CYCLES = 3;
/** At most this many changes are named — three is a reading, seven is a report. */
export const MAX_CHANGES = 3;

/** A drop in sleep she would feel; under it is the night-to-night noise of a check-in. Minutes a night. */
export const SLEEP_DROP_MIN = 45;
/** Nights with sleep recorded, in EACH of the two stretches compared, before an average means anything. */
export const MIN_NIGHTS = 5;
/** Training up by half, in sessions or minutes a week. */
const TRAINING_RISE = 0.5;
/** ...and by at least this much, so 1 → 1.5 sessions a week isn't news. */
const MIN_EXTRA_SESSIONS = 1;
const MIN_EXTRA_MINUTES = 60;
/** With no training logged in her earlier cycles, this many sessions a week this cycle is a change. */
const NEW_TRAINING_SESSIONS = 2;
/** Eating down by a fifth on average — the size of change that can delay a period. */
export const EATING_DROP = 0.2;
/** Days that recorded intake, in EACH stretch compared. */
export const MIN_INTAKE_DAYS = 7;
/** Weight up or down this much over the cycle. */
export const WEIGHT_CHANGE_KG = 2;
/** A weigh-in up to this many days before the cycle began can be its starting weight. */
const WEIGHT_LOOKBACK_DAYS = 14;
/** Low-mood days at least twice their usual share... */
const MOOD_SHARE_RATIO = 2;
/** ...over at least this many scored days in each stretch, with at least this many low ones now. */
const MIN_MOOD_DAYS = 5;
const MIN_LOW_DAYS = 3;
/**
 * A low-mood day: any unpleasant reading on the Mind scale — below the edge of
 * its Neutral stop (services/gozlin/mind's seven stops put Neutral at ±1/6).
 */
export const LOW_MOOD_VALENCE = -1 / 6;
/** "Most late periods arrive within a week" is said only inside that week. */
export const LATE_REASSURE_DAYS = 7;

/** A stretch of days she was away or unwell, from Life Context or a rough day. */
export interface LifeSpan {
  kind: "travel" | "ill";
  start: string;
  /** Inclusive. */
  end: string;
  /** Her own name for it ("Lagos trip"), when she gave one. */
  title?: string | null;
}

export interface LateSignals {
  mind: readonly MindPoint[];
  workouts: readonly { date: string; minutes: number | null }[];
  /** Calories on days that RECORDED intake only — an unlogged day must not be here. */
  intake: readonly { date: string; kcal: number }[];
  weighIns: readonly { date: string; kg: number }[];
  events: readonly LifeSpan[];
}

export type LateChangeId = "illness" | "travel" | "eating" | "training" | "weight" | "sleep" | "mood";

export interface LateChange {
  id: LateChangeId;
  /** On screen: "You slept about 50 minutes less a night than usual (6 h 10 vs 7 h)." */
  text: string;
  /** For the coach, about her: "slept about 50 min less a night than usual (6 h 10 vs 7 h)". */
  coach: string;
}

export interface LateContext {
  /** Previous cycles compared against (0 when she has none yet). */
  baseline: number;
  /** What genuinely changed, most telling first, at most {@link MAX_CHANGES}. */
  changes: LateChange[];
  /** "Changes like these can delay a period." — or "Nothing stands out in what you logged this cycle." */
  summary: string;
  /** After a birth: the line about first cycles back. */
  context: string | null;
  /** The honest next steps, in the app's own thresholds. */
  nextSteps: string[];
}

/** The late-period page's own advice, word for word in substance. */
export const PREGNANCY_TEST_LINE =
  "If there's any chance you could be pregnant, a home test is reliable from the day your period was due. If it's negative and your period still hasn't come a week later, test again.";

const ORDER: readonly LateChangeId[] = ["illness", "travel", "eating", "training", "weight", "sleep", "mood"];

/* ───────────────────────────── small helpers ───────────────────────────── */

interface Span {
  from: string;
  to: string;
}

const inside = (date: string, s: Span) => date >= s.from && date <= s.to;
const spanDays = (s: Span) => daysBetween(s.from, s.to) + 1;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "6 h 10", "7 h". */
function hoursMinutes(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round(((hours - h) * 60) / 5) * 5;
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Thousands grouped by hand — Hermes' Intl varies by build (./dates says why). */
function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Sessions a week, to the half: "5", "2.5". */
function rate(n: number): string {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/* ───────────────────────────── the reading ───────────────────────────── */

/**
 * What has been different this cycle, or null when she isn't late (or the mode
 * has no "late"). `cycles` are the view's completed cycles, already counted from
 * her fresh start after a birth or a stopped method.
 */
export function lateContext(input: {
  mode: CycleMode;
  status: CycleToday;
  cycles: readonly CycleRecord[];
  today: string;
  signals: LateSignals;
}): LateContext | null {
  const { mode, status, today, signals } = input;
  if (mode !== "normal" && mode !== "postpartum") return null;
  if (status.lateBy <= 0 || status.cycleDay === null) return null;

  const n = status.cycleDay;
  const now: Span = { from: addDays(today, -(n - 1)), to: today };
  // The same stretch of days in each earlier cycle — day 1 to day n, or its whole length.
  const before: Span[] = input.cycles
    .filter((c) => c.status === "counted")
    .slice(-BASELINE_CYCLES)
    .map((c) => ({ from: c.start, to: addDays(c.start, Math.min(n, c.length) - 1) }));
  const inBefore = (date: string) => before.some((s) => inside(date, s));
  const nowDays = spanDays(now);
  const beforeDays = before.reduce((s, b) => s + spanDays(b), 0);

  const found = new Map<LateChangeId, LateChange>();

  // ── Illness and travel: anything that overlapped this cycle ──
  const overlap = (kind: LifeSpan["kind"]) => {
    const days = new Set<string>();
    const titles: string[] = [];
    for (const e of signals.events) {
      if (e.kind !== kind || e.end < now.from || e.start > now.to) continue;
      const from = e.start > now.from ? e.start : now.from;
      const to = e.end < now.to ? e.end : now.to;
      for (let d = from; d <= to; d = addDays(d, 1)) days.add(d);
      const title = e.title?.trim();
      if (title && !titles.includes(title)) titles.push(title);
    }
    return { days: days.size, titles };
  };
  const ill = overlap("ill");
  if (ill.days > 0) {
    found.set("illness", {
      id: "illness",
      text: `You were unwell for ${plural(ill.days, "day")} this cycle.`,
      coach: `unwell for ${plural(ill.days, "day")}`,
    });
  }
  const away = overlap("travel");
  if (away.days > 0) {
    const named = away.titles.length === 1 ? ` (${away.titles[0]})` : "";
    found.set("travel", {
      id: "travel",
      text: `You were travelling for ${plural(away.days, "day")}${named}.`,
      coach: `travelling for ${plural(away.days, "day")}${named}`,
    });
  }

  // ── Eating: recorded days only, enough of them on both sides ──
  const kcalNow = signals.intake.filter((x) => inside(x.date, now) && x.kcal > 0).map((x) => x.kcal);
  const kcalBefore = signals.intake.filter((x) => inBefore(x.date) && x.kcal > 0).map((x) => x.kcal);
  if (kcalNow.length >= MIN_INTAKE_DAYS && kcalBefore.length >= MIN_INTAKE_DAYS) {
    const cur = mean(kcalNow);
    const usual = mean(kcalBefore);
    if (usual > 0 && (usual - cur) / usual >= EATING_DROP) {
      const a = grouped(Math.round(cur / 10) * 10);
      const b = grouped(Math.round(usual / 10) * 10);
      found.set("eating", {
        id: "eating",
        text: `You ate quite a bit less than usual: about ${a} kcal a day vs ${b}.`,
        coach: `ate quite a bit less than usual (about ${a} vs ${b} kcal a day, recorded days only)`,
      });
    }
  }

  // ── Training: sessions or minutes a week, against the same stretch before ──
  if (beforeDays > 0) {
    const sessions = (pred: (d: string) => boolean) => signals.workouts.filter((w) => pred(w.date));
    const wNow = sessions((d) => inside(d, now));
    const wBefore = sessions(inBefore);
    const perWeek = (count: number, days: number) => (count * 7) / days;
    const sNow = perWeek(wNow.length, nowDays);
    const sBefore = perWeek(wBefore.length, beforeDays);
    const minutes = (ws: typeof wNow) => ws.reduce((s, w) => s + (w.minutes ?? 0), 0);
    const mNow = perWeek(minutes(wNow), nowDays);
    const mBefore = perWeek(minutes(wBefore), beforeDays);
    if (sBefore === 0) {
      if (sNow >= NEW_TRAINING_SESSIONS) {
        found.set("training", {
          id: "training",
          text: `You trained ${rate(sNow)} times a week this cycle, with none logged in your cycles before.`,
          coach: `started training (${rate(sNow)} sessions a week, none logged before)`,
        });
      }
    } else if (sNow >= sBefore * (1 + TRAINING_RISE) && sNow - sBefore >= MIN_EXTRA_SESSIONS) {
      found.set("training", {
        id: "training",
        text: `You trained more than usual: ${rate(sNow)} sessions a week vs ${rate(sBefore)}.`,
        coach: `trained more than usual (${rate(sNow)} vs ${rate(sBefore)} sessions a week)`,
      });
    } else if (mBefore > 0 && mNow >= mBefore * (1 + TRAINING_RISE) && mNow - mBefore >= MIN_EXTRA_MINUTES) {
      const a = Math.round(mNow / 10) * 10;
      const b = Math.round(mBefore / 10) * 10;
      found.set("training", {
        id: "training",
        text: `You trained longer than usual: about ${a} minutes a week vs ${b}.`,
        coach: `trained longer than usual (about ${a} vs ${b} minutes a week)`,
      });
    }
  }

  // ── Weight: over the cycle, from the nearest weigh-in at its start ──
  const scale = [...signals.weighIns]
    .filter((w) => Number.isFinite(w.kg) && w.kg > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const atStart =
    [...scale].reverse().find((w) => w.date <= now.from && w.date >= addDays(now.from, -WEIGHT_LOOKBACK_DAYS)) ??
    scale.find((w) => inside(w.date, now));
  const latest = [...scale].reverse().find((w) => inside(w.date, now));
  if (atStart && latest && latest.date > atStart.date) {
    const delta = Math.round((latest.kg - atStart.kg) * 10) / 10;
    if (Math.abs(delta) >= WEIGHT_CHANGE_KG) {
      const from = atStart.kg.toFixed(1);
      const to = latest.kg.toFixed(1);
      const way = delta < 0 ? "came down" : "went up";
      found.set("weight", {
        id: "weight",
        text: `Your weight ${way} ${Math.abs(delta).toFixed(1)} kg this cycle (${from} to ${to} kg).`,
        coach: `weight ${way} ${Math.abs(delta).toFixed(1)} kg this cycle`,
      });
    }
  }

  // ── Sleep: Mind check-ins, enough nights on both sides ──
  const slept = signals.mind.filter((p) => p.sleepHours !== null && Number.isFinite(p.sleepHours) && p.sleepHours > 0);
  const nightsNow = slept.filter((p) => inside(p.date, now)).map((p) => p.sleepHours as number);
  const nightsBefore = slept.filter((p) => inBefore(p.date)).map((p) => p.sleepHours as number);
  if (nightsNow.length >= MIN_NIGHTS && nightsBefore.length >= MIN_NIGHTS) {
    const cur = mean(nightsNow);
    const usual = mean(nightsBefore);
    const less = (usual - cur) * 60;
    if (less >= SLEEP_DROP_MIN) {
      const mins = Math.round(less / 5) * 5;
      found.set("sleep", {
        id: "sleep",
        text: `You slept about ${mins} minutes less a night than usual (${hoursMinutes(cur)} vs ${hoursMinutes(usual)}).`,
        coach: `slept about ${mins} min less a night than usual (${hoursMinutes(cur)} vs ${hoursMinutes(usual)})`,
      });
    }
  }

  // ── Mood: the share of scored days that were low ──
  const scored = signals.mind.filter((p) => p.valence !== null && Number.isFinite(p.valence));
  const moodNow = scored.filter((p) => inside(p.date, now));
  const moodBefore = scored.filter((p) => inBefore(p.date));
  if (moodNow.length >= MIN_MOOD_DAYS && moodBefore.length >= MIN_MOOD_DAYS) {
    const low = (ps: readonly MindPoint[]) => ps.filter((p) => (p.valence as number) < LOW_MOOD_VALENCE).length;
    const lowNow = low(moodNow);
    const lowBefore = low(moodBefore);
    if (lowNow >= MIN_LOW_DAYS && lowNow / moodNow.length >= MOOD_SHARE_RATIO * (lowBefore / moodBefore.length)) {
      found.set("mood", {
        id: "mood",
        text: `More of your check-ins were low than usual: ${lowNow} of ${moodNow.length} days, against ${lowBefore} of ${moodBefore.length} before.`,
        coach: `more low check-ins than usual (${lowNow} of ${moodNow.length} days vs ${lowBefore} of ${moodBefore.length} before)`,
      });
    }
  }

  const changes = ORDER.map((id) => found.get(id)).filter((c): c is LateChange => !!c).slice(0, MAX_CHANGES);
  const reassure = status.lateBy <= LATE_REASSURE_DAYS ? " Most late periods arrive within a week." : "";
  const postpartum = mode === "postpartum";
  return {
    baseline: before.length,
    changes,
    summary: changes.length
      ? `Changes like these can delay a period.${reassure}`
      : `Nothing stands out in what you logged this cycle.${reassure}`,
    context: postpartum
      ? "After a birth, the first cycles back are often irregular, and breastfeeding can hold a period off for months."
      : null,
    nextSteps: [
      PREGNANCY_TEST_LINE,
      postpartum
        ? "If your period hasn't come back by around three months after you stop breastfeeding, that's worth mentioning to a doctor."
        : `If you go ${MISSED_AFTER_DAYS} days without a period, that's worth mentioning to a doctor.`,
    ],
  };
}
