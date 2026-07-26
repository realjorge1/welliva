/**
 * MealCard — one meal, as a premium swipeable row.
 *
 *   • Tap the circular checkbox to complete / un-complete (see MealCheckbox);
 *     a completed card settles into a faint tone-tinted, struck-through state.
 *   • Tap the body (while un-eaten) to open the swap/edit sheet.
 *   • Swipe left to reveal a Swap action that tracks the finger and scales in.
 *
 * The swipe pan is tuned to live inside the vertical page scroll: it only claims
 * horizontal drags (`activeOffsetX`) and yields to vertical ones (`failOffsetY`).
 * All motion is UI-thread (Reanimated); the list handles enter/exit/reflow.
 */
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MealCheckbox } from "./MealCheckbox";
import { CARD_SPRING, mealEnter, mealExit, mealLayout } from "./mealAnimations";
import type { MealActionHandlers, MealListItem } from "./types";

const ACTION_W = 92;
const OPEN_X = -ACTION_W;

type Colors = ReturnType<typeof useColors>["colors"];

function toneFor(mealType: MealListItem["mealType"], colors: Colors): string {
  switch (mealType) {
    case "breakfast":
      return colors.calories;
    case "lunch":
      return colors.protein;
    case "dinner":
      return colors.fat;
    default:
      return colors.carbs;
  }
}

export interface MealCardProps extends MealActionHandlers {
  item: MealListItem;
  index: number;
}

export function MealCard({ item, index, onToggle, onSwap }: MealCardProps) {
  const { colors } = useColors();
  const tone = toneFor(item.mealType, colors);
  const completed = item.completed;

  const tx = useSharedValue(0);
  const startX = useSharedValue(0);
  const done = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    done.value = withTiming(completed ? 1 : 0, { duration: 340 });
    // A meal that's just been eaten can't stay swiped open.
    if (completed) tx.value = withSpring(0, CARD_SPRING);
  }, [completed, done, tx]);

  const closeJS = () => {
    tx.value = withSpring(0, CARD_SPRING);
  };

  const pan = Gesture.Pan()
    .enabled(!completed)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      startX.value = tx.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      // Left-swipe only, with a little rubber-band past the action width.
      tx.value = Math.min(0, Math.max(OPEN_X - 28, next));
    })
    .onEnd((e) => {
      const open = tx.value < OPEN_X * 0.5 || e.velocityX < -650;
      tx.value = withSpring(open ? OPEN_X : 0, CARD_SPRING);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: done.value * 0.1 }));
  const actionStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.abs(tx.value) / ACTION_W);
    return { opacity: t, transform: [{ scale: 0.7 + t * 0.3 }] };
  });

  const handleToggle = () => onToggle(item.mealType, item.snackIndex);
  const handleBodyPress = () => {
    if (completed) return;
    if (tx.value !== 0) {
      closeJS();
      return;
    }
    onSwap(item.mealType, item.snackIndex);
  };
  const handleSwapAction = () => {
    closeJS();
    onSwap(item.mealType, item.snackIndex);
  };

  return (
    <Animated.View
      entering={mealEnter(index)}
      exiting={mealExit()}
      layout={mealLayout()}
      style={styles.wrap}
    >
      {/* Swap action, revealed from behind on left-swipe */}
      {!completed && (
        <View style={styles.actionsLayer} pointerEvents="box-none">
          <Animated.View style={[styles.actionInner, actionStyle]}>
            <Pressable
              onPress={handleSwapAction}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Swap ${item.label}`}
            >
              <Ionicons name="swap-horizontal" size={20} color={colors.onPrimary} />
              <AppText
                variant="caption"
                style={[styles.actionLabel, { color: colors.onPrimary }]}
              >
                Swap
              </AppText>
            </Pressable>
          </Animated.View>
        </View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardStyle,
          ]}
        >
          {/* Faint tone wash once the meal is done */}
          <Animated.View
            pointerEvents="none"
            style={[styles.tint, { backgroundColor: tone }, tintStyle]}
          />
          <Pressable
            style={({ pressed }) => [styles.cardInner, { opacity: pressed ? 0.9 : 1 }]}
            onPress={handleBodyPress}
          >
            <MealCheckbox completed={completed} tone={tone} onPress={handleToggle} />

            <View style={styles.body}>
              <View style={styles.labelRow}>
                <AppText variant="caption" color="tertiary" uppercase>
                  {item.label}
                </AppText>
                {item.smartSwap && !completed && (
                  <View style={[styles.smartHint, { backgroundColor: colors.primarySoft }]}>
                    <AILogoIcon size={10} color={colors.primary} />
                    <AppText variant="caption" color="brand" style={styles.bold}>
                      Smart swap
                    </AppText>
                  </View>
                )}
              </View>

              <AppText
                variant="callout"
                color={completed ? "secondary" : "primary"}
                numberOfLines={2}
                style={[styles.name, completed && styles.struck]}
              >
                {item.name || "Not set"}
              </AppText>

              <AppText variant="footnote" color="tertiary" style={styles.macros}>
                {item.calories} kcal · P {item.proteinG}g · C {item.carbsG}g · F{" "}
                {item.fatG}g
              </AppText>
            </View>

            {completed ? (
              <Ionicons name="checkmark-circle" size={18} color={tone} style={styles.trailing} />
            ) : (
              <Ionicons
                name="chevron-back"
                size={15}
                color={colors.textTertiary}
                style={styles.trailing}
              />
            )}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  wrap: { justifyContent: "center" },
  actionsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  actionInner: { width: ACTION_W, height: "100%", paddingLeft: Spacing.sm },
  actionBtn: {
    flex: 1,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  actionLabel: { fontWeight: "700" },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  tint: { ...StyleSheet.absoluteFillObject },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  body: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  smartHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  name: { marginTop: 2 },
  struck: { textDecorationLine: "line-through" },
  macros: { marginTop: 4 },
  trailing: { marginLeft: Spacing.xs },
});
