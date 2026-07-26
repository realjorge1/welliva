/**
 * Text — the only text component in the app. Binds the type scale + theme.
 *
 *   <AppText variant="title">Today</AppText>
 *   <AppText variant="caption" color="tertiary" uppercase>Protein</AppText>
 */
import { Typography, type TypographyVariant } from "@/constants/theme";
import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useColors } from "./useColors";

type ColorRole =
  | "primary"
  | "secondary"
  | "tertiary"
  | "brand"
  | "inverse"
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "water"
  | "success"
  | "warning"
  | "error";

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorRole | string;
  weight?: TextStyle["fontWeight"];
  align?: TextStyle["textAlign"];
  uppercase?: boolean;
  /** Opacity-style dimming without changing the hue. */
  dim?: boolean;
}

/**
 * Cap how far each variant scales with the OS font-size setting. Without this,
 * large accessibility text sizes (up to ~3.5×) overflow the fixed-height chips,
 * rings, badges, buttons and rows — reading as "text spilling out of cards."
 * Big display/metric type lives in fixed-size heroes, so it's capped tighter;
 * body copy is allowed a little more headroom for readability.
 */
const MAX_FONT_SCALE: Partial<Record<TypographyVariant, number>> = {
  displayLg: 1.15,
  display: 1.15,
  metric: 1.15,
  title: 1.2,
  headline: 1.25,
};
const DEFAULT_MAX_FONT_SCALE = 1.35;

const ROLES: Record<ColorRole, keyof ReturnType<typeof useColors>["colors"]> = {
  primary: "text",
  secondary: "textSecondary",
  tertiary: "textTertiary",
  brand: "primary",
  inverse: "textInverse",
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  water: "water",
  success: "success",
  warning: "warning",
  error: "error",
};

export function AppText({
  variant = "body",
  color = "primary",
  weight,
  align,
  uppercase,
  dim,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useColors();
  const resolved = (
    color in ROLES ? colors[ROLES[color as ColorRole]] : color
  ) as string;

  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE[variant] ?? DEFAULT_MAX_FONT_SCALE}
      style={[
        Typography[variant] as TextStyle,
        { color: resolved },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        uppercase ? { textTransform: "uppercase" } : null,
        dim ? { opacity: 0.6 } : null,
        style,
      ]}
      {...rest}
    />
  );
}
