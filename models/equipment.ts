/**
 * EQUIPMENT CHOICES — the one rule every equipment picker shares.
 *
 * Up to three choices. "Bodyweight & mat" (`none`) is a choice like any other.
 * It used to be EXCLUSIVE — picking dumbbells cleared it, picking it cleared
 * the gear — which every user read as "dumbbells OR bodyweight, never both".
 *
 * What the planner does with the list is unchanged: bodyweight moves are
 * always open to it (services/training/context.ts adds `none` to every list),
 * and each piece of gear ticked here unlocks the moves that need it. So the
 * pickers say so — "bodyweight moves are always in your plan" — rather than
 * implying the Bodyweight tick switches anything on or off. (Measured before
 * deciding: weighting gear down when Bodyweight is also ticked moved a plan
 * by a move or two at most, too little to claim it built a different week.)
 *
 * The list is never empty — un-ticking the last choice falls back to
 * bodyweight — and the order is the order picked, so summaries read back the
 * way the user built them.
 *
 * Pure (no React), shared by onboarding, Settings and the training nudge.
 */
import type { Equipment } from "./workout";

/** The most equipment choices a user can hold at once. */
export const MAX_EQUIPMENT = 3;

/** Short human label per equipment value. */
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: "Bodyweight",
  dumbbells: "Dumbbells",
  resistance_bands: "Bands",
  pull_up_bar: "Pull-up bar",
  bench: "Bench",
  kettlebell: "Kettlebell",
};

const BODYWEIGHT: readonly Equipment[] = ["none"];

export interface EquipmentToggle {
  next: Equipment[];
  /** True when the tap was refused because the list is already full. */
  capped: boolean;
}

/**
 * Tick or un-tick one choice. Adding past MAX_EQUIPMENT is refused (`capped`)
 * rather than silently dropping something the user picked earlier.
 */
export function toggleEquipment(current: readonly Equipment[] | undefined, value: Equipment): EquipmentToggle {
  const cur = current && current.length > 0 ? [...current] : [...BODYWEIGHT];
  if (cur.includes(value)) {
    const next = cur.filter((e) => e !== value);
    return { next: next.length > 0 ? next : [...BODYWEIGHT], capped: false };
  }
  if (cur.length >= MAX_EQUIPMENT) return { next: cur, capped: true };
  return { next: [...cur, value], capped: false };
}

/** True once a list holds as many choices as it may. */
export function equipmentFull(list: readonly Equipment[] | undefined): boolean {
  return (list?.length ?? 0) >= MAX_EQUIPMENT;
}

/** "Bodyweight, Dumbbells" — human labels in the order they were picked. */
export function equipmentSummary(list: readonly Equipment[] | undefined, separator = ", "): string {
  const items = list && list.length > 0 ? list : BODYWEIGHT;
  return items.map((e) => EQUIPMENT_LABEL[e] ?? String(e).replace(/_/g, " ")).join(separator);
}
