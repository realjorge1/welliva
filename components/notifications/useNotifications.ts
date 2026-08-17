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
  buildContext,
  issueRecommendation,
  notificationScheduler,
  todayDate,
  type NotificationCandidate,
  type NotificationPrefs,
  type NotifStatus,
} from "@/health-os";
import { buildBriefing, buildNotificationCandidates } from "@/services/gozlin";
import { listArchivedStories, storyNotification } from "@/services/StoryService";
import { useCallback, useEffect, useRef, useState } from "react";

/** The three goal buckets the bandit's context is keyed on. */
function goalBucket(primaryGoal?: string | null): "lose" | "gain" | "maintain" {
  const g = (primaryGoal ?? "").toLowerCase();
  if (g.includes("lose") || g.includes("fat") || g.includes("cut")) return "lose";
  if (g.includes("gain") || g.includes("muscle") || g.includes("bulk")) return "gain";
  return "maintain";
}

/**
 * Record today's briefing as a falsifiable prediction, then let the chosen arm
 * decide whether it actually goes out.
 *
 * The prediction is written BEFORE the outcome is known and before the
 * notification is scheduled — that ordering is what makes the ledger evidence
 * rather than narration. `adherence_pct` over a one-day horizon is the honest
 * thing to predict here: a morning briefing is an attempt to move today's
 * behaviour, and that is exactly what gets measured.
 *
 * Silence is recorded the same way as any other arm, with the same prediction.
 * If behaviour holds up on the days Gozlin says nothing, silence earns reward
 * and gets chosen more often — which is the mechanism by which this app can
 * learn to leave someone alone.
 */
async function applyDeliveryPolicy(
  candidates: NotificationCandidate[],
  context: Parameters<typeof buildContext>[0],
): Promise<NotificationCandidate[]> {
  const briefing = candidates.find((c) => c.category === "briefing");
  if (!briefing) return candidates;

  try {
    const { arm } = await issueRecommendation({
      context: buildContext(context),
      action: { kind: "daily_briefing", params: { title: briefing.title } },
      prediction: { metric: "adherence_pct", direction: "up", horizonDays: 1 },
    });
    if (arm === "nudge:silence") {
      return candidates.filter((c) => c.category !== "briefing");
    }
  } catch {
    // A learning failure must never cost the user their briefing — fall through
    // and deliver exactly what would have been delivered before any of this.
  }
  return candidates;
}

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

      // ── The learning loop's write side ────────────────────────────────
      //
      // The bandit decides HOW to deliver today's coaching nudge, and whether
      // to deliver it at all. This is the one place `nudge:silence` can be
      // chosen, which is the only reason it can ever be learned: an arm that
      // is never selected can never be shown to be better (see bandit.ts).
      //
      // It governs the BRIEFING only. Anticipations are event-driven and
      // time-sensitive — "your flight is in two days" is not a discretionary
      // nudge, and suppressing it to satisfy an exploration policy would be
      // the algorithm serving itself. The story is on its own 7-day cadence.
      const scheduled = await applyDeliveryPolicy(candidates, {
        goal: goalBucket(app.userBio?.primaryGoal),
        adherenceScore: twin.momentum.adherence7d,
        recoveryScore: twin.recovery.score,
        date: today,
      });

      // Scheduler no-ops without consent + OS permission; idempotent across calls.
      await notificationScheduler.planAndSchedule(scheduled);
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
    app.userBio?.primaryGoal,
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
