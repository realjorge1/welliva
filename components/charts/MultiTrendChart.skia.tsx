/**
 * MultiTrendChart.skia — several trend lines overlaid on one plot, drawn with
 * Skia. Built for the nutrition trends card: every macro is its own bold
 * gradient stroke with a marker on each sample, all sharing one baseline.
 *
 * Motion lives on the UI thread:
 *   • `draw`  — a 0→1 shared value trims every stroke's `end` so the lines
 *               sweep in together from the left; the markers fade in behind it.
 *   • `scrub` — a 0→1 emphasis that fades the vertical crosshair + the enlarged
 *               "reading" dot on each line in while a finger is down.
 * The scrub *position* is the discrete `activeIdx` (a plain prop): markers snap
 * cleanly point-to-point, which reads as precise on a dotted line and keeps the
 * per-series geometry off the worklet path entirely.
 *
 * Pixel geometry (xs shared, per-series ys) is computed by the wrapper and
 * handed in as plain numbers; `null` in a series' ys is a gap (skipped stroke
 * segment + no marker), so an untracked day never invents a point.
 */
import { alpha } from "@/constants/theme";
import {
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
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface SkiaSeries {
  key: string;
  /** Solid marker / accent color. */
  color: string;
  /** Two-stop-plus ramp for the line stroke. */
  gradient: readonly [string, string, ...string[]];
  /** Pixel y per sample; `null` breaks the line (a gap day). */
  ys: (number | null)[];
  visible: boolean;
}

export interface SkiaMultiTrendChartProps {
  width: number;
  height: number;
  /** Shared pixel x of every sample, oldest → newest. */
  xs: number[];
  series: SkiaSeries[];
  /** Plot-area top / bottom in px. */
  top: number;
  bottom: number;
  /** Grid hairline color. */
  grid: string;
  /** Surface color, used to ring markers so overlaps stay legible. */
  surface: string;
  /** Draw a marker on every sample (dense ranges pass false — line only). */
  showDots: boolean;
  /** 0→1 mount draw-in. */
  draw: SharedValue<number>;
  /** 0→1 scrub emphasis. */
  scrub: SharedValue<number>;
  /** Snapped scrub index (drives the reading dots + crosshair position). */
  activeIdx: number;
  scrubbing: boolean;
}

/**
 * Catmull-Rom → cubic-bezier through the given samples, splitting into separate
 * contours across `null` gaps so a break never draws a straight bridge.
 */
function buildSeriesPath(xs: number[], ys: (number | null)[]): SkPath {
  const path = Skia.Path.Make();
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    const n = run.length;
    if (n >= 2) {
      path.moveTo(run[0].x, run[0].y);
      for (let i = 0; i < n - 1; i++) {
        const p0 = run[i - 1] ?? run[i];
        const p1 = run[i];
        const p2 = run[i + 1];
        const p3 = run[i + 2] ?? p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    run = [];
  };
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y == null || Number.isNaN(y)) flush();
    else run.push({ x: xs[i], y });
  }
  flush();
  return path;
}

export function SkiaMultiTrendChart({
  width,
  height,
  xs,
  series,
  top,
  bottom,
  grid,
  surface,
  showDots,
  draw,
  scrub,
  activeIdx,
  scrubbing,
}: SkiaMultiTrendChartProps) {
  // One path per series, rebuilt only when the geometry changes.
  const paths = useMemo(
    () => series.map((s) => buildSeriesPath(xs, s.ys)),
    [xs, series],
  );

  // Markers fade in as the stroke finishes tracing; the crosshair + reading
  // dots ride the `scrub` emphasis.
  const dotsOpacity = useDerivedValue(() => {
    "worklet";
    return Math.max(0, Math.min(1, (draw.value - 0.55) / 0.45));
  });
  const scrubOpacity = useDerivedValue(() => {
    "worklet";
    return scrub.value;
  });

  const gridYs = [0.25, 0.5, 0.75].map((f) => top + (bottom - top) * f);
  const crossX = xs[Math.min(activeIdx, xs.length - 1)] ?? 0;

  return (
    <Canvas style={{ width, height }}>
      {/* Recessive horizontal grid */}
      <Group>
        {gridYs.map((y, i) => (
          <Line key={i} p1={vec(0, y)} p2={vec(width, y)} color={grid} strokeWidth={1} />
        ))}
      </Group>

      {/* Vertical crosshair (scrub only) */}
      <Group opacity={scrubOpacity}>
        <Line
          p1={vec(crossX, top)}
          p2={vec(crossX, bottom)}
          color={alpha(surface === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.28)}
          strokeWidth={1.5}
        />
      </Group>

      {/* One crisp bold gradient stroke per visible series, trimmed by `draw`. */}
      {series.map((s, si) =>
        s.visible ? (
          <Path
            key={s.key}
            path={paths[si]}
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
              colors={[...s.gradient]}
            />
          </Path>
        ) : null,
      )}

      {/* A marker on every sample (sparse ranges only) — surface-ringed so
          overlapping macros stay separable. */}
      {showDots && (
        <Group opacity={dotsOpacity}>
          {series.map((s) =>
            s.visible
              ? s.ys.map((y, i) =>
                  y == null || Number.isNaN(y) ? null : (
                    <Group key={`${s.key}-${i}`}>
                      <Circle cx={xs[i]} cy={y} r={4.5} color={surface} />
                      <Circle cx={xs[i]} cy={y} r={2.8} color={s.color} />
                    </Group>
                  ),
                )
              : null,
          )}
        </Group>
      )}

      {/* Enlarged reading dot per line at the scrubbed sample */}
      {scrubbing && (
        <Group opacity={scrubOpacity}>
          {series.map((s) => {
            const y = s.ys[Math.min(activeIdx, s.ys.length - 1)];
            if (!s.visible || y == null || Number.isNaN(y)) return null;
            return (
              <Group key={s.key}>
                <Circle cx={crossX} cy={y} r={5.5} color={surface} />
                <Circle cx={crossX} cy={y} r={3.4} color={s.color} />
              </Group>
            );
          })}
        </Group>
      )}
    </Canvas>
  );
}
