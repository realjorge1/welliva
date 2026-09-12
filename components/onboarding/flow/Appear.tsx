/**
 * Appear / StaggerReveal — the entrance primitive the whole flow is built from.
 *
 * One element arriving = `Appear`. A group arriving in sequence =
 * `StaggerReveal`. Nothing in the onboarding calls `withTiming` on an opacity
 * directly; it composes these, so the entrance curve is identical everywhere
 * and a single change here re-times the whole ritual.
 *
 * The default is a 12px rise over 720ms on a long-tailed ease-out, started
 * after a caller-supplied delay. Under Reduce Motion the rise collapses to zero
 * and the fade shortens — the sequence still reads, it just stops travelling.
 *
 * EXITS. An `Appear` also knows how to LEAVE, which is what lets a step hand
 * over as a composition rather than as a slab. `OnboardingTransition` puts the
 * outgoing step's subtree into `ExitContext`, and every `Appear` inside it runs
 * its own exit, ordered by `exitOrder`: the body goes first, the question's
 * heading last. That is the brief's "secondary elements disappear first, the
 * main heading remains visible slightly longer", and it is only possible
 * because the transition keeps the outgoing subtree MOUNTED (see the two-slot
 * design there) — a remounted tree would replay entrances, not exits.
 */
import React, { useContext, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Dur, Ease, Stagger, Travel, useMotion } from "./onboardingMotion";

/** Broadcast by `OnboardingTransition` to the step that is leaving. */
export const ExitContext = React.createContext(false);

/** Gap between exit tiers. Three tiers spans ~140ms — felt, not waited on. */
const EXIT_TIER = 70;

export interface AppearProps {
  children: React.ReactNode;
  /** Milliseconds to wait before starting. Compose from `Stagger`. */
  delay?: number;
  /** Travel distance in px. Positive rises from below, negative drops in. */
  distance?: number;
  duration?: number;
  /** Hold at zero opacity until this flips true (for interaction-gated reveals). */
  when?: boolean;
  /** A faint scale-up alongside the fade — for hero elements only. */
  scaleFrom?: number;
  /**
   * How late this element leaves when its step hands over. 0 = first out
   * (options, cards), 1 = kickers and supporting copy, 2 = the question itself.
   */
  exitOrder?: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
}

export function Appear({
  children,
  delay = 0,
  distance = Travel.rise,
  duration = Dur.content,
  when = true,
  scaleFrom,
  exitOrder = 0,
  style,
  pointerEvents,
}: AppearProps) {
  const motion = useMotion();
  const leaving = useContext(ExitContext);
  const p = useSharedValue(0);

  useEffect(() => {
    if (leaving) {
      // Accelerate away, tiered so the composition empties from the bottom up.
      p.value = withDelay(
        motion.delay(exitOrder * EXIT_TIER),
        withTiming(0, { duration: motion.dur(Dur.micro), easing: Ease.exit }),
      );
      return;
    }
    if (!when) {
      p.value = withTiming(0, { duration: motion.dur(Dur.ui), easing: Ease.exit });
      return;
    }
    p.value = withDelay(
      motion.delay(delay),
      withTiming(1, { duration: motion.dur(duration), easing: Ease.soft }),
    );
  }, [leaving, when, delay, duration, exitOrder, motion, p]);

  const travel = motion.dist(distance);
  const from = scaleFrom ?? 1;

  const animated = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: travel * (1 - p.value) },
      { scale: from + (1 - from) * p.value },
    ],
  }));

  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

export interface StaggerRevealProps {
  children: React.ReactNode;
  /** Delay before the FIRST child starts. */
  delay?: number;
  /** Gap between consecutive children. */
  step?: number;
  distance?: number;
  duration?: number;
  when?: boolean;
  exitOrder?: number;
  style?: StyleProp<ViewStyle>;
  /** Style applied to each child's wrapper (e.g. a measured grid cell width). */
  itemStyle?: StyleProp<ViewStyle> | ((index: number) => StyleProp<ViewStyle>);
}

/**
 * Wraps each child in an `Appear` whose delay advances by `step`. Children are
 * flattened and nulls dropped first, so a conditionally-rendered option never
 * leaves a hole in the timing sequence.
 */
export function StaggerReveal({
  children,
  delay = 0,
  step = Stagger.item,
  distance = Travel.rise,
  duration = Dur.content,
  when = true,
  exitOrder = 0,
  style,
  itemStyle,
}: StaggerRevealProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Animated.View style={style}>
      {items.map((child, i) => (
        <Appear
          key={(child as React.ReactElement)?.key ?? i}
          delay={delay + i * step}
          distance={distance}
          duration={duration}
          when={when}
          exitOrder={exitOrder}
          style={typeof itemStyle === "function" ? itemStyle(i) : itemStyle}
        >
          {child}
        </Appear>
      ))}
    </Animated.View>
  );
}

/**
 * Recede — hold something back while the screen is busy with something else.
 *
 * The counterpart to `Appear`: the element stays exactly where it is and stays
 * usable, it simply stops competing. Used on the "about you" step, where the
 * row holding the caret is the only thing at full strength — and where an
 * un-animated opacity switch would read as a flicker rather than as attention
 * moving.
 */
export function Recede({
  active,
  children,
  /** Opacity while receded. Never low enough to look disabled. */
  to = 0.45,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  to?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const motion = useMotion();
  const p = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [active, motion, p]);

  const animated = useAnimatedStyle(() => ({ opacity: 1 - (1 - to) * p.value }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
