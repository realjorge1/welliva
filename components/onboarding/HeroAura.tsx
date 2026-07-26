/**
 * HeroAura — the ambient brand light behind onboarding heroes (public wrapper).
 *
 * Renders the animated Skia aurora when the native module is present, or a clean
 * static gradient-blob fallback otherwise (pre-rebuild window, Skia-less web,
 * reduced-motion). Purely decorative, non-interactive, always paired with a
 * fallback so a hero is never left flat.
 *
 *   <HeroAura mode="roam" width={W} height={H} />   // drifting, bouncing blobs
 *   <HeroAura mode="glow" size={240} />             // pronounced centered halo
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import { Radius, alpha, brandGradientLight } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import type { HeroAuraSkiaProps } from "./HeroAura.skia";

let SkiaAura: React.ComponentType<HeroAuraSkiaProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaAura = require("./HeroAura.skia").HeroAuraSkia;
}

/** Default aura ramp (light-mode orange). The component itself defaults to the
 *  theme brand ramp so the aura is gold-yellow in dark mode; this stays as a
 *  static fallback for any external caller. */
export const AURA_COLORS = brandGradientLight;

export interface HeroAuraProps {
  /** Square convenience — sets both width & height. */
  size?: number;
  width?: number;
  height?: number;
  /** "glow" = centered breathing bloom (default); "roam" = drifting blobs. */
  mode?: "glow" | "roam";
  colors?: readonly [string, string, ...string[]];
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function HeroAura({
  size = 300,
  width,
  height,
  mode = "glow",
  colors,
  animated = true,
  style,
}: HeroAuraProps) {
  const { colors: theme } = useColors();
  const reduced = useReducedMotion();
  // Default to the theme brand ramp — orange in light, gold-yellow in dark.
  const ramp = colors ?? theme.brandGradient;
  const w = width ?? size;
  const h = height ?? size;
  const Impl = SkiaAura;

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: w, height: h }, style]}>
      {Impl ? (
        <Impl width={w} height={h} mode={mode} colors={ramp} animated={animated && !reduced} />
      ) : (
        <StaticAura width={w} height={h} mode={mode} colors={ramp} />
      )}
    </View>
  );
}

/** Skia-less fallback: static soft gradient blobs. */
function StaticAura({
  width,
  height,
  mode,
  colors,
}: {
  width: number;
  height: number;
  mode: "glow" | "roam";
  colors: readonly [string, string, ...string[]];
}) {
  const blob = (tint: string, dim: number, d: number, left: number, top: number) => (
    <LinearGradient
      colors={[alpha(tint, dim), alpha(tint, dim * 0.35), "transparent"]}
      start={{ x: 0.3, y: 0.2 }}
      end={{ x: 0.8, y: 0.9 }}
      style={{
        position: "absolute",
        width: d,
        height: d,
        left,
        top,
        borderRadius: Radius.pill,
      }}
    />
  );
  const min = Math.min(width, height);
  if (mode === "glow") {
    const d = min * 0.9;
    return (
      <View style={StyleSheet.absoluteFill}>
        {blob(colors[1] ?? colors[0], 0.5, d, (width - d) / 2, (height - d) / 2)}
      </View>
    );
  }
  // Roam fallback: three orbs of different sizes at low intensity, matching the
  // animated impl's size tiers and gentle cast.
  const big = min * 0.84;
  const mid = min * 0.6;
  const small = min * 0.44;
  return (
    <View style={StyleSheet.absoluteFill}>
      {blob(colors[0], 0.26, big, width * 0.05, height * 0.12)}
      {blob(colors[2] ?? colors[1] ?? colors[0], 0.22, mid, width * 0.5, height * 0.42)}
      {blob(colors[1] ?? colors[0], 0.2, small, width * 0.34, height * 0.72)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
