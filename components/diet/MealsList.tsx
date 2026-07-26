/**
 * MealsList — today's meals as a stack of premium swipeable cards.
 *
 * Each meal owns its own card (rounded, bordered, subtly elevated) rather than
 * sharing one panel, so completion tints, swipe actions and reflow read per
 * meal. The list keys on the stable slot so a swap updates a card in place
 * (no reload); adds/removes fade + reflow via each card's layout transition.
 *
 * The slot-based plan is a small, fixed set (breakfast/lunch/dinner + snacks),
 * so a mapped list with layout animations is lighter and smoother here than a
 * virtualized list — no windowing overhead, every card animates natively.
 */
import { enterFade } from "@/components/motion/motion";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { MealCard } from "./MealCard";
import { mealLayout } from "./mealAnimations";
import type { MealActionHandlers, MealListItem } from "./types";

export interface MealsListProps extends MealActionHandlers {
  meals: MealListItem[];
}

export function MealsList({ meals, onToggle, onSwap }: MealsListProps) {
  const { colors } = useColors();
  if (meals.length === 0) return null;

  const allDone = meals.every((m) => m.completed);

  return (
    <View style={styles.list}>
      {meals.map((m, i) => (
        <MealCard
          key={m.key}
          item={m}
          index={i}
          onToggle={onToggle}
          onSwap={onSwap}
        />
      ))}

      {allDone && (
        <Animated.View
          entering={enterFade()}
          layout={mealLayout()}
          style={[
            styles.done,
            {
              borderColor: alpha(colors.success, 0.4),
              backgroundColor: alpha(colors.success, 0.08),
            },
          ]}
        >
          <Ionicons name="checkmark-done-circle" size={18} color={colors.success} />
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            Every meal logged today — nicely done.
          </AppText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.md },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
