/**
 * OnboardingTransition — the whole flow is one canvas, not nine routes.
 *
 * THE PROBLEM WITH THE OBVIOUS IMPLEMENTATION. Fading a step out, swapping the
 * content, then fading the next one in leaves a hole in the middle where the
 * screen is empty — and because the outgoing subtree is unmounted at the swap,
 * every element leaves at exactly the same instant. Both are what make a
 * multi-step form feel like a multi-step form.
 *
 * THE TWO-SLOT DESIGN. This component keeps TWO fixed render slots and
 * alternates between them. A step change writes the new step into the idle slot
 * and makes it active; the previously active slot keeps rendering its content
 * while it leaves. Because each slot is a stable position in the React tree,
 * the outgoing subtree is never remounted — so `ExitContext` can drive a real,
 * staggered exit inside it (body first, heading last, see `Appear`), and the
 * incoming slot starts rising 120ms before the outgoing one has finished.
 *
 * Both slots are absolutely filled, so a taller step never pushes a shorter one
 * around during the overlap, and the canvas behind them (gradient + orbs) is
 * continuous throughout — the user never sees a screen boundary.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ExitContext } from "./Appear";
import { Dur, Ease, Travel, useMotion } from "./onboardingMotion";

/** How long after the exit begins the incoming step starts to arrive. */
const OVERLAP = 120;
/** Slack before the leaving slot is emptied. Must outlast the longest exit. */
const RECLAIM = 520;

type SlotId = "a" | "b";

export interface OnboardingTransitionProps<S extends string> {
  /** The step to display. Changing it hands the canvas over. */
  step: S;
  /** Renders a step's content. Called for both slots during a hand-over. */
  render: (step: S) => React.ReactNode;
  /** Forward rises into place; back drops in. */
  direction?: "forward" | "back";
  style?: StyleProp<ViewStyle>;
}

export function OnboardingTransition<S extends string>({
  step,
  render,
  direction = "forward",
  style,
}: OnboardingTransitionProps<S>) {
  const motion = useMotion();
  const [slots, setSlots] = useState<{ a: S | null; b: S | null; active: SlotId }>({
    a: step,
    b: null,
    active: "a",
  });
  const shown = useRef(step);

  const enterA = useSharedValue(1);
  const enterB = useSharedValue(0);

  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;

    setSlots((prev) => {
      const next: SlotId = prev.active === "a" ? "b" : "a";
      return { ...prev, [next]: step, active: next } as typeof prev;
    });
  }, [step]);

  const active = slots.active;
  const mounted = useRef(false);

  useEffect(() => {
    // The first step is already on screen at full opacity — animating it in
    // would open the flow with a black frame before the welcome could start.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const rising = active === "a" ? enterA : enterB;
    const falling = active === "a" ? enterB : enterA;

    falling.value = withTiming(0, {
      duration: motion.dur(Dur.stepOut),
      easing: Ease.exit,
    });
    rising.value = 0;
    rising.value = withDelay(
      motion.delay(OVERLAP),
      withTiming(1, { duration: motion.dur(Dur.stepIn), easing: Ease.soft }),
    );

    // Let go of the outgoing step's tree once it is invisible. Doing this on a
    // timer rather than an animation callback keeps the cleanup on the JS side,
    // where the setState belongs.
    const idle: SlotId = active === "a" ? "b" : "a";
    const t = setTimeout(
      () => setSlots((prev) => (prev.active === idle ? prev : { ...prev, [idle]: null })),
      motion.dur(RECLAIM),
    );
    return () => clearTimeout(t);
  }, [active, motion, enterA, enterB]);

  const travel = motion.dist(Travel.stepIn) * (direction === "forward" ? 1 : -1);

  const styleA = useAnimatedStyle(() => ({
    opacity: enterA.value,
    transform: [{ translateY: travel * (1 - enterA.value) }],
  }));
  const styleB = useAnimatedStyle(() => ({
    opacity: enterB.value,
    transform: [{ translateY: travel * (1 - enterB.value) }],
  }));

  const slot = (id: SlotId, animatedStyle: StyleProp<ViewStyle>) => {
    const value = slots[id];
    if (value === null) return null;
    const isActive = active === id;
    return (
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedStyle]}
        pointerEvents={isActive ? "auto" : "none"}
        // The leaving slot is still painted but is no longer part of the page
        // as far as a screen reader is concerned.
        accessibilityElementsHidden={!isActive}
        importantForAccessibility={isActive ? "auto" : "no-hide-descendants"}
      >
        <ExitContext.Provider value={!isActive}>
          {/* Keyed by step so a NEW step remounts (and plays its entrance),
              while a leaving step keeps its identity (and plays its exit). */}
          <React.Fragment key={value}>{render(value)}</React.Fragment>
        </ExitContext.Provider>
      </Animated.View>
    );
  };

  return (
    <Animated.View style={[styles.stage, style]}>
      {slot("a", styleA)}
      {slot("b", styleB)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
});
