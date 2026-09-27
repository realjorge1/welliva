/**
 * useQuickLog — the two hand-entered logs (check-in, weigh-in) without the coach.
 *
 * Check-in and weigh-in used to be reachable only from Gozlin's overflow menu,
 * which put two ordinary logging actions inside a chat screen and left `/logs`
 * — the screen literally named for the record — unable to add to it. They moved
 * to Logs; this is what let them move.
 *
 * WHY NOT `useGozlin`. That hook is the whole coach: it loads four memory
 * tiers, builds the Twin, composes the day's briefing and holds an abort
 * controller for an in-flight agent turn. Mounting all of it on Logs to reach
 * three one-line writes would make a read-only screen pay for an AI engine it
 * never uses. The writes themselves are thin — two AppContext calls and one
 * memory-store append — so this takes them directly.
 *
 * WHY THE NARROW SLICES. `useApp()` would be one import instead of two, and it
 * re-renders on ANY state change in any domain. Profile + System is everything
 * this needs, and Logs already subscribes to both — so the hook costs its host
 * screen no additional re-renders at all.
 *
 * The check-in list is READ HERE rather than passed in because nothing else on
 * Logs needs it, and prefilling the sheet with today's existing answers is the
 * difference between "check in" and "update your check-in".
 */

import type { MindPayload } from "@/components/mind";
import { useProfile, useSystem } from "@/contexts/AppContext";
import { makeWeighIn } from "@/services/BodyLogService";
import {
  loadCheckins,
  recordMindEntry,
  type GozlinCheckin,
} from "@/services/gozlin";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeighInPayload } from "./WeighInModal";

export interface UseQuickLog {
  /** Today's `daily` state-of-mind entry, or null. Prefills the sheet. */
  todayCheckin: GozlinCheckin | null;
  /** How many entries today holds, of both kinds — the row caption reads this. */
  todayCount: number;
  /** Latest recorded weight, falling back to the onboarding figure. */
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  saveCheckin: (data: MindPayload) => Promise<void>;
  saveWeighIn: (data: WeighInPayload) => Promise<void>;
}

export function useQuickLog(): UseQuickLog {
  const { currentDate } = useSystem();
  const { bodyLogs, userBio, userGoals, logBodyMeasurement, setTargetWeight } =
    useProfile();
  const [checkins, setCheckins] = useState<GozlinCheckin[]>([]);

  useEffect(() => {
    let alive = true;
    void loadCheckins().then((c) => {
      if (alive) setCheckins(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The day's DAILY entry — momentary entries are deliberately not prefilled,
  // because a moment is a fresh reading and offering the last one as a starting
  // point would bias it toward whatever was true an hour ago.
  const todayCheckin = useMemo(
    () =>
      checkins.find((c) => c.date === currentDate && (c.kind ?? "daily") === "daily") ??
      null,
    [checkins, currentDate],
  );

  const todayCount = useMemo(
    () => checkins.filter((c) => c.date === currentDate).length,
    [checkins, currentDate],
  );

  // Same derivation the Twin uses: the most recent logged weight, or the
  // onboarding figure until there is one.
  const currentWeightKg = useMemo(() => {
    const latest = [...(bodyLogs ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return latest?.weightKg ?? userBio?.weightKg ?? null;
  }, [bodyLogs, userBio?.weightKg]);

  const goalWeightKg = userGoals?.targetWeightKg ?? null;

  // Goes through recordMindEntry rather than addCheckin: that is the path that
  // also mirrors the entry onto the health-os Timeline, which is what every
  // check-in written since migration 001 committed was silently missing.
  const saveCheckin = useCallback(
    async (data: MindPayload) => {
      setCheckins(
        await recordMindEntry({
          date: currentDate,
          kind: data.kind,
          valence: data.valence,
          labels: data.labels,
          associations: data.associations,
          sleepHours: data.sleepHours,
          id: data.id,
        }),
      );
    },
    [currentDate],
  );

  const saveWeighIn = useCallback(
    async (data: WeighInPayload) => {
      // Goal first: the forecast the weigh-in feeds should already know what
      // it's aiming at by the time the new measurement lands.
      if (data.goalWeightKg != null) await setTargetWeight(data.goalWeightKg);
      if (data.weightKg != null) {
        await logBodyMeasurement(makeWeighIn(data.weightKg, { waistCm: data.waistCm }));
      }
    },
    [logBodyMeasurement, setTargetWeight],
  );

  return {
    todayCheckin,
    todayCount,
    currentWeightKg,
    goalWeightKg,
    saveCheckin,
    saveWeighIn,
  };
}
