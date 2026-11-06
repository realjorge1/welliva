/**
 * What your good days have in common — the screen half (services/smart/goodDays
 * is the rule).
 *
 *   · useGoodDays        the findings, for Memory and the sheet
 *   · useGoodDaysMoment  the one that may arrive on Home, through the quiet layer
 *
 * Free for everyone (the owner's decision): this reads the person's own records
 * back to them. Only the history of opened insights is Pro, and it stays Pro.
 */
import { useInsightLedger } from "@/components/home/useInsightLedger";
import { useNutrition } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { todayDate } from "@/services/OfflineStorage";
import { openInsight } from "@/services/gozlin/InsightLedger";
import {
  GOOD_DAYS_PRIORITY,
  answerSmart,
  goodDayCard,
  liveRoughDays,
  nextGoodDay,
  readGoodDays,
  type GoodDayFinding,
  type SmartCandidate,
} from "@/services/smart";
import { useCallback, useMemo } from "react";
import { useRoutineSources } from "./useReminderMoves";
import { useRoughDays } from "./useRoughDay";
import { useSmartLedger, useSmartMoment } from "./useSmartMoment";

const NO_FINDINGS: readonly GoodDayFinding[] = [];

export function useGoodDays() {
  const { views } = useHabits();
  const { dietHistory } = useNutrition();
  const roughDays = useRoughDays();
  const { sources, ready } = useRoutineSources();
  const { answers } = useSmartLedger();
  const today = todayDate();

  const report = useMemo(() => {
    if (!ready) return null;
    return readGoodDays({
      today,
      checkins: sources.checkins,
      workouts: sources.workouts,
      waterHistory: sources.waterHistory,
      dietHistory,
      intake: sources.intake,
      foodLog: sources.foodLog,
      // Their own habits: the derived ones (water, meals…) repeat other candidates.
      habits: views
        .filter((v) => v.habit.source === "manual")
        .map((v) => ({ ...v.habit, done: v.done })),
      roughDates: new Set(liveRoughDays(roughDays).map((d) => d.date)),
      dismissed: new Set(
        answers.filter((a) => a.feature === "good-days" && a.answer === "dismissed").map((a) => a.id),
      ),
    });
  }, [ready, today, sources, dietHistory, views, roughDays, answers]);

  const findings = report?.findings ?? NO_FINDINGS;

  /** Read in the sheet, so none of them comes back to Home as "new". */
  const file = useCallback((list: readonly GoodDayFinding[]) => {
    const day = todayDate();
    for (const f of list) void openInsight(goodDayCard(f), day).catch(() => undefined);
  }, []);

  /** "That isn't me": gone from Memory and Home, and it doesn't come back. */
  const dismiss = useCallback((f: GoodDayFinding) => {
    void answerSmart({ id: f.id, feature: "good-days", answer: "dismissed" });
  }, []);

  return { report, findings, file, dismiss };
}

interface GoodDayMoment extends SmartCandidate {
  finding: GoodDayFinding;
}

export function useGoodDaysMoment() {
  const { report, findings, file } = useGoodDays();
  const { ledger, ready } = useInsightLedger();
  const { shown } = useSmartLedger();
  const today = todayDate();

  const next = useMemo(
    () => (ready ? nextGoodDay(findings, ledger, today) : null),
    [ready, findings, ledger, today],
  );

  // A card still waiting from an earlier day isn't a new suggestion, so it doesn't
  // take the day's one slot from something that is.
  const waiting = !!next && shown.some((s) => s.id === next.id && s.date < today);
  const candidates = useMemo<GoodDayMoment[]>(
    () =>
      next
        ? [{ id: next.id, feature: "good-days", priority: GOOD_DAYS_PRIORITY, exempt: waiting, finding: next }]
        : [],
    [next, waiting],
  );
  const moment = useSmartMoment("home", candidates);

  const card = useMemo(() => (moment ? goodDayCard(moment.finding) : null), [moment]);

  /** The sheet closed: everything it showed has been read. */
  const read = useCallback(() => {
    file(findings);
    if (moment) void answerSmart({ id: moment.id, feature: "good-days", answer: "accepted" });
  }, [file, findings, moment]);

  return { report, findings, card, read };
}
