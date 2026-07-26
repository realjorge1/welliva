/**
 * health-os/signals — the external senses.
 *
 * Adapters that read the world (device calendar, weather/location) behind lazy, guarded
 * native imports, plus PURE cores that translate what they read into Life Context
 * proposals and coach hints. Every source degrades to a safe no-op when its module or
 * permission is absent, so the app stays fully functional offline / in Expo Go.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.2.
 */
export * from "./types";

// calendar
export {
  classifyKind,
  proposeFromCalendar,
  proposeFromCalendarEvent,
  CALENDAR_CONFIDENCE,
  type RawCalendarEvent,
} from "./calendar/classify";
export { CalendarSource, calendarSource } from "./calendar/CalendarSource";

// weather
export {
  buildForecastUrl,
  coarsen,
  describeWeatherCode,
  parseForecast,
  weatherWorkoutHint,
  type WeatherGroup,
  type WeatherSnapshot,
  type WorkoutWeatherHint,
} from "./weather/openmeteo";
export { WeatherSource, weatherSource } from "./weather/WeatherSource";

// wearable (sleep / HRV / resting-HR → real recovery)
export {
  recoveryAdjustment,
  wearableBasis,
  wearableHints,
  type RecoveryAdjustment,
  type WearableHint,
  type WearableSnapshot,
  type WearableSource as WearableSourceKind,
} from "./wearable/wearable";
export {
  WearableSource,
  wearableSource,
  nullWearableProvider,
  type WearableProvider,
} from "./wearable/WearableSource";

// coordinator (consent + permission gated boot/rollover sync + "what's watching")
export {
  SignalsCoordinator,
  signalsCoordinator,
  type SignalSyncResult,
  type WatchedSignal,
} from "./SignalsCoordinator";
