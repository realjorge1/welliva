/**
 * MultiTrendChart — several overlaid, scrubbable trend lines (public wrapper).
 *
 * Owns everything that isn't the raw drawing: it measures its width, maps every
 * series' values to a *shared* pixel scale (so the lines are directly
 * comparable and all begin at the same left edge), runs the horizontal
 * pan-to-scrub gesture, and reports the active sample index up to its parent
 * (which owns the legend readout). The curves are drawn by the Skia impl when
 * available, or a clean react-native-svg fallback otherwise.
 *
 * Like {@link InteractiveChart}, the gesture is tuned to coexist with the
 * vertical page ScrollView: `activeOffsetX` claims horizontal drags while
 * `failOffsetY` lets vertical scrolls pass through.
 */
import { IntroGrow } from "@/components/motion/IntroReveal";
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { useColors } from "@/components/ui";
import { Motion, alpha } from "@/constants/theme";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
} from "react-native-svg";
import type { SkiaMultiTrendChartProps, SkiaSeries } from "./MultiTrendChart.skia";
import { sharedDomain } from "./series";

let SkiaChart: React.ComponentType<SkiaMultiTrendChartProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaChart = require("./MultiTrendChart.skia").SkiaMultiTrendChart;
}

const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 12;
/** At or below this many samples every point gets a marker; above, line only. */
const DOT_LIMIT = 16;

/** One overlaid line: pre-normalized values (nulls = gaps) + its identity. */
export interface MultiSeries {
  key: string;
  color: string;
  gradient: readonly [string, string, ...string[]];
  values: (number | null)[];
  visible: boolean;
}

export interface MultiTrendChartProps {
  series: MultiSeries[];
  /** Sample count — every series' `values` must be this long. */
  length: number;
  height?: number;
  /** Changing this replays the draw-in and resets the scrubber. */
  animKey?: string;
  onActiveChange?: (index: number, scrubbing: boolean) => void;
}

/**
 * Shared scale across ALL series; per-series ys, nulls preserved.
 *
 * THE DOMAIN IGNORES VISIBILITY, DELIBERATELY. It used to be built from the
 * visible series only, which meant toggling a macro off silently rescaled the
 * plot: hide calories and the carbs line jumped up to sit exactly where
 * calories had been. Two people comparing the same week would see the same
 * curve at two different heights depending on which chips they'd tapped, and a
 * line that moves when you hide a DIFFERENT line is not a line anyone can read.
 *
 * A legend chip is a FILTER, not a zoom. Every series is already indexed to its
 * own first day = 100 (`indexToStart`), so one domain over all of them is the
 * honest one — and it means a hidden line comes back exactly where it left.
 */
function computeGeometry(
  series: MultiSeries[],
  length: number,
  width: number,
  height: number,
) {
  const innerW = width - PAD_L - PAD_R;
  const top = PAD_T;
  const bottom = height - PAD_B;
  // Every series, hidden ones included — see `sharedDomain`.
  const [lo, hi] = sharedDomain(series.map((s) => s.values));
  const xs = Array.from({ length }, (_, i) =>
    length > 1 ? PAD_L + (i / (length - 1)) * innerW : PAD_L + innerW / 2,
  );
  const toY = (v: number | null): number | null =>
    v == null || !Number.isFinite(v)
      ? null
      : top + (1 - (v - lo) / (hi - lo)) * (bottom - top);
  const skiaSeries: SkiaSeries[] = series.map((s) => ({
    key: s.key,
    color: s.color,
    gradient: s.gradient,
    ys: s.values.map(toY),
    visible: s.visible,
  }));
  return { xs, top, bottom, skiaSeries };
}

