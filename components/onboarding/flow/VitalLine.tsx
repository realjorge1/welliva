/**
 * VitalLine — the one drawn mark the onboarding is built around.
 *
 * A single continuous curve: a long calm run, one full breath, a smaller
 * second breath, then calm again. It is Welliva's through-line — it draws
 * itself on the welcome screen, and the same curve, compressed, is the progress
 * indicator in the header. Progress in this flow is therefore not a bar filling
 * up; it is one line being drawn a little further with every answer.
 *
 * HOW THE DRAW WORKS. The path and its arc length both come from
 * `vitalLineGeometry.ts`, derived from one set of segment data, so the two can
 * never disagree. That matters because the draw is a `strokeDashoffset`
 * animation: a length that did not match the path would leave the line either
 * finishing early or never closing — and `getTotalLength()` is a DOM API we do
 * not have on native, so it cannot simply be asked for.
 */
import { alpha } from "@/constants/theme";
import React, { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { HAIRLINE } from "./onboardingTheme";
import { VITAL_BOX, VITAL_LENGTH, VITAL_PATH } from "./vitalLineGeometry";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface VitalLineProps {
  /** How much of the line is drawn, 0–1. Animates whenever it changes. */
  progress?: number;
  width?: number;
  /** Defaults to the box ratio. */
  height?: number;
  tone: string;
  /** Ghost of the undrawn remainder. Set 0 to hide it entirely. */
  trackOpacity?: number;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function VitalLine({
  progress = 1,
  width = VITAL_BOX.width,
  height,
  tone,
  trackOpacity = 0.14,
  strokeWidth = HAIRLINE,
  duration = Dur.cinematic,
  delay = 0,
  style,
}: VitalLineProps) {
  const motion = useMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    p.value = withDelay(
      motion.delay(delay),
      withTiming(target, { duration: motion.dur(duration), easing: Ease.draw }),
    );
  }, [progress, duration, delay, motion, p]);

  // The dash pattern is the full arc length, so offsetting by L hides the line
  // completely and offsetting by 0 shows all of it.
  const offset = useDerivedValue(() => VITAL_LENGTH * (1 - p.value));
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  const h = height ?? (width * VITAL_BOX.height) / VITAL_BOX.width;

  return (
    <Svg
      width={width}
      height={h}
      viewBox={`0 0 ${VITAL_BOX.width} ${VITAL_BOX.height}`}
      style={style}
      pointerEvents="none"
    >
      {trackOpacity > 0 && (
        <Path
          d={VITAL_PATH}
          stroke={alpha(tone, trackOpacity)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
      )}
      <AnimatedPath
        d={VITAL_PATH}
        stroke={tone}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${VITAL_LENGTH} ${VITAL_LENGTH}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
