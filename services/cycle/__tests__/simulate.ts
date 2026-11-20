/**
 * A SEEDED POPULATION SIMULATOR for the cycle engine (docs/cycle/engine-accuracy.md).
 *
 * Six kinds of cycle, thirty simulated people each, twenty-four cycles per
 * person with a KNOWN true ovulation. The engine is asked, on the first day of
 * each period from the third on, when the next one will start — using only
 * what she would have logged by then — and its answer is checked against what
 * really happened. Seeded, so the numbers never change between runs: they
 * move only when the engine does.
 *
 * Everyone "told us 28" at setup (the commonest answer), so the archetypes
 * whose real cycles are not 28 also measure how fast that answer fades.
 */
import { addDays, daysBetween } from "../dates";
import { predict, type CycleProfile, type Prediction } from "../predict";
import { DEFAULT_CYCLE_SETTINGS, type CycleSettings, type PeriodEpisode } from "../types";

/* ───────────────────────────── seeded randomness ───────────────────────────── */

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/* ───────────────────────────── the archetypes ───────────────────────────── */

export interface Archetype {
  id: string;
  label: string;
  profile: CycleProfile;
  /** Cycle `i` (0-based) of 24, start to start, in days. */
  length: (r: () => number, i: number) => number;
  /** The archetypes the brief holds to "average error ≤ 1.5 days". */
  regular: boolean;
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "regular28",
    label: "Regular 28",
    profile: { age: 30, conditions: [] },
    length: (r) => clampInt(28 + 1.2 * gaussian(r), 24, 33),
    regular: true,
  },
  {
    id: "regular32",
    label: "Regular 32",
    profile: { age: 30, conditions: [] },
    length: (r) => clampInt(32 + 1.2 * gaussian(r), 28, 37),
    regular: true,
  },
  {
    id: "irregular",
    label: "Irregular 24–40",
    profile: { age: 30, conditions: [] },
    length: (r) => between(r, 24, 40),
    regular: false,
  },
  {
    id: "pcosLike",
    label: "Long, variable 36–44 (PCOS on profile)",
    profile: { age: 28, conditions: ["pcos"] },
    length: (r) => between(r, 36, 44),
    regular: false,
  },
  {
    id: "teen",
    label: "Teen 21–45 (age 16)",
    profile: { age: 16, conditions: [] },
    length: (r) => between(r, 21, 45),
    regular: false,
  },
  {
    id: "perimenopause",
    label: "Perimenopause (lengthening, age 47)",
    profile: { age: 47, conditions: [] },
    length: (r, i) => clampInt(27 + (13 * i) / 23 + 4 * gaussian(r), 21, 58),
    regular: false,
  },
];

export const PEOPLE_PER_ARCHETYPE = 30;
export const CYCLES_PER_PERSON = 24;
/** Forecasts are scored from the third period on: before that there is nothing to learn from. */
export const FIRST_FORECAST = 2;
/** "After 8 cycles": forecasts made with at least this many completed cycles behind them. */
export const SETTLED_AFTER = 8;
const BLEED_DAYS = 5;
const FIRST_START = "2024-01-07";

export interface Person {
  starts: string[];
  /** True ovulation of cycle i (between starts[i] and starts[i + 1]). */
  ovulations: string[];
}

export function simulatePerson(a: Archetype, seed: number): Person {
  const r = seeded(seed);
  const starts = [FIRST_START];
  const ovulations: string[] = [];
  for (let i = 0; i < CYCLES_PER_PERSON; i += 1) {
    const length = a.length(r, i);
    const luteal = clampInt(13 + 1.5 * gaussian(r), 9, 17);
    const next = addDays(starts[i], length);
    starts.push(next);
    ovulations.push(addDays(next, -Math.min(luteal, length - 6)));
  }
  return { starts, ovulations };
}

/** What she has logged on the first day of period `k`: every period before it closed, period `k` open. */
export function loggedBy(person: Person, k: number): PeriodEpisode[] {
  return person.starts.slice(0, k + 1).map((start, i) => ({
    id: `p${String(i).padStart(3, "0")}`,
    start,
    end: i < k ? addDays(start, BLEED_DAYS - 1) : null,
    updatedAt: `${start}T08:00:00.000Z`,
  }));
}

