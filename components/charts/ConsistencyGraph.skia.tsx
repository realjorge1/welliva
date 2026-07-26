/**
 * ConsistencyGraph.skia — the neon adherence line, drawn with Skia.
 *
 * A dark spotlight panel with a cyan "your average" reference line across the
 * middle and an amber line that connects each day — no axis rules, just the
 * data. Every day is a dot: gold when it sat above your average,
 * red when it slipped below — so the shape of your consistency reads at a glance.
 *
 * All motion lives on the UI thread:
 *   • `draw`   — 0→1 trims the connecting line so it sweeps in from the left, the
 *                dots blooming in just behind it.
 *   • `active` — the scrub position (a float index) drives a white halo that
 *                rides the line while you drag; it rests on today when idle.
 *   • `scrub`  — 0→1 fades the vertical crosshair in while a finger is down.
 *
 * Loaded lazily (only when isSkiaAvailable); pairs with the SVG fallback in the
 * wrapper. Pixel geometry is computed by the wrapper and handed in as plain
 * numbers — the paths themselves are built here, where Skia is guaranteed.
 */
import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Path,
  RoundedRect,
  Skia,
  vec,
  type SkPath,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

/** The fixed neon palette — the chart draws its own dark panel so it looks
 *  identical whether the app is in light or dark mode. */
export interface NeonPalette {
  panelTop: string;
  panelBottom: string;
  panelBorder: string;
  ref: string;
  lineFrom: string;
  lineTo: string;
  /** Dot fill / core for a day at or above the average (a good day). */
  up: string;
  upCore: string;
  /** Dot fill / core for a day below the average (an off day). */
  down: string;
  downCore: string;
  crosshair: string;
}

export interface SkiaConsistencyGraphProps {
  width: number;
  height: number;
  /** Pixel x / y of every day, oldest → newest. */
  xs: number[];
  ys: number[];
  /** Plot frame in px. */
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  /** Y of the average reference line. */
  refY: number;
  /** Per-day: is this day at/above the average? (picks the dot colour). */
  above: boolean[];
  palette: NeonPalette;
  /** 0→1 mount draw-in progress. */
  draw: SharedValue<number>;
  /** Scrub position as a float index (0 … n-1). */
  active: SharedValue<number>;
  /** 0→1 scrub emphasis (crosshair fades in while touching). */
  scrub: SharedValue<number>;
}

/** Straight polyline through the points (the angular, data-honest look). */
function buildLinePath(xs: number[], ys: number[]): SkPath {
  const p = Skia.Path.Make();
  if (xs.length === 0) return p;
  p.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) p.lineTo(xs[i], ys[i]);
  return p;
}

export function SkiaConsistencyGraph({
  width,
  height,
  xs,
  ys,
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  refY,
  above,
  palette,
  draw,
  active,
  scrub,
}: SkiaConsistencyGraphProps) {
  const n = xs.length;
  const linePath = useMemo(() => buildLinePath(xs, ys), [xs, ys]);

  // ── Active halo geometry (all on the UI thread) ──
  const haloX = useDerivedValue(() => {
    "worklet";
    if (n === 0) return 0;
    const i = Math.max(0, Math.min(n - 1, active.value));
    const lo = Math.floor(i);
    const hi = Math.min(n - 1, lo + 1);
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
  });
  const haloY = useDerivedValue(() => {
    "worklet";
    if (n === 0) return 0;
    const i = Math.max(0, Math.min(n - 1, active.value));
    const lo = Math.floor(i);
    const hi = Math.min(n - 1, lo + 1);
    return ys[lo] + (ys[hi] - ys[lo]) * (i - lo);
  });

  const crossPath = useDerivedValue<SkPath>(() => {
    "worklet";
    const p = Skia.Path.Make();
    p.moveTo(haloX.value, plotTop);
    p.lineTo(haloX.value, plotBottom);
    return p;
  });

  // Dots (and the halo) bloom in just after the line begins tracing.
  const dotsOpacity = useDerivedValue(() => {
    "worklet";
    return Math.max(0, Math.min(1, (draw.value - 0.15) / 0.55));
  });
  const haloOpacity = useDerivedValue(() => {
    "worklet";
    return Math.max(0, Math.min(1, (draw.value - 0.8) / 0.2));
  });
  const crossOpacity = useDerivedValue(() => {
    "worklet";
    return scrub.value * 0.85;
  });
  const haloR = useDerivedValue(() => {
    "worklet";
    return 7 + 2.5 * scrub.value;
  });

  return (
    <Canvas style={{ width, height }}>
      {/* Dark spotlight panel — its own background so the neon reads in any theme */}
      <RoundedRect x={0.5} y={0.5} width={width - 1} height={height - 1} r={20}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[palette.panelTop, palette.panelBottom]}
        />
      </RoundedRect>
      <RoundedRect
        x={0.75}
        y={0.75}
        width={width - 1.5}
        height={height - 1.5}
        r={19.5}
        color={palette.panelBorder}
        style="stroke"
        strokeWidth={1}
      />

      {/* Cyan "your average" reference line */}
      <Line
        p1={vec(plotLeft, refY)}
        p2={vec(plotRight, refY)}
        color={palette.ref}
        strokeWidth={1.75}
      />

      {/* The amber connecting line — trimmed by `draw` so it sweeps in from
          the left. */}
      {n > 1 && (
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={3}
          strokeJoin="round"
          strokeCap="round"
          start={0}
          end={draw}
        >
          <LinearGradient start={vec(plotLeft, 0)} end={vec(plotRight, 0)} colors={[palette.lineFrom, palette.lineTo]} />
        </Path>
      )}

      {/* One dot per day — gold above the average, red below */}
      <Group opacity={dotsOpacity}>
        {xs.map((x, i) => {
          const up = above[i];
          return (
            <Group key={i}>
              <Circle cx={x} cy={ys[i]} r={4.5} color={up ? palette.up : palette.down} />
              <Circle cx={x} cy={ys[i]} r={1.8} color={up ? palette.upCore : palette.downCore} />
            </Group>
          );
        })}
      </Group>

      {/* Vertical crosshair (scrub only) */}
      <Group opacity={crossOpacity}>
        <Path path={crossPath} style="stroke" strokeWidth={1.5} color={palette.crosshair} />
      </Group>

      {/* White ring — rests on today, rides the line while scrubbing */}
      <Group opacity={haloOpacity}>
        <Circle cx={haloX} cy={haloY} r={haloR} color="#FFFFFF" style="stroke" strokeWidth={2} />
      </Group>
    </Canvas>
  );
}
