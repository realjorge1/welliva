/**
 * useNotifications — bridge hooks for Proactive Delivery (P2).
 *
 *  • useProactiveDelivery() — headless: assembles today's candidates (briefing +
 *    anticipations) from the existing engines and hands them to the consent-gated
 *    NotificationScheduler. Mounted once (ProactiveDeliveryRunner) so the daily plan is
 *    laid down whenever the app opens. No-op until the user enables notifications.
 *  • useNotificationSettings() — the controls for the Privacy screen: status, prefs
 *    (quiet hours, daily budget), enable/disable.
 *
 * All scheduling policy lives in health-os/notifications; these are thin wiring.
 */
import { useGozlinSnapshot } from "@/components/gozlin";
import { useAnticipation } from "@/components/lifecontext/useAnticipation";
import { useApp } from "@/contexts/AppContext";
import {
  notificationScheduler,
  todayDate,
  type NotificationPrefs,
  type NotifStatus,
} from "@/health-os";
import { buildBriefing, buildNotificationCandidates } from "@/services/gozlin";
import { listArchivedStories, storyNotification } from "@/services/StoryService";
import { useCallback, useEffect, useRef, useState } from "react";

/** Headless: lay down today's notification plan once the app's data is ready. */
export function useProactiveDelivery(): void {
  const app = useApp();
  const { twin } = useGozlinSnapshot();
  const ant = useAnticipation();
  const plannedFor = useRef<string | null>(null);

  useEffect(() => {
    if (ant.loading) return;
    const today = todayDate();
    if (plannedFor.current === today) return;

    let cancelled = false;
    void (async () => {
      const briefing = twin.hasProfile
        ? buildBriefing({
            twin,
            insights: app.coachInsights,
            dietHistory: app.dietHistory,
            workoutLog: app.workoutLog,
            journeyStartedAt: app.userGoals?.journeyStartedAt,
          })
        : null;

      // The freshest long-horizon story, if one's been generated/archived (P6). The
      // orchestrator de-dupes by id + a 7-day cadence, so a story is pushed at most once.
      const stories = await listArchivedStories();
      const story = stories[0] ? storyNotification(stories[0]) : null;

      const candidates = buildNotificationCandidates({
        forDate: today,
        briefing,
        anticipations: ant.anticipations,
        story,
      });

      // Scheduler no-ops without consent + OS permission; idempotent across calls.
      await notificationScheduler.planAndSchedule(candidates);
      if (!cancelled) plannedFor.current = today;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ant.loading,
    ant.anticipations,
    twin,
    app.coachInsights,
    app.dietHistory,
    app.workoutLog,
    app.userGoals?.journeyStartedAt,
  ]);
}

export interface UseNotificationSettings {
  loading: boolean;
  status: NotifStatus | null;
  prefs: NotificationPrefs | null;
  /** Grant consent + request OS permission. */
  enable: () => Promise<void>;
  /** Revoke consent + cancel everything scheduled. */
  disable: () => Promise<void>;
  setQuietHours: (start: string, end: string) => Promise<void>;
  setDailyBudget: (budget: number) => Promise<void>;
  reload: () => Promise<void>;
}

/** Controls for the Privacy screen's notification section. */
export function useNotificationSettings(): UseNotificationSettings {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<NotifStatus | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  const reload = useCallback(async () => {
    const [s, p] = await Promise.all([
      notificationScheduler.getStatus(),
      notificationScheduler.getPrefs(),
    ]);
    setStatus(s);
    setPrefs(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enable = useCallback(async () => {
    const s = await notificationScheduler.enable();
    setStatus(s);
    await reload();
  }, [reload]);

  const disable = useCallback(async () => {
    await notificationScheduler.disable();
    await reload();
  }, [reload]);

  const setQuietHours = useCallback(
    async (start: string, end: string) => {
      const p = await notificationScheduler.setPrefs({ quietStart: start, quietEnd: end });
      setPrefs(p);
    },
    [],
  );

  const setDailyBudget = useCallback(async (budget: number) => {
    const p = await notificationScheduler.setPrefs({ dailyBudget: budget });
    setPrefs(p);
  }, []);

  return { loading, status, prefs, enable, disable, setQuietHours, setDailyBudget, reload };
}
