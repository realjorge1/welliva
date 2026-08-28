/**
 * Sheet — the app's bottom sheet shell.
 *
 * One surface, one motion, reused by everything that slides up from the bottom.
 * It owns the parts that are easy to get wrong and pointless to re-derive:
 *
 *  · ONE `progress` (0→1) drives the scrim fade and the panel's rise together,
 *    so the sheet arrives as a single movement. A modal that merely fades in is
 *    the single loudest "this is an old app" signal there is.
 *  · DRAG TO DISMISS, from the handle region. Downward tracks the finger 1:1;
 *    upward is rubber-banded to a sixth, because a sheet that stretches off its
 *    seat stops reading as a solid object. Release dismisses on distance OR
 *    velocity — a fast flick shouldn't have to travel far.
 *  · The pan lives on the HANDLE, never the whole panel. A sheet whose body
 *    scrolls would otherwise have to arbitrate between the scroll and the drag
 *    on every touch; putting the grab where the grabber is removes the conflict
 *    instead of negotiating it.
 *  · It unmounts itself AFTER the close animation, so dismissing is a movement
 *    rather than a disappearance.
 *
 * ACCESSIBILITY NEVER RIDES ON THE GESTURE. A drag is invisible to a screen
 * reader, so the scrim is always an explicit labelled "Close" button and the
 * hardware back button stays wired. The gesture is the fast path, not the only
 * one.
 */
import { alpha, Radius, Spacing } from "@/constants/theme";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "./useColors";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Rendered in the draggable handle region, under the grabber. Titles belong
   * here — it's the part of a sheet people already reach for.
   */
  header?: React.ReactNode;
  /** Cap the panel's height as a fraction of the screen. Omit to hug content. */
  maxHeightRatio?: number;
  /**
   * Extra styling for the panel. An ANIMATED style is accepted as well: the
   * panel is an Animated.View, and a sheet that holds a text field has to be
   * able to ride the keyboard (see components/ui/useKeyboardInset.ts).
   */
  style?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
}

/** Drag distance past which release dismisses, in points. */
const DISMISS_DISTANCE = 90;
/** Downward flick speed that dismisses regardless of distance. */
const DISMISS_VELOCITY = 700;
/** How far below its seat the panel starts and ends its travel. */
const TRAVEL = 340;

const SEAT_SPRING = { damping: 22, stiffness: 240, mass: 0.9 } as const;

export function Sheet({
  visible,
  onClose,
  children,
  header,
  maxHeightRatio,
  style,
}: SheetProps) {
  const { colors, isDark } = useColors();

  // 0 = dismissed, 1 = seated.
  const progress = useSharedValue(0);
  // Live finger offset during a drag, in points below the seated position.
  const drag = useSharedValue(0);
  // Tracked apart from `visible` so the close animation plays before teardown.
  const [mounted, setMounted] = useState(visible);

  const finishClose = useCallback(() => setMounted(false), []);

  const animateClosed = useCallback(() => {
    progress.value = withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) });
    drag.value = withTiming(TRAVEL, { duration: 170 }, (done) => {
      if (done) runOnJS(finishClose)();
    });
  }, [progress, drag, finishClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      progress.value = withSpring(1, SEAT_SPRING);
    } else if (mounted) {
      animateClosed();
    }
  }, [visible, mounted, progress, drag, animateClosed]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        // Ask the owner to close; the effect above plays the animation, so the
        // gesture and the button take exactly the same path out.
        runOnJS(onClose)();
      } else {
        drag.value = withSpring(0, SEAT_SPRING);
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({
    // The scrim thins as the panel is dragged away, so the page behind is
    // already returning before the finger lifts.
    opacity: progress.value * (1 - Math.min(1, Math.max(0, drag.value) / 400)),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [TRAVEL, 0]) + drag.value },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Gestures inside a Modal need their own root — the app's outer one
          doesn't reach into the modal's native view hierarchy. */}
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <BlurView
            intensity={isDark ? 26 : 18}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.4) }]}
          />
        </Animated.View>

        <SafeAreaView style={styles.wrap} edges={["bottom"]} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: alpha(colors.borderStrong, 0.6),
              },
              maxHeightRatio ? { maxHeight: `${Math.round(maxHeightRatio * 100)}%` } : null,
              sheetStyle,
              style,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View>
                <View style={[styles.grabber, { backgroundColor: alpha(colors.text, 0.22) }]} />
                {header}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xxl + 6,
    borderTopRightRadius: Radius.xxl + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
});
