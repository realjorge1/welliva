/**
 * TrainingGauge — the workout HUD instrument (public wrapper).
 *
 * A Mercedes-Benz-cluster radial gauge: a 270° ring of graduated ticks that
 * light up in a brand sweep as `progress` fills. Renders the animated Skia
 * dial when available, or a clean static SVG dial otherwise (pre-rebuild
 * window, reduced-motion surface, Skia-less web) — there is always an
 * instrument on screen. Center content (the digital readout) is layered over
 * the dial via the `children` slot, exactly like Ring.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { alpha } from "@/constants/theme";
import { useColors } from "@/components/ui";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import type { SkiaTrainingGaugeProps } from "./TrainingGauge.skia";

let SkiaGauge: React.ComponentType<SkiaTrainingGaugeProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaGauge = require("./TrainingGauge.skia").SkiaTrainingGauge;
}

export interface TrainingGaugeProps {
  /** 0–1 fill. */
  progress: number;
  size?: number;
  gradient?: readonly [string, string, ...string[]];
  track?: string;
  /** Breathe the core glow (rest / final-push states). */
  pulse?: boolean;
  duration?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const START_DEG = 135;
const SWEEP_DEG = 270;
const TICKS = 60;

export function TrainingGauge({
  progress,
  size = 240,
  gradient,
  track,
  pulse = false,
  duration,
  children,
  style,
}: TrainingGaugeProps) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  // Default to the theme brand ramp (orange in light, gold in dark).
  const grad = gradient ?? colors.brandGradient;
  // Light: unlit ticks are a bold dark charcoal that light up in color.
  // Dark: keep the faint per-metric tint (the cluster "remains as is").
  const trackColor =
    track ?? (isDark ? alpha(grad[grad.length - 1], 0.18) : colors.emptyTrack);
  const Impl = SkiaGauge;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {Impl && !reduced ? (
        <Impl
          progress={progress}
          size={size}
          colors={grad}
          track={trackColor}
          pulse={pulse}
          duration={duration}
        />
      ) : (
        <StaticGauge
          progress={progress}
          size={size}
          gradient={grad}
          track={trackColor}
        />
      )}
      {children != null && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      )}
    </View>
  );
}

/** Always-available SVG dial (static, no glow) for the Skia-less path. */
function StaticGauge({
  progress,
  size,
  gradient,
  track,
}: {
  progress: number;
  size: number;
  gradient: readonly [string, string, ...string[]];
  track: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - size * 0.02;
  const minorInnerR = outerR - size * 0.058;
  const majorInnerR = outerR - size * 0.095;
  const litCount = Math.round(clamped * TICKS);
  const lit = gradient[0];
  const litDeep = gradient[gradient.length - 1];

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = ((START_DEG + (i / (TICKS - 1)) * SWEEP_DEG) * Math.PI) / 180;
    const major = i % 6 === 0;
    const rIn = major ? majorInnerR : minorInnerR;
    const isLit = i < litCount;
    return {
      x1: cx + rIn * Math.cos(a),
      y1: cy + rIn * Math.sin(a),
      x2: cx + outerR * Math.cos(a),
      y2: cy + outerR * Math.sin(a),
      color: isLit ? (i / TICKS < 0.5 ? lit : litDeep) : track,
      w: major ? Math.max(2.5, size * 0.02) : Math.max(2, size * 0.013),
    };
  });

  return (
    <Svg width={size} height={size}>
      {ticks.map((t, i) => (
        <Line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.color}
          strokeWidth={t.w}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
