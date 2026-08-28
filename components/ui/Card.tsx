/**
 * Card — the standard surface. One look, used everywhere.
 *   • Dark mode: a pale sky-blue pane of frosted glass over the black canvas
 *     (depth from the light wash + a hairline border, never a drop shadow).
 *     The surface tokens ARE that wash (see SKY_WASH in constants/theme), so
 *     the card keeps only a whisper of translucency on top of them.
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
  /**
   * Spoken name for a TAPPABLE card. A card's contents are often several text
   * nodes (title, metadata, pills), which a screen reader would otherwise read
   * as a stream of disconnected fragments — so a pressable card should name
   * itself as one thing. Ignored when there's no `onPress`.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  accessibilityLabel,
  accessibilityHint,
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
        ? alpha(surfaceTone, 0.8)
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
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        // Group the children into one focusable element when the card names
        // itself; without a label, leave the children individually reachable so
        // nothing becomes unreadable.
        accessible={accessibilityLabel ? true : undefined}
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
