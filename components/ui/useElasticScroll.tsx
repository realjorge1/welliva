/**
 * ELASTIC SCROLL — a real rubber-band at the ends of a list.
 *
 * iOS scroll views bounce. Android's don't: when you hit the top they paint an
 * EdgeEffect — the glow/shadow smear that says "there is nothing above this" by
 * bruising the edge of your content. It reads as a rendering fault on a dark,
 * calm canvas like ours. This replaces it with the motion people actually expect
 * from a phone: the page follows your finger a little past the end, with rising
 * resistance, then springs back with a touch of overshoot.
 *
 * HOW IT WORKS. The native scroll view keeps doing every bit of the scrolling —
 * we never take that over. A Pan gesture runs SIMULTANEOUSLY alongside it (that
 * is what `Gesture.Native()` + `Gesture.Simultaneous` buy: RNGH would otherwise
 * cancel the scroll the moment our pan activated) and does exactly one thing:
 * when the list is pinned at an end and the finger keeps pulling, it translates
 * the whole scroll view. Reanimated drives that translation on the UI thread, so
 * the pull tracks the finger frame-for-frame and never crosses the bridge.
 *
 * ANDROID ONLY, DELIBERATELY. On iOS `bounces` already does all of this in the
 * native scroller, better than we can; doubling it up would just make the page
 * travel twice as far. Everywhere else the hook returns the scrollable
 * untouched, and the only cost is one shared value nobody writes to.
 *
 *   const elastic = useElasticScroll({ onScroll });
 *   …
 *   {elastic.wrap(<ScrollView {...elastic.scrollProps} … />)}
 *
 * The `wrap()` call is what installs the gesture and the moving container, and
 * `scrollProps` is what feeds it the list's position. Both are required — the
 * pull needs to know where the list is, and the list needs something that can
 * move.
 */

import React, { useCallback, useMemo } from "react";
import {
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const ANDROID = Platform.OS === "android";

/**
 * The asymptote of the pull, in points. Resistance is hyperbolic — the first
 * points of travel follow the finger almost 1:1, and it can never reach this
 * number however hard you drag, which is what makes the end of the list feel
 * like a wall with give rather than a wall with a bug.
 */
const MAX_PULL = 92;

/** Under-damped (ζ ≈ 0.55) so it snaps home and rebounds a hair past it. */
const BOUNCE_BACK = {
  damping: 12,
  stiffness: 200,
  mass: 0.6,
  restDisplacementThreshold: 0.05,
  restSpeedThreshold: 0.5,
} as const;

/**
 * Vertical travel before the pull can take over. Matched to a scroll's own
 * slop so an ordinary flick is never mistaken for a pull.
 */
const ACTIVATE_Y = 14;
/**
 * Horizontal travel that kills the pull outright. This is what keeps the hook
 * out of the way of the two horizontal gestures that share the screen with it:
 * the drawer's edge swipe (which needs 18pt of X) and any in-page carousel.
 * Sideways intent shows up long before 16pt, so they win their touch cleanly.
 */
const FAIL_X = 16;

/** Hyperbolic resistance: slope 1 at the origin, asymptotic to MAX_PULL. */
function resist(distance: number): number {
  "worklet";
  return (distance * MAX_PULL) / (distance + MAX_PULL);
}

export interface ElasticScrollOptions {
  /**
   * Turn the pull off. Pass `false` for a list that owns its own top gesture —
   * a RefreshControl, above all, which is already the thing that happens when
   * you drag down from the top.
   */
  enabled?: boolean;
  /** The screen's own scroll handler. Called after the pull reads the event. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function useElasticScroll({
  enabled = true,
  onScroll,
}: ElasticScrollOptions = {}) {
  const live = ANDROID && enabled;

  /** Where the list is, and how far it can go. Both fed by `scrollProps`. */
  const offsetY = useSharedValue(0);
  const maxOffsetY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const contentH = useSharedValue(0);

  /** The pull itself, in points. Positive = pulled down from the top. */
  const pull = useSharedValue(0);
  /** Finger position the current stretch is measured from. */
  const anchor = useSharedValue(0);
  /** 0 = the list is scrolling, 1 = stretching the top, -1 = the bottom. */
  const latch = useSharedValue(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (live) offsetY.value = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [live, onScroll, offsetY],
  );

  // Layout and content size, so "is this list at its bottom?" is answerable
  // before the user has ever scrolled it.
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewportH.value = e.nativeEvent.layout.height;
      maxOffsetY.value = Math.max(0, contentH.value - viewportH.value);
    },
    [viewportH, contentH, maxOffsetY],
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentH.value = h;
      maxOffsetY.value = Math.max(0, h - viewportH.value);
    },
    [contentH, viewportH, maxOffsetY],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(live)
      .activeOffsetY([-ACTIVATE_Y, ACTIVATE_Y])
      .failOffsetX([-FAIL_X, FAIL_X])
      // Measure the stretch from where the finger was when the pan ACTIVATED,
      // not from touch-down — otherwise the activation slop itself would appear
      // as an instant jump of pull.
      .onStart((e) => {
        anchor.value = e.translationY;
        latch.value = 0;
      })
      .onUpdate((e) => {
        if (latch.value === 0) {
          const d = e.translationY - anchor.value;
          const atTop = offsetY.value <= 0.5;
          const atBottom =
            maxOffsetY.value > 0 && offsetY.value >= maxOffsetY.value - 0.5;

          if (d > 0 && atTop) latch.value = 1;
          else if (d < 0 && atBottom) latch.value = -1;
          else {
            // Still scrolling. Keep the anchor glued to the finger so the pull
            // starts from zero the moment the list runs out of room, however
            // far the finger has already travelled.
            anchor.value = e.translationY;
            if (pull.value !== 0) pull.value = 0;
            return;
          }
        }

        const dir = latch.value;
        const stretch = (e.translationY - anchor.value) * dir;
        if (stretch <= 0) {
          // Dragged back to where the stretch began — hand the list its scroll
          // back, exactly at zero, so there is nothing to snap.
          latch.value = 0;
          anchor.value = e.translationY;
          pull.value = 0;
          return;
        }
        pull.value = dir * resist(stretch);
      })
      // `onFinalize`, not `onEnd`: a pull that gets cancelled (a gesture higher
      // up claims the touch) must still come home rather than stay stretched.
      .onFinalize(() => {
        latch.value = 0;
        if (pull.value !== 0) pull.value = withSpring(0, BOUNCE_BACK);
      });

    // The scrollable's own native recogniser, declared as a peer rather than a
    // rival. Without this the pan's activation cancels the scroll outright.
    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [live, anchor, latch, offsetY, maxOffsetY, pull]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  const wrap = useCallback(
    (scrollable: React.ReactElement) =>
      live ? (
        <Animated.View style={[styles.flex, containerStyle]}>
          <GestureDetector gesture={gesture}>{scrollable}</GestureDetector>
        </Animated.View>
      ) : (
        scrollable
      ),
    [live, gesture, containerStyle],
  );

  const scrollProps = useMemo(
    () => ({
      onScroll: handleScroll,
      scrollEventThrottle: 16,
      onLayout: live ? handleLayout : undefined,
      onContentSizeChange: live ? handleContentSizeChange : undefined,
      // Kill the EdgeEffect glow — this hook is its replacement, and the two
      // must never be visible at once.
      overScrollMode: live ? ("never" as const) : undefined,
    }),
    [live, handleScroll, handleLayout, handleContentSizeChange],
  );

  return { wrap, scrollProps };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
