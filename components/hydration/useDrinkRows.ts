/**
 * useDrinkRows — today's drinks, as the hydration card lists them.
 *
 * It reads the stored list once, then LISTENS: waterStore announces after every
 * write to it, whichever door the water came through (this card, the gold +, the
 * lock-screen button). Re-reading on a change of the day's total instead would
 * race the very write it is reacting to — the total moves optimistically, a
 * frame before the drink reaches storage — and the list would sit one drink
 * behind until something else nudged it.
 *
 * The rows are then fitted to the counter (services/nutrition/waterPours): the
 * counter is the truth, and the list is only ever allowed to explain it.
 */
import {
  poursOn,
  reconcilePours,
  type DrinkRows,
  type PourLog,
} from "@/services/nutrition/waterPours";
import { readWaterPours, subscribeWaterPours } from "@/services/nutrition/waterStore";
import { useEffect, useMemo, useState } from "react";

export function useDrinkRows(totalMl: number, today: string): DrinkRows {
  const [log, setLog] = useState<PourLog | null>(null);

  useEffect(() => {
    let alive = true;
    void readWaterPours().then((l) => {
      if (alive) setLog(l);
    });
    const stop = subscribeWaterPours((l) => {
      if (alive) setLog(l);
    });
    return () => {
      alive = false;
      stop();
    };
    // `today` re-reads across midnight: the stored list is the OLD day's until
    // the first drink of the new one replaces it, and poursOn() hides it meanwhile.
  }, [today]);

  return useMemo(() => reconcilePours(totalMl, poursOn(log, today)), [log, totalMl, today]);
}
