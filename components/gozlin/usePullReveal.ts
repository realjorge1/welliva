/**
 * usePullReveal — drag the conversation down to uncover something behind it.
 *
 * The gesture everyone already knows from pull-to-refresh, pointed at a panel
 * instead of a spinner. At the top of the thread the list has nowhere left to
 * go; that dead travel is the affordance, and this spends it on the one thing
 * a coach screen can usefully put above the conversation (see ./CoachPulse).
 *
 * ── HOW IT MOVES ──────────────────────────────────────────────────────────
 *
 * THE PANEL IS A SIBLING, NOT AN OVERLAY. `height` drives a real view above the
 * list, so the conversation is genuinely pushed down rather than covered. That
 * matters more than it sounds: an overlay hides the newest message behind the
 * thing you just opened, and every attempt to fix that ends in a scroll offset
 * that fights the user.
 *
 * RESISTANCE ON THE WAY OUT, 1:1 ON THE WAY BACK. Opening is hyperbolic — the
 * first points follow the finger and it can never quite reach the full height,
 * which is what makes it feel like something being uncovered rather than
 * something being dragged. Closing tracks the finger exactly, because by then
 * you are moving a real object you can see.
 *
 * IT LATCHES. Past the threshold the panel stays open when you let go, with a
 * tick of feedback at the crossing so you know before you release. Below it,
 * it springs shut. There is no "peek" state to get stuck in.
 *
 * ── HOW IT SHARES THE SCREEN ──────────────────────────────────────────────
 *
 * `Gesture.Simultaneous(pan, Gesture.Native())` — the same contract
 * `components/ui/useElasticScroll` documents. Without the native peer, RNGH
 * cancels the list's own scrolling the instant this pan activates, and the
 * thread becomes undraggable.
 *
 * `failOffsetX` is load-bearing: the app's drawer opens on a horizontal edge
 * swipe, and a pull that survives sideways travel would steal it. Sideways
 * intent is obvious well before a vertical pull commits — see FAIL_X.
 *
 * `bounces={false}` ships with `scrollProps` on purpose. iOS would otherwise
 * run its own rubber-band underneath this one and the panel would travel twice
 * as far as the finger — the doubling that useElasticScroll avoids by being
 * Android-only. Here the pull IS the feature on both platforms, so the native
 * bounce is the thing that has to go.
 */

