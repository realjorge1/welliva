/**
 * services/smart/usual.ts
 *
 * "YOUR USUAL?" — one tap to log the meal someone eats again and again.
 *
 *   "Your usual breakfast? Oats with milk · coffee · about 420 kcal"  [Log it]
 *
 * A USUAL is the same set of foods, logged under the same meal, on at least
 * {@link USUAL_MIN_DAYS} of the last {@link USUAL_WINDOW_DAYS} days and at least
 * once in the last {@link USUAL_RECENT_DAYS}. "The same set" is a fingerprint
 * of every item's identity and amount, order ignored — the same oats at a
 * different weight is a different breakfast. One usual per meal at most: the
 * most frequent, the most recent on a tie.
 *
 * What gets logged is the most recent occurrence, EXACTLY as it was recorded —
 * the same items, the same numbers, the same confidence labels. Nothing is
 * looked up again, so the usual can never quietly become a different meal.
 *
 * Not offered:
 *   · for a meal the person normally ticks off their PLAN — the plan's own
 *     "Ate it" already covers it; the usual is for people who log freely;
 *   · for snacks — a day holds several, with no hour of their own (the same
 *     rule the navigation bar keeps: snacks never drive it);
 *   · for a usual they said is not their usual any more — until it has been
 *     eaten {@link USUAL_MIN_DAYS} more times since.
 *
 * Pure: types only, no storage.
 */
import type { MealType } from "../../models/diet";
import type { NutrientConfidence, NutrientKey, NutrientPanel, ResolvedFoodItem } from "../../models/nutrients";
import { shiftDay } from "../commitment";
import type { IntakeLedger } from "../nutrition/IntakeLedger";
import type { FoodLogEntry, LogStore } from "../nutrition/foodLogStore";
import { isConsistent, readRoutine, wallClockOf } from "../routine/clock";

/** A usual is a fortnight's habit. */
export const USUAL_WINDOW_DAYS = 14;

/** Three times in two weeks is a pattern; twice is a coincidence. */
export const USUAL_MIN_DAYS = 3;

/** And at least once this week — or it's a memory, not a usual. */
export const USUAL_RECENT_DAYS = 7;

/** A slot ticked from the plan on half the days it was eaten belongs to the plan. */
export const PLAN_FOLLOWER_SHARE = 0.5;

/** Logged at scattered times, there is no "usual time" to appear around. */
export const USUAL_TIME_SPREAD_MINUTES = 90;

export type UsualSlot = Extract<MealType, "breakfast" | "lunch" | "dinner">;
export const USUAL_SLOTS: readonly UsualSlot[] = ["breakfast", "lunch", "dinner"];

/** One logged entry, as it was recorded — everything except where and when. */
export interface UsualEntry {
  label: string;
  items: ResolvedFoodItem[];
  totals: NutrientPanel;
  partialKeys: NutrientKey[];
  confidence: NutrientConfidence;
  origin: FoodLogEntry["origin"];
}

export interface Usual {
  /** `usual:<slot>:<hash>` — stable while the set of foods is. */
  id: string;
  slot: UsualSlot;
  fingerprint: string;
  /** Days in the window it was eaten. */
  days: number;
  windowDays: number;
  lastDate: string;
  /** The most recent occurrence, in the order it was logged. */
  entries: UsualEntry[];
  /** Sum of the entries' calories — null unless every entry measured them. */
  calories: number | null;
  /** When it is usually logged (minutes after midnight), when that is steady. */
  usualMinute: number | null;
}

/** "I said this isn't my usual any more" — synced, so it holds on every phone. */
export interface ForgottenUsual {
  id: string;
  /** UTC ISO time it was forgotten. */
  at: string;
}

