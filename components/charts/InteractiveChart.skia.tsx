/**
 * InteractiveChart.skia — the premium trend line, drawn with Skia.
 *
 * A fluid cubic-bezier line under a soft area wash, a subtle grid, and a
 * glowing dot that rides the curve while you scrub. All motion lives on the UI
 * thread:
 *   • `draw`   — a 0→1 shared value trims the stroke (`end`) so the line draws
 *                itself in from the left on mount, the fill blooming beneath it.
 *   • `active` — the scrub position (a float index) drives the dot, its radial
 *                glow and the vertical crosshair via worklets, so tracking a
 *                finger never touches the JS thread.
 *
 * Loaded lazily (only when isSkiaAvailable) so this file's static Skia import
 * is never evaluated on a surface without the native module. Pixel geometry
 * (xs/ys) is computed by the wrapper and handed in as plain numbers — the path
 * itself is built here, where Skia is guaranteed present.
 */
import { alpha } from "@/constants/theme";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Path,
  Skia,
  vec,
  type SkPath,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import {
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

export interface SkiaInteractiveChartProps {
  width: number;
  height: number;
  /** Pixel x of every point (evenly spaced), oldest → newest. */
  xs: number[];
  /** Pixel y of every point. */
  ys: number[];
  /** Chart plot area top / bottom in px (grid + crosshair extents). */
  top: number;
  bottom: number;
  /** Line + fill accent ramp. */
  colors: readonly [string, string, ...string[]];
  /** Grid hairline color. */
  grid: string;
  /** 0→1 mount draw-in progress. */
  draw: SharedValue<number>;
  /** Scrub position as a float index (0 … n-1). */
  active: SharedValue<number>;
  /** 0→1 scrub emphasis (crosshair + glow fade in while touching). */
  scrub: SharedValue<number>;
}

/**
 * Catmull-Rom → cubic-bezier: turns the points into one flowing curve with no
 * sharp corners. Each segment's control points are derived from its neighbours,
 * which is what gives the line its fluid, hand-drawn feel.
 */
function buildSmoothPath(xs: number[], ys: number[]): SkPath {
  const path = Skia.Path.Make();
  const n = xs.length;
  if (n === 0) return path;
  path.moveTo(xs[0], ys[0]);
  if (n === 1) return path;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i];
    const y0 = ys[i - 1] ?? ys[i];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[i + 2] ?? x2;
    const y3 = ys[i + 2] ?? y2;
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    path.cubicTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
  }
  return path;
}

export function SkiaInteractiveChart({
  width,
  height,
  xs,
  ys,
  top,
  bottom,
  colors,
  grid,
  draw,
  active,
  scrub,
}: SkiaInteractiveChartProps) {
  const c0 = colors[0];
  const cLast = colors[colors.length - 1];

  // The fluid line, built once per geometry change.
  const linePath = useMemo(() => buildSmoothPath(xs, ys), [xs, ys]);

  // The area under the line = the same curve, closed down to the baseline.
  const areaPath = useMemo(() => {
    const p = buildSmoothPath(xs, ys);
    if (xs.length > 0) {
      p.lineTo(xs[xs.length - 1], bottom);
      p.lineTo(xs[0], bottom);
      p.close();
    }
    return p;
  }, [xs, ys, bottom]);

  // ── Scrub geometry (all on the UI thread) ──
  // `active` is a float index; the dot glides between samples while the value
  // it reports (in the wrapper) snaps to the nearest one.
  const dotX = useDerivedValue(() => {
    "worklet";
    const n = xs.length;
    if (n === 0) return 0;
    const i = Math.max(0, Math.min(n - 1, active.value));
    const lo = Math.floor(i);
    const hi = Math.min(n - 1, lo + 1);
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
  });
  const dotY = useDerivedValue(() => {
    "worklet";
    const n = ys.length;
    if (n === 0) return 0;
    const i = Math.max(0, Math.min(n - 1, active.value));
    const lo = Math.floor(i);
    const hi = Math.min(n - 1, lo + 1);
    return ys[lo] + (ys[hi] - ys[lo]) * (i - lo);
  });

  const crossPath = useDerivedValue<SkPath>(() => {
    "worklet";
    const p = Skia.Path.Make();
    p.moveTo(dotX.value, top);
    p.lineTo(dotX.value, bottom);
    return p;
  });

  // Fill blooms in with the draw; the dot fades in as the line finishes.
  const fillOpacity = useDerivedValue(() => {
    "worklet";
    return 0.9 * draw.value;
  });
  const dotOpacity = useDerivedValue(() => {
    "worklet";
    return Math.max(0, Math.min(1, (draw.value - 0.75) / 0.25));
  });
  const crossOpacity = useDerivedValue(() => {
    "worklet";
    return scrub.value * 0.9;
  });
  const glowRadius = useDerivedValue(() => {
    "worklet";
    return 9 + 7 * scrub.value;
  });

  const gridYs = [0.25, 0.5, 0.75].map((f) => top + (bottom - top) * f);

  return (
    <Canvas style={{ width, height }}>
      {/* Subtle horizontal grid */}
      <Group>
        {gridYs.map((y, i) => (
          <Line
            key={i}
            p1={vec(0, y)}
            p2={vec(width, y)}
            color={grid}
            strokeWidth={1}
          />
        ))}
      </Group>

      {/* Area wash under the curve */}
      <Group opacity={fillOpacity}>
        <Path path={areaPath}>
          <LinearGradient
            start={vec(0, top)}
            end={vec(0, bottom)}
            colors={[alpha(c0, 0.34), alpha(cLast, 0.06), "transparent"]}
            positions={[0, 0.6, 1]}
          />
        </Path>
      </Group>

      {/* The line — soft glow underlay, then the crisp gradient stroke, both
          trimmed by `draw` so they sweep in from the left. */}
      <Group>
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={5}
          strokeJoin="round"
          strokeCap="round"
          start={0}
          end={draw}
          opacity={0.5}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, 0)}
            colors={[...colors]}
          />
          <BlurMask blur={6} style="normal" />
        </Path>
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={3}
          strokeJoin="round"
          strokeCap="round"
          start={0}
          end={draw}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, 0)}
            colors={[...colors]}
          />
        </Path>
      </Group>

      {/* Vertical crosshair (scrub only) */}
      <Group opacity={crossOpacity}>
        <Path
          path={crossPath}
          style="stroke"
          strokeWidth={1.5}
          color={alpha(cLast, 0.6)}
        />
      </Group>

      {/* Glowing scrub / current dot */}
      <Group opacity={dotOpacity}>
        <Circle cx={dotX} cy={dotY} r={glowRadius} color={alpha(cLast, 0.35)}>
          <BlurMask blur={10} style="normal" />
        </Circle>
        <Circle cx={dotX} cy={dotY} r={6} color="#FFFFFF" />
        <Circle cx={dotX} cy={dotY} r={3.5} color={cLast} />
      </Group>
    </Canvas>
  );
}
