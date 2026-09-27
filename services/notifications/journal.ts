/**
 * services/notifications/journal.ts
 *
 * FROM YOUR LOCK SCREEN — a short, device-local record of what the notification
 * buttons actually did.
 *
 * The write itself lands in the real stores (habit logs, the intake ledger,
 * today's water), which is what every screen and Gozlin read. This journal is
 * the RECEIPT: the Notifications screen shows it so a user who pressed "Ate it"
 * on a locked phone at 1pm can see, later, that it was counted — and, just as
 * important, when a press could NOT be counted and why. A button that fails
 * silently is worse than no button.
 *
 * Bounded (newest {@link JOURNAL_MAX}) and device-local: it describes presses on
 * THIS phone, and the data it points at syncs on its own.
 */
import { readJSON, writeJSON } from "../OfflineStorage";

export const JOURNAL_KEY = "@welliva_notif_journal";
export const JOURNAL_MAX = 40;

export type JournalKind = "habit" | "meal" | "water";

export interface JournalEntry {
  /** Stable id — the response key that produced it. */
  id: string;
  kind: JournalKind;
  /** ISO time the button was pressed (handled). */
  at: string;
  /** Local YYYY-MM-DD the write was FOR — the reminder's fire date. */
  date: string;
  /** "Meditate", "Grilled chicken salad", "Water". */
  title: string;
  /** "Marked done · 6-day streak", "Logged to lunch", "+250 ml". */
  detail: string;
  /** False when the press could not be counted; `detail` says why. */
  ok: boolean;
}

export async function readJournal(): Promise<JournalEntry[]> {
  const stored = await readJSON<JournalEntry[]>(JOURNAL_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

/** Prepend one entry, de-duplicated by id, keeping the newest {@link JOURNAL_MAX}. */
export async function appendJournal(entry: JournalEntry): Promise<void> {
  const current = await readJournal();
  const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(
    0,
    JOURNAL_MAX,
  );
  await writeJSON(JOURNAL_KEY, next);
}
