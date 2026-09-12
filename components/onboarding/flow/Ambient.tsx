/**
 * Ambient motion — the loops that never resolve.
 *
 * `BreathingPulse` is the app's own pulse: a 4.2s scale/opacity cycle on a
 * symmetrical curve, so it has no perceptible start or end. It is what makes a
 * "loading" moment read as a system thinking rather than a spinner spinning.
 *
 * `FloatingElement` is the tiny decorative drift — a 6s vertical wander of a
 * few pixels. At that amplitude it is never consciously seen; it is only felt
 * as the screen not being dead.
 *
 * Both stop entirely under Reduce Motion. An ambient loop has no informational
 * content, so there is nothing to preserve — unlike a selection, which keeps
 * its feedback.
 */
import React, { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Dur, Ease, useMotion } from "./onboardingMotion";

export interface BreathingPulseProps {
  children: React.ReactNode;
  /** Peak scale. Keep it under 1.05 — anything more reads as a throb. */
  scale?: number;
  /** Opacity floor. 1 disables the fade half of the breath. */
  opacityFrom?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function BreathingPulse({
  children,
  scale = 1.035,
  opacityFrom = 0.9,
  duration = Dur.breath,
  delay = 0,
  style,
}: BreathingPulseProps) {
  const motion = useMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (!motion.ambient) {
      p.value = 0;
      return;
    }
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: duration / 2, easing: Ease.breath }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(p);
  }, [motion.ambient, duration, delay, p]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (scale - 1) * p.value }],
    opacity: opacityFrom + (1 - opacityFrom) * p.value,
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export interface FloatingElementProps {
  children: React.ReactNode;
  /** Peak travel in px. 3–8 is the whole useful range. */
  amplitude?: number;
  duration?: number;
  /** Offsets the phase so a field of floating elements never moves in unison. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FloatingElement({
  children,
  amplitude = 5,
  duration = Dur.drift,
  delay = 0,
  style,
}: FloatingElementProps) {
  const motion = useMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (!motion.ambient) {
      p.value = 0;
      return;
    }
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(p);
  }, [motion.ambient, duration, delay, p]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -amplitude * p.value }],
  }));

  return (
    <Animated.View style={[style, animated]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}
