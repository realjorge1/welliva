/**
 * EXPERIENCE STORE — what they told Gozlin about things they tried, the
 * questions it opened, and the care flags. docs/gozlin/11-trying-something-new.md.
 *
 * Three keys, all in Gozlin's namespace, all wiped by "Clear memory" (they are
 * spread into GozlinMemoryStore's G_KEYS) and all synced like every other
 * memory tier (the owner's call, D5), merged per record rather than
 * overwritten — see services/sync/mergeStrategies.ts.
 *
 * ── FORGETTING IS A TOMBSTONE, NOT A DELETE ─────────────────────────────────
 * Records sync by UNION: two phones each keep what the other never saw. A
 * record simply removed here would come straight back from the other phone on
 * the next merge — "forget" that un-forgets itself is the worst kind of
 * privacy control. So forgetting scrubs every word (quote, answers, label) and
 * leaves a tombstone: the id, `forgotten`, and a newer `updatedAt`, which the
 * merge prefers. Readers never see one.
 *
 * Storage only. Every decision lives in the pure engines (./novelty).
 */

import { readJSON, writeJSON } from "../OfflineStorage";
import type { CareFlag, CareFlagKind } from "./careFlags";
import type { CuriosityEntry, ExperienceRecord } from "./novelty/types";

export const EXPERIENCE_KEYS = {
  EXPERIENCES: "@gozlin_experiences",
  CURIOSITY: "@gozlin_curiosity",
  CARE_FLAGS: "@gozlin_care_flags",
} as const;

/** Newest kept; a memory older than a year is history, not coaching. */
const RECORD_CAP = 300;
const RECORD_MAX_AGE_DAYS = 365;
/** The same length `identityEvidence` clips remembered facts to. */
export const QUOTE_MAX = 140;
/** Only budget and back-off read the log, and neither looks back this far. */
const CURIOSITY_CAP = 200;
const CURIOSITY_MAX_AGE_DAYS = 180;
const CARE_FLAG_CAP = 50;

const DAY = 86_400_000;

/**
 * Their words, clipped — at a word boundary, with an ellipsis, so the stored
 * quote is always a verbatim PREFIX of what they said and never a paraphrase.
 */
export function clipQuote(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= QUOTE_MAX) return t;
  const cut = t.slice(0, QUOTE_MAX - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > QUOTE_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ── Change announcements ───────────────────────────────────────────────────
//
// The coach screen and the Memory screen both hold a copy. A Forget on one must
// reach the other while it is still mounted — the same reason MindService
// announces its writes. Unlike MindService nothing is passed: there are two
// lists and "Clear memory" empties both from outside this module, so a
// subscriber re-reads, which is two small AsyncStorage gets.

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeExperiences(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called after any write here, and by clearGozlinMemory. */
export function announceExperiences(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.error("[experiences] subscriber failed:", e);
    }
  }
}

// ── Experiences ────────────────────────────────────────────────────────────

function pruneRecords(records: ExperienceRecord[], now: Date): ExperienceRecord[] {
  const cutoff = now.getTime() - RECORD_MAX_AGE_DAYS * DAY;
  return records
    .filter((r) => Date.parse(r.updatedAt ?? r.answeredAt) >= cutoff)
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
    .slice(0, RECORD_CAP);
}

/** Every stored record, tombstones included — for writes and for sync. */
async function loadRaw(): Promise<ExperienceRecord[]> {
  const list = await readJSON<ExperienceRecord[]>(EXPERIENCE_KEYS.EXPERIENCES, []);
  return Array.isArray(list) ? list : [];
}

/** What they told us, newest first. Forgotten records are never returned. */
export async function loadExperiences(): Promise<ExperienceRecord[]> {
  return (await loadRaw()).filter((r) => !r.forgotten);
}

