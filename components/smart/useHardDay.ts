/**
 * Prepare for the hard day — the screen half (services/smart/hardDay is the
 * rule). Offers the short version of a weekday that keeps getting missed, the
 * evening before it or that morning; asks once when a short run ends, with the
 * real number; and says which days are short right now.
 */
import { useWorkout } from "@/contexts/AppContext";
import { todayDate } from "@/services/OfflineStorage";
import {
  HARD_DAY_PRIORITY,
  KEEP_DAYS,
  activeShortDay,
  answerFor,
  answerSmart,
  endWeekdayShort,
  findHardWeekday,
  freshStartDay,
  hardDayCopy,
  liveRoughDays,
  loadPlannedDays,
  loadShortWeekdays,
  makeWeekdayShort,
  offerDue,
  shortReviewDue,
  subscribeShortWeekdays,
  type HardDayOffer,
  type PlannedDays,
  type ShortReview,
  type ShortWeekday,
} from "@/services/smart";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { Receipt } from "./receipt";
import { useRoughDays } from "./useRoughDay";
import { useSmartLedger, useSmartMoment } from "./useSmartMoment";
import { useFreshStart } from "./useWelcomeBack";

type HardMoment = HardDayOffer | ShortReview;

/** The weekdays kept short: loaded, followed, re-read on every return. */
export function useShortWeekdays(): ShortWeekday[] {
  const [list, setList] = useState<ShortWeekday[]>([]);
  useEffect(() => {
    let alive = true;
    const read = () => {
      void loadShortWeekdays().then((l) => {
        if (alive) setList(l);
      });
    };
    read();
    const off = subscribeShortWeekdays(setList);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") read();
    });
    return () => {
      alive = false;
      off();
      sub.remove();
    };
  }, []);
  return list;
}

/**
 * Is today's session not the full one — a short weekday, or a fresh-start week?
 * Anything that launches or describes "today's session" asks this: only the
 * Fitness screen builds the eased version, so everything else sends you there
 * rather than quietly starting the full one.
 */
export function useEasedToday(): boolean {
  const shortDays = useShortWeekdays();
  const fresh = useFreshStart();
  const today = todayDate();
  return activeShortDay(shortDays, today) !== null || freshStartDay(fresh, today) !== null;
}

export function useHardDayMoment(surface: "home" | "fitness", show: (r: Receipt) => void) {
  const { workoutLog, workoutPlan } = useWorkout();
  const roughDays = useRoughDays();
  const shortDays = useShortWeekdays();
  const { answers } = useSmartLedger();
  const [planned, setPlanned] = useState<PlannedDays>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadPlannedDays().then((p) => {
        if (alive) setPlanned(p);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const today = todayDate();
  const hour = new Date().getHours();

  const candidates = useMemo<HardMoment[]>(() => {
    const workoutDates = new Set(workoutLog.map((w) => w.date));
    const roughDates = new Set(liveRoughDays(roughDays).map((r) => r.date));

    const review = shortReviewDue({ shortDays, planned, workoutDates, roughDates, today });
    if (review && review.planned > 0) {
      const id = `hard-day-review:${review.weekday}:${review.since}`;
      if (!answerFor(answers, id)) {
        return [{ ...review, id, feature: "hard-day", kind: "review", priority: HARD_DAY_PRIORITY + 1 }];
      }
    }

    const hard = findHardWeekday({ planned, workoutDates, roughDates, today });
    if (!hard || !offerDue(hard.weekday, today, hour)) return [];
    // Already short — and nothing to shorten if that day has no session now.
    if (shortDays.some((s) => !s.deleted && s.weekday === hard.weekday && s.until >= today)) return [];
    if (!workoutPlan?.sessions.some((s) => s.dayOfWeek === hard.weekday && !s.isRestDay)) return [];
    return [
      { ...hard, id: `hard-day:${hard.weekday}`, feature: "hard-day", kind: "offer", priority: HARD_DAY_PRIORITY },
    ];
  }, [workoutLog, roughDays, shortDays, planned, answers, today, hour, workoutPlan]);

  const moment = useSmartMoment(surface, candidates);

  const accept = useCallback(
    async (m: HardMoment) => {
      await makeWeekdayShort(m.weekday);
      await answerSmart({ id: m.id, feature: "hard-day", answer: "accepted" });
      if (m.kind === "offer") {
        show({
          message: hardDayCopy(m).done,
          onUndo: async () => {
            await endWeekdayShort(m.weekday);
            await answerSmart({ id: m.id, feature: "hard-day", answer: "declined", coolDownDays: KEEP_DAYS });
          },
        });
      }
    },
    [show],
  );

  const decline = useCallback(async (m: HardMoment) => {
    if (m.kind === "review") {
      await endWeekdayShort(m.weekday);
      await answerSmart({ id: m.id, feature: "hard-day", answer: "declined" });
      return;
    }
    await answerSmart({ id: m.id, feature: "hard-day", answer: "declined", coolDownDays: KEEP_DAYS });
  }, []);

  return { moment, accept, decline };
}