import * as Haptics from "@/utils/haptics";
import { useCallback, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/** Vertical travel before the pull takes over, matched to a scroll's own slop. */
const ACTIVATE_Y = 14;
/**
 * Horizontal travel that kills the pull outright.
 *
 * SIXTEEN, NOT EIGHTEEN, and the two points matter: the drawer's edge swipe
 * activates at 18pt of X, so failing at 16 means this pan is already out of
 * the way when the drawer claims the touch. Matching the drawer's own number
 * would leave both live at the same instant and hand the arbitration to
 * whichever recogniser happened to be asked first. Same figure, same reason,
 * as components/ui/useElasticScroll.
 */
const FAIL_X = 16;
/**
 * The asymptote of the opening drag. Resistance is hyperbolic, so the panel
 * approaches its full height without a hard stop at the end of the travel.
 */
const MAX_PULL = 260;
/** Fraction of the panel's height that latches it open. */
const LATCH_AT = 0.5;
/** …but never less than this, so a short panel still needs a deliberate pull. */
const MIN_LATCH = 56;

const SETTLE = { damping: 20, stiffness: 220, mass: 0.8 } as const;

/** Hyperbolic resistance: slope 1 at the origin, asymptotic to MAX_PULL. */
function resist(distance: number): number {
  "worklet";
  return (distance * MAX_PULL) / (distance + MAX_PULL);
}

export interface PullReveal {
  /** Live revealed height, in points. Drives the panel's own container. */
  height: SharedValue<number>;
  /** The panel's full height once measured. */
  panelHeight: SharedValue<number>;
  /** 1 while a release right now would latch it open. */
  armed: SharedValue<number>;
  /**
   * The same thing on the JS side, for the copy that has to change with it
   * ("Pull down" → "Release"). State rather than a re-read of the shared
   * value, because a label is a render and a shared value is not.
   */
  armedNow: boolean;
  /** Latched open. JS-side mirror, for anything that has to render on it. */
  open: boolean;
  /** Height style for the panel's clipping container. */
  panelStyle: AnimatedStyle<ViewStyle>;
  /** Call from the panel's own `onLayout`. */
  measure: (h: number) => void;
  /** Close it from a button, or after an action that supersedes it. */
  close: () => void;
  /** Wrap the scrollable in this. */
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  scrollProps: {
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    bounces: boolean;
    overScrollMode: "never";
  };
}

export function usePullReveal({
  enabled = true,
  onScroll,
  onOpen,
}: {
  enabled?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Fired once, at the moment it latches open. */
  onOpen?: () => void;
} = {}): PullReveal {
  const height = useSharedValue(0);
  const panelHeight = useSharedValue(0);
  const armed = useSharedValue(0);
  /** 0 = closed, 1 = latched open. The UI-thread copy of `open`. */
  const latched = useSharedValue(0);
  /** Where the list is, so "is it at the top?" is answerable in the worklet. */
  const offsetY = useSharedValue(0);
  /** Finger position the current stretch is measured from. */
  const anchor = useSharedValue(0);
  /** 0 = still scrolling, 1 = opening, -1 = closing. */
  const mode = useSharedValue(0);

  const [open, setOpen] = useState(false);
  const [armedNow, setArmedNow] = useState(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.value = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [offsetY, onScroll],
  );

  const measure = useCallback(
    (h: number) => {
      panelHeight.value = h;
      // A panel that grew or shrank while open keeps its seat rather than
      // leaving a gap or clipping itself.
      if (latched.value === 1) height.value = withSpring(h, SETTLE);
    },
    [panelHeight, latched, height],
  );

  const close = useCallback(() => {
    latched.value = 0;
    armed.value = 0;
    height.value = withSpring(0, SETTLE);
    setOpen(false);
  }, [latched, armed, height]);

  const settle = useCallback(
    (shouldOpen: boolean) => {
      setOpen(shouldOpen);
      if (shouldOpen) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onOpen?.();
      }
    },
    [onOpen],
  );

  // The tick at the crossing. Feedback BEFORE the release is the whole reason a
  // latch feels like a latch rather than a lottery — and the same crossing
  // flips the label, so the two can never disagree.
  const cross = useCallback((now: boolean) => {
    setArmedNow(now);
    if (now) Haptics.selectionAsync().catch(() => {});
  }, []);

  useAnimatedReaction(
    () => armed.value,
    (now, before) => {
      if (before !== null && now !== before) runOnJS(cross)(now === 1);
    },
    [cross],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetY([-ACTIVATE_Y, ACTIVATE_Y])
      .failOffsetX([-FAIL_X, FAIL_X])
      .onStart((e) => {
        anchor.value = e.translationY;
        mode.value = 0;
      })
      .onUpdate((e) => {
        const full = panelHeight.value;
        if (full <= 0) return;

        if (mode.value === 0) {
          const d = e.translationY - anchor.value;
          const atTop = offsetY.value <= 0.5;
          if (atTop && d > 0 && latched.value === 0) mode.value = 1;
          else if (atTop && d < 0 && latched.value === 1) mode.value = -1;
          else {
            // Still the list's gesture. Keep the anchor glued to the finger so
            // the pull starts from zero the moment the list runs out of room.
            anchor.value = e.translationY;
            return;
          }
        }

        const d = e.translationY - anchor.value;
        height.value =
          mode.value === 1
            ? Math.min(full, resist(Math.max(0, d)))
            : Math.max(0, Math.min(full, full + d));

        const latch = Math.max(MIN_LATCH, full * LATCH_AT);
        armed.value = height.value >= latch ? 1 : 0;
      })
      // `onFinalize`, not `onEnd`: a pull cancelled by a gesture higher up must
      // still resolve, or the panel is left stranded half-open.
      .onFinalize(() => {
        if (mode.value === 0) return;
        const shouldOpen = armed.value === 1;
        mode.value = 0;
        armed.value = 0;
        latched.value = shouldOpen ? 1 : 0;
        height.value = withSpring(shouldOpen ? panelHeight.value : 0, SETTLE);
        runOnJS(settle)(shouldOpen);
      });

    return Gesture.Simultaneous(pan, Gesture.Native());
  }, [enabled, anchor, mode, offsetY, latched, height, panelHeight, armed, settle]);

  const panelStyle = useAnimatedStyle(() => ({ height: height.value }));

  const scrollProps = useMemo(
    () => ({
      onScroll: handleScroll,
      scrollEventThrottle: 16,
      // See the header: the native bounce and this pull must never both run.
      bounces: false,
      overScrollMode: "never" as const,
    }),
    [handleScroll],
  );

  return {
    height,
    panelHeight,
    armed,
    armedNow,
    open,
    panelStyle,
    measure,
    close,
    gesture,
    scrollProps,
  };
}
