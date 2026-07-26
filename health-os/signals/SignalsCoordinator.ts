/**
 * health-os/signals/SignalsCoordinator.ts
 *
 * The one place that drives the external senses on boot and at day-rollover. It is
 * consent- AND permission-gated end to end: a source only runs when the user has granted
 * its consent category AND the OS permission is ready. Everything degrades to a no-op
 * (Expo Go, web, denied, offline), so calling this is always safe.
 *
 * AppContext calls `syncDue()` alongside `lifeContext.expireDue()`; the result feeds the
 * "What Gozlin is watching" surface so the user can always see — and revoke — the live
 * forward model. See docs/companion/00-proactive-companion-blueprint.md §3.2 + §6.
 */
import { consent as defaultConsent, type ConsentRepository } from "../privacy";
import { CalendarSource, calendarSource as defaultCalendar } from "./calendar/CalendarSource";
import { WeatherSource, weatherSource as defaultWeather } from "./weather/WeatherSource";
import { weatherWorkoutHint, type WeatherSnapshot } from "./weather/openmeteo";
import { WearableSource, wearableSource as defaultWearable } from "./wearable/WearableSource";

export interface SignalSyncResult {
  /** Calendar entries (re)proposed into Life Context this pass (0 if not connected). */
  calendarProposed: number;
  /** Whether a fresh weather snapshot was fetched. */
  weatherRefreshed: boolean;
}

/** A row for the "What Gozlin is watching" surface — one per connectable sense. */
export interface WatchedSignal {
  id: "calendar" | "weather" | "wearable";
  label: string;
  /** Connected = consent granted AND OS permission ready. */
  connected: boolean;
  /** Plain-language current state ("Watching your calendar", "Clear, 22°"). */
  detail: string;
  icon: string;
}

export class SignalsCoordinator {
  constructor(
    private readonly calendar: CalendarSource = defaultCalendar,
    private readonly weather: WeatherSource = defaultWeather,
    private readonly consent: ConsentRepository = defaultConsent,
    private readonly wearable: WearableSource = defaultWearable,
  ) {}

  /**
   * Run any sense the user has switched on. Idempotent (calendar proposals are keyed by
   * `cal:<id>`; weather serves a fresh cache without re-fetching). Never throws.
   */
  async syncDue(now: Date = new Date()): Promise<SignalSyncResult> {
    let calendarProposed = 0;
    let weatherRefreshed = false;

    try {
      if (await this.consent.isGranted("calendar")) {
        const { ready } = await this.calendar.getStatus();
        if (ready) {
          const { proposed } = await this.calendar.syncToLifeContext({ now });
          calendarProposed = proposed;
        }
      }
    } catch {
      // a single failing sense never blocks the others or the boot path
    }

    try {
      if (await this.consent.isGranted("location_weather")) {
        const { ready } = await this.weather.getStatus();
        if (ready) {
          const snap = await this.weather.getToday({ now });
          weatherRefreshed = !!snap;
        }
      }
    } catch {
      // ignore
    }

    return { calendarProposed, weatherRefreshed };
  }

  /** The current "what Gozlin is watching" rows (no native reads beyond status/cache). */
  async watching(): Promise<WatchedSignal[]> {
    const rows: WatchedSignal[] = [];

    const calGranted = await this.consent.isGranted("calendar");
    const calReady = calGranted && (await this.calendar.getStatus()).ready;
    rows.push({
      id: "calendar",
      label: "Calendar",
      connected: calReady,
      detail: calReady
        ? "Watching for trips and big days"
        : "Not connected — add events manually",
      icon: "calendar",
    });

    const wxGranted = await this.consent.isGranted("location_weather");
    const wxReady = wxGranted && (await this.weather.getStatus()).ready;
    const snap: WeatherSnapshot | null = wxReady ? await this.weather.lastKnown() : null;
    rows.push({
      id: "weather",
      label: "Weather",
      connected: wxReady,
      detail: snap
        ? `${snap.condition}, ${snap.tempC}° — ${
            weatherWorkoutHint(snap).indoor ? "may suggest indoor" : "good to train outside"
          }`
        : wxReady
          ? "Connected — forecast loads soon"
          : "Not connected",
      icon: snap?.icon ?? "partly-sunny",
    });

    const wearGranted = await this.consent.isGranted("wearable");
    const wearReady = wearGranted && (await this.wearable.getStatus()).ready;
    const wear = wearGranted ? await this.wearable.lastKnown() : null;
    rows.push({
      id: "wearable",
      label: "Wearable",
      connected: wearReady || (!!wear && wear.source === "manual"),
      detail: wear?.sleepHours != null
        ? `${wear.sleepHours.toFixed(1)}h sleep — folded into recovery`
        : wearReady
          ? "Connected — metrics load overnight"
          : "Not connected — recovery uses training load",
      icon: "watch",
    });

    return rows;
  }
}

/** The default, app-wide signals coordinator. */
export const signalsCoordinator = new SignalsCoordinator();
