/**
 * services/notifications/format.ts
 *
 * Which notification FORMAT this device's pending reminders were laid in.
 *
 * Reminders are baked when scheduled — channel, owner stamp, identifier, data —
 * so a change to any of those only reaches a user whose reminders are re-laid.
 * Bumping {@link NOTIFICATION_FORMAT} makes the reminder runner re-lay every
 * habit reminder once on each device (meals, water and fitness re-lay on every
 * sync anyway). Device-local: it describes THIS device's OS queue.
 *
 *   1 — original (`reminders` channel, random ids, no owner stamp)
 *   2 — heads-up `welliva-reminders` channel, deterministic ids, `data.uid`
 *   3 — SCHEDULE_EXACT_ALARM declared: on Android 12/13 it is granted at install,
 *       so every reminder laid before it (inexact) is re-laid as an exact alarm
 */
import { readJSON, writeJSON } from "../OfflineStorage";

export const NOTIFICATION_FORMAT = 3;
export const NOTIFICATION_FORMAT_KEY = "@welliva_notif_format";

export async function readNotificationFormat(): Promise<number> {
  const v = await readJSON<number>(NOTIFICATION_FORMAT_KEY, 1);
  return typeof v === "number" && Number.isFinite(v) ? v : 1;
}

export async function writeNotificationFormat(v: number): Promise<void> {
  await writeJSON(NOTIFICATION_FORMAT_KEY, v);
}
