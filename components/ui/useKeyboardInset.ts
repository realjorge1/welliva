/**
 * KEYBOARD INSET — the composer follows the keyboard, on both platforms.
 *
 * WHAT WAS WRONG WITH `KeyboardAvoidingView`. It has one job and, in this app,
 * it does not do it. The reason is edge-to-edge: `app.json` sets
 * `android.edgeToEdgeEnabled`, so the window is laid out BEHIND the system bars
 * and the IME. `adjustResize` no longer resizes anything — the keyboard arrives
 * as a window inset that the app is expected to consume itself — so a
 * KeyboardAvoidingView with `behavior={undefined}` (the Android default, and
 * what every screen here passes) has nothing to react to and the composer sits
 * under the keyboard. On iOS it usually works, but it animates on a curve of
 * its own that never quite matches the system's, so the bar chases the keyboard
 * up instead of riding it.
 *
 * WHAT THIS DOES INSTEAD. `useAnimatedKeyboard` reads the keyboard's height
 * frame by frame ON THE UI THREAD, from the same animation the system is
 * running — so the bar is locked to the keyboard rather than following it, and
 * there is no JS round-trip to drop a frame. Reanimated detects edge-to-edge
 * itself (`react-native-is-edge-to-edge`) and reports the inset correctly under
 * it, which is exactly the case KeyboardAvoidingView misses. The options that
 * used to be needed for translucent bars are deliberately NOT passed: with
 * edge-to-edge on they are implied, and passing them logs a warning in dev.
 *
 * HOW TO USE IT — two styles, two different jobs:
 *
 *   const kb = useKeyboardInset({ bottomInset: insets.bottom, gap: Spacing.sm });
 *
 *   <Animated.View style={[styles.flex, kb.containerStyle]}>   ← shrinks
 *     <FlatList … />
 *     <Animated.View style={[styles.bar, kb.restingStyle]}>    ← keeps its seat
 *
 * `containerStyle` pads the flex container that holds BOTH the list and the
 * bar, so the list shrinks and the bar rises — the same effect
 * `behavior="padding"` was after, from a source that is actually correct.
 *
 * `restingStyle` handles the bottom safe area, which is not the same inset and
 * must not be added twice: with no keyboard the bar sits above the home
 * indicator; once the keyboard covers that area, the extra padding would be a
 * gap between the bar and the keys, so it is spent down as the keyboard rises.
 *
 * WHY A PADDING ANIMATION RATHER THAN A TRANSFORM. A transform would slide the
 * header off the top of the screen along with everything else. Padding is a
 * layout property, so this does re-layout per frame — acceptable for one bar
 * over a list, and the honest cost of not moving the whole screen.
 *
 * THE ONE WAY THIS BREAKS. It assumes the window does NOT resize under the
 * keyboard — true while `android.edgeToEdgeEnabled` is set in app.json, which
 * is what makes `adjustResize` a no-op on modern Android. If edge-to-edge is
 * ever turned off, the system will shrink the window AND this will pad it, and
 * the composer will travel twice as far as the keyboard. The fix at that point
 * is one line — `softwareKeyboardLayoutMode: "pan"` in app.json — not a rewrite
 * of this hook. If you are reading this because a bar is jumping too far, that
 * is the thing to check first.
 */
import { useMemo } from "react";
import type { ViewStyle } from "react-native";
import {
  useAnimatedKeyboard,
  useAnimatedStyle,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

export interface KeyboardInsetOptions {
  /** The screen's bottom safe-area inset, in points. */
  bottomInset?: number;
  /** Padding the bar keeps under itself at all times. */
  gap?: number;
}

export interface KeyboardInset {
  /** Live keyboard height in points. A shared value — read it in worklets. */
  height: SharedValue<number>;
  /** Bottom padding for the container holding the list AND the bar. */
  containerStyle: AnimatedStyle<ViewStyle>;
  /** Bottom padding for the bar itself: safe area when closed, gap when open. */
  restingStyle: AnimatedStyle<ViewStyle>;
}

export function useKeyboardInset({
  bottomInset = 0,
  gap = 0,
}: KeyboardInsetOptions = {}): KeyboardInset {
  const keyboard = useAnimatedKeyboard();

  const containerStyle = useAnimatedStyle(
    () => ({ paddingBottom: keyboard.height.value }),
    [keyboard],
  );

  const restingStyle = useAnimatedStyle(
    () => ({ paddingBottom: gap + Math.max(0, bottomInset - keyboard.height.value) }),
    [keyboard, bottomInset, gap],
  );

  return useMemo(
    () => ({ height: keyboard.height, containerStyle, restingStyle }),
    [keyboard.height, containerStyle, restingStyle],
  );
}
