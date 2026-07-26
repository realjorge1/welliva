/**
 * health-os/notifications — the reach.
 *
 * A NotificationPort (lazy, consent-gated Expo adapter) + a PURE attention-budget
 * orchestrator + a scheduler that turns ranked candidates (anticipations, the daily
 * briefing, ready story recaps) into local notifications that respect quiet hours, a
 * daily budget and per-category cadence. No push server needed for v1.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.4.
 */
export {
  DEFAULT_NOTIFICATION_PREFS,
  deliveryMinute,
  inQuietHours,
  minutesOfDay,
  planNotifications,
  recordSent,
  type NotificationCandidate,
  type NotificationCategory,
  type NotificationLedger,
  type NotificationPrefs,
  type PlannedNotification,
  type SentRecord,
} from "./orchestrator";
export type {
  NotificationPort,
  NotifPermission,
  NotifStatus,
  ScheduleRequest,
} from "./NotificationPort";
export { ExpoNotificationAdapter, expoNotificationAdapter } from "./ExpoNotificationAdapter";
export {
  NotificationScheduler,
  notificationScheduler,
  type NotificationPrefsPatch,
} from "./NotificationScheduler";
