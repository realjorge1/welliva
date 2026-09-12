/**
 * CinematicExit — leaving onboarding as an arrival, not a navigation.
 *
 * Tapping "Start my journey" does not cut to Home. The plan recedes, the ring's
 * circle grows out of the middle of the screen until it has swallowed it, the
 * Welliva mark appears in the dark for a beat, and the app is underneath when
 * it clears.
 *
 * WHY THE COVER IS OPAQUE. The overlay lives inside the onboarding route, so it
 * dies the moment we navigate — there is no shared element to hand to the next
 * screen. The way to make that unmounting invisible is to navigate while the
 * screen is completely covered by the app's own canvas colour, which is exactly
 * what Home paints too. The result is what the brief describes: the home screen
 * emerging from underneath, with no cut to see.
 *
 * WHY IT REPORTS `onCovered` RATHER THAN NAVIGATING. Saving the profile is
 * asynchronous and may fail. The step waits for BOTH this callback and a
 * successful save before it routes, and can reverse the whole overlay if the
 * save throws — which is why `active` is a prop and not internal state.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { HAIRLINE } from "./onboardingTheme";

/** Diameter of the circle at rest — the calorie ring's own size. */
const SEED = 158;
/** When the canvas behind the circle has finished taking the screen. */
const COVER_AT = 820;

export interface CinematicExitProps {
  active: boolean;
  /** Fired once the screen is fully covered and it is safe to navigate. */
  onCovered: () => void;
}

export function CinematicExit({ active, onCovered }: CinematicExitProps) {
  const { colors } = useColors();
  const motion = useMotion();
  const { width, height } = useWindowDimensions();
  const fired = useRef(false);

  // Enough to cover the corners from the centre, whatever the aspect ratio.
  const reach = (Math.hypot(width, height) * 1.06) / SEED;

  const grow = useSharedValue(0);
  const cover = useSharedValue(0);
  const mark = useSharedValue(0);

  const report = React.useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onCovered();
  }, [onCovered]);

  useEffect(() => {
    if (!active) {
      fired.current = false;
      grow.value = withTiming(0, { duration: motion.dur(Dur.ui), easing: Ease.exit });
      cover.value = withTiming(0, { duration: motion.dur(Dur.ui), easing: Ease.exit });
      mark.value = withTiming(0, { duration: motion.dur(Dur.micro), easing: Ease.exit });
      return;
    }

    // Reduce Motion gets the same hand-over without the expansion: the canvas
    // simply fades up and the mark appears. Same timing contract, no travel.
    if (motion.reduced) {
      cover.value = withTiming(1, { duration: 260, easing: Ease.standard }, (done) => {
        if (done) runOnJS(report)();
      });
      mark.value = withDelay(200, withTiming(1, { duration: 220 }));
      return;
    }

    grow.value = withDelay(
      120,
      withTiming(1, { duration: 780, easing: Ease.glide }),
    );
    cover.value = withDelay(
      420,
      withTiming(1, { duration: 420, easing: Ease.standard }, (done) => {
        if (done) runOnJS(report)();
      }),
    );
    mark.value = withDelay(680, withTiming(1, { duration: 340, easing: Ease.soft }));
  }, [active, motion, grow, cover, mark, report]);

  // Belt and braces: if the animation callback never lands (a backgrounded app
  // pauses the UI thread), the flow must still be able to leave.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(report, COVER_AT + 400);
    return () => clearTimeout(t);
  }, [active, report]);

  const circle = useAnimatedStyle(() => ({
    opacity: grow.value > 0 ? 1 : 0,
    transform: [{ scale: 0.2 + (reach - 0.2) * grow.value }],
  }));
  const canvas = useAnimatedStyle(() => ({ opacity: cover.value }));
  const badge = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.9 + 0.1 * mark.value }],
  }));

  if (!active) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      // The flow is leaving; nothing underneath should be reachable, by touch
      // or by a screen reader, while it does.
      accessibilityViewIsModal
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.centre} pointerEvents="none">
        <Animated.View
          style={[
            styles.circle,
            { backgroundColor: colors.background, borderColor: alpha(colors.primary, 0.22) },
            circle,
          ]}
        />
      </View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, canvas]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.centre, badge]} pointerEvents="none">
        <AILogoBadge size={58} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  circle: {
    width: SEED,
    height: SEED,
    borderRadius: SEED / 2,
    borderWidth: HAIRLINE,
  },
});