const norm = (s: string): string => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** One item's identity and amount: what makes two breakfasts "the same". */
export function itemKey(item: Pick<ResolvedFoodItem, "foodId" | "inputText" | "name" | "grams" | "quantity" | "unit">): string {
  const who = item.foodId ? `id:${item.foodId}` : `t:${norm(item.inputText || item.name)}`;
  const amount =
    Number.isFinite(item.grams) && item.grams > 0
      ? `${Math.round(item.grams)}g`
      : `${Math.round((item.quantity ?? 0) * 100) / 100}${norm(item.unit)}`;
  return `${who}@${amount}`;
}

/** The fingerprint of a meal's entries — every item, sorted. Null when empty. */
export function fingerprintOf(entries: readonly Pick<FoodLogEntry, "items">[]): string | null {
  const keys = entries.flatMap((e) => (e.items ?? []).map(itemKey)).sort();
  return keys.length > 0 ? keys.join("|") : null;
}

/** A short stable hash of a fingerprint (djb2), for ids. */
export function usualHash(fingerprint: string): string {
  let h = 5381;
  for (let i = 0; i < fingerprint.length; i++) h = ((h << 5) + h + fingerprint.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const usualId = (slot: UsualSlot, fingerprint: string): string =>
  `usual:${slot}:${usualHash(fingerprint)}`;

/** Is every item of `wanted` already among `have` (counting repeats)? */
export function containsAll(have: readonly string[], wanted: readonly string[]): boolean {
  const left = new Map<string, number>();
  for (const k of have) left.set(k, (left.get(k) ?? 0) + 1);
  for (const k of wanted) {
    const n = left.get(k) ?? 0;
    if (n === 0) return false;
    left.set(k, n - 1);
  }
  return true;
}

function toEntry(e: FoodLogEntry): UsualEntry {
  return {
    label: e.label,
    items: e.items,
    totals: e.totals,
    partialKeys: e.partialKeys ?? [],
    confidence: e.confidence,
    origin: e.origin,
  };
}

/** Local date a forget happened on, from its UTC stamp. */
function forgotOn(at: string): string | null {
  return wallClockOf(at)?.date ?? null;
}

/** The usual for each meal that has one, in breakfast → dinner order. */
export function findUsuals(input: {
  foodLog: LogStore;
  intake: IntakeLedger;
  forgotten: readonly ForgottenUsual[];
  today: string;
}): Usual[] {
  const { foodLog, intake, forgotten, today } = input;
  const dates: string[] = [];
  for (let i = 0; i < USUAL_WINDOW_DAYS; i++) dates.push(shiftDay(today, -i));
  const recentFloor = shiftDay(today, -(USUAL_RECENT_DAYS - 1));
  const forgottenOn = new Map<string, string>();
  for (const f of forgotten) {
    const d = forgotOn(f.at);
    if (d && (!forgottenOn.has(f.id) || d > forgottenOn.get(f.id)!)) forgottenOn.set(f.id, d);
  }

  const out: Usual[] = [];
  for (const slot of USUAL_SLOTS) {
    const byPrint = new Map<string, { date: string; entries: FoodLogEntry[] }[]>();
    const planDays = new Set<string>();
    const eatenDays = new Set<string>();

    for (const date of dates) {
      const ticked = (intake?.[date] ?? []).some((r) => r?.slot === slot);
      const logged = (foodLog?.[date] ?? []).filter((e) => e?.slot === slot);
      if (ticked) planDays.add(date);
      if (ticked || logged.length > 0) eatenDays.add(date);
      const print = fingerprintOf(logged);
      if (!print) continue;
      const list = byPrint.get(print) ?? [];
      list.push({ date, entries: [...logged].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)) });
      byPrint.set(print, list);
    }

    // The plan's meal, ticked on half the days or more: "Ate it" is its button.
    if (planDays.size > 0 && planDays.size >= PLAN_FOLLOWER_SHARE * eatenDays.size) continue;

    let best: Usual | null = null;
    for (const [print, all] of byPrint) {
      const id = usualId(slot, print);
      const floor = forgottenOn.get(id);
      const days = floor ? all.filter((o) => o.date > floor) : all;
      if (days.length < USUAL_MIN_DAYS) continue;
      if (!days.some((o) => o.date >= recentFloor)) continue;
      const latest = days.reduce((a, b) => (b.date > a.date ? b : a));
      if (best && (days.length < best.days || (days.length === best.days && latest.date <= best.lastDate))) {
        continue;
      }
      const entries = latest.entries.map(toEntry);
      const cals = entries.map((e) => e.totals?.calories);
      const reading = readRoutine(
        days.map((o) => ({ date: o.date, at: o.entries[0].loggedAt })),
        today,
        { windowDays: USUAL_WINDOW_DAYS, minCount: USUAL_MIN_DAYS },
      );
      best = {
        id,
        slot,
        fingerprint: print,
        days: days.length,
        windowDays: USUAL_WINDOW_DAYS,
        lastDate: latest.date,
        entries,
        calories: cals.every((c) => typeof c === "number" && Number.isFinite(c))
          ? (cals as number[]).reduce((s, c) => s + c, 0)
          : null,
        usualMinute: isConsistent(reading, USUAL_TIME_SPREAD_MINUTES) ? reading.medianMinute : null,
      };
    }
    if (best) out.push(best);
  }
  return out;
}

