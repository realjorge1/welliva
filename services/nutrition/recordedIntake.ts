/**
 * services/nutrition/recordedIntake.ts — did a closed day record any intake?
 *
 * "Has a number" is not the test. Day-close writes consumed totals for EVERY day
 * it closes, so a day the user logged nothing on is saved as 0 kcal / 0 g / 0 g /
 * 0 g — which means "nothing was recorded", not "nothing was eaten". Plotted as
 * a real zero it dragged every nutrition line to the floor on each unlogged day,
 * and on the overlaid macro chart it did worse: 0 indexes to 0% for every macro,
 * so all four lines were pinned to the same point, and a week with one logged
 * day came out as four identical [0, 100, 0] series — one visible line.
 *
 * A day counts once any macro is positive. A zero macro on such a day (fat on a
 * day of fruit) is a real zero and is kept.
 *
 * ONE RULE, SHARED. It began private to the charts (components/charts/series);
 * the cycle tracker's hungrier-week and late-period reads need exactly the same
 * answer, and a second copy is how two screens come to disagree about whether
 * someone ate on Tuesday. Pure, so services and tests can import it.
 */
import type { DietHistoryEntry } from "@/models/diet";

export function hasRecordedIntake(
  e: Pick<DietHistoryEntry, "consumedCalories" | "consumedProteinG" | "consumedCarbsG" | "consumedFatG">,
): boolean {
  return [e.consumedCalories, e.consumedProteinG, e.consumedCarbsG, e.consumedFatG].some(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
}
