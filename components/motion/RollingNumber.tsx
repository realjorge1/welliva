/**
 * RollingNumber — an odometer-style readout. When the value changes, only the
 * digits that changed roll over (old one drifts out, new one drifts in), so a
 * rep count ticking 7 → 8 feels mechanical and alive instead of teleporting.
 *
 * Runs entirely on the UI thread via Reanimated entering/exiting animations —
 * a tick costs one mount, no JS-thread animation loop. Digits are rendered
 * with tabular numerals so the row never shifts as values change.
 *
 *   <RollingNumber value={reps} />            // counts up: digits roll upward
 *   <RollingNumber value={t} direction="down" /> // countdowns roll downward
 */
import { Typography, type TypographyVariant } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useColors } from "@/components/ui";
import {
  settleLayout,
  tickInDown,
  tickInUp,
  tickOutDown,
  tickOutUp,
} from "./motion";

export interface RollingNumberProps {
  /** Pre-formatted value — numbers are stringified as-is. */
  value: number | string;
  variant?: TypographyVariant;
  color?: string;
  /** Roll direction: "up" for counts that grow, "down" for countdowns. */
  direction?: "up" | "down";
  /** Override font size/line height for hero counters. */
  textStyle?: StyleProp<TextStyle>;
}

export function RollingNumber({
  value,
  variant = "metric",
  color,
  direction = "up",
  textStyle,
}: RollingNumberProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();

  const base = Typography[variant] as TextStyle;
  const charStyle: TextStyle = {
    ...base,
    ...(StyleSheet.flatten(textStyle) ?? {}),
    color: color ?? colors.text,
    fontVariant: ["tabular-nums"],
  };
  const cellHeight = charStyle.lineHeight ?? base.lineHeight ?? 38;

  const chars = String(value).split("");
  const entering = direction === "up" ? tickInUp : tickInDown;
  const exiting = direction === "up" ? tickOutUp : tickOutDown;

  return (
    <Animated.View layout={reduced ? undefined : settleLayout()} style={styles.row}>
      {chars.map((c, i) => (
        <View key={`slot-${i}`} style={[styles.cell, { height: cellHeight }]}>
          <Animated.Text
            // Keyed on slot + character: when this position's digit changes,
            // the old one animates out while the new one rolls in.
            key={`${i}-${c}`}
            entering={reduced ? undefined : entering()}
            exiting={reduced ? undefined : exiting()}
            style={charStyle}
            allowFontScaling={false}
          >
            {c}
          </Animated.Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  cell: { overflow: "hidden", justifyContent: "center" },
});
