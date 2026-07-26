/**
 * Ring — animated circular progress with a gradient stroke and a center slot.
 * The hero metric component (calories, hydration, completion, live set timer).
 *
 * Progress animates on the UI thread (Reanimated worklet driving the SVG
 * dash offset), so the sweep stays smooth even while the JS thread is busy —
 * this matters in the live workout player where a session tick, coach line and
 * ring update land on the same second.
 */
import { Motion, alpha } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from "react-native-svg";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { useColors } from "./useColors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

let RING_SEQ = 0;

export interface RingProps {
  /** 0–1. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  gradient?: readonly [string, string, ...string[]];
  tone?: string;
  track?: string;
  /** Sweep duration in ms — defaults to the hero motion token. */
  duration?: number;
  /**
   * Reverse the sweep. Rings always start at the bottom (6 o'clock); by default
   * they fill clockwise. When true the arc is mirrored horizontally so it keeps
   * the same bottom start point but fills anti-clockwise instead.
   */
  counterClockwise?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Ring({
  progress,
  size = 132,
  strokeWidth = 12,
  gradient,
  tone,
  track,
  duration = Motion.duration.hero,
  counterClockwise = false,
  children,
  style,
}: RingProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const gradId = useRef(`ring-${RING_SEQ++}`).current;

  // Fill up from empty only on a cold-start reveal; on warm mounts start at the
  // real value so it snaps. Later value changes always animate the delta.
  const anim = useSharedValue(reduced || !intro ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      anim.value = clamped;
      return;
    }
    anim.value = withTiming(clamped, { duration, easing: Ease.standard });
  }, [clamped, duration, anim, reduced]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - anim.value),
  }));

  const stops = gradient ?? [tone ?? colors.primary, tone ?? colors.primary];
  const c1 = stops[0];
  const c2 = stops[stops.length - 1];

  // Start at the bottom (rotate 90). For anti-clockwise, additionally mirror the
  // arc horizontally about its center — this flips the winding (clockwise →
  // anti-clockwise) while leaving the bottom start point on the axis untouched.
  const arcTransform = counterClockwise
    ? `translate(${size} 0) scale(-1 1) rotate(90 ${size / 2} ${size / 2})`
    : `rotate(90 ${size / 2} ${size / 2})`;
  // Light: no track — the empty arc is invisible (emptyTrack: "transparent").
  // Dark: a faint per-metric ghost of the fill so the empty arc still reads,
  // but kept fainter than the fill's tint (not fully transparent like light).
  const emptyTrack = isDark ? alpha(c2, 0.09) : colors.emptyTrack;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="100%" stopColor={c2} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track ?? emptyTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={arcTransform}
        />
      </Svg>
      {children != null && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
