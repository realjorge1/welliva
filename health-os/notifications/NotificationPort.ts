/**
 * health-os/notifications/NotificationPort.ts
 *
 * The OS-notification PORT. The orchestrator + scheduler talk to this interface, never to
 * `expo-notifications` directly — so the pure scheduling policy stays testable and the
 * native module sits behind a single, lazily-loaded, consent-gated adapter that degrades
 * to a no-op when absent (Expo Go / web). Mirrors the SignalSource discipline.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.4.
 */
import type { SignalPermission, SignalStatus } from "../signals/types";

/** Reuse the signal permission vocabulary so the UI treats every integration the same. */
export type NotifPermission = SignalPermission;
export type NotifStatus = SignalStatus;

export interface ScheduleRequest {
  /** Our stable id — also the native identifier, so re-scheduling overwrites and cancel works. */
  id: string;
  title: string;
  body: string;
  /** Local fire instant, ISO-8601 with offset. */
  fireAt: string;
  /** Carried to the tap handler (e.g. `{ route: "/recap/2026" }`). */
  data?: Record<string, unknown>;
}

export interface NotificationPort {
  getStatus(): Promise<NotifStatus>;
  requestAccess(): Promise<NotifStatus>;
  /** Schedule one local notification. Returns the native id, or null if it couldn't. */
  schedule(req: ScheduleRequest): Promise<string | null>;
  /** Cancel a previously-scheduled notification by our id. */
  cancel(id: string): Promise<void>;
  /** Cancel everything we've scheduled (used on disable / re-plan). */
  cancelAll(): Promise<void>;
}
