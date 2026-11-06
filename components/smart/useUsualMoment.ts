/**
 * "Your usual?" — the screen half (services/smart/usual is the rule).
 *
 * Offers a meal's usual around when it is usually eaten: from an hour before
 * that time until the meal's window ends (the same windows the navigation bar
 * asks about meals in — components/navigation/nextMove), and only while
 * nothing has been logged or ticked for that meal today. The quiet layer then
 * decides whether it is shown at all (useSmartMoment).
 *
 * Log it writes the usual exactly as last time and leaves an Undo; "Not my
 * usual any more" forgets it on every device.
 */
import { MEAL_WINDOWS } from "@/components/navigation/nextMove";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { subscribeExternalWrites } from "@/services/notifications/externalWrites";
import { todayDate } from "@/services/OfflineStorage";
import type { RoutineSources } from "@/services/routine";
import {
  answerSmart,
  findUsuals,
  forgetUsual,
  loadForgottenUsuals,
  logUsual,
  snapshotOf,
  subscribeForgottenUsuals,
  type ForgottenUsual,
  type SmartCandidate,
  type Usual,
  type UsualSlot,
} from "@/services/smart";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import type { Receipt } from "./receipt";
import { useRoutineSources } from "./useReminderMoves";
import { useSmartMoment } from "./useSmartMoment";

/** It appears this long before the usual time. */
export const USUAL_LEAD_MINUTES = 60;

/** A late eater's usual stays this long past their own time, whatever the window says. */
export const USUAL_LATE_MINUTES = 90;

/** Above a reminder offer: it's about the next hour, not the next month. */
export const USUAL_PRIORITY = 50;

/** Logged or ticked anything for this meal today? Then nothing to offer. */
function eatenToday(sources: RoutineSources, today: string, slot: UsualSlot): boolean {
  return (
    (sources.intake?.[today] ?? []).some((r) => r?.slot === slot) ||
    (sources.foodLog?.[today] ?? []).some((e) => e?.slot === slot)
  );
}

/** Is `minute` inside the usual's showing window? */
export function usualDue(u: Pick<Usual, "slot" | "usualMinute">, minute: number): boolean {
  const [start, end] = MEAL_WINDOWS[u.slot];
  const from = u.usualMinute != null ? u.usualMinute - USUAL_LEAD_MINUTES : start;
  const until = Math.max(end, (u.usualMinute ?? end) + USUAL_LATE_MINUTES);
  return minute >= from && minute < until;
}

export function useUsualMoment(surface: "home" | "diet", show: (r: Receipt) => void) {
  const { sources, ready, reload } = useRoutineSources();
  const { removeLoggedFood } = useMealPlan();
  const [forgotten, setForgotten] = useState<ForgottenUsual[]>([]);

  useEffect(() => {
    let alive = true;
    void loadForgottenUsuals().then((f) => {
      if (alive) setForgotten(f);
    });
    const offForgotten = subscribeForgottenUsuals(setForgotten);
    // A meal logged anywhere — this card, the lock screen, the food log — can
    // end the offer, so read the log again.
    const offWrites = subscribeExternalWrites((w) => {
      if (w.kind === "meal") reload();
    });
    return () => {
      alive = false;
      offForgotten();
      offWrites();
    };
  }, [reload]);

  const today = todayDate();
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();

  const usual = useMemo(() => {
    if (!ready) return null;
    const all = findUsuals({ foodLog: sources.foodLog, intake: sources.intake, forgotten, today });
    return all.find((u) => usualDue(u, minute) && !eatenToday(sources, today, u.slot)) ?? null;
  }, [ready, sources, forgotten, today, minute]);

  const candidates = useMemo<SmartCandidate[]>(
    () => (usual ? [{ id: usual.id, feature: "usual", priority: USUAL_PRIORITY }] : []),
    [usual],
  );
  const offer = useSmartMoment(surface, candidates);
  const shown = offer && usual && offer.id === usual.id ? usual : null;

  const logIt = useCallback(
    async (u: Usual) => {
      const out = await logUsual(snapshotOf(u), todayDate());
      if (out.status === "logged") {
        void answerSmart({ id: u.id, feature: "usual", answer: "accepted" });
        show({
          message: "Logged",
          onUndo: async () => {
            for (const e of out.entries) await removeLoggedFood(e.id, out.date);
            reload();
          },
        });
      } else if (out.status === "already") {
        show({ message: "Already logged today" });
      } else {
        show({ message: "That day is closed for logging" });
      }
      reload();
    },
    [removeLoggedFood, reload, show],
  );

  const notMine = useCallback((u: Usual) => {
    Alert.alert(
      "Not your usual any more?",
      "welliva will stop offering it. If you have it a few more times, it can come back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Not my usual",
          style: "destructive",
          onPress: () => {
            void forgetUsual(u.id);
            void answerSmart({ id: u.id, feature: "usual", answer: "dismissed" });
          },
        },
      ],
    );
  }, []);

  return { usual: shown, logIt, notMine };
}
