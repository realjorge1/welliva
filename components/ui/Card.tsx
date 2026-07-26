/**
 * Card — the standard surface. One look, used everywhere.
 *   • Dark mode: a translucent pane of glass over the black canvas (depth from
 *     translucency + a hairline border, never a drop shadow).
 *   • Light mode: a soft neutral light-gray panel on the white page — children
 *     render dark-on-light exactly like the rest of the page (no inversion).
 */
import { LightCard, Radius, Shadows, Spacing, alpha } from "@/constants/theme";
import React from "react";
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useColors } from "./useColors";

type Elevation = keyof typeof Shadows;

export interface CardProps {
  children: React.ReactNode;
  /** Padding preset or explicit number. */
  padding?: keyof typeof Spacing | number;
  radius?: keyof typeof Radius | number;
  elevation?: Elevation;
  /** Use the elevated surface tone (for cards on cards). */
  elevated?: boolean;
  bordered?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  padding = "xxl",
  radius = "xl",
  elevation = "sm",
  elevated = false,
  bordered = true,
  onPress,
  style,
}: CardProps) {
  const { colors, isDark } = useColors();
  const pad = typeof padding === "number" ? padding : Spacing[padding];
  const rad = typeof radius === "number" ? radius : Radius[radius];

  // Light mode: a soft neutral gray panel on the white page. Dark mode: the
  // frosted-glass veil over the black canvas. Children render with the normal
  // page palette in both modes — no inversion.
  const surfaceTone = elevated ? colors.surfaceElevated : colors.surface;
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: isDark
        ? alpha(surfaceTone, 0.66)
        : elevated
          ? LightCard.elevated
          : LightCard.base,
      borderRadius: rad,
      padding: pad,
      borderWidth: bordered ? 1 : 0,
      borderColor: isDark ? alpha(colors.borderStrong, 0.55) : LightCard.border,
    },
    // Always flat — no drop shadows anywhere (depth = surface + border).
    Shadows[elevation],
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}
