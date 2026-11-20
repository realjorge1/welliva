/** Shared shapes for the meals list. */

export interface MealListItem {
  /** Stable identity for the slot (e.g. "breakfast", "snack-1"). */
  key: string;
  /** Underlying meal id — changes when the meal is swapped. */
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  snackIndex?: number;
  /** Slot label ("Breakfast", "Snack 2"). */
  label: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  completed: boolean;
  smartSwap?: boolean;
  /** Original plan order (breakfast → lunch → dinner → snacks). */
  order: number;
  /** ISO time the meal was checked off, when completed. */
  consumedAt?: string;
  /** Servings of the dish the plan serves (absent = 1). The macros above include it. */
  servings?: number;
  /** How much of the planned meal she ate, once ticked (absent = 1). */
  portion?: number;
}

export interface MealActionHandlers {
  onToggle: (mealType: MealListItem["mealType"], snackIndex?: number) => void;
  onSwap: (mealType: MealListItem["mealType"], snackIndex?: number) => void;
  /** Opens "how much did you have?" for a ticked meal. Absent = no portion control. */
  onPortion?: (mealType: MealListItem["mealType"], snackIndex?: number) => void;
}

/** "½×", "1×", "1¼×", "2×" — a multiplier as a cook would write it. */
export function servingsLabel(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4) / 4;
  const fracGlyph =
    frac === 0.25
      ? String.fromCharCode(0xbc)
      : frac === 0.5
        ? String.fromCharCode(0xbd)
        : frac === 0.75
          ? String.fromCharCode(0xbe)
          : "";
  const head = whole === 0 && fracGlyph ? "" : String(whole);
  return `${head}${fracGlyph}${String.fromCharCode(0xd7)}`;
}
