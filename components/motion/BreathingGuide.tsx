/**
 * BreathingGuide — a slow, calm breathing pacer for rest periods. A soft disc
 * expands (~4s in) and contracts (~4s out) with "Inhale" / "Exhale" fading in
 * sync; the rest timer renders in the center slot so one element carries the
 * whole rest moment instead of a stack of competing widgets.
 *
 * A single looping shared value drives scale + both labels — pure UI thread,
 * zero per-frame JS. Honors the OS reduced-motion setting (static disc).
 */
import { Motion, alpha } from "@/constants/theme";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText, useColors } from "@/components/ui";

export interface BreathingGuideProps {
  /** Disc diameter at full inhale. */
  size?: number;
  /** Center slot — typically the rest countdown. */
  children?: React.ReactNode;
  /** Hide the inhale/exhale captions (e.g. very small variants). */
  showLabels?: boolean;
}

export function BreathingGuide({
  size = 190,
  children,
  showLabels = true,
}: BreathingGuideProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();

  // 0→1 over a full breath cycle, looping. Scale peaks mid-cycle (full inhale).
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: Motion.duration.breath * 2, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(phase);
  }, [phase, reduced]);

  const discStyle = useAnimatedStyle(() => {
    // Sine wave: rest → full at 0.5 → rest. Ease is inherent to the curve.
    const breath = 0.5 - 0.5 * Math.cos(phase.value * 2 * Math.PI);
    return { transform: [{ scale: 0.82 + 0.18 * breath }] };
  });

  const inhaleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.1, 0.4, 0.5], [0.2, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const exhaleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0.5, 0.6, 0.9, 1], [0, 1, 1, 0.2], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: alpha(colors.primary, 0.1),
            borderColor: alpha(colors.primary, 0.35),
          },
          reduced ? undefined : discStyle,
        ]}
      />
      <View style={styles.center}>{children}</View>
      {showLabels && !reduced && (
        <View style={styles.labels} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.labelCenter, inhaleStyle]}>
            <AppText variant="caption" color="brand" uppercase>
              Breathe in
            </AppText>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.labelCenter, exhaleStyle]}>
            <AppText variant="caption" color="tertiary" uppercase>
              Breathe out
            </AppText>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", borderWidth: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  labels: { position: "absolute", left: 0, right: 0, bottom: -26, height: 16 },
  labelCenter: { alignItems: "center", justifyContent: "center" },
});
