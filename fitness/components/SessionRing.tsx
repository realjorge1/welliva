/**
 * SessionRing — the workout player's instrument (public wrapper).
 *
 * A frame, not a hero. The demonstration figure occupies the middle of the
 * stage; this ring wraps it and reports where the athlete is — one chunky arc
 * per set, the live one filling with a knob on its leading edge, and a gold
 * overtime hand on the outside once the work box is spent. Its `children`
 * render centred inside the ring, which is where the figure lives.
 *
 * Renders the animated Skia instrument when available, and a static SVG ring
 * of the same shape otherwise (reduced-motion surfaces, Skia-less web, the
 * window before a native rebuild) — there is always an instrument on screen.
 *
 * Phase colour is passed in by the player: brand while working, gold on the
 * overtime / final push, water on rest.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import type { SkiaSessionRingProps } from "./SessionRing.skia";
import { ringGeometry, ringPalette } from "./sessionRingStyle";

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
  /** Ramp for the band. Defaults to the brand ramp. */
  gradient?: readonly [string, string, ...string[]];
  /** Seconds past the work box — draws the gold hand on the outside. */
  overtimeSeconds?: number;
  /** Breathe the halo (rest / final push). */
  pulse?: boolean;
  /** Thump the knob once a second — the last seconds of the box, overtime. */
  beat?: boolean;
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
  beat = false,
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
          ground={colors.background}
          overtimeSeconds={overtimeSeconds}
          pulse={pulse}
          beat={beat}
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
          ground={colors.background}
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

/** The same chunky band as the Skia ring — track, banked sets, the live fill. */
function StaticRing({
  progress,
  segments,
  currentSegment,
  size,
  gradient,
  ground,
}: {
  progress: number;
  segments: number;
  currentSegment: number;
  size: number;
  gradient: readonly [string, string, ...string[]];
  ground: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const g = ringGeometry(size, segments);
  const pal = ringPalette(gradient, ground);
  const liveIndex = Math.max(0, Math.min(g.count - 1, Math.round(currentSegment) - 1));
  const sets = Array.from({ length: g.count }, (_, i) => i);

  const band = (i: number, sweep: number, color: string, key: string) => (
    <Path
      key={key}
      d={arcPath(g.cx, g.cy, g.arcR, g.startDeg(i), sweep)}
      stroke={color}
      strokeWidth={g.arcW}
      strokeLinecap="round"
      fill="none"
    />
  );

  return (
    <Svg width={size} height={size}>
      <Circle cx={g.cx} cy={g.cy} r={g.plateR} fill={pal.plate} />
      <G transform={`translate(0 ${g.lip})`}>
        {sets.map((i) => band(i, g.sweepDeg, i < liveIndex ? pal.fillLip : pal.trackLip, `l-${i}`))}
        {clamped > 0.01 ? band(liveIndex, g.sweepDeg * clamped, pal.fillLip, "l-live") : null}
      </G>
      {sets.map((i) => band(i, g.sweepDeg, i < liveIndex ? pal.fill : pal.track, `t-${i}`))}
      {clamped > 0.01 ? band(liveIndex, g.sweepDeg * clamped, pal.fill, "live") : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