/** Add or replace one record (by id). */
export async function saveExperience(
  record: ExperienceRecord,
  now: Date = new Date(),
): Promise<ExperienceRecord[]> {
  const list = await loadRaw();
  const next = pruneRecords([record, ...list.filter((r) => r.id !== record.id)], now);
  await writeJSON(EXPERIENCE_KEYS.EXPERIENCES, next);
  announceExperiences();
  return next.filter((r) => !r.forgotten);
}

/** Stamp that a reply used these memories — starts their recall rest. */
export async function markRecalled(ids: readonly string[], now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return;
  const at = now.toISOString();
  const want = new Set(ids);
  const list = await loadRaw();
  const next = list.map((r) => (want.has(r.id) && !r.forgotten ? { ...r, lastRecalledAt: at, updatedAt: at } : r));
  await writeJSON(EXPERIENCE_KEYS.EXPERIENCES, next);
  announceExperiences();
}

function tombstone(r: ExperienceRecord, at: string): ExperienceRecord {
  return {
    id: r.id,
    kind: r.kind,
    variantKey: "",
    familyKey: "",
    label: "",
    triedOn: null,
    answeredAt: r.answeredAt,
    source: r.source,
    quote: null,
    soreness: null,
    enjoyed: null,
    feelings: [],
    updatedAt: at,
    forgotten: true,
  };
}

/** Forget one record: every word of it goes; a tombstone stays so sync cannot bring it back. */
export async function forgetExperience(id: string, now: Date = new Date()): Promise<ExperienceRecord[]> {
  const at = now.toISOString();
  const next = (await loadRaw()).map((r) => (r.id === id ? tombstone(r, at) : r));
  await writeJSON(EXPERIENCE_KEYS.EXPERIENCES, next);
  announceExperiences();
  return next.filter((r) => !r.forgotten);
}

/** Forget all of them — the Memory screen's "Forget all of these". */
export async function forgetAllExperiences(now: Date = new Date()): Promise<void> {
  const at = now.toISOString();
  const next = (await loadRaw()).map((r) => (r.forgotten ? r : tombstone(r, at)));
  await writeJSON(EXPERIENCE_KEYS.EXPERIENCES, next);
  announceExperiences();
}

// ── The curiosity log ──────────────────────────────────────────────────────

export async function loadCuriosityLog(): Promise<CuriosityEntry[]> {
  const list = await readJSON<CuriosityEntry[]>(EXPERIENCE_KEYS.CURIOSITY, []);
  return Array.isArray(list) ? list : [];
}

/** Add or replace one entry (by id). Returns the pruned log, newest first. */
export async function upsertCuriosity(
  entry: CuriosityEntry,
  now: Date = new Date(),
): Promise<CuriosityEntry[]> {
  const cutoff = now.getTime() - CURIOSITY_MAX_AGE_DAYS * DAY;
  const list = await loadCuriosityLog();
  const next = [entry, ...list.filter((e) => e.id !== entry.id)]
    .filter((e) => Date.parse(e.openedAt) >= cutoff)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, CURIOSITY_CAP);
  await writeJSON(EXPERIENCE_KEYS.CURIOSITY, next);
  announceExperiences();
  return next;
}

// ── Care flags ─────────────────────────────────────────────────────────────

export async function loadCareFlags(): Promise<CareFlag[]> {
  const list = await readJSON<CareFlag[]>(EXPERIENCE_KEYS.CARE_FLAGS, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Remember that a signal happened — its kind and when, never the words. One a
 * day is enough to know it happened; more would only be a count of someone's
 * worst days.
 */
export async function recordCareFlag(kind: CareFlagKind, now: Date = new Date()): Promise<void> {
  const list = await loadCareFlags();
  const today = now.toISOString().slice(0, 10);
  if (list.some((f) => f.kind === kind && f.at.slice(0, 10) === today)) return;
  const next = [{ kind, at: now.toISOString() }, ...list]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, CARE_FLAG_CAP);
  await writeJSON(EXPERIENCE_KEYS.CARE_FLAGS, next);
}
