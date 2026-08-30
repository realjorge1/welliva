/**
 * SessionRing — the workout player's instrument (public wrapper).
 *
 * A frame, not a hero. The demonstration figure occupies the middle of the
 * stage; this ring wraps it and reports where the athlete is — one arc per set,
 * the live one filling, a comet on its leading edge, and a gold overtime hand
 * on the outside once the work box is spent. Its `children` render centred
 * inside the ring, which is where the figure lives.
 *
 * Renders the animated Skia instrument when available, and a clean static SVG
 * ring otherwise (reduced-motion surfaces, Skia-less web, the window before a
 * native rebuild) — there is always an instrument on screen.
 *
 * Phase colour is passed in by the player: brand while working, gold on the
 * overtime / final push, water on rest.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import type { SkiaSessionRingProps } from "./SessionRing.skia";

let SkiaRing: React.ComponentType<SkiaSessionRingProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaRing = require("./SessionRing.skia").SkiaSessionRing;
}

export interface SessionRingProps {
  /** 0–1 through the CURRENT segment. */
  progress: number;
  /** How many segments the ring is cut into — one per set. Minimum 1. */
  segments?: number;
  /** Which segment is live, 1-based. */
  currentSegment?: number;
  size?: number;
  /** Ramp for the live arc and the comet. Defaults to the brand ramp. */
  gradient?: readonly [string, string, ...string[]];
  /** Seconds past the work box — draws the gold hand on the outside. */
  overtimeSeconds?: number;
  /** Breathe the halo (rest / final push). */
  pulse?: boolean;
  /** How long the charge takes to reach a new level, in ms. */
  duration?: number;
  /**
   * Linear travel — for anything driven by a clock, so the arc glides between
   * one-second ticks instead of easing to a stop sixty times a minute.
   */
  linear?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SessionRing = React.memo(function SessionRing({
  progress,
  segments = 1,
  currentSegment = 1,
  size = 300,
  gradient,
  overtimeSeconds = 0,
  pulse = false,
  duration,
  linear = false,
  children,
  style,
}: SessionRingProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const grad = gradient ?? colors.brandGradient;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {SkiaRing && !reduced ? (
        <SkiaRing
          progress={progress}
          segments={segments}
          currentSegment={currentSegment}
          size={size}
          colors={grad}
          overtimeSeconds={overtimeSeconds}
          pulse={pulse}
          duration={duration}
          linear={linear}
        />
      ) : (
        <StaticRing
          progress={progress}
          segments={segments}
          currentSegment={currentSegment}
          size={size}
          gradient={grad}
        />
      )}
      {children != null && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
          {children}
        </View>
      )}
    </View>
  );
});

/* ── Always-available SVG ring (static, no motion) ───────────────────────── */

/** One arc of a circle as an SVG path, clockwise from `startDeg`. */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number,
): string {
  const sweep = Math.max(0.01, Math.min(359.9, sweepDeg));
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = ((startDeg + sweep) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${x0},${y0} A${r},${r} 0 ${sweep > 180 ? 1 : 0},1 ${x1},${y1}`;
}

function StaticRing({
  progress,
  segments,
  currentSegment,
  size,
  gradient,
}: {
  progress: number;
  segments: number;
  currentSegment: number;
  size: number;
  gradient: readonly [string, string, ...string[]];
}) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const count = Math.max(1, Math.round(segments));
  const liveIndex = Math.max(0, Math.min(count - 1, Math.round(currentSegment) - 1));

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;
  const arcR = R * 0.93;
  const arcW = size * 0.026;

  const c0 = gradient[0];
  const cMid = gradient[Math.floor(gradient.length / 2)] ?? c0;

  const step = 360 / count;
  const gapDeg = count > 1 ? Math.min(7, 34 / count) : 0;
  const sweepDeg = count === 1 ? 359.9 : step - gapDeg;
  const startDeg = (i: number) => -90 + i * step + gapDeg / 2;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={R * 0.8}
        stroke={alpha(cMid, 0.16)}
        strokeWidth={Math.max(0.6, size * 0.0028)}
        fill="none"
      />
      {Array.from({ length: count }).map((_, i) => (
        <Path
          key={`t-${i}`}
          d={arcPath(cx, cy, arcR, startDeg(i), sweepDeg)}
          stroke={alpha(cMid, i < liveIndex ? 0.9 : 0.13)}
          strokeWidth={arcW}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {clamped > 0.01 && (
        <Path
          d={arcPath(cx, cy, arcR, startDeg(liveIndex), sweepDeg * clamped)}
          stroke={c0}
          strokeWidth={arcW}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
