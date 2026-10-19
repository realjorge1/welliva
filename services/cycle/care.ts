/**
 * services/cycle/care.ts — where the cycle changes the plan.
 *
 * This is what a period app can't do: welliva already writes her workouts and
 * her meals, so her cycle can change them. Three hooks, each driven by what SHE
 * logged and never by a phase stereotype ("luteal, so rest" is exactly the kind
 * of assumption the owner ruled out):
 *
 *   cycleEase   — a lighter version of today's session when she logs cramps or
 *                 a heavy flow today. It LEARNS: if she chose the full session
 *                 on two of her last three such days, it stops easing by default
 *                 and offers the lighter one instead.
 *   ironPicks   — around heavy periods, iron-rich foods she ALREADY eats, from
 *                 her own food log with measured numbers; a short reference list
 *                 (filtered for her diet and allergies) only when her log has
 *                 none, and labelled as such.
 *   headsUps    — today's personal forecasts from her timing patterns
 *                 ("headaches usually come about now for you").
 *
 * Free for everyone (owner, 2026-10-15): none of this spends inference.
 */

import { CANONICAL_FOODS } from "../../constants/NutrientDatabase";
import { addDays, daysBetween } from "./dates";
import { liveEpisodes } from "./episodes";
import { describeWindow, SUBJECT_LABEL, type CyclePattern } from "./patterns";
import type { CycleMode, CycleToday, Prediction } from "./predict";
import type { CycleDayLog, CycleDays, PeriodEpisode } from "./types";

/* ───────────────────────────── training ───────────────────────────── */

export interface CycleEase {
  /** First line of the change list — names what she logged. */
  headline: string;
  /** The per-exercise note. */
  dose: string;
  /**
   * Ease by default. False once she has chosen the full session on two of her
   * last three cramp/heavy days: then the lighter one is offered, not imposed.
   */
  auto: boolean;
  /** Shown under the offer when `auto` is false. */
  learnedNote: string | null;
}

const isTrigger = (log: CycleDayLog | undefined) =>
  !!log && (!!log.symptoms?.includes("cramps") || log.flow === "heavy");

export function cycleEase(input: {
  enabled: boolean;
  mode: CycleMode;
  today: string;
  days: CycleDays;
  fullSessionDays: readonly string[];
}): CycleEase | null {
  if (!input.enabled || input.mode === "pregnancy") return null;
  const log = input.days[input.today];
  if (!isTrigger(log)) return null;
  const cramps = !!log?.symptoms?.includes("cramps");
  const heavy = log?.flow === "heavy";

  const previous = Object.keys(input.days)
    .filter((d) => d < input.today && isTrigger(input.days[d]))
    .sort()
    .slice(-3);
  const choseFull = previous.filter((d) => input.fullSessionDays.includes(d)).length;
  const auto = choseFull < 2;

  const what = cramps && heavy ? "cramps and a heavy flow" : cramps ? "cramps" : "a heavy flow";
  return {
    headline: `You logged ${what} — a lighter version of today's session`,
    dose: cramps && heavy
      ? "Eased for today's cramps and heavy flow"
      : cramps
        ? "Eased for today's cramps"
        : "Eased for a heavy day",
    auto,
    learnedNote: auto
      ? null
      : `You chose the full session on ${choseFull} of your last ${previous.length} days like this, so today stays as planned.`,
  };
}

/* ───────────────────────────── iron ───────────────────────────── */

/**
 * The FDA's "good source" claim: 10% of the Daily Value per serving
 * (21 CFR 101.54; iron DV 18 mg, 21 CFR 101.9) — a defined threshold, not ours.
 */
export const IRON_GOOD_SOURCE_MG = 1.8;

export interface IronPick {
  name: string;
  /** Iron in the portion named, mg. */
  ironMg: number;
  portion: string;
  /** Days she logged it (0 for a reference food). */
  days: number;
  source: "yours" | "reference";
}

