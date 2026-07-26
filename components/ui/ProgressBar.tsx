/**
 * ProgressBar — animated track + fill. Optional gradient fill.
 *
 * The fill animates on the UI thread (Reanimated) with the same curve and
 * duration as Ring, so bars and rings across the app sweep as one system.
 */
import { Motion, Radius, alpha } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { useColors } from "./useColors";

export interface ProgressBarProps {
  /** 0–1. */
  progress: number;
  tone?: string;
  gradient?: readonly [string, string, ...string[]];
  height?: number;
  track?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  tone,
  gradient,
  height = 8,
  track,
  style,
}: ProgressBarProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const clamped = Math.max(0, Math.min(1, progress || 0));
  // Light: no track — the empty bar is invisible (emptyTrack: "transparent").
  // Dark: a faint per-metric ghost of the fill, matching Ring so bars & rings
  // read as one system — kept fainter (not fully transparent like light).
  const tint = gradient?.[gradient.length - 1] ?? tone ?? colors.primary;
  const emptyTrack = isDark ? alpha(tint, 0.09) : colors.emptyTrack;

  // Fill up from empty only on a cold-start reveal; snap on warm mounts. Value
  // changes always animate the delta.
  const anim = useSharedValue(reduced || !intro ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      anim.value = clamped;
      return;
    }
    anim.value = withTiming(clamped, {
      duration: Motion.duration.hero,
      easing: Ease.standard,
    });
  }, [clamped, anim, reduced]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${anim.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: track ?? emptyTrack },
        style,
      ]}
    >
      <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
        {gradient ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tone ?? colors.primary }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%", overflow: "hidden", borderRadius: Radius.pill },
});
