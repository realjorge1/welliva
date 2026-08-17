/**
 * MENU BUTTON — the hamburger, top-left of every root screen.
 *
 * Drawn rather than iconified so the bars can be part of the same animation as
 * everything else: they read the drawer's shared value directly, so the icon
 * settles *with your finger* during a drag instead of snapping at the end. The
 * middle bar retracts and fades as the menu comes out — a small tell that the
 * control is live and reversible.
 */

import { useColors } from "@/components/ui/useColors";
import { Radius } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useDrawer } from "./DrawerContext";

export interface MenuButtonProps {
  /** Overall diameter of the tap target. */
  size?: number;
  /** Bar color. Defaults to the theme's primary text. */
  tint?: string;
  /** Give the button a soft plate behind it (for busy or image-backed headers). */
  plated?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BAR_WIDTH = 19;

export function MenuButton({ size = 40, tint, plated = false, style }: MenuButtonProps) {
  const { colors } = useColors();
  const { progress, isOpen, toggle } = useDrawer();
  const color = tint ?? colors.text;

  // Outer bars ease inward a touch; the middle one gets out of the way.
  const outer = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0, 1],
      [BAR_WIDTH, BAR_WIDTH - 4],
      Extrapolation.CLAMP,
    ),
  }));

  const middle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0, 1],
      [BAR_WIDTH - 5, 4],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(progress.value, [0, 0.7], [1, 0.25], Extrapolation.CLAMP),
  }));

  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? "Close menu" : "Open menu"}
      accessibilityState={{ expanded: isOpen }}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        plated && { backgroundColor: colors.surfaceMuted },
        pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
        style,
      ]}
    >
      <View style={styles.bars}>
        <Animated.View style={[styles.bar, { backgroundColor: color }, outer]} />
        <Animated.View style={[styles.bar, { backgroundColor: color }, middle]} />
        <Animated.View style={[styles.bar, { backgroundColor: color }, outer]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bars: { gap: 4, alignItems: "flex-start" },
  bar: { height: 2, borderRadius: 1 },
});
