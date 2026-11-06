/**
 * MealCard — one meal, as an instrument row you tick and swipe.
 *
 *   • Tap the circular checkbox to complete / un-complete (see MealCheckbox).
 *   • Tap the body (while un-eaten) to open the swap/edit sheet.
 *   • Swipe left to reveal a Swap action that tracks the finger and scales in.
 *
 * THE LOOK (owner, 2026-10-31: "can be upgraded to be more premium") is Home's
 * instrument surface — black, a thin white edge — with the meal's numbers set
 * like readings: the slot in mono caps, the dish, its calories in the display
 * face on the right, and the three macros as coloured dots. Under them, one thin
 * bar splits the dish's energy between protein, carbs and fat (4, 4 and 9 kcal a
 * gram) — the shape of the meal at a glance, read off the same grams printed
 * above it, never a decoration.
 *
 * EATEN is told without a strike-through (a struck line reads as "cancelled",
 * not "done"): the edge takes the meal's colour, a wash of it rises from the
 * left, the dish dims a step, and the time it was ticked joins the slot name.
 *
 * The swipe pan is tuned to live inside the vertical page scroll: it only claims
 * horizontal drags (`activeOffsetX`) and yields to vertical ones (`failOffsetY`).
 * All motion is UI-thread (Reanimated); the list handles enter/exit/reflow.
 */
import AILogoIcon from "@/components/gozlin/AILogoIcon";
import { EDGE_WHITE, HOME_ORANGE, INSTRUMENT_BLACK, MACRO_VIVID } from "@/components/home/surface";
import { AppText, Mono, useColors } from "@/components/ui";
import { retroText } from "@/constants/RetroFont";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
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

/** Each slot's colour — the saturated set, which holds its own on black. */
function toneFor(mealType: MealListItem["mealType"]): string {
  switch (mealType) {
    case "breakfast":
      return HOME_ORANGE;
    case "lunch":
      return MACRO_VIVID.protein;
    case "dinner":
      return MACRO_VIVID.fat;
    default:
      return MACRO_VIVID.carbs;
  }
}

/** "08:12" in the phone's own clock style, or null for a missing/odd stamp. */
function eatenAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export interface MealCardProps extends MealActionHandlers {
  item: MealListItem;
  index: number;
}

export function MealCard({ item, index, onToggle, onSwap }: MealCardProps) {
  const { colors } = useColors();
  const tone = toneFor(item.mealType);
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

  const edgeTone = alpha(tone, 0.55);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    borderColor: interpolateColor(done.value, [0, 1], [EDGE_WHITE, edgeTone]),
  }));
  const washStyle = useAnimatedStyle(() => ({ opacity: done.value }));
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

  // The dish's energy, split by where it comes from.
  const pKcal = Math.max(0, item.proteinG) * 4;
  const cKcal = Math.max(0, item.carbsG) * 4;
  const fKcal = Math.max(0, item.fatG) * 9;
  const hasSplit = pKcal + cKcal + fKcal > 0;
  const time = completed ? eatenAt(item.consumedAt) : null;
  const slot = time ? `${item.label} · ${time}` : item.label;

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
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Eaten: a wash of the meal's colour, rising from the left. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]}>
            <LinearGradient
              colors={[alpha(tone, 0.16), alpha(tone, 0)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 0.85, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Pressable
            style={({ pressed }) => [styles.cardInner, { opacity: pressed ? 0.9 : 1 }]}
            onPress={handleBodyPress}
            accessibilityRole="button"
            accessibilityLabel={
              completed
                ? `${item.label}: ${item.name}, eaten`
                : `${item.label}: ${item.name}. Opens other options`
            }
          >
            <MealCheckbox completed={completed} tone={tone} onPress={handleToggle} size={30} />

            <View style={styles.body}>
              <View style={styles.labelRow}>
                <Mono
                  size={11}
                  tracking={0.8}
                  color={completed ? tone : colors.textTertiary}
                  numberOfLines={1}
                  style={styles.slot}
                >
                  {slot.toUpperCase()}
                </Mono>
                {item.smartSwap && !completed && (
                  <View style={[styles.smartHint, { borderColor: alpha(colors.primary, 0.45) }]}>
                    <AILogoIcon size={10} />
                    <AppText variant="caption" color="brand" style={styles.bold}>
                      Smart swap
                    </AppText>
                  </View>
                )}
              </View>

              <AppText
                variant="callout"
                weight="700"
                color={completed ? "secondary" : "primary"}
                numberOfLines={2}
                style={styles.name}
              >
                {item.name || "Not set"}
              </AppText>

              <View style={styles.macros}>
                <MacroDot tone={MACRO_VIVID.protein} letter="P" grams={item.proteinG} />
                <MacroDot tone={MACRO_VIVID.carbs} letter="C" grams={item.carbsG} />
                <MacroDot tone={MACRO_VIVID.fat} letter="F" grams={item.fatG} />
              </View>

              {hasSplit ? (
                <View
                  style={styles.split}
                  accessible
                  accessibilityLabel={`Energy: ${Math.round((pKcal / (pKcal + cKcal + fKcal)) * 100)} percent protein, ${Math.round((cKcal / (pKcal + cKcal + fKcal)) * 100)} percent carbs, ${Math.round((fKcal / (pKcal + cKcal + fKcal)) * 100)} percent fat`}
                >
                  {pKcal > 0 ? (
                    <View style={[styles.splitPart, { flex: pKcal, backgroundColor: MACRO_VIVID.protein }]} />
                  ) : null}
                  {cKcal > 0 ? (
                    <View style={[styles.splitPart, { flex: cKcal, backgroundColor: MACRO_VIVID.carbs }]} />
                  ) : null}
                  {fKcal > 0 ? (
                    <View style={[styles.splitPart, { flex: fKcal, backgroundColor: MACRO_VIVID.fat }]} />
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.kcal}>
              <AppText
                variant="headline"
                color={completed ? "secondary" : "primary"}
                numberOfLines={1}
                style={retroText}
              >
                {item.calories}
              </AppText>
              <Mono size={10} tracking={0.8} color={colors.textTertiary}>
                KCAL
              </Mono>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function MacroDot({ tone, letter, grams }: { tone: string; letter: string; grams: number }) {
  const { colors } = useColors();
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Mono size={11} color={colors.textSecondary}>
        {letter} {Math.round(grams)}g
      </Mono>
    </View>
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
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  actionLabel: { fontWeight: "700" },
  card: {
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
  },
  body: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  slot: { flexShrink: 1 },
  smartHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  name: { marginTop: 3 },
  macros: { flexDirection: "row", flexWrap: "wrap", columnGap: Spacing.md, rowGap: 2, marginTop: 6 },
  macro: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  split: {
    flexDirection: "row",
    gap: 2,
    height: 3,
    marginTop: Spacing.sm,
    borderRadius: 2,
    overflow: "hidden",
  },
  splitPart: { height: 3, borderRadius: 2 },
  kcal: { alignItems: "flex-end", flexShrink: 0, gap: 1 },
});
