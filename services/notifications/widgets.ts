/**
 * services/notifications/widgets.ts
 *
 * The home-screen widget's data contract.
 *
 * Welliva keeps ONE compact snapshot of "today's habits" in storage. The app
 * rewrites it whenever habit state changes (HabitsContext), and a notification
 * action patches it directly — so a habit completed from the lock screen, with
 * the app never opened, still leaves the widget's source of truth correct.
 *
 * ⚠️ Boundary note: the native widget target (WidgetKit on iOS / Glance on
 * Android) is NOT part of this Expo project yet — it needs its own native target
 * plus a config plugin, and on iOS the snapshot has to be mirrored into an App
 * Group container that the extension can read. Everything up TO that boundary is
 * finished here: the snapshot is always current and `refreshWidgets()` is the one
 * place the redraw poke belongs. Until a host registers itself via
 * {@link setWidgetHost}, the poke is a no-op and nothing else changes.
 *
 * Deliberately free of `react-native` imports so it stays loadable under the Node
 * test runner; the native lookup is injected by the caller instead.
 */
import { readJSON, writeJSON } from "../OfflineStorage";

const WIDGET_SNAPSHOT_KEY = "@welliva_widget_snapshot";

/** One habit as the widget renders it. */
export interface WidgetHabitItem {
  id: string;
  name: string;
  /** Ionicons glyph — the widget maps it to its own asset set. */
  icon: string;
  color: string;
  streak: number;
  doneToday: boolean;
  /** False on a day the habit isn't scheduled — widgets grey these out. */
  scheduledToday: boolean;
}

export interface WidgetSnapshot {
  /** Local YYYY-MM-DD the snapshot describes. */
  date: string;
  /** Scheduled habits completed today. */
  completed: number;
  /** Scheduled habits today (the progress bar's denominator). */
  total: number;
  habits: WidgetHabitItem[];
  /** ISO instant of the last write, so a stale snapshot is detectable. */
  updatedAt: string;
}

/** A native module able to force widget timelines to redraw. */
export interface WidgetHost {
  reload: () => void | Promise<void>;
}

let host: WidgetHost | null = null;

/**
 * Register the native widget host. Called once from the React layer, which is
 * the only place allowed to touch `NativeModules`. Pass null to unregister.
 */
export function setWidgetHost(next: WidgetHost | null): void {
  host = next;
}

export function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  return readJSON<WidgetSnapshot | null>(WIDGET_SNAPSHOT_KEY, null);
}

/** Replace the snapshot wholesale — the app's normal path. */
export async function writeWidgetSnapshot(
  snapshot: Omit<WidgetSnapshot, "updatedAt">,
): Promise<void> {
  try {
    await writeJSON(WIDGET_SNAPSHOT_KEY, {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    } satisfies WidgetSnapshot);
  } catch {
    // A stale widget must never break a habit write.
  }
}

/**
 * Mark one habit done inside the stored snapshot, without recomputing the rest.
 * This is the background path: a "Mark as Done" tap has no React tree and no
 * derived state to lean on, so it patches the row it knows changed and bumps the
 * counters. The next foreground render overwrites it with fully-derived truth.
 *
 * No-ops when the snapshot is missing, is for another day, or already has the
 * habit done — so it stays idempotent under a re-delivered notification response.
 */
export async function patchWidgetHabitDone(
  habitId: string,
  date: string,
  streak: number,
): Promise<void> {
  try {
    const snap = await readWidgetSnapshot();
    if (!snap || snap.date !== date) return;
    const row = snap.habits.find((h) => h.id === habitId);
    if (!row || row.doneToday) return;

    const habits = snap.habits.map((h) =>
      h.id === habitId ? { ...h, doneToday: true, streak } : h,
    );
    await writeWidgetSnapshot({
      date: snap.date,
      habits,
      total: snap.total,
      completed: Math.min(snap.total, snap.completed + (row.scheduledToday ? 1 : 0)),
    });
  } catch {
    // fail-soft
  }
}

/**
 * Ask the OS to redraw the home-screen widgets. No-op until a native host is
 * registered (see the boundary note at the top of this file).
 */
export async function refreshWidgets(): Promise<void> {
  try {
    await host?.reload();
  } catch {
    // fail-soft
  }
}
