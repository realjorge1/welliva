/**
 * services/calendar/device.ts — welliva's own calendar on this phone (the native half).
 *
 * ONE CALENDAR, KEPT ON THIS PHONE. It is created as a LOCAL calendar (Android's
 * `isLocalAccount`), so nothing in it is synced to a Google or any other account
 * — the cycle entries especially must not leave the phone. Calendar apps on the
 * phone show it like any other, and the person can hide or delete it there.
 *
 * Every write goes to that calendar only, and only to entries carrying our tag
 * (./events). The person's own calendars are never written to.
 *
 * ANDROID ONLY for now (an iPhone release isn't planned): iOS needs a calendar
 * source that would sync through iCloud, so there it reports "unavailable".
 * expo-calendar is in every build already (it reads the calendar too), loaded
 * lazily so a surface without it never breaks.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  planCalendarChanges,
  type CalendarChanges,
  type CalendarEventSpec,
  type CalendarScope,
  type ExistingEvent,
} from "./events";

type ExpoCalendar = typeof import("expo-calendar");

/** The id of welliva's calendar on this phone. Device-local (syncKeys prefix). */
export const WELLIVA_CALENDAR_ID_KEY = "@welliva_calendar_id";

/** How the calendar shows in calendar apps; the internal name finds it again. */
const CALENDAR_TITLE = "welliva";
const CALENDAR_NAME = "welliva_app";
const CALENDAR_OWNER = "welliva";
const CALENDAR_COLOR = "#EDB623";

export type CalendarAccess = "granted" | "denied" | "undetermined" | "unavailable";

async function mod(): Promise<ExpoCalendar | null> {
  if (Platform.OS !== "android") return null;
  try {
    return await import("expo-calendar");
  } catch {
    return null;
  }
}

function asAccess(status: string | undefined): CalendarAccess {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function calendarWriteAccess(): Promise<CalendarAccess> {
  const Cal = await mod();
  if (!Cal) return "unavailable";
  try {
    return asAccess((await Cal.getCalendarPermissionsAsync()).status);
  } catch {
    return "unavailable";
  }
}

/** Ask Android for calendar access (read and write are one permission group there). */
export async function requestCalendarWriteAccess(): Promise<CalendarAccess> {
  const Cal = await mod();
  if (!Cal) return "unavailable";
  try {
    return asAccess((await Cal.requestCalendarPermissionsAsync()).status);
  } catch {
    return "unavailable";
  }
}

/** Find welliva's calendar (by the stored id, then by its internal name), or make it. */
async function ensureCalendar(Cal: ExpoCalendar, create: boolean): Promise<string | null> {
  const all = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const stored = await AsyncStorage.getItem(WELLIVA_CALENDAR_ID_KEY).catch(() => null);
  const found =
    all.find((c) => c.id === stored) ??
    all.find((c) => c.name === CALENDAR_NAME && c.ownerAccount === CALENDAR_OWNER);
  if (found) {
    if (found.id !== stored) await AsyncStorage.setItem(WELLIVA_CALENDAR_ID_KEY, found.id).catch(() => {});
    return found.id;
  }
  if (!create) return null;
  const id = await Cal.createCalendarAsync({
    title: CALENDAR_TITLE,
    name: CALENDAR_NAME,
    color: CALENDAR_COLOR,
    entityType: Cal.EntityTypes.EVENT,
    // A LOCAL calendar: lives on this phone, synced to no account.
    source: { isLocalAccount: true, name: CALENDAR_TITLE, type: "LOCAL" } as never,
    ownerAccount: CALENDAR_OWNER,
    accessLevel: Cal.CalendarAccessLevel.OWNER,
    isVisible: true,
    isSynced: true,
  });
  await AsyncStorage.setItem(WELLIVA_CALENDAR_ID_KEY, id).catch(() => {});
  return id;
}

async function readOurs(Cal: ExpoCalendar, calendarId: string, from: Date, to: Date): Promise<ExistingEvent[]> {
  const events = await Cal.getEventsAsync([calendarId], from, to);
  return events
    .filter((e) => e.calendarId === calendarId)
    .map((e) => ({
      id: e.id,
      title: e.title ?? "",
      notes: e.notes ?? "",
      allDay: !!e.allDay,
      start: new Date(e.startDate as string | number | Date).getTime(),
      end: new Date(e.endDate as string | number | Date).getTime(),
    }));
}

function details(s: CalendarEventSpec) {
  return {
    title: s.title,
    notes: s.notes,
    allDay: s.allDay,
    startDate: s.start,
    endDate: s.end,
    // Android requires a zone; all-day entries are pinned to UTC by the provider.
    timeZone: s.allDay ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: [],
  };
}

export interface ApplyResult {
  status: "ok" | "no-access" | "unavailable" | "failed";
  created: number;
  updated: number;
  removed: number;
}

const NOTHING = { created: 0, updated: 0, removed: 0 };

/**
 * Make one scope of welliva's calendar match `wanted` inside [from, to). With no
 * calendar yet and nothing wanted, nothing is created. Never throws.
 */
export async function applyScope(
  scope: CalendarScope,
  wanted: CalendarEventSpec[],
  from: Date,
  to: Date,
): Promise<ApplyResult> {
  const Cal = await mod();
  if (!Cal) return { status: "unavailable", ...NOTHING };
  try {
    if (asAccess((await Cal.getCalendarPermissionsAsync()).status) !== "granted") {
      return { status: "no-access", ...NOTHING };
    }
    const calendarId = await ensureCalendar(Cal, wanted.length > 0);
    if (!calendarId) return { status: "ok", ...NOTHING };
    const changes: CalendarChanges = planCalendarChanges(
      scope,
      await readOurs(Cal, calendarId, from, to),
      wanted,
    );
    for (const id of changes.remove) await Cal.deleteEventAsync(id).catch(() => {});
    for (const { id, spec } of changes.update) await Cal.updateEventAsync(id, details(spec));
    for (const spec of changes.create) await Cal.createEventAsync(calendarId, details(spec));
    return {
      status: "ok",
      created: changes.create.length,
      updated: changes.update.length,
      removed: changes.remove.length,
    };
  } catch {
    return { status: "failed", ...NOTHING };
  }
}

/** Two years either side: wide enough to clear a scope completely when it is switched off. */
export function clearWindow(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 2);
  const to = new Date(now);
  to.setFullYear(to.getFullYear() + 2);
  return { from, to };
}
