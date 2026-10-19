/**
 * INSIGHT LEDGER — which of Gozlin's insights the user has opened, and what they
 * said.
 *
 * An insight behaves like a notification: it sits on Home until it is opened,
 * and once it has been opened it does not come back until there is a NEW one to
 * show. This is the record that makes "opened" something the app can remember —
 * before it existed the Home cards were rebuilt from live data on every render,
 * so there was nothing to mark and nothing to list.
 *
 * It is also the archive. Each entry keeps the card as the user read it (title,
 * message, tone, icon), because the live engine no longer says the same thing a
 * week later. The archive is a Pro surface (`insight-history`); RECORDING is not
 * gated, so a user who upgrades finds their history already there.
 *
 * ── WHAT COUNTS AS "A NEW INSIGHT" ─────────────────────────────────────────
 *
 * The cards come from two very different sources, and one rule cannot fit both:
 *
 *  • LEARNED FINDINGS (the habit-awareness patterns, the weekly insight) are
 *    facts about the user that hold for weeks. Their identity is their CONTENT:
 *    the same sentence is the same insight, however many days it stays true,
 *    and the weekly card and the carousel card carrying one finding are ONE
 *    insight (opening either files both). A changed sentence is a new insight.
 *
 *  • TODAY'S PACING CARDS ("Hydration is behind", "Today: Upper body") are about
 *    the day, not the person. Their identity is the card and the DATE: opened
 *    today, quiet for the rest of today, and eligible again tomorrow if it is
 *    still true — which is a new occurrence, not a repeat.
 *
 *  • A RETIRED-HABIT beat already carries its fact's id, which is permanent.
 *
 * ── THE CAP IS A TRADE-OFF, STATED ─────────────────────────────────────────
 *
 * 100 entries, newest kept. Eviction also forgets "already opened" for a
 * content-keyed finding, so a pattern that stays true for longer than the last
 * hundred openings could come back once as if new. That needs a heavy user and a
 * very stable pattern, and the cost is one repeat card; a second, uncapped
 * "seen" set would double the storage and the sync surface to prevent it.
 *
 * ── SYNC ───────────────────────────────────────────────────────────────────
 *
 * Synced like Gozlin's other memory (a read on the phone is read on the tablet),
 * merged per entry by key — see services/sync/mergeStrategies.ts. Lives in the
 * `@gozlin_` namespace and is listed in GozlinMemoryStore's key table, so
 * "Clear memory" removes it with the rest.
 */

import { readJSON, writeJSON } from "../OfflineStorage";

export const INSIGHT_LEDGER_KEY = "@gozlin_insight_ledger";

/** How many opened insights the archive keeps. */
export const LEDGER_CAP = 100;

const RETIRED_PREFIX = "gozlin-retired-";

/**
 * The part of a coach card the ledger needs. Structural, so this module does not
 * import from components/ — `CoachCard` satisfies it as it stands.
 */
export interface LedgerCard {
  id: string;
  type: string;
  tone: "positive" | "nudge" | "warning";
  icon: string;
  title: string;
  message: string;
  priority: number;
  isHabit?: boolean;
}

export interface InsightEntry {
  /** Identity of the insight — see {@link insightKey}. */
  key: string;
  /** The card, as it was read. */
  card: LedgerCard;
  /** ISO time it was first opened. Never rewritten by a reopen. */
  openedAt: string;
}

/** A short stable fingerprint of a string (djb2). Not security — just identity. */
function fingerprint(text: string): string {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * The identity of an insight. `today` is the caller's local YYYY-MM-DD — passed
 * in so this stays pure and agrees with the app's own clock.
 */
export function insightKey(card: LedgerCard, today: string): string {
  if (card.id.startsWith(RETIRED_PREFIX)) return card.id;
  if (card.isHabit) return `habit:${fingerprint(`${card.title}|${card.message}`)}`;
  return `${card.id}:${today}`;
}

/** Has this insight already been opened? */
export function isInsightSeen(
  ledger: readonly InsightEntry[],
  card: LedgerCard,
  today: string,
): boolean {
  const key = insightKey(card, today);
  return ledger.some((e) => e.key === key);
}

/** Only the cards that have not been opened yet, order preserved. */
export function unseenCards<T extends LedgerCard>(
  cards: readonly T[],
  ledger: readonly InsightEntry[],
  today: string,
): T[] {
  if (ledger.length === 0) return [...cards];
  const seen = new Set(ledger.map((e) => e.key));
  return cards.filter((c) => !seen.has(insightKey(c, today)));
}

/**
 * The ledger with `card` filed in. Returns the SAME array when the insight is
 * already there — a reopen from the archive must not move it or restamp it, and
 * callers use identity to skip a pointless write.
 */
export function recordOpened(
  ledger: readonly InsightEntry[],
  card: LedgerCard,
  today: string,
  now: Date = new Date(),
): readonly InsightEntry[] {
  const key = insightKey(card, today);
  if (ledger.some((e) => e.key === key)) return ledger;
  const entry: InsightEntry = {
    key,
    card: {
      id: card.id,
      type: card.type,
      tone: card.tone,
      icon: card.icon,
      title: card.title,
      message: card.message,
      priority: card.priority,
      ...(card.isHabit ? { isHabit: true } : {}),
    },
    openedAt: now.toISOString(),
  };
  return [entry, ...ledger]
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, LEDGER_CAP);
}

// ── Storage ────────────────────────────────────────────────────────────────

/** Newest first. Anything that is not a well-formed entry is dropped, not trusted. */
export async function loadLedger(): Promise<InsightEntry[]> {
  const raw = await readJSON<unknown>(INSIGHT_LEDGER_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is InsightEntry =>
      !!e &&
      typeof e.key === "string" &&
      typeof e.openedAt === "string" &&
      !!e.card &&
      typeof e.card.title === "string" &&
      typeof e.card.message === "string",
  );
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Re-read when the ledger changes — Home, the menu and Memory each hold a copy. */
export function subscribeLedger(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called after any write here, and by clearGozlinMemory. */
export function announceLedger(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.error("[insight-ledger] subscriber failed:", e);
    }
  }
}

/**
 * Writes are serialised: opening two cards in quick succession must not have
 * both read the same list and the second write drop the first.
 */
let queue: Promise<unknown> = Promise.resolve();

/** File `card` as opened. Idempotent per insight. */
export function openInsight(
  card: LedgerCard,
  today: string,
  now: Date = new Date(),
): Promise<void> {
  const run = queue.then(async () => {
    const current = await loadLedger();
    const next = recordOpened(current, card, today, now);
    if (next === current) return;
    await writeJSON(INSIGHT_LEDGER_KEY, next);
    announceLedger();
  });
  queue = run.catch(() => undefined);
  return run;
}
