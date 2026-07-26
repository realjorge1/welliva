/**
 * InteractiveChart — a scrubbable trend line (public wrapper).
 *
 * Owns everything that isn't the raw drawing: it measures its width, maps the
 * `points` to pixel geometry, runs the horizontal pan-to-scrub gesture, floats
 * the value tooltip, and reports the active sample to its parent. The actual
 * curve is drawn by the Skia impl when available, or a clean react-native-svg
 * fallback otherwise (pre-rebuild window, reduced motion, Skia-less surface) —
 * there is always a chart on screen, and scrubbing works either way.
 *
 * The gesture is tuned to live happily inside the vertical page ScrollView:
 * `activeOffsetX` claims horizontal drags while `failOffsetY` lets vertical
 * scrolls pass straight through.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { IntroGrow } from "@/components/motion/IntroReveal";
import { AppText, useColors } from "@/components/ui";
import { Motion, Radius, alpha } from "@/constants/theme";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
} from "react-native-svg";
import type { SkiaInteractiveChartProps } from "./InteractiveChart.skia";
import type { ChartPoint } from "./types";

let SkiaChart: React.ComponentType<SkiaInteractiveChartProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaChart = require("./InteractiveChart.skia").SkiaInteractiveChart;
}

const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 10;
const TIP_W = 138;

export interface InteractiveChartProps {
  points: ChartPoint[];
  height?: number;
  /** Line + fill accent ramp (defaults to the brand gradient). */
  gradient: readonly [string, string, ...string[]];
  /** Changing this replays the draw-in and resets the scrubber (range switch). */
  animKey?: string;
  /** Fired when the scrub position changes (and on release, with scrubbing=false). */
  onActiveChange?: (index: number, scrubbing: boolean) => void;
  /** Unit suffix for the tooltip value ("kcal", "min", "kg"). */
  unit?: string;
}

function computeGeometry(points: ChartPoint[], width: number, height: number) {
  const n = points.length;
  const innerW = width - PAD_L - PAD_R;
  const top = PAD_T;
  const bottom = height - PAD_B;
  const values = points.map((p) => p.value);
  let vmin = Math.min(...values);
  let vmax = Math.max(...values);
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) {
    vmin = 0;
    vmax = 1;
  }
  if (vmin === vmax) {
    vmin -= 1;
    vmax += 1;
  }
  const padV = (vmax - vmin) * 0.18;
  const lo = vmin - padV;
  const hi = vmax + padV;
  const xs = points.map((_, i) =>
    n > 1 ? PAD_L + (i / (n - 1)) * innerW : PAD_L + innerW / 2,
  );
  const ys = values.map(
    (v) => top + (1 - (v - lo) / (hi - lo)) * (bottom - top),
  );
  return { xs, ys, top, bottom, innerW };
}

/** Catmull-Rom → cubic-bezier as an SVG `d` string (fallback path). */
function smoothPathString(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i];
    const y0 = ys[i - 1] ?? ys[i];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[i + 2] ?? x2;
    const y3 = ys[i + 2] ?? y2;
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
  }
  return d;
}