export const TOLD: CycleSettings = {
  ...DEFAULT_CYCLE_SETTINGS,
  enabled: true,
  usualCycleDays: 28,
  usualPeriodDays: BLEED_DAYS,
  showFertileWindow: true,
};

/* ───────────────────────────── scoring ───────────────────────────── */

export interface Forecast {
  k: number;
  prediction: Prediction;
  actualNext: string;
  trueOvulation: string;
}

export function forecasts(a: Archetype, seed: number): Forecast[] {
  const person = simulatePerson(a, seed);
  const out: Forecast[] = [];
  for (let k = FIRST_FORECAST; k < CYCLES_PER_PERSON; k += 1) {
    const today = person.starts[k];
    const p = predict({ episodes: loggedBy(person, k), days: {}, settings: TOLD, today, profile: a.profile });
    if (!p) continue;
    out.push({ k, prediction: p, actualNext: person.starts[k + 1], trueOvulation: person.ovulations[k] });
  }
  return out;
}

export interface ArchetypeScore {
  id: string;
  label: string;
  /** Forecasts scored, all of them / after SETTLED_AFTER cycles. */
  n: number;
  nSettled: number;
  /** Share whose real next start fell inside [earliest, latest]. */
  hitRate: number;
  hitRateSettled: number;
  /** Mean |likely − real start|, in days, after SETTLED_AFTER cycles. */
  meanErrorSettled: number;
  /** Mean days either side of `likely`. */
  meanHalfWidth: number;
  /** Mean fertile-window length, in days. */
  meanFertileDays: number;
  /** Share of cycles whose TRUE ovulation fell inside the fertile window. */
  ovulationCaught: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const round2 = (x: number) => Math.round(x * 100) / 100;

export function scoreArchetype(a: Archetype, people = PEOPLE_PER_ARCHETYPE): ArchetypeScore {
  const all: Forecast[] = [];
  for (let i = 0; i < people; i += 1) all.push(...forecasts(a, 1000 * (ARCHETYPES.indexOf(a) + 1) + i));
  const settled = all.filter((f) => f.k >= SETTLED_AFTER);
  const hit = (f: Forecast) => f.actualNext >= f.prediction.earliest && f.actualNext <= f.prediction.latest;
  return {
    id: a.id,
    label: a.label,
    n: all.length,
    nSettled: settled.length,
    hitRate: round2(mean(all.map((f) => (hit(f) ? 1 : 0)))),
    hitRateSettled: round2(mean(settled.map((f) => (hit(f) ? 1 : 0)))),
    meanErrorSettled: round2(mean(settled.map((f) => Math.abs(daysBetween(f.prediction.likely, f.actualNext))))),
    meanHalfWidth: round2(mean(all.map((f) => f.prediction.halfWidth))),
    meanFertileDays: round2(mean(all.map((f) => daysBetween(f.prediction.fertileStart, f.prediction.fertileEnd) + 1))),
    ovulationCaught: round2(
      mean(
        all.map((f) =>
          f.trueOvulation >= f.prediction.fertileStart && f.trueOvulation <= f.prediction.fertileEnd ? 1 : 0,
        ),
      ),
    ),
  };
}

export function scoreAll(people = PEOPLE_PER_ARCHETYPE): ArchetypeScore[] {
  return ARCHETYPES.map((a) => scoreArchetype(a, people));
}

/** The table docs/cycle/engine-accuracy.md prints. */
export function accuracyTable(scores: readonly ArchetypeScore[]): string {
  const head =
    "| Archetype | Forecasts | In window (all) | In window (after 8) | Avg miss, days (after 8) | ± days | Fertile days | True ovulation inside |";
  const rule = "|---|---|---|---|---|---|---|---|";
  const rows = scores.map(
    (s) =>
      `| ${s.label} | ${s.n} | ${s.hitRate.toFixed(2)} | ${s.hitRateSettled.toFixed(2)} | ${s.meanErrorSettled.toFixed(
        2,
      )} | ${s.meanHalfWidth.toFixed(1)} | ${s.meanFertileDays.toFixed(1)} | ${s.ovulationCaught.toFixed(2)} |`,
  );
  return [head, rule, ...rows].join("\n");
}
