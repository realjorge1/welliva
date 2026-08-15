/**
 * IntroReveal — the cold-start "everything settles into place" gate.
 *
 * On a fresh app launch, rings & bars fill up from empty and graphs scale into
 * place the first time each screen appears. Once the app has been backgrounded
 * and resumed — or a screen is revisited — values snap in, so the app feels calm
 * and instant in use. Value *changes* (logging water, finishing a set) always
 * animate; only the first-paint reveal is gated.
 *
 * Why a single global flag rather than per-route tracking? The tabs ARE separate
 * routes now (see app/(tabs)/_layout), but the mount PATTERN that this gate
 * depends on is unchanged: React Navigation mounts a tab lazily on first visit
 * and then keeps it mounted, freezing it on blur. So "mounted for the first
 * time" still means "first visit", and one shared window still does the job
 * without per-route bookkeeping. We keep one "reveal window":
 *
 *   • It opens on a cold start (fresh JS bundle → `revealWindowOpen = true`).
 *   • Every screen that mounts while it's open reveals — and thanks to lazy tab
 *     mounting, that means each tab reveals the first time you visit it.
 *   • It closes the first time the app is sent to the background (the natural
 *     end of the launch). From then on, warm resumes and revisits snap.
 *   • The next cold start reloads the bundle, so it opens again.
 *
 * Read the window once, at mount, via `useIntroReveal()` — the decision is then
 * fixed for that component's lifetime.
 */
import { Motion } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { AppState, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ease } from "./motion";

// Open on cold start (fresh JS); closed for good once the app first backgrounds.
let revealWindowOpen = true;

/** Hosts the AppState listener that closes the reveal window after launch. */
export function IntroRevealProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      // 'inactive' is transient (app switcher, Face ID, the notification shade),
      // so only a real background means the launch is over and later mounts snap.
      if (state === "background") revealWindowOpen = false;
    });
    return () => sub.remove();
  }, []);
  return <>{children}</>;
}

/**
 * True while the cold-start reveal window is open. Read once at mount to decide
 * whether to play a reveal (fill / scale) or snap; captured for the component's
 * lifetime so it never flips mid-life.
 */
export function useIntroReveal(): boolean {
  return useRef(revealWindowOpen).current;
}

export interface IntroGrowProps {
  children: React.ReactNode;
  /** Reveal duration; defaults to the hero motion token. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a graph so it scales up into place (and fades in) on a cold-start reveal,
 * then sits perfectly still. On warm visits / reduced motion it renders inert.
 */
export function IntroGrow({ children, duration, style }: IntroGrowProps) {
  const intro = useIntroReveal();
  const reduced = useReducedMotion();
  const inert = reduced || !intro;
  const p = useSharedValue(inert ? 1 : 0);

  useEffect(() => {
    if (inert) return;
    p.value = withTiming(1, {
      duration: duration ?? Motion.duration.hero,
      easing: Ease.decelerate,
    });
    // Mount-only: the reveal plays once, when the graph first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scaleY: 0.9 + 0.1 * p.value }],
  }));

  return <Animated.View style={[styles.grow, style, animStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  grow: { width: "100%" },
});