const SLOT_WORD: Record<UsualSlot, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };

/** The entries' own words, in the order they were logged. */
export function usualLabels(u: Pick<Usual, "entries">): string[] {
  return u.entries.map((e) => e.label.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** "Your usual breakfast? Oats with milk · coffee · about 420 kcal" */
export function usualMessage(u: Usual): string {
  const parts = usualLabels(u);
  const kcal = u.calories != null ? [`about ${Math.round(u.calories / 10) * 10} kcal`] : [];
  const what = [...parts, ...kcal].join(" · ");
  return `Your usual ${SLOT_WORD[u.slot]}? ${what.charAt(0).toUpperCase()}${what.slice(1)}`;
}

/** The scope it was read from, and the promise about the numbers. */
export function usualSource(u: Usual): string {
  return `Logged on ${u.days} of your last ${u.windowDays} days. Logs the same amounts as last time.`;
}

/** The lock-screen body: "Your usual? Oats with milk, coffee". */
export function usualReminderBody(u: Pick<Usual, "entries">, max = 90): string {
  const text = `Your usual? ${usualLabels(u).join(", ")}`;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// ── the lock-screen snapshot ────────────────────────────────────────

/**
 * What a meal reminder carries so its "Had my usual" button can log without
 * the app: the usual's id, its fingerprint and the entries exactly as they
 * were recorded. The headless handler never resolves a food.
 */
export interface UsualSnapshot {
  id: string;
  slot: UsualSlot;
  fingerprint: string;
  /** When it was taken — a later "not my usual" outranks it. */
  madeAt: string;
  entries: UsualEntry[];
}

export function snapshotOf(u: Usual, now: Date = new Date()): UsualSnapshot {
  return {
    id: u.id,
    slot: u.slot,
    fingerprint: u.fingerprint,
    madeAt: now.toISOString(),
    // The "did you mean" list is for correcting a log in the app, not part of
    // what was eaten — left out to keep the notification small.
    entries: u.entries.map((e) => ({
      ...e,
      items: e.items.map(({ alternatives: _alternatives, ...item }) => item),
    })),
  };
}

export function isUsualSnapshot(v: unknown): v is UsualSnapshot {
  const s = v as UsualSnapshot;
  return (
    !!s &&
    typeof s.id === "string" &&
    (USUAL_SLOTS as readonly string[]).includes(s.slot) &&
    typeof s.fingerprint === "string" &&
    typeof s.madeAt === "string" &&
    Array.isArray(s.entries) &&
    s.entries.length > 0 &&
    s.entries.every((e) => e && typeof e.label === "string" && Array.isArray(e.items) && !!e.totals)
  );
}
