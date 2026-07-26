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
}

export interface MealActionHandlers {
  onToggle: (mealType: MealListItem["mealType"], snackIndex?: number) => void;
  onSwap: (mealType: MealListItem["mealType"], snackIndex?: number) => void;
}