/** The slice of a food-log entry this needs — structural, so the store isn't imported. */
export interface IronLogEntry {
  date: string;
  items: {
    name: string;
    foodId: string | null;
    quantity: number;
    unit: string;
    nutrients: { iron?: number };
  }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Iron-rich foods from her own log, most useful first. */
export function ironFromLog(entries: readonly IronLogEntry[], since: string): IronPick[] {
  const byFood = new Map<string, { name: string; iron: number[]; dates: Set<string>; portion: string; at: string }>();
  for (const e of entries) {
    if (e.date < since) continue;
    for (const item of e.items) {
      const iron = item.nutrients?.iron;
      if (typeof iron !== "number" || !Number.isFinite(iron) || iron <= 0) continue;
      const key = item.foodId ?? item.name.trim().toLowerCase();
      if (!key) continue;
      const row = byFood.get(key) ?? { name: item.name, iron: [], dates: new Set(), portion: "", at: "" };
      row.iron.push(iron);
      row.dates.add(e.date);
      if (e.date >= row.at) {
        row.at = e.date;
        row.portion = `${round1(item.quantity)} ${item.unit}`.trim();
      }
      byFood.set(key, row);
    }
  }
  return [...byFood.values()]
    .map((r) => ({
      name: r.name,
      ironMg: round1(r.iron.reduce((s, x) => s + x, 0) / r.iron.length),
      portion: r.portion,
      days: r.dates.size,
      source: "yours" as const,
    }))
    .filter((p) => p.ironMg >= IRON_GOOD_SOURCE_MG)
    .sort(
      (a, b) =>
        b.ironMg * (1 + Math.log2(b.days)) - a.ironMg * (1 + Math.log2(a.days)) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3);
}

type Contains = "meat" | "fish" | "egg" | "gluten";

/**
 * The reference list, by canonical id. Each carries what it typically contains,
 * conservatively (egusi is usually cooked with meat or fish; moi moi usually
 * with egg), so a restriction or an allergy can only ever remove a food.
 */
const IRON_REFERENCE: { id: string; contains: Contains[] }[] = [
  { id: "lentils_cooked", contains: [] },
  { id: "beans_cowpea_cooked", contains: [] },
  { id: "beans_black_cooked", contains: [] },
  { id: "egusi_soup", contains: ["meat", "fish"] },
  { id: "moi_moi", contains: ["egg"] },
  { id: "beef_ground_85", contains: ["meat"] },
  { id: "oats_dry", contains: ["gluten"] },
];

function excludedBy(restriction: string | undefined, allergies: readonly string[]): Set<Contains> {
  const out = new Set<Contains>();
  if (restriction === "vegetarian") ["meat", "fish"].forEach((c) => out.add(c as Contains));
  if (restriction === "vegan") ["meat", "fish", "egg"].forEach((c) => out.add(c as Contains));
  if (restriction === "pescatarian") out.add("meat");
  if (restriction === "gluten_free") out.add("gluten");
  const a = allergies.map((x) => x.toLowerCase());
  if (a.includes("eggs")) out.add("egg");
  if (a.includes("fish") || a.includes("shellfish")) out.add("fish");
  if (a.includes("gluten") || a.includes("wheat")) out.add("gluten");
  return out;
}

/** Well-measured iron sources from the reference table, safe for her diet. */
export function ironReference(restriction: string | undefined, allergies: readonly string[] = []): IronPick[] {
  const blocked = excludedBy(restriction, allergies);
  const out: IronPick[] = [];
  for (const ref of IRON_REFERENCE) {
    if (ref.contains.some((c) => blocked.has(c))) continue;
    const food = CANONICAL_FOODS.find((f) => f.id === ref.id);
    const per100 = food?.per100g.iron;
    if (!food || typeof per100 !== "number") continue;
    const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
    const grams = portion?.grams ?? 100;
    const ironMg = round1((per100 * grams) / 100);
    if (ironMg < IRON_GOOD_SOURCE_MG) continue;
    out.push({
      name: food.name,
      ironMg,
      portion: portion ? `1 ${portion.unit}` : "100 g",
      days: 0,
      source: "reference",
    });
  }
  return out.sort((a, b) => b.ironMg - a.ironMg).slice(0, 3);
}

export type IronReason = "heavy-today" | "heavy-period" | "anemia";

/**
 * Is this a moment for iron? A heavy flow today, a period (or the three days
 * after it) that had a heavy day in it, or a period with anaemia on the profile.
 */
export function ironMoment(input: {
  today: string;
  days: CycleDays;
  episodes: readonly PeriodEpisode[];
  status: CycleToday;
  conditions?: readonly string[];
}): IronReason | null {
  if (input.days[input.today]?.flow === "heavy") return "heavy-today";
  const live = liveEpisodes(input.episodes);
  const last = live.length ? live[live.length - 1] : null;
  if (last && last.start <= input.today) {
    const end = last.end ?? input.today;
    const within = daysBetween(end, input.today) <= 3;
    if (within) {
      const span = daysBetween(last.start, end);
      for (let i = 0; i <= span; i += 1) {
        if (input.days[addDays(last.start, i)]?.flow === "heavy") return "heavy-period";
      }
    }
  }
  if (input.status.inPeriod && input.conditions?.includes("anemia")) return "anemia";
  return null;
}

/* ───────────────────────────── heads-ups ───────────────────────────── */

export interface HeadsUp {
  id: string;
  icon: string;
  text: string;
}

/**
 * Today's forecasts from her timing patterns. A pattern anchored to the start
 * speaks while she's in that part of her period, or the day before a likely
 * start; one anchored to the next period speaks when today falls in its window
 * of the PREDICTED start — and says it's her pattern, not a certainty.
 */
/** Subjects whose label is a mass noun ("bloating", "nausea") take a singular verb. */
const SINGULAR: ReadonlySet<string> = new Set(["bloating", "back_pain", "nausea"]);

export function headsUps(
  patterns: readonly CyclePattern[],
  status: CycleToday,
  prediction: Prediction | null,
): HeadsUp[] {
  const out: HeadsUp[] = [];
  for (const p of patterns) {
    if (p.kind !== "timing" || !p.window || !p.subject) continue;
    const w = p.window;
    const label = SUBJECT_LABEL[p.subject];
    const lower = label.toLowerCase();
    const one = SINGULAR.has(p.subject);
    const shows = one ? "shows up" : "show up";
    const has = one ? "has" : "have";
    const comes = one ? "comes" : "come";
    if (w.anchor === "start") {
      if (status.inPeriod && status.periodDay !== null && status.periodDay >= w.lo && status.periodDay <= w.hi) {
        out.push({
          id: p.id,
          icon: p.icon,
          text:
            p.subject === "low_energy"
              ? `Your energy usually dips around now (${describeWindow(w)}).`
              : `${label} usually ${shows} around now for you (${describeWindow(w)}).`,
        });
      } else if (!status.inPeriod && status.predicting && status.toLikely === 1 && w.lo === 1) {
        out.push({
          id: p.id,
          icon: p.icon,
          text:
            p.subject === "low_energy"
              ? "Your period may start tomorrow, and your energy usually dips on day 1."
              : `Your period may start tomorrow, and ${lower} usually ${comes} with day 1 for you.`,
        });
      }
    } else if (!status.inPeriod && status.predicting && prediction && status.toLikely !== null) {
      const offset = -status.toLikely; // e.g. -2 = two days before the likely start
      if (offset >= w.lo && offset <= w.hi) {
        out.push({
          id: p.id,
          icon: p.icon,
          text:
            p.subject === "low_energy"
              ? `Your energy has tended to dip about now, ${describeWindow(w)}. A lighter day is fine.`
              : `${label} ${has} tended to show up about now for you, ${describeWindow(w)}.`,
        });
      }
    }
    if (out.length >= 2) break;
  }
  return out;
}
