/**
 * "On 3 November you said: …" — the screen half (services/smart/why is the rule).
 *
 * Reads the words from Gozlin's identity memory, decides whether this is a
 * wobbly moment (a run just lapsed, or the evening before their hard weekday),
 * and asks the quiet layer. Once it reaches the screen the date of the quote is
 * written down: "once a month" holds whether or not it gets answered.
 */
import { useGamification, useWorkout } from "@/contexts/AppContext";
import { loadIdentity, rememberMotivation, saveIdentity } from "@/services/gozlin/GozlinMemoryStore";
import type { GozlinIdentityMemory } from "@/services/gozlin/gozlin.types";
import { shiftDay, weekdayIndex } from "@/services/commitment";
import { todayDate } from "@/services/OfflineStorage";
import { wallClockOf } from "@/services/routine/clock";
import {
  EVE_FROM_HOUR,
  WHY_ID,
  WHY_PRIORITY,
  WHY_QUOTE_GAP_DAYS,
  answerSmart,
  findHardWeekday,
  liveRoughDays,
  loadPlannedDays,
  runJustLapsed,
  whyDue,
  type PlannedDays,
  type SmartCandidate,
} from "@/services/smart";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoughDays } from "./useRoughDay";
import { useSmartMoment } from "./useSmartMoment";

/** Their words and dates, re-read every time the screen comes into focus. */
export function useIdentityMemory(): { identity: GozlinIdentityMemory | null; reload: () => void } {
  const [identity, setIdentity] = useState<GozlinIdentityMemory | null>(null);
  const reload = useCallback(() => {
    void loadIdentity().then(setIdentity);
  }, []);
  useFocusEffect(reload);
  return { identity, reload };
}

export function useWhyMoment() {
  const { identity, reload } = useIdentityMemory();
  const { streakData } = useGamification();
  const { workoutLog } = useWorkout();
  const roughDays = useRoughDays();
  const [planned, setPlanned] = useState<PlannedDays>({});
  useFocusEffect(
    useCallback(() => {
      void loadPlannedDays().then(setPlanned);
    }, []),
  );

  const today = todayDate();
  const hour = new Date().getHours();

  const candidates = useMemo<SmartCandidate[]>(() => {
    if (!identity?.motivation) return [];
    const hard = findHardWeekday({
      planned,
      workoutDates: new Set(workoutLog.map((w) => w.date)),
      roughDates: new Set(liveRoughDays(roughDays).map((r) => r.date)),
      today,
    });
    const hardEve = !!hard && hour >= EVE_FROM_HOUR && weekdayIndex(shiftDay(today, 1)) === hard.weekday;
    const wobbly = hardEve || runJustLapsed(streakData.days, streakData.paused, today);
    if (!whyDue({ motivation: identity.motivation, quotedAt: identity.motivationQuotedAt, wobbly, today })) {
      return [];
    }
    return [{ id: WHY_ID, feature: "why", priority: WHY_PRIORITY }];
  }, [identity, planned, workoutLog, roughDays, streakData.days, streakData.paused, today, hour]);

  const moment = useSmartMoment("home", candidates);
  const showing = moment !== null;

  // Write the date down the first time it shows today.
  const quotedOn = identity?.motivationQuotedAt ? wallClockOf(identity.motivationQuotedAt)?.date : null;
  useEffect(() => {
    if (!showing || quotedOn === today) return;
    void saveIdentity({ motivationQuotedAt: new Date().toISOString() }).then(reload);
  }, [showing, quotedOn, today, reload]);

  const answer = useCallback(
    (kind: "accepted" | "dismissed") =>
      answerSmart({ id: WHY_ID, feature: "why", answer: kind, coolDownDays: WHY_QUOTE_GAP_DAYS }),
    [],
  );

  /** New words from "Change it". The day they said it becomes today. */
  const change = useCallback(
    async (text: string) => {
      await rememberMotivation(text);
      await answer("accepted");
      reload();
    },
    [answer, reload],
  );

  // The welcome-back screen quotes without asking: it is a wobbly moment by
  // definition, and it spends the same month's allowance.
  const welcomeWords =
    identity?.motivation &&
    whyDue({ motivation: identity.motivation, quotedAt: identity.motivationQuotedAt, wobbly: true, today })
      ? identity.motivation
      : null;
  const noteQuoted = useCallback(() => {
    if (quotedOn !== today) void saveIdentity({ motivationQuotedAt: new Date().toISOString() }).then(reload);
  }, [quotedOn, today, reload]);

  return {
    why: showing ? (identity?.motivation ?? null) : null,
    whyAt: identity?.motivationAt,
    stillTrue: () => void answer("accepted"),
    notNow: () => void answer("dismissed"),
    change,
    welcomeWords,
    noteQuoted,
  };
}
