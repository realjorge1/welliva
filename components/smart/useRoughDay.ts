/**
 * useRoughDay — today's rough day, and the three things that can happen to it:
 * marked ("Make today gentle"), taken back ("I'm OK actually"), and the
 * workout choice (a gentle walk, or rest).
 *
 * Each change is announced the two ways the rest of the app listens: the
 * streak re-reads its record (the day just became paused, or stopped being),
 * and every reminder module re-lays (services/notifications/pause), which is
 * what silences — or restores — the rest of today.
 */
import { emitExternalWrite } from "@/services/notifications/externalWrites";
import { announceQuietChange } from "@/services/notifications/pause";
import { todayDate } from "@/services/OfflineStorage";
import {
  ROUGH_DAYS_PER_MONTH,
  canProtect,
  chooseRoughWorkout,
  clearRoughDay,
  loadRoughDays,
  markRoughDay,
  protectedThisMonth,
  roughDayOn,
  subscribeRoughDays,
  type RoughDay,
  type RoughReason,
} from "@/services/smart/roughDay";
import { track } from "@/services/telemetry";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export function useRoughDays(): RoughDay[] {
  const [list, setList] = useState<RoughDay[]>([]);
  useEffect(() => {
    let alive = true;
    const apply = (next: RoughDay[]) => {
      if (alive) setList(next);
    };
    void loadRoughDays().then(apply);
    const off = subscribeRoughDays(apply);
    // Another phone's rough day arrives through sync; read it on every return.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void loadRoughDays().then(apply);
    });
    return () => {
      alive = false;
      off();
      sub.remove();
    };
  }, []);
  return list;
}

/** Is today a rough day? The one-line read for screens that only need that. */
export function useRoughToday(): RoughDay | null {
  return roughDayOn(useRoughDays(), todayDate());
}

function announce(): void {
  emitExternalWrite({ kind: "streak", date: todayDate() });
  void announceQuietChange();
}

export function useRoughDay() {
  const list = useRoughDays();
  const today = todayDate();
  const rough = roughDayOn(list, today);

  const mark = useCallback(async (reason?: RoughReason) => {
    await markRoughDay(reason);
    // Which feature, never the reason (services/telemetry/events.ts).
    track("smart_moment", { feature: "rough-day", result: "accepted" });
    announce();
  }, []);

  const clear = useCallback(async () => {
    await clearRoughDay();
    track("smart_moment", { feature: "rough-day", result: "dismissed" });
    announce();
  }, []);

  const chooseWorkout = useCallback(async (choice: "walk" | "rest") => {
    await chooseRoughWorkout(choice);
  }, []);

  return {
    rough,
    /** Would a rough day marked now pause the streak? */
    canProtectToday: canProtect(list, today),
    usedThisMonth: protectedThisMonth(list, today),
    perMonth: ROUGH_DAYS_PER_MONTH,
    mark,
    clear,
    chooseWorkout,
  };
}
