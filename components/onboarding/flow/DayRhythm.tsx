/**
 * DayRhythm — what "how many meals?" looks like across a day.
 *
 * The two answers differ by ONE snack: three meals and a snack, or three meals
 * and two (that is exactly what `DietPlanGenerator` builds from `mealsPerDay`).
 * Read as "3 meals" / "4 meals" that is an abstraction; drawn as a day, it is a
 * single mark arriving between breakfast and lunch, and the choice is obvious.
 *
 * Snacks are drawn BETWEEN meals, never at a time. The plan gives them no clock,
 * so this draws an order, not a schedule.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Appear } from "./Appear";
import { Dur, Ease, Stagger, useMotion } from "./onboardingMotion";
import { HAIRLINE } from "./onboardingTheme";

const MEAL = 12;
const SNACK = 7;
const TRACK = 16;

const MARKS: { at: `${number}%`; meal: boolean; secondSnack?: boolean }[] = [
  { at: "0%", meal: true },
  { at: "25%", meal: false, secondSnack: true },
  { at: "50%", meal: true },
  { at: "75%", meal: false },
  { at: "100%", meal: true },
];

function Mark({
  meal,
  at,
  shown,
  enterDelay,
}: {
  meal: boolean;
  at: `${number}%`;
  shown: boolean;
  enterDelay: number;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const p = useSharedValue(0);
  const arrived = useRef(false);

  useEffect(() => {
    // The first arrival is staggered along the day; a changed answer is immediate.
    const wait = arrived.current ? 0 : enterDelay;
    arrived.current = true;
    p.value = withDelay(
      motion.delay(wait),
      withTiming(shown ? 1 : 0, { duration: motion.dur(Dur.ui), easing: Ease.soft }),
    );
  }, [shown, enterDelay, motion, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.4 + 0.6 * p.value }],
  }));

  const size = meal ? MEAL : SNACK;
  return (
    <Animated.View
      style={[
        styles.mark,
        {
          left: at,
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          top: (TRACK - size) / 2,
          backgroundColor: meal ? colors.primary : alpha(colors.primary, 0.5),
        },
        style,
      ]}
    />
  );
}

export function DayRhythm({ meals, delay = 0 }: { meals: number; delay?: number }) {
  const { colors } = useColors();
  const twoSnacks = meals >= 4;

  return (
    <Appear delay={delay} duration={Dur.content} distance={6}>
      <View
        style={styles.wrap}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          twoSnacks
            ? "Your day: breakfast, a snack, lunch, a snack, dinner."
            : "Your day: breakfast, lunch, a snack, dinner."
        }
      >
        <View style={styles.track}>
          <View style={[styles.line, { backgroundColor: alpha(colors.border, 1) }]} />
          {/* Inset by half a meal mark, so the end marks sit flush with the gutters. */}
          <View style={styles.lane}>
            {MARKS.map((m, i) => (
              <Mark
                key={m.at}
                meal={m.meal}
                at={m.at}
                shown={!m.secondSnack || twoSnacks}
                enterDelay={delay + 160 + i * Stagger.item}
              />
            ))}
          </View>
        </View>
        <View style={styles.labels}>
          <AppText variant="caption" color="tertiary">
            Breakfast
          </AppText>
          <AppText variant="caption" color="tertiary">
            Lunch
          </AppText>
          <AppText variant="caption" color="tertiary">
            Dinner
          </AppText>
        </View>
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  track: { height: TRACK },
  line: {
    position: "absolute",
    left: MEAL / 2,
    right: MEAL / 2,
    top: TRACK / 2 - HAIRLINE / 2,
    height: HAIRLINE,
    borderRadius: HAIRLINE,
  },
  lane: { position: "absolute", left: MEAL / 2, right: MEAL / 2, top: 0, bottom: 0 },
  mark: { position: "absolute" },
  labels: { flexDirection: "row", justifyContent: "space-between" },
});
