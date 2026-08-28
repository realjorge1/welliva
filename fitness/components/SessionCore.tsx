/**
 * SessionCore — the workout player's hero instrument (public wrapper).
 *
 * The single thing on screen the athlete watches. It is deliberately NOT a
 * dial: it's a charged energy cell — a fluid core inside a graduated
 * containment ring, with a comet on the leading edge of a progress arc. It
 * persists across every phase of a session instead of being torn down and
 * rebuilt, so the countdown draining into the first set, the set filling, and
 * rest emptying all read as one continuous instrument.
 *
 * Renders the animated Skia core when available, or a clean static SVG cell
 * otherwise (reduced-motion surfaces, Skia-less web, the window before a native
 * rebuild) — there is always an instrument on screen. Center content (the
 * digital readout) is layered over it via the `children` slot.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { SkiaSessionCoreProps } from "./SessionCore.skia";

let SkiaCore: React.ComponentType<SkiaSessionCoreProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaCore = require("./SessionCore.skia").SkiaSessionCore;
}

export interface SessionCoreProps {
  /** 0–1 charge level. */
  progress: number;
  size?: number;
  /** Ramp for the fluid, the arc and the comet. Defaults to the brand ramp. */
  gradient?: readonly [string, string, ...string[]];
  /** Breathe the containment field (rest / final push). */
  pulse?: boolean;
  /** How long the charge takes to reach a new level, in ms. */
  duration?: number;
  /**
   * Linear travel — for anything driven by a clock (a countdown, a rest timer),
   * so the charge glides continuously between one-second ticks instead of
   * easing to a stop 60 times a minute.
   */
  linear?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SessionCore = React.memo(function SessionCore({
  progress,
  size = 240,
  gradient,
  pulse = false,
  duration,
  linear = false,
  children,
  style,
}: SessionCoreProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const grad = gradient ?? colors.brandGradient;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {SkiaCore && !reduced ? (
        <SkiaCore
          progress={progress}
          size={size}
          colors={grad}
          pulse={pulse}
          duration={duration}
          linear={linear}
        />
      ) : (
        <StaticCore progress={progress} size={size} gradient={grad} />
      )}
      {children != null && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      )}
    </View>
  );
});

/** Always-available SVG cell (static, no motion) for the Skia-less path. */
function StaticCore({
  progress,
  size,
  gradient,
}: {
  progress: number;
  size: number;
  gradient: readonly [string, string, ...string[]];
}) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const cx = size / 2;
  const cy = size / 2;
  const arcR = size / 2 - size * 0.035;
  const cellR = (size / 2) * 0.665;
  const c0 = gradient[0];
  const cDeep = gradient[gradient.length - 1];
  const circumference = 2 * Math.PI * arcR;

  // The fluid level, drawn as a chord-capped fill inside the cell.
  const level = cy + cellR - clamped * cellR * 2;
  const half = Math.sqrt(Math.max(0, cellR * cellR - (level - cy) * (level - cy)));
  const fill =
    clamped <= 0
      ? ""
      : `M${cx - half},${level} A${cellR},${cellR} 0 ${level < cy ? 1 : 0},0 ${cx + half},${level} Z`;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="core-fluid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c0} stopOpacity="0.7" />
          <Stop offset="1" stopColor={cDeep} stopOpacity="0.35" />
        </LinearGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={cellR} fill={alpha(cDeep, 0.16)} />
      {fill ? <Path d={fill} fill="url(#core-fluid)" /> : null}
      <Circle
        cx={cx}
        cy={cy}
        r={cellR}
        stroke={alpha(c0, 0.34)}
        strokeWidth={Math.max(1, size * 0.006)}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={arcR}
        stroke={alpha(c0, 0.16)}
        strokeWidth={size * 0.026}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={arcR}
        stroke={c0}
        strokeWidth={size * 0.026}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference * clamped} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
