/**
 * services/checks/store.ts — which "worth mentioning to a doctor" notes were put away.
 *
 * One small document: note id → the signature that was dismissed and the day.
 * services/checks/doctorNotes decides what that means (visibleNotes). It syncs
 * like any other app key (services/sync/syncKeys), so "Got it" on one phone is
 * "Got it" on the next, and account erasure takes it with everything else.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DismissedNotes, HealthNoteId } from "./doctorNotes";

export const HEALTH_NOTES_KEY = "@welliva_health_notes";

type Listener = (next: DismissedNotes) => void;
const listeners = new Set<Listener>();

export function subscribeDismissedNotes(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function loadDismissedNotes(): Promise<DismissedNotes> {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_NOTES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as DismissedNotes) : {};
  } catch {
    return {};
  }
}

export async function dismissHealthNote(id: HealthNoteId, signature: string, today: string): Promise<void> {
  const current = await loadDismissedNotes();
  const next: DismissedNotes = { ...current, [id]: { signature, on: today } };
  try {
    await AsyncStorage.setItem(HEALTH_NOTES_KEY, JSON.stringify(next));
  } catch (e) {
    console.log("[checks] could not save a dismissed note", e);
  }
  for (const fn of [...listeners]) {
    try {
      fn(next);
    } catch {
      // one bad listener must not stop the others
    }
  }
}
