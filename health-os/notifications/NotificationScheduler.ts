/**
 * health-os/notifications/NotificationScheduler.ts
 *
 * The service that drives proactive delivery: it gates on the `proactive_notifications`
 * consent category AND the OS permission, loads the user's prefs (quiet hours, daily
 * budget, cadence) + the sent ledger, runs the PURE orchestrator to decide what to
 * deliver today, schedules the winners through the NotificationPort, and records them so
 * cadence holds across days. Consent is the single on/off truth; prefs hold only the
 * shaping knobs.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.4.
 */
import { toLocalDateString } from "../platform/clock";
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import { K } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import { consent as defaultConsent, type ConsentRepository } from "../privacy";
import type { NotifStatus, NotificationPort } from "./NotificationPort";
import { expoNotificationAdapter } from "./ExpoNotificationAdapter";
import {
  DEFAULT_NOTIFICATION_PREFS,
  planNotifications,
  recordSent,
  type NotificationCandidate,
  type NotificationLedger,
  type NotificationPrefs,
  type PlannedNotification,
} from "./orchestrator";

/** The user-facing prefs: everything in NotificationPrefs except `enabled` (consent owns that). */
export type NotificationPrefsPatch = Partial<Omit<NotificationPrefs, "enabled">>;

export class NotificationScheduler {
  constructor(
    private readonly port: NotificationPort = expoNotificationAdapter,
    private readonly store: KeyValueStore = defaultStore,
    private readonly consent: ConsentRepository = defaultConsent,
  ) {}

  // ── prefs (shaping knobs; consent is the on/off) ──

  async getPrefs(): Promise<NotificationPrefs> {
    const stored = await this.store.get<Partial<NotificationPrefs> | null>(
      K.NOTIFICATIONS_PREFS,
      null,
    );
    const enabled = await this.consent.isGranted("proactive_notifications");
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(stored ?? {}),
      cadenceDays: { ...DEFAULT_NOTIFICATION_PREFS.cadenceDays, ...(stored?.cadenceDays ?? {}) },
      enabled,
    };
  }

  async setPrefs(patch: NotificationPrefsPatch): Promise<NotificationPrefs> {
    const current = await this.getPrefs();
    const next: NotificationPrefs = {
      ...current,
      ...patch,
      cadenceDays: { ...current.cadenceDays, ...(patch.cadenceDays ?? {}) },
    };
    // Persist everything except the consent-owned `enabled` flag.
    const { enabled: _enabled, ...persisted } = next;
    void _enabled;
    await this.store.set(K.NOTIFICATIONS_PREFS, persisted);
    return next;
  }

  // ── consent + permission ──

  getStatus(): Promise<NotifStatus> {
    return this.port.getStatus();
  }

  /** Grant consent + prompt for OS permission. Returns the resulting status. */
  async enable(): Promise<NotifStatus> {
    await this.consent.grant("proactive_notifications");
    return this.port.requestAccess();
  }

  /** Revoke consent + clear anything already scheduled. */
  async disable(): Promise<void> {
    await this.consent.revoke("proactive_notifications");
    await this.port.cancelAll();
  }

  // ── the daily plan ──

  private getLedger(): Promise<NotificationLedger> {
    return this.store.get<NotificationLedger>(K.NOTIFICATIONS_LEDGER, { sent: [] });
  }

  /**
   * Plan and schedule today's (or `forDate`'s) notifications from the supplied candidates.
   * No-op unless consent is granted AND the OS permission is ready. Idempotent: the
   * ledger de-dupes by id, and the port overwrites by identifier.
   */
  async planAndSchedule(
    candidates: NotificationCandidate[],
    opts: { forDate?: string; now?: Date } = {},
  ): Promise<PlannedNotification[]> {
    if (!(await this.consent.isGranted("proactive_notifications"))) return [];
    const status = await this.port.getStatus();
    if (!status.ready) return [];

    const now = opts.now ?? new Date();
    const forDate = opts.forDate ?? toLocalDateString(now);
    const prefs = { ...(await this.getPrefs()), enabled: true }; // consent already verified
    const ledger = await this.getLedger();

    const planned = planNotifications({ candidates, prefs, ledger, forDate, now });

    for (const p of planned) {
      await this.port.schedule({
        id: p.id,
        title: p.title,
        body: p.body,
        fireAt: p.fireAt,
        ...(p.route ? { data: { route: p.route } } : {}),
      });
    }

    if (planned.length > 0) {
      await this.store.set(
        K.NOTIFICATIONS_LEDGER,
        recordSent(ledger, planned, forDate),
      );
    }
    return planned;
  }

  /** Clear the sent ledger + cancel scheduled (part of "forget everything"). */
  async clear(): Promise<void> {
    await this.port.cancelAll();
    await this.store.remove(K.NOTIFICATIONS_LEDGER);
  }
}

/** The default, app-wide notification scheduler. */
export const notificationScheduler = new NotificationScheduler();
