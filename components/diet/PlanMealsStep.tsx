/**
 * PlanMealsStep — "How should we plan your meals?", asked every time a diet is
 * started from the Diet screen, not only once in onboarding.
 *
 * Picking a diet and a length used to start the plan on the spot, with every
 * meal chosen by the generator. Now the third beat of that sheet is the same
 * question onboarding asks — Gozlin plans every day, or the user picks their own
 * breakfasts, lunches and dinners — and the same planner answers it
 * (components/onboarding/flow/MenuPlanner), with one difference that matters:
 * the dishes on offer are THE CHOSEN DIET'S (services/nutrition/menuBuilder
 * dietDishesForSlot), the same shelf "plan them for me" rotates through, so
 * neither answer can step outside the diet or the user's restrictions.
 *
 * It knows how long the plan runs, so a one-day plan picks one dish per meal
 * (a new tap replaces the old) and a short plan only rotates dishes onto the
 * weekdays it actually reaches.
 *
 * Owns its beat, its picks and its footer; the screen owns saving.
 */
import { MenuPlanner, type MenuMode, type MenuSample } from "@/components/onboarding/flow";
import { Button, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { DietData } from "@/constants/DietDatabase";
import type { NutritionTargets } from "@/models/nutrition";
import type { UserBio } from "@/models/user";
import { addDays } from "@/models/mealPlan";
import { generateDietPlan } from "@/services/DietPlanGenerator";
import { midpoint } from "@/services/nutrition/MealCatalog";
import { cuisineWord, dishTitle } from "@/services/nutrition/mealRules";
import {
  MAIN_SLOTS,
  cycleDayIn,
  dietDishesForSlot,
  emptyDraft,
  picksFor,
  portionFor,
  slotTargets,
  toggleDishIn,
  weekdaysOf,
  type Dish,
  type MainSlot,
  type MenuDraft,
} from "@/services/nutrition/menuBuilder";
import React, { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

/** Most picks per meal: enough to rotate a week, few enough to stay a choice. */
const MAX_PICKS_PER_MEAL = 6;

const SLOT_OF_PHASE: Record<number, MainSlot> = { 1: "breakfast", 2: "lunch", 3: "dinner" };

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}

export interface PlanMealsStepProps {
  diet: DietData;
  bio: UserBio;
  targets: NutritionTargets;
  /** Every date the plan covers, first to last. */
  dates: string[];
  /** What starting a Gozlin-planned run says: "Start this week's plan". */
  startLabel: string;
  busy: boolean;
  /** Draws the sheet's header with this step's title and back action. */
  renderHeader: (title: string, onBack: () => void) => React.ReactNode;
  /** Back from the first beat — to "how long?". */
  onExit: () => void;
  onPlanForMe: () => void;
  onStartMenu: (draft: MenuDraft) => void;
  /** Filled with this step's back action, for the hardware back button. */
  backRef?: MutableRefObject<(() => void) | null>;
}

export function PlanMealsStep({
  diet,
  bio,
  targets,
  dates,
  startLabel,
  busy,
  renderHeader,
  onExit,
  onPlanForMe,
  onStartMenu,
  backRef,
}: PlanMealsStepProps) {
  const { colors } = useColors();
  const [mode, setMode] = useState<MenuMode>("auto");
  /** 0 the choice · 1–3 breakfast, lunch, dinner. */
  const [phase, setPhase] = useState(0);
  const [draft, setDraft] = useState<MenuDraft>(emptyDraft);

  const active = useMemo(() => weekdaysOf(dates), [dates]);
  const maxPicks = Math.max(1, Math.min(MAX_PICKS_PER_MEAL, active.length));
  const cuisine =
    bio.cuisinePreference && bio.cuisinePreference !== "mixed" ? cuisineWord(bio.cuisinePreference) : null;

  /** Every dish this diet may serve this user, per meal. */
  const slots = useMemo(() => {
    const filter = {
      cuisinePreference: bio.cuisinePreference,
      dietaryRestriction: bio.dietaryRestriction,
      allergies: bio.allergies,
      foodDislikes: bio.foodDislikes,
    };
    const out = {} as Record<MainSlot, { dishes: Dish[]; staples: Dish[] }>;
    for (const slot of MAIN_SLOTS) out[slot] = dietDishesForSlot(slot, diet.id, filter);
    return out;
  }, [diet.id, bio]);

  /** The plan's first days as Gozlin would serve them — the real dishes, not a promise. */
  const samples = useMemo<MenuSample[]>(() => {
    const first = dates[0];
    if (!first) return [];
    return dates.slice(0, 3).flatMap((date) => {
      const day = generateDietPlan(bio, targets, date, diet.id)?.schedule;
      const meals = day
        ? [day.breakfast, day.lunch, day.dinner].flatMap((m) => (m ? [dishTitle(m.name)] : []))
        : [];
      return meals.length > 0 ? [{ label: dayLabel(date, first), meals }] : [];
    });
  }, [dates, bio, targets, diet.id]);

  const perSlotKcal = useMemo(() => slotTargets(targets, bio.mealsPerDay), [targets, bio.mealsPerDay]);
  const metaFor = useCallback(
    (dish: Dish) => {
      const portion = portionFor(dish, perSlotKcal[dish.slot]);
      return `≈ ${midpoint(portion.calories)} kcal · ${midpoint(portion.protein)} g protein`;
    },
    [perSlotKcal],
  );

  const back = useCallback(() => {
    if (phase > 0) setPhase((p) => p - 1);
    else onExit();
  }, [phase, onExit]);
  useEffect(() => {
    if (!backRef) return;
    backRef.current = back;
    return () => {
      backRef.current = null;
    };
  }, [backRef, back]);

  // A new beat starts at its top, not wherever the last list was scrolled to.
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [phase]);

  const pickedAny = MAIN_SLOTS.some((s) => picksFor(draft, s).length > 0);
  const slot = SLOT_OF_PHASE[phase];
  const pickedHere = slot ? picksFor(draft, slot).length > 0 : false;

  const label = busy
    ? "Starting…"
    : phase === 0
      ? mode === "auto"
        ? startLabel
        : "Start with breakfast"
      : phase === 3
        ? "Start my plan"
        : !pickedHere
          ? `Let Gozlin pick ${slot}`
          : phase === 1
            ? "Continue to lunch"
            : "Continue to dinner";

  const primary = () => {
    if (busy) return;
    if (phase === 0 && mode === "auto") return onPlanForMe();
    if (phase < 3) return setPhase((p) => p + 1);
    // Nothing picked anywhere is "plan them for me" — say it the plain way, so
    // the days stay Gozlin's to plan rather than frozen into a menu.
    if (!pickedAny) return onPlanForMe();
    onStartMenu(draft);
  };

  return (
    <>
      {renderHeader("Your meals", back)}
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <MenuPlanner
          phase={mode === "choose" ? phase : 0}
          onJump={setPhase}
          mode={mode}
          onMode={setMode}
          cuisine={cuisine}
          dailyKcal={Math.round(targets.calories)}
          samples={samples}
          slots={slots}
          draft={draft}
          onToggleDish={(dish) => setDraft((d) => toggleDishIn(d, dish, maxPicks, active))}
          onCycleDay={(s, day) => setDraft((d) => cycleDayIn(d, s, day))}
          metaFor={metaFor}
          maxPicks={maxPicks}
          showLength={false}
          dietName={diet.name}
          active={active}
          planLength={dates.length}
        />
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.divider, backgroundColor: colors.background }]}>
        <Button
          label={label}
          icon={busy ? undefined : phase === 0 && mode === "auto" ? "flash" : undefined}
          onPress={primary}
          disabled={busy}
          loading={busy}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.screen, paddingBottom: Spacing.xxl },
  footer: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