export function InteractiveChart({
  points,
  height = 200,
  gradient,
  animKey,
  onActiveChange,
  unit,
}: InteractiveChartProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const n = points.length;
  const lastIndex = Math.max(0, n - 1);

  const [activeIdx, setActiveIdx] = useState(lastIndex);
  const [scrubbing, setScrubbing] = useState(false);

  // UI-thread scrub state. The line starts fully drawn — the cold-start reveal
  // is the container's scale-in (IntroGrow), and range switches re-trace below.
  const draw = useSharedValue(1);
  const firstRun = useRef(true);
  const active = useSharedValue(lastIndex);
  const scrub = useSharedValue(0);
  const lastReported = useSharedValue(lastIndex);

  const geo = useMemo(
    () => (width > 0 ? computeGeometry(points, width, height) : null),
    [points, width, height],
  );

  // Reset the scrubber whenever the data set changes, and re-trace the line —
  // but not on the first paint (that's the scale-in reveal, or a plain snap).
  useEffect(() => {
    setActiveIdx(lastIndex);
    setScrubbing(false);
    lastReported.value = lastIndex;
    active.value = lastIndex;
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
  }, [animKey, n]);

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
    const count = n;
    const updateFromX = (x: number) => {
      "worklet";
      if (count < 2 || innerW <= 0) return;
      const clampedX = Math.max(PAD_L, Math.min(width - PAD_R, x));
      const t = (clampedX - PAD_L) / innerW;
      const idx = t * (count - 1);
      active.value = idx;
      const r = Math.round(idx);
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
        active.value = withTiming(count - 1, { duration: 260 });
        lastReported.value = count - 1;
        runOnJS(report)(count - 1, false);
      });
  }, [width, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tooltip glides with the dot (UI thread); its text updates on index change.
  const tipStyle = useAnimatedStyle(() => {
    const innerW = width - PAD_L - PAD_R;
    const x = n > 1 ? PAD_L + (active.value / (n - 1)) * innerW : PAD_L;
    const clamped = Math.max(0, Math.min(width - TIP_W, x - TIP_W / 2));
    return {
      opacity: scrub.value,
      transform: [{ translateX: clamped }],
    };
  });

  const activePoint = points[Math.min(activeIdx, lastIndex)];

  return (
    <IntroGrow>
      <GestureDetector gesture={pan}>
        <View style={{ height, width: "100%" }} onLayout={onLayout}>
          {geo && n > 0 && (
            <>
              {SkiaChart && !reduced ? (
                <SkiaChart
                  width={width}
                  height={height}
                  xs={geo.xs}
                  ys={geo.ys}
                  top={geo.top}
                  bottom={geo.bottom}
                  colors={gradient}
                  grid={alpha(colors.borderStrong, 0.4)}
                  draw={draw}
                  active={active}
                  scrub={scrub}
                />
              ) : (
                <FallbackChart
                  width={width}
                  height={height}
                  xs={geo.xs}
                  ys={geo.ys}
                  top={geo.top}
                  bottom={geo.bottom}
                  gradient={gradient}
                  grid={alpha(colors.borderStrong, 0.4)}
                  activeIdx={activeIdx}
                  scrubbing={scrubbing}
                />
              )}

              {/* Floating value tooltip (scrub only) */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tip,
                  {
                    width: TIP_W,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: alpha(colors.borderStrong, 0.7),
                  },
                  tipStyle,
                ]}
              >
                <AppText variant="caption" color="tertiary" numberOfLines={1}>
                  {activePoint?.fullLabel ?? activePoint?.label ?? ""}
                </AppText>
                <AppText variant="callout" numberOfLines={1}>
                  {activePoint ? formatValue(activePoint.value) : ""}
                  {unit ? ` ${unit}` : ""}
                </AppText>
              </Animated.View>
            </>
          )}
        </View>
      </GestureDetector>

      {/* First / last axis labels */}
      {n > 1 && (
        <View style={styles.axis}>
          <AppText variant="caption" color="tertiary">
            {points[0].label}
          </AppText>
          <AppText variant="caption" color="tertiary">
            {points[lastIndex].label}
          </AppText>
        </View>
      )}
    </IntroGrow>
  );
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

/** Static-but-interactive SVG chart for the Skia-less path. */
function FallbackChart({
  width,
  height,
  xs,
  ys,
  top,
  bottom,
  gradient,
  grid,
  activeIdx,
  scrubbing,
}: {
  width: number;
  height: number;
  xs: number[];
  ys: number[];
  top: number;
  bottom: number;
  gradient: readonly [string, string, ...string[]];
  grid: string;
  activeIdx: number;
  scrubbing: boolean;
}) {
  const line = smoothPathString(xs, ys);
  const area =
    xs.length > 0
      ? `${line} L ${xs[xs.length - 1]} ${bottom} L ${xs[0]} ${bottom} Z`
      : "";
  const stroke = gradient[0];
  const accent = gradient[gradient.length - 1];
  const gridYs = [0.25, 0.5, 0.75].map((f) => top + (bottom - top) * f);
  const dx = xs[Math.min(activeIdx, xs.length - 1)] ?? 0;
  const dy = ys[Math.min(activeIdx, ys.length - 1)] ?? 0;

  return (
    <Svg width={width} height={height}>
      {gridYs.map((y, i) => (
        <SvgLine key={i} x1={0} y1={y} x2={width} y2={y} stroke={grid} strokeWidth={1} />
      ))}
      {area !== "" && <SvgPath d={area} fill={alpha(accent, 0.14)} />}
      {line !== "" && (
        <SvgPath
          d={line}
          stroke={stroke}
          strokeWidth={3}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {scrubbing && (
        <SvgLine
          x1={dx}
          y1={top}
          x2={dx}
          y2={bottom}
          stroke={alpha(accent, 0.6)}
          strokeWidth={1.5}
        />
      )}
      <SvgCircle cx={dx} cy={dy} r={6} fill="#FFFFFF" />
      <SvgCircle cx={dx} cy={dy} r={3.5} fill={accent} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tip: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: PAD_L,
  },
});
