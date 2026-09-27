/**
 * OnboardingContainer — the canvas the whole ritual is painted on.
 *
 * ONE background, mounted once, for all nine steps: the app's ambient gradient
 * plus the drifting orb field that the sign-in screen uses. Because it lives
 * ABOVE the step transition rather than inside it, the background never
 * flickers, re-seeds or restarts as steps hand over — which is the difference
 * between "one place" and "nine screens that happen to share a colour".
 *
 * KEYBOARD. `KeyboardAvoidingView` is dead in this app (edge-to-edge makes
 * `adjustResize` a no-op — see `useKeyboardInset`). The stage and the action
 * bar therefore live in one insetting container so the form shrinks and the
 * action rises in a single motion, locked to the system's own keyboard
 * animation rather than chasing it.
 *
 * SAFE AREA. Top edge only. The bottom is paid for deliberately: by the action
 * bar's resting style when there is one, and by each scroll region's own tail
 * when there is not — so nothing ever sits under a home indicator, and nothing
 * is ever padded for it twice.
 */
import { OrbField, useOrbTouch } from "@/components/OrbField";
import { AmbientCanvas, Button, useKeyboardInset } from "@/components/ui";
import { Spacing, brandGradientDark } from "@/constants/theme";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CrossFade } from "./CrossFade";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { Gutter, Rhythm } from "./onboardingTheme";

export interface OnboardingContainerProps {
  /** The persistent header. Rendered above the stage, outside the transition. */
  header?: React.ReactNode;
  /** The action bar. Rides the keyboard with the stage. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function OnboardingContainer({ header, footer, children }: OnboardingContainerProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardInset({ bottomInset: insets.bottom, gap: Spacing.lg });
  // Bubble-phase observers: any press or swipe that lands on a background orb
  // bounces it away elastically, without ever intercepting the flow's own taps.
  const { touch, touchHandlers } = useOrbTouch();

  return (
    <View style={styles.flex} {...touchHandlers}>
      <AmbientCanvas />
      <OrbField color={brandGradientDark[0]} opacityScale={0.55} touch={touch} />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {header}
        <Animated.View style={[styles.flex, kb.containerStyle]}>
          <View style={styles.flex}>{children}</View>
          {footer ? (
            <Animated.View style={[styles.actions, kb.restingStyle]}>{footer}</Animated.View>
          ) : null}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/* ──────────────────────────── Step layouts ─────────────────────────────── */

export interface StepScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  /** Extra room under the content, on top of the standard tail. */
  tail?: number;
  /** For a step whose beats replace each other in place and must each start at the top. */
  scrollRef?: React.Ref<ScrollView>;
}

/**
 * The standard scrolling step body. Gutter, crown and tail come from the
 * onboarding's rhythm rather than the app's denser screen spacing, and taps
 * pass through to controls while the keyboard is up.
 */
export function StepScroll({ children, tail = 0, style, scrollRef, ...rest }: StepScrollProps) {
  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.flex, style]}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: Rhythm.tail + tail }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A step that holds a single composition in the middle of the screen, with no
 * scrolling — the welcome, the build and the stillness beat. On a short display
 * it still scrolls rather than clipping.
 */
export function StepCentre({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.centreBody, style]}
      showsVerticalScrollIndicator={false}
      // The content is meant to sit still; only let it move if it cannot fit.
      alwaysBounceVertical={false}
    >
      {children}
    </ScrollView>
  );
}

/* ──────────────────────────── The action bar ───────────────────────────── */

export interface OnboardingActionsProps {
  label: string;
  onPress: () => void;
  /**
   * Whether the step has what it needs. An unready action is QUIET, not
   * disabled — pressing it still runs the existing validation and explains
   * what is missing, which is more useful than a button that ignores taps.
   */
  ready?: boolean;
  /**
   * Whether this step has an action at all. Like the header, it FADES rather
   * than unmounting — the build and the reveal have no action bar, and letting
   * the bar leave the layout would resize the canvas during a dissolve.
   */
  visible?: boolean;
  loading?: boolean;
  /** When the action first arrives. It is always the last thing on a screen. */
  delay?: number;
  accessibilityHint?: string;
}

/**
 * The action bar is mounted ONCE for the whole flow and never keyed to the
 * step. That is why its label crossfades instead of cutting, why it does not
 * replay its entrance on every question, and why the welcome's 2-second
 * opening is paid exactly once rather than before every screen.
 */
export function OnboardingActions({
  label,
  onPress,
  ready = true,
  visible = true,
  loading = false,
  delay = 0,
  accessibilityHint,
}: OnboardingActionsProps) {
  const motion = useMotion();
  const shown = useSharedValue(0);
  const prominence = useSharedValue(ready ? 1 : 0);
  const present = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    shown.value = withDelay(
      motion.delay(delay),
      withTiming(1, { duration: motion.dur(Dur.content), easing: Ease.soft }),
    );
    // Deliberately mount-only: the first arrival is choreographed, every
    // subsequent step inherits a bar that is already on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    prominence.value = withTiming(ready ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.soft,
    });
  }, [ready, motion, prominence]);

  React.useEffect(() => {
    present.value = withTiming(visible ? 1 : 0, {
      duration: motion.dur(Dur.ui),
      easing: Ease.standard,
    });
  }, [visible, motion, present]);

  const rise = motion.dist(10);
  const wrap = useAnimatedStyle(() => ({
    opacity: shown.value * present.value,
    transform: [{ translateY: rise * (1 - shown.value) }],
  }));
  // 0.5 → 1: the reference's pale-until-earned CTA. Never below 0.5, so it is
  // always legible and always obviously a button.
  const strength = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * prominence.value }));

  return (
    <Animated.View
      style={[styles.actionRow, wrap]}
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <Animated.View style={[styles.flex, strength]}>
        {/* The wording changes between steps; crossfading it keeps the one
            persistent control in the flow from ever flickering. */}
        <CrossFade contentKey={label}>
          <Button
            label={label}
            onPress={onPress}
            loading={loading}
            disabled={loading}
            accessibilityHint={accessibilityHint}
            size="lg"
          />
        </CrossFade>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { paddingHorizontal: Gutter, paddingTop: Spacing.md },
  actionRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  scrollBody: {
    paddingHorizontal: Gutter,
    paddingTop: Rhythm.crown,
    gap: Rhythm.layer,
  },
  centreBody: {
    flexGrow: 1,
    paddingHorizontal: Gutter,
    paddingVertical: Rhythm.layer,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
});
