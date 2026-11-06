/**
 * services/smart/ledger.ts
 *
 * What the smart layer has SHOWN, and what the user ANSWERED.
 *
 *   · SHOWN (`@welliva_smart_shown`, device-local) — which moment took which
 *     screen's slot on which day. A day's budget is a decision about this phone
 *     on this day; nothing else needs it, and it is pruned to a week.
 *   · ANSWERED (`@welliva_smart_answers`, synced) — every "Move it", "Keep",
 *     "Not now". Merged entry by entry (services/sync/mergeStrategies), so a
 *     question declined on the phone is not asked again on the tablet.
 *
 * Both are held in memory once loaded, and claiming a slot is SYNCHRONOUS
 * against that copy: two screens deciding in the same frame cannot both take
 * the last slot, because the second claim sees the first. The writes to
 * storage follow.
 */
import { readJSON, remove, toLocalDateString, writeJSON } from "../OfflineStorage";
import { shiftDay } from "../commitment";
import { track } from "../telemetry";
import { canClaim } from "./arbiter";
import {
  UNCOUNTED_FEATURES,
  type ShownRecord,
  type SmartAnswer,
  type SmartCandidate,
  type SmartFeature,
  type SmartSurface,
} from "./types";

export const SMART_SHOWN_KEY = "@welliva_smart_shown";
export const SMART_ANSWERS_KEY = "@welliva_smart_answers";

/** Days of the shown log kept. The budget only reads today. */
const SHOWN_KEEP_DAYS = 7;

/** Answers kept, newest first. Cool-downs are months at most. */
export const ANSWERS_CAP = 300;

let shown: ShownRecord[] = [];
let answers: SmartAnswer[] = [];
let ready = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function announce(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  }
}

function isShown(v: unknown): v is ShownRecord {
  const s = v as ShownRecord;
  return !!s && typeof s.date === "string" && typeof s.id === "string" && typeof s.surface === "string";
}

function isAnswer(v: unknown): v is SmartAnswer {
  const a = v as SmartAnswer;
  return !!a && typeof a.id === "string" && typeof a.at === "string" && typeof a.answer === "string";
}

/** Read both records from storage (again). Never throws. */
export async function refreshSmartLedger(): Promise<void> {
  try {
    const [s, a] = await Promise.all([
      readJSON<unknown>(SMART_SHOWN_KEY, []),
      readJSON<unknown>(SMART_ANSWERS_KEY, []),
    ]);
    shown = Array.isArray(s) ? s.filter(isShown) : [];
    answers = Array.isArray(a) ? a.filter(isAnswer) : [];
  } catch {
    // keep what was held; a failed read must not erase the day's budget
  }
  ready = true;
  announce();
}

/** Load once. Later callers share the same read. */
export function ensureSmartLedger(): Promise<void> {
  if (ready) return Promise.resolve();
  if (!loading) loading = refreshSmartLedger().finally(() => (loading = null));
  return loading;
}

export function smartLedgerSnapshot(): {
  ready: boolean;
  shown: readonly ShownRecord[];
  answers: readonly SmartAnswer[];
} {
  return { ready, shown, answers };
}

export function subscribeSmartLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let logged = false;
function persistFailed(e: unknown): void {
  // Background work: one quiet line, never a warning bar on the owner's screen.
  if (logged) return;
  logged = true;
  console.log("[smart] could not save:", e instanceof Error ? e.message : String(e));
}

/**
 * Take `surface`'s slot for `c` today, if the budget allows. Returns false when
 * another moment got there first. Recording the same moment twice is a no-op,
 * so a screen can claim on every visit.
 */
export function claimSmartSlot(
  c: SmartCandidate,
  surface: SmartSurface,
  today: string = toLocalDateString(new Date()),
): boolean {
  if (!ready) return false;
  const todayShown = shown.filter((s) => s.date === today);
  if (todayShown.some((s) => s.id === c.id && s.surface === surface)) return true;
  if (!canClaim(c, surface, todayShown)) return false;

  const firstShowing = !todayShown.some((s) => s.id === c.id);
  const floor = shiftDay(today, -SHOWN_KEEP_DAYS);
  shown = [
    ...shown.filter((s) => s.date >= floor),
    { date: today, id: c.id, feature: c.feature, surface, ...(c.exempt ? { exempt: true } : {}) },
  ];
  void writeJSON(SMART_SHOWN_KEY, shown).catch(persistFailed);
  if (firstShowing && !UNCOUNTED_FEATURES.includes(c.feature)) {
    track("smart_moment", { feature: c.feature, result: "shown" });
  }
  announce();
  return true;
}

/**
 * Remember the user's answer. `coolDownDays` keeps the moment quiet that long
 * (counting today); `value` is whatever the feature needs to judge a re-ask.
 */
export async function answerSmart(input: {
  id: string;
  feature: SmartFeature;
  answer: SmartAnswer["answer"];
  coolDownDays?: number;
  value?: number | string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const entry: SmartAnswer = {
    id: input.id,
    feature: input.feature,
    answer: input.answer,
    at: now.toISOString(),
    ...(input.coolDownDays && input.coolDownDays > 0
      ? { until: shiftDay(today, input.coolDownDays - 1) }
      : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
  };
  await ensureSmartLedger();
  answers = [entry, ...answers.filter((a) => a.id !== input.id)].slice(0, ANSWERS_CAP);
  announce();
  if (!UNCOUNTED_FEATURES.includes(input.feature)) {
    track("smart_moment", {
      feature: input.feature,
      result: input.answer === "accepted" ? "accepted" : "dismissed",
    });
  }
  try {
    await writeJSON(SMART_ANSWERS_KEY, answers);
  } catch (e) {
    persistFailed(e);
  }
}

/** Forget everything about one feature: its data was erased, so these traces go with it. */
export async function forgetSmartFeature(feature: SmartFeature): Promise<void> {
  await ensureSmartLedger();
  shown = shown.filter((s) => s.feature !== feature);
  answers = answers.filter((a) => a.feature !== feature);
  announce();
  try {
    await Promise.all([writeJSON(SMART_SHOWN_KEY, shown), writeJSON(SMART_ANSWERS_KEY, answers)]);
  } catch (e) {
    persistFailed(e);
  }
}

/**
 * Storage was just wiped (sign-out, another account, "Reset data"), so this copy
 * goes too: the next "Not now" would otherwise write the old answers straight back.
 */
export function forgetSmartLedgerMemory(): void {
  shown = [];
  answers = [];
  ready = true;
  announce();
}

/**
 * Forget every answer and showing — "Clear memory". Removed rather than emptied:
 * an empty list merges with the cloud's and brings it all back; a removed key
 * syncs as a deletion.
 */
export async function clearSmartLedger(): Promise<void> {
  forgetSmartLedgerMemory();
  try {
    await Promise.all([remove(SMART_SHOWN_KEY), remove(SMART_ANSWERS_KEY)]);
  } catch (e) {
    persistFailed(e);
  }
}