export function MultiTrendChart({
  series,
  length,
  height = 190,
  animKey,
  onActiveChange,
}: MultiTrendChartProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const lastIndex = Math.max(0, length - 1);

  const [activeIdx, setActiveIdx] = useState(lastIndex);
  const [scrubbing, setScrubbing] = useState(false);

  const draw = useSharedValue(1);
  const scrub = useSharedValue(0);
  const firstRun = useRef(true);
  const lastReported = useSharedValue(lastIndex);

  const geo = useMemo(
    () => (width > 0 ? computeGeometry(series, length, width, height) : null),
    [series, length, width, height],
  );

  // Reset the scrubber + re-trace when the data set changes (range switch),
  // except on the very first paint (that reveal is the container scale-in).
  useEffect(() => {
    setActiveIdx(lastIndex);
    setScrubbing(false);
    lastReported.value = lastIndex;
    scrub.value = 0;
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (reduced || isFirst) {
      draw.value = 1;
    } else {
      draw.value = 0;
      draw.value = withTiming(1, {
        duration: Motion.duration.hero,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, length]);

  const report = useCallback(
    (idx: number, isScrubbing: boolean) => {
      setActiveIdx(idx);
      setScrubbing(isScrubbing);
      onActiveChange?.(idx, isScrubbing);
    },
    [onActiveChange],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // Horizontal scrub, cooperative with the vertical page scroll.
  const pan = useMemo(() => {
    const innerW = width - PAD_L - PAD_R;
    const count = length;
    const updateFromX = (x: number) => {
      "worklet";
      if (count < 2 || innerW <= 0) return;
      const clampedX = Math.max(PAD_L, Math.min(width - PAD_R, x));
      const t = (clampedX - PAD_L) / innerW;
      const r = Math.round(t * (count - 1));
      if (r !== lastReported.value) {
        lastReported.value = r;
        runOnJS(report)(r, true);
      }
    };
    return Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-14, 14])
      .enabled(count >= 2)
      .onBegin((e) => {
        scrub.value = withTiming(1, { duration: 140 });
        updateFromX(e.x);
      })
      .onChange((e) => updateFromX(e.x))
      .onFinalize(() => {
        scrub.value = withTiming(0, { duration: 220 });
        lastReported.value = count - 1;
        runOnJS(report)(count - 1, false);
      });
  }, [width, length]); // eslint-disable-line react-hooks/exhaustive-deps

  const showDots = length <= DOT_LIMIT;

  return (
    <IntroGrow>
      <GestureDetector gesture={pan}>
        <View style={{ height, width: "100%" }} onLayout={onLayout}>
          {geo && length > 0 && (
            <>
              {SkiaChart && !reduced ? (
                <SkiaChart
                  width={width}
                  height={height}
                  xs={geo.xs}
                  series={geo.skiaSeries}
                  top={geo.top}
                  bottom={geo.bottom}
                  grid={alpha(colors.borderStrong, 0.4)}
                  surface={colors.surfaceElevated}
                  showDots={showDots}
                  draw={draw}
                  scrub={scrub}
                  activeIdx={activeIdx}
                  scrubbing={scrubbing}
                />
              ) : (
                <FallbackChart
                  width={width}
                  height={height}
                  xs={geo.xs}
                  series={geo.skiaSeries}
                  top={geo.top}
                  bottom={geo.bottom}
                  grid={alpha(colors.borderStrong, 0.4)}
                  surface={colors.surfaceElevated}
                  showDots={showDots}
                  activeIdx={activeIdx}
                  scrubbing={scrubbing}
                />
              )}
            </>
          )}
        </View>
      </GestureDetector>
    </IntroGrow>
  );
}

/** Catmull-Rom → cubic-bezier as an SVG `d`, split across `null` gaps. */
function smoothSegments(xs: number[], ys: (number | null)[]): string {
  let d = "";
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    if (run.length >= 2) {
      d += ` M ${run[0].x} ${run[0].y}`;
      for (let i = 0; i < run.length - 1; i++) {
        const p0 = run[i - 1] ?? run[i];
        const p1 = run[i];
        const p2 = run[i + 1];
        const p3 = run[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
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
  return d.trim();
}

/** Static-but-interactive SVG chart for the Skia-less / reduced-motion path. */
function FallbackChart({
  width,
  height,
  xs,
  series,
  top,
  bottom,
  grid,
  surface,
  showDots,
  activeIdx,
  scrubbing,
}: {
  width: number;
  height: number;
  xs: number[];
  series: SkiaSeries[];
  top: number;
  bottom: number;
  grid: string;
  surface: string;
  showDots: boolean;
  activeIdx: number;
  scrubbing: boolean;
}) {
  const gridYs = [0.25, 0.5, 0.75].map((f) => top + (bottom - top) * f);
  const crossX = xs[Math.min(activeIdx, xs.length - 1)] ?? 0;

  return (
    <Svg width={width} height={height}>
      {gridYs.map((y, i) => (
        <SvgLine key={i} x1={0} y1={y} x2={width} y2={y} stroke={grid} strokeWidth={1} />
      ))}
      {scrubbing && (
        <SvgLine
          x1={crossX}
          y1={top}
          x2={crossX}
          y2={bottom}
          stroke={alpha("#808080", 0.5)}
          strokeWidth={1.5}
        />
      )}
      {series.map((s) =>
        s.visible ? (
          <SvgPath
            key={s.key}
            d={smoothSegments(xs, s.ys)}
            stroke={s.color}
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null,
      )}
      {showDots &&
        series.map((s) =>
          s.visible
            ? s.ys.map((y, i) =>
                y == null || Number.isNaN(y) ? null : (
                  <React.Fragment key={`${s.key}-${i}`}>
                    <SvgCircle cx={xs[i]} cy={y} r={4.5} fill={surface} />
                    <SvgCircle cx={xs[i]} cy={y} r={2.8} fill={s.color} />
                  </React.Fragment>
                ),
              )
            : null,
        )}
      {scrubbing &&
        series.map((s) => {
          const y = s.ys[Math.min(activeIdx, s.ys.length - 1)];
          if (!s.visible || y == null || Number.isNaN(y)) return null;
          return (
            <React.Fragment key={`a-${s.key}`}>
              <SvgCircle cx={crossX} cy={y} r={5} fill={surface} />
              <SvgCircle cx={crossX} cy={y} r={3.2} fill={s.color} />
            </React.Fragment>
          );
        })}
    </Svg>
  );
}
