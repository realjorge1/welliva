/**
 * MindService — the ONE write path for a state-of-mind entry.
 *
 * ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
 * Check-ins used to be written by `addCheckin` alone, straight into
 * `@gozlin_checkins`, and that was the end of them. health-os has had a
 * first-class `checkin.logged` event type the whole time — compaction folds it
 * into a DaySummary, the learning engine reads sleep off it, Memory Center
 * renders it as a timeline row — but the ONLY thing that ever produced one was
 * migration 001, the one-time backfill.
 *
 * The migration runner skips anything at or below the stored schema version
 * (see platform/migrations/runner.ts), so 001 runs exactly once. Every check-in
 * saved after that commit existed only in the Gozlin store: invisible to the
 * timeline, to compaction, to the Memory Center and to the learning loop. Mood
 * was being collected into a dead end.
 *
 * So writing an entry is two writes, and they belong behind one function rather
 * than at each call site — which is how they came apart in the first place.
 *
 * ── ORDERING ────────────────────────────────────────────────────────────────
 * The Gozlin store is written FIRST and is the one that decides success. It is
 * what the sheet reads back, what the habit engine reads, and what the user
 * would call "my check-in". The timeline append is the derived record; if it
 * throws (a corrupt partition, a full disk) the entry is still saved and the
 * next backfill can recover the event, whereas the reverse ordering would give
 * us an event for an entry the user cannot see. The append failure is logged,
 * never rethrown — a mood entry must not fail to save because a downstream
 * index was unhappy.
 *
 * ── EVENT IDS ───────────────────────────────────────────────────────────────
 * `TimelineRepository.append` is idempotent on `id`, so the event id is derived
 * deterministically from the entry id AND its `createdAt`. A retry of the same
 * save is therefore a no-op, while a genuine edit (which re-stamps `createdAt`)
 * appends a new event that supersedes the old one by recency — compaction reads
 * the day's LAST checkin event, which is the correction-by-append the timeline
 * is designed around.
 */
import { buildEvent, timeline, ulidFromSeed, type CheckinPayload } from "@/health-os";

import { addCheckin, removeCheckin } from "./GozlinMemoryStore";
import type { GozlinCheckin } from "./gozlin.types";
import { clampValence, type MindKind } from "./mind";

/* ───────────────────────── change notification ─────────────────────────── */

/**
 * The sheet lives in the Deck, which is mounted globally — so an entry can be
 * saved while /logs is the screen you are looking at, and /logs is a (tabs)
 * screen whose effects run once per launch. Without a notification the row you
 * just wrote would be missing from the very screen you wrote it from until the
 * tab was left and re-entered, which is the same class of bug as the check-in
 * being absent from Logs in the first place.
 *
 * A focus effect does not cover it, because focus never changes. So the one
 * write path announces itself, and any screen holding a copy of the list can
 * keep it honest. Deliberately tiny: a Set of callbacks, no payload negotiation,
 * no context — the list itself is passed, so a subscriber never has to re-read.
 */
type MindListener = (entries: GozlinCheckin[]) => void;
const listeners = new Set<MindListener>();

export function subscribeMindEntries(fn: MindListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function announce(entries: GozlinCheckin[]): void {
  for (const fn of listeners) {
    try {
      fn(entries);
    } catch (e) {
      // One bad subscriber must not stop the others, or block the save.
      console.error("[mind] subscriber failed:", e);
    }
  }
}

export interface MindEntryInput {
  /** Local date, YYYY-MM-DD. */
  date: string;
  kind: MindKind;
  /** −1 … +1. Clamped on the way in. */
  valence: number;
  labels?: string[];
  associations?: string[];
  /** Daily entries only — sleep is a night, not a moment. */
  sleepHours?: number;
  note?: string;
  /** Set when editing an existing entry; omit to create a new one. */
  id?: string;
}

/**
 * A daily entry's id is its date, so re-logging the day updates in place even
 * if the sheet was opened twice. A momentary one needs to be unique per moment.
 */
export function mindEntryId(date: string, kind: MindKind): string {
  return kind === "daily"
    ? `daily:${date}`
    : `moment:${date}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Build the stored record from sheet input. Pure — exported for tests. */
export function toMindEntry(input: MindEntryInput): GozlinCheckin {
  const kind = input.kind;
  const labels = input.labels?.filter(Boolean) ?? [];
  const associations = input.associations?.filter(Boolean) ?? [];
  return {
    id: input.id ?? mindEntryId(input.date, kind),
    date: input.date,
    kind,
    valence: clampValence(input.valence),
    ...(labels.length ? { labels } : {}),
    ...(associations.length ? { associations } : {}),
    // Sleep belongs to the night behind a daily entry; a momentary entry that
    // carried one would be claiming a fact about a different span of time.
    ...(kind === "daily" && input.sleepHours != null
      ? { sleepHours: input.sleepHours }
      : {}),
    ...(input.note ? { note: input.note } : {}),
    createdAt: Date.now(),
  };
}

function toPayload(entry: GozlinCheckin): CheckinPayload {
  return {
    kind: entry.kind,
    valence: entry.valence,
    ...(entry.labels?.length ? { labels: entry.labels } : {}),
    ...(entry.associations?.length ? { associations: entry.associations } : {}),
    ...(entry.sleepHours != null ? { sleepHours: entry.sleepHours } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  };
}

/**
 * Persist a state-of-mind entry and mirror it onto the Timeline.
 * Returns the full, pruned entry list — what the caller renders next.
 */
export async function recordMindEntry(
  input: MindEntryInput,
): Promise<GozlinCheckin[]> {
  const entry = toMindEntry(input);
  const list = await addCheckin(entry);

  try {
    await timeline.append(
      buildEvent<CheckinPayload>({
        id: ulidFromSeed(`checkin:${entry.id}:${entry.createdAt}`),
        type: "checkin.logged",
        source: "user",
        localDate: entry.date,
        payload: toPayload(entry),
      }),
    );
  } catch (e) {
    // The entry is saved. The timeline is a derived index, and a mood log must
    // not appear to fail because that index did.
    console.error("[mind] timeline append failed:", e);
  }

  announce(list);
  return list;
}

/** Delete an entry. The timeline event is redacted, not erased, per L1 rules. */
export async function deleteMindEntry(
  entry: GozlinCheckin,
): Promise<GozlinCheckin[]> {
  const list = await removeCheckin(entry.id ?? `${entry.date}:${entry.kind ?? "daily"}`);
  try {
    await timeline.redact(ulidFromSeed(`checkin:${entry.id}:${entry.createdAt}`));
  } catch (e) {
    console.error("[mind] timeline redact failed:", e);
  }
  announce(list);
  return list;
}
