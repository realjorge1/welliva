/**
 * Button — primary (brand gradient), tonal, ghost & danger variants.
 * Built-in haptics + press-scale so every tap feels considered.
 */
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";

type Variant = "primary" | "tonal" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Overrides the spoken name. Only needed when the visible `label` isn't the
   * whole story ("Next" → "Next, step 3 of 5"); otherwise `label` is used.
   */
  accessibilityLabel?: string;
  /** What happens on activation, when it isn't obvious from the label. */
  accessibilityHint?: string;
}

const SIZES: Record<Size, { h: number; px: number; font: number; icon: number }> = {
  sm: { h: 40, px: Spacing.lg, font: 14, icon: 16 },
  md: { h: 52, px: Spacing.xl, font: 15, icon: 18 },
  lg: { h: 58, px: Spacing.xxl, font: 16, icon: 20 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight = false,
  fullWidth = true,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useColors();
  const s = SIZES[size];
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, tension: 300, friction: 18 }).start();

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress?.();
  };

  const fg =
    variant === "primary" || variant === "danger"
      ? colors.onPrimary
      : variant === "ghost"
        ? colors.primary
        : colors.text;

  const inner = (
    <View style={styles.row}>
      {icon && !iconRight && (
        <Ionicons name={icon} size={s.icon} color={fg} style={styles.iconLeft} />
      )}
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <AppText
          variant="callout"
          color={fg}
          style={{ fontSize: s.font, fontWeight: "700", letterSpacing: 0.1 }}
        >
          {label}
        </AppText>
      )}
      {icon && iconRight && (
        <Ionicons name={icon} size={s.icon} color={fg} style={styles.iconRight} />
      )}
    </View>
  );

  const frame: StyleProp<ViewStyle> = [
    styles.base,
    { height: s.h, paddingHorizontal: s.px },
    fullWidth ? styles.full : null,
    disabled ? { opacity: 0.45 } : null,
    style,
  ];

  return (
    <Animated.View style={[fullWidth ? styles.full : null, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={disabled || loading}
        // Every Button gets a spoken name for free by falling back to the
        // visible label — the single highest-coverage a11y change in the app,
        // since most touchables route through here. `busy` matters because a
        // loading button swaps its text for a spinner and would otherwise go
        // silent mid-action.
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        {variant === "primary" || variant === "danger" ? (
          <LinearGradient
            colors={variant === "danger" ? [colors.error, colors.error] : colors.brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={frame}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View
            style={[
              frame,
              variant === "tonal"
                ? { backgroundColor: colors.primarySoft }
                : { backgroundColor: "transparent", borderWidth: 1.5, borderColor: alpha(colors.primary, 0.4) },
            ]}
          >
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  full: { width: "100%" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm },
});
