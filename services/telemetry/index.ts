/**
 * The telemetry surface. Three concerns, one of which is allowed to leave the
 * phone:
 *
 *   CrashLog   — the device-local black box of caught render crashes.
 *   Analytics  — anonymous first-party product events, consent-gated.
 *   installId  — the random per-install id those events are keyed on.
 *
 * THIS BARREL IS PURE — no `react-native`, no `lib/supabase`. Domain code under
 * services/ imports `track` from here and keeps testing under Node. The platform
 * half lives in ./boot (installAnalytics) and ./supabaseSink, which app/_layout
 * imports directly; pulling either into this file would break every test that
 * touches a logging path. See ./sink.ts for the full reasoning.
 */
export {
  ANALYTICS_ACTIVATED_KEY,
  ANALYTICS_QUEUE_KEY,
  flush,
  markActivated,
  persist,
  sanitize,
  setAnalyticsSink,
  setAnalyticsUser,
  track,
  uploadCrash,
} from "./Analytics";
export type { AnalyticsSink, CrashRow, EventRow, SendResult } from "./sink";
export { NULL_SINK } from "./sink";
export type {
  AnalyticsEventName,
  AnalyticsEvents,
  AuthMethod,
  FoodLogSource,
  OnboardingStep,
  PaywallSource,
  PlanKind,
  PurchaseResult,
} from "./events";
export {
  ALLOWED_PROP_KEYS,
  KNOWN_EVENTS,
  ONBOARDING_STEPS,
  PAYWALL_SOURCES,
} from "./events";
export { getInstallId, INSTALL_ID_KEY, resetInstallId } from "./installId";
export {
  clearCrashLog,
  countCrashes,
  type CrashRecord,
  getCrashLog,
  reportCrash,
} from "./CrashLog";
