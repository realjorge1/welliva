/**
 * health-os/signals/calendar/CalendarSource.ts
 *
 * The device-calendar adapter (Apple Calendar / Google Calendar / any account synced to
 * the OS calendar database). The ONLY code here that touches the native module —
 * imported LAZILY and guarded, so:
 *   • the app still boots where the module isn't present (Expo Go / web) — it reports
 *     `unavailable` and every method degrades to a safe no-op;
 *   • the pure translation (classify.ts) stays unit-testable with zero native deps.
 *
 * Reads are LOCAL-ONLY: events never leave the device. We turn upcoming events into
 * Life Context PROPOSALS (idempotent `cal:<id>`), never silent commits.
 *
 * ⚠️ Requires a dev/prod build to grant calendar permission reliably (not Expo Go).
 * See docs/companion/00-proactive-companion-blueprint.md §3.2 + §7.
 */
import { toLocalDateString } from "../../platform/clock";
import type { LifeContextRepository } from "../../lifecontext";
import { lifeContext as defaultLifeContext } from "../../lifecontext";
import { consent as defaultConsent, type ConsentRepository } from "../../privacy";
import type { SignalPermission, SignalStatus } from "../types";
import { proposeFromCalendar, type RawCalendarEvent } from "./classify";

type ExpoCalendar = typeof import("expo-calendar");

function mapPermission(status: string | undefined): SignalPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

function toStatus(p: SignalPermission): SignalStatus {
  return { permission: p, ready: p === "granted" };
}

/** Subtract a day from an all-day event's exclusive end so the last day is inclusive. */
function inclusiveEndDate(end: Date, allDay: boolean): Date {
  if (!allDay) return end;
  const d = new Date(end);
  d.setDate(d.getDate() - 1);
  return d;
}

export class CalendarSource {
  constructor(
    private readonly lifeContext: LifeContextRepository = defaultLifeContext,
    /** Consent gate — reads are a no-op unless the "calendar" category is granted. */
    private readonly consent: ConsentRepository = defaultConsent,
  ) {}

  /** Lazily load expo-calendar; null when the module isn't in this build. */
  private async mod(): Promise<ExpoCalendar | null> {
    try {
      return await import("expo-calendar");
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<SignalStatus> {
    const Calendar = await this.mod();
    if (!Calendar) return toStatus("unavailable");
    try {
      const res = await Calendar.getCalendarPermissionsAsync();
      return toStatus(mapPermission(res.status));
    } catch {
      return toStatus("unavailable");
    }
  }

  /** Prompt for calendar access. Returns the resulting status. */
  async requestAccess(): Promise<SignalStatus> {
    const Calendar = await this.mod();
    if (!Calendar) return toStatus("unavailable");
    try {
      const res = await Calendar.requestCalendarPermissionsAsync();
      return toStatus(mapPermission(res.status));
    } catch {
      return toStatus("unavailable");
    }
  }

  /** Read upcoming events across all calendars, normalized to local dates. */
  async readUpcoming(days = 120, now: Date = new Date()): Promise<RawCalendarEvent[]> {
    // Consent gate (defense in depth): no native read without the granted category.
    if (!(await this.consent.isGranted("calendar"))) return [];
    const Calendar = await this.mod();
    if (!Calendar) return [];
    try {
      const perm = await Calendar.getCalendarPermissionsAsync();
      if (mapPermission(perm.status) !== "granted") return [];

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const ids = calendars.map((c) => c.id);
      if (ids.length === 0) return [];

      const end = new Date(now);
      end.setDate(end.getDate() + days);
      const events = await Calendar.getEventsAsync(ids, now, end);

      return events.map((e): RawCalendarEvent => {
        const start = new Date(e.startDate as string | number | Date);
        const rawEnd = new Date(e.endDate as string | number | Date);
        const allDay = !!e.allDay;
        return {
          id: e.id,
          title: e.title ?? "",
          startDate: toLocalDateString(start),
          endDate: toLocalDateString(inclusiveEndDate(rawEnd, allDay)),
          allDay,
          location: e.location || undefined,
          notes: e.notes || undefined,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Read upcoming events and file them as Life Context proposals. Idempotent: a second
   * sync re-adds the same `cal:<id>`s as no-ops. Returns how many entries now exist
   * from the calendar (added or already present).
   */
  async syncToLifeContext(
    opts: { days?: number; now?: Date } = {},
  ): Promise<{ proposed: number }> {
    const now = opts.now ?? new Date();
    const events = await this.readUpcoming(opts.days ?? 120, now);
    const proposals = proposeFromCalendar(events, toLocalDateString(now));
    for (const p of proposals) {
      try {
        await this.lifeContext.add(p, now);
      } catch {
        // skip a single malformed event; keep importing the rest
      }
    }
    return { proposed: proposals.length };
  }
}

/** The default, app-wide calendar source. */
export const calendarSource = new CalendarSource();
