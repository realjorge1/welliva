/**
 * GradientIconButton — the app's premium circular action.
 *
 * A flat tinted disc with an icon on it is the default every app reaches for,
 * and it reads as exactly that: a default. This is built like a piece of
 * hardware instead — a hairline of the brand's gold ramp run diagonally around
 * a dark glass core, so the ring catches "light" at the top-left and deepens
 * toward the bottom-right. On the OLED canvas that thin bright edge is the whole
 * effect; the button stays quiet until you look straight at it.
 *
 * Three details do the work, and none of them are the gradient:
 *   · The ring is a HAIRLINE (1.5pt). A thick gradient border reads as a toy;
 *     jewellery is thin.
 *   · The core is `surfaceElevated` over a faint brand wash, so the icon sits on
 *     something with depth rather than on a hole punched in the page.
 *   · The press is a spring on the UI thread, not an opacity flicker — the
 *     control has weight when you touch it.
 */

import { Motion, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useColors } from "./useColors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Ring thickness. Thin on purpose — see the header. */
const RING = 1.5;

const PRESS_SPRING = { damping: 18, stiffness: 380, mass: 0.6 } as const;

export interface GradientIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Required — this control is icon-only, so it has no other accessible name. */
  accessibilityLabel: string;
  /** Diameter. Defaults to the standard 44pt touch target. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function GradientIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 44,
  style,
}: GradientIconButtonProps) {
  const { colors } = useColors();

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const inner = size - RING * 2;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(Motion.pressScale - 0.05, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        styles.wrap,
        pressStyle,
        style,
      ]}
    >
      {/* The ring: the full disc painted with the brand ramp, then covered by
          the core — what's left showing IS the ring. */}
      <LinearGradient
        colors={colors.brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />

      <View
        style={[
          styles.core,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
      >
        {/* Faint brand wash inside the glass, so the core isn't a dead hole. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: inner / 2,
              backgroundColor: alpha(colors.primary, 0.1),
            },
          ]}
        />
        <Ionicons
          name={icon}
          size={Math.round(size * 0.44)}
          color={colors.primary}
        />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  core: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
