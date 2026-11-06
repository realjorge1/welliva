/**
 * Welcome back and fresh-start moments — the screen half (the rules are in
 * services/smart/welcomeBack).
 *
 * Both ask the same two questions and take the same two answers: start fresh
 * (a seven-day fresh start: easier workouts, "Your week" from today) or pick up
 * where you left off (nothing changes). Either answer ends that moment for good
 * — each return is welcomed once.
 */
import { useGamification, useSystem } from "@/contexts/AppContext";
import { todayDate } from "@/services/OfflineStorage";
import { wallClockOf } from "@/services/routine/clock";
import {
  answerFor,
  answerSmart,
  freshMomentDue,
  freshStartDay,
  loadFreshStart,
  startFresh,
  subscribeFreshStart,
  welcomeBackDue,
  type FreshStart,
  type SmartCandidate,
  type SmartFeature,
} from "@/services/smart";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useSmartLedger, useSmartMoment } from "./useSmartMoment";

/** Outranks everything: the day of a welcome back belongs to it. */
const WELCOME_PRIORITY = 100;

/** A fresh-start offer is a nice-to-have; the meal in front of you beats it. */
const FRESH_MOMENT_PRIORITY = 35;

interface WelcomeCandidate extends SmartCandidate {
  feature: Extract<SmartFeature, "welcome-back" | "fresh-start">;
  kind: "welcome" | "monday" | "month";
}

/** The running fresh start, if any: loaded, followed, re-read on every return. */
export function useFreshStart(): FreshStart | null {
  const [fresh, setFresh] = useState<FreshStart | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => {
      void loadFreshStart().then((f) => {
        if (alive) setFresh(f);
      });
    };
    read();
    const off = subscribeFreshStart(setFresh);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") read();
    });
    return () => {
      alive = false;
      off();
      sub.remove();
    };
  }, []);
  return fresh;
}

/** Day 1–7 of the fresh start today, or null. */
export function useFreshStartDay(): number | null {
  return freshStartDay(useFreshStart(), todayDate());
}

export function useWelcomeBack() {
  const { streakData } = useGamification();
  const { celebrations } = useSystem();
  const { answers } = useSmartLedger();
  const today = todayDate();
  const hour = new Date().getHours();

  const candidates = useMemo<WelcomeCandidate[]>(() => {
    const due = welcomeBackDue(streakData, today);
    if (due) {
      return answerFor(answers, due.id)
        ? []
        : [{ id: due.id, feature: "welcome-back", priority: WELCOME_PRIORITY, kind: "welcome" }];
    }
    const offered = answers
      .filter((a) => a.feature === "fresh-start")
      .map((a) => wallClockOf(a.at)?.date)
      .filter((d): d is string => d != null)
      .sort();
    const moment = freshMomentDue({
      streak: streakData,
      today,
      hour,
      lastOffered: offered.length ? offered[offered.length - 1] : null,
    });
    if (!moment || answerFor(answers, moment.id)) return [];
    return [{ id: moment.id, feature: "fresh-start", priority: FRESH_MOMENT_PRIORITY, kind: moment.kind }];
  }, [streakData, answers, today, hour]);

  const moment = useSmartMoment("home", candidates);

  const startFreshNow = useCallback(async (m: WelcomeCandidate) => {
    await startFresh(todayDate(), m.kind === "welcome" ? "welcome-back" : m.kind);
    await answerSmart({ id: m.id, feature: m.feature, answer: "accepted" });
  }, []);

  const pickUp = useCallback(async (m: WelcomeCandidate) => {
    await answerSmart({ id: m.id, feature: m.feature, answer: "declined" });
  }, []);

  return {
    /**
     * The full-screen welcome. Held back while a celebration is on screen: the
     * two are both Modals, and React Native silently drops the second.
     */
    welcome: moment?.kind === "welcome" && celebrations.length === 0 ? moment : null,
    /** The small Monday / 1st-of-the-month card. */
    freshMoment: moment && moment.kind !== "welcome" ? moment : null,
    startFresh: startFreshNow,
    pickUp,
  };
}

export type WelcomeMoment = NonNullable<ReturnType<typeof useWelcomeBack>["welcome"]>;
