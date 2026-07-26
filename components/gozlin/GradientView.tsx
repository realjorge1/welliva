/**
 * GradientView — thin wrapper over expo-linear-gradient with the same props.
 * expo-linear-gradient is a hard dependency of the app (imported statically
 * across the design system), so no runtime fallback is needed here.
 */

import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleProp, ViewStyle } from "react-native";

interface GradientViewProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GradientView({ colors, start, end, style, children }: GradientViewProps) {
  return (
    <LinearGradient
      colors={colors as unknown as readonly [string, string, ...string[]]}
      start={start}
      end={end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
