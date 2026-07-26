/**
 * ConsistencyGraph — the neon adherence line (public wrapper).
 *
 * A dark spotlight panel showing your recent daily adherence as a line: gold
 * dots for the days you sat at/above your average, red for the ones you slipped
 * below, and a cyan "your average" line through the middle — clean and flat, no
 * axis rules or glows. It fits the container width and shows the most recent
 * window so it always reads cleanly. Drag across it to inspect any single day
 * (a white ring rides the line, a tooltip floats above); release and it settles
 * back on today.
 *
 * The Skia impl draws the real thing when available; a clean react-native-svg
 * fallback stands in on any Skia-less surface — there's always a chart, and
 * scrubbing works either way. The gesture is tuned to live inside the vertical
 * page scroll: it claims horizontal drags and lets vertical scrolls pass through.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { IntroGrow } from "@/components/motion/IntroReveal";
import { AppText } from "@/components/ui";
import { Motion, Radius } from "@/constants/theme";
import type { ChartPoint } from "./types";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
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
  Polyline as SvgPolyline,
  Rect as SvgRect,
} from "react-native-svg";
import type {
  NeonPalette,
  SkiaConsistencyGraphProps,
} from "./ConsistencyGraph.skia";

let SkiaGraph: React.ComponentType<SkiaConsistencyGraphProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaGraph = require("./ConsistencyGraph.skia").SkiaConsistencyGraph;
}

const HEIGHT = 208;
const PAD_T = 22;
const PAD_R = 18;
const AXIS_X = 18; // x of the magenta y-axis
const FIRST_DOT_GAP = 16; // first dot sits this far right of the axis
const LABEL_H = 30; // room for date labels below the x-axis
const TIP_W = 132;
const MAX_POINTS = 16; // most recent days shown — keeps the line legible

// A fixed neon palette. The chart paints its own dark panel, so these read the
// same whether the app is in light or dark mode — exactly like the reference.
const NEON: NeonPalette = {
  panelTop: "#141A28",
  panelBottom: "#0A0D16",
  panelBorder: "rgba(255,255,255,0.07)",
  ref: "#25E6CE", // cyan "your average" line
  lineFrom: "#FFD54A", // amber connecting line
  lineTo: "#FF7A1F",
  up: "#FFB020", // gold — a day at/above average
  upCore: "#FFE08A",
  down: "#FF3D5A", // red — a day below average
  downCore: "#FF8A9C",
  crosshair: "rgba(37,230,206,0.6)",
};

const LABEL_COLOR = "rgba(226,231,242,0.5)";
const AVG_COLOR = "#5FF0DC";

export interface ConsistencyGraphProps {
  /** Daily adherence points (0–100), oldest → newest. */
  points: ChartPoint[];
}

interface Geometry {
  xs: number[];
  ys: number[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  refY: number;
  above: boolean[];
  avg: number;
}

function computeGeometry(points: ChartPoint[], width: number): Geometry {
  const n = points.length;
  const plotLeft = AXIS_X;
  const plotRight = width - PAD_R;
  const plotTop = PAD_T;
  const plotBottom = HEIGHT - LABEL_H;
  const firstDot = plotLeft + FIRST_DOT_GAP;

  const values = points.map((p) => p.value);
  let vmin = Math.min(...values);
  let vmax = Math.max(...values);
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) {
    vmin = 0;
    vmax = 100;
  }
  if (vmin === vmax) {
    vmin -= 10;
    vmax += 10;
  }
  const padV = (vmax - vmin) * 0.22;
  const lo = vmin - padV;
  const hi = vmax + padV;
  const toY = (v: number) =>
    plotTop + (1 - (v - lo) / (hi - lo)) * (plotBottom - plotTop);

  const xs = points.map((_, i) =>
    n > 1 ? firstDot + (i / (n - 1)) * (plotRight - firstDot) : (firstDot + plotRight) / 2,
  );
  const ys = values.map(toY);

  const avg = values.reduce((s, v) => s + v, 0) / Math.max(1, n);
  const refY = toY(avg);
  const above = values.map((v) => v >= avg - 0.5);

  return { xs, ys, plotLeft, plotRight, plotTop, plotBottom, refY, above, avg };
}

export function ConsistencyGraph({ points }: ConsistencyGraphProps) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);

  // Only the most recent window, so the line stays legible like the reference.
  const view = useMemo(
    () => (points.length > MAX_POINTS ? points.slice(-MAX_POINTS) : points),
    [points],
  );
  const n = view.length;
  const lastIndex = Math.max(0, n - 1);

  const [activeIdx, setActiveIdx] = useState(lastIndex);
  const [scrubbing, setScrubbing] = useState(false);

  const draw = useSharedValue(0);
  const firstRun = useRef(true);
  const active = useSharedValue(lastIndex);
  const scrub = useSharedValue(0);
  const lastReported = useSharedValue(lastIndex);

  const geo = useMemo(
    () => (width > 0 && n > 0 ? computeGeometry(view, width) : null),
    [view, width, n],
  );

  // Draw the line in on the cold-start reveal; snap on warm visits / reduced
  // motion, and re-trace whenever the window's length changes.
  useEffect(() => {
    setActiveIdx(lastIndex);
    setScrubbing(false);
    lastReported.value = lastIndex;
    active.value = lastIndex;
    scrub.value = 0;
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (reduced || !isFirst) {
      draw.value = 1;
    } else {
      draw.value = 0;
      draw.value = withTiming(1, {
        duration: Motion.duration.hero,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const report = useCallback((idx: number, isScrubbing: boolean) => {
    setActiveIdx(idx);
    setScrubbing(isScrubbing);
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // Horizontal scrub, cooperative with the vertical page scroll.
  const pan = useMemo(() => {
    const firstDot = AXIS_X + FIRST_DOT_GAP;
    const right = width - PAD_R;
    const span = right - firstDot;
    const updateFromX = (x: number) => {
      "worklet";
      if (n < 2 || span <= 0) return;
      const clamped = Math.max(firstDot, Math.min(right, x));
      const idx = ((clamped - firstDot) / span) * (n - 1);
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
      .enabled(n >= 2)
      .onBegin((e) => {
        scrub.value = withTiming(1, { duration: 140 });
        updateFromX(e.x);
      })
      .onChange((e) => updateFromX(e.x))
      .onFinalize(() => {
        scrub.value = withTiming(0, { duration: 220 });
        active.value = withTiming(n - 1, { duration: 300 });
        lastReported.value = n - 1;
        runOnJS(report)(n - 1, false);
      });
  }, [width, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tooltip glides with the halo; its text updates on index change.
  const tipStyle = useAnimatedStyle(() => {
    const firstDot = AXIS_X + FIRST_DOT_GAP;
    const right = width - PAD_R;
    const x = n > 1 ? firstDot + (active.value / (n - 1)) * (right - firstDot) : firstDot;
    const clamped = Math.max(4, Math.min(width - TIP_W - 4, x - TIP_W / 2));
    return { opacity: scrub.value, transform: [{ translateX: clamped }] };
  });

  if (n === 0) return null;

  const activePoint = view[Math.min(activeIdx, lastIndex)];
  const step = Math.max(1, Math.ceil(n / 5)); // thin date labels so they don't collide

  return (
    <IntroGrow>
      <GestureDetector gesture={pan}>
        <View style={styles.panel} onLayout={onLayout}>
          {geo && (
            <>
              {SkiaGraph && !reduced ? (
                <SkiaGraph
                  width={width}
                  height={HEIGHT}
                  xs={geo.xs}
                  ys={geo.ys}
                  plotLeft={geo.plotLeft}
                  plotRight={geo.plotRight}
                  plotTop={geo.plotTop}
                  plotBottom={geo.plotBottom}
                  refY={geo.refY}
                  above={geo.above}
                  palette={NEON}
                  draw={draw}
                  active={active}
                  scrub={scrub}
                />
              ) : (
                <FallbackGraph geo={geo} width={width} activeIdx={activeIdx} scrubbing={scrubbing} />
              )}

              {/* "avg NN%" tag riding the cyan line */}
              <AppText
                variant="caption"
                numberOfLines={1}
                style={[
                  styles.avg,
                  { top: geo.refY - 16, right: PAD_R + 2, color: AVG_COLOR },
                ]}
              >
                avg {Math.round(geo.avg)}%
              </AppText>

              {/* Date labels below the x-axis */}
              {view.map((p, i) => {
                if (i % step !== 0 && i !== lastIndex) return null;
                return (
                  <AppText
                    key={i}
                    variant="caption"
                    numberOfLines={1}
                    style={[styles.label, { left: geo.xs[i] - 24, color: LABEL_COLOR }]}
                  >
                    {p.label}
                  </AppText>
                );
              })}

              {/* Floating value tooltip (scrub only) */}
              <Animated.View pointerEvents="none" style={[styles.tip, tipStyle]}>
                <AppText variant="caption" numberOfLines={1} style={styles.tipDate}>
                  {activePoint?.fullLabel ?? activePoint?.label ?? ""}
                </AppText>
                <AppText variant="callout" numberOfLines={1} style={styles.tipValue}>
                  {activePoint ? `${Math.round(activePoint.value)}%` : ""}
                </AppText>
              </Animated.View>
            </>
          )}
        </View>
      </GestureDetector>
    </IntroGrow>
  );
}

/** Static-but-interactive SVG chart for the Skia-less path. */
function FallbackGraph({
  geo,
  width,
  activeIdx,
  scrubbing,
}: {
  geo: Geometry;
  width: number;
  activeIdx: number;
  scrubbing: boolean;
}) {
  const { xs, ys, plotLeft, plotRight, plotTop, plotBottom, refY, above } = geo;
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const dx = xs[Math.min(activeIdx, xs.length - 1)] ?? 0;
  const dy = ys[Math.min(activeIdx, ys.length - 1)] ?? 0;

  return (
    <Svg width={width} height={HEIGHT}>
      <SvgRect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={HEIGHT - 1}
        rx={20}
        fill={NEON.panelBottom}
        stroke={NEON.panelBorder}
        strokeWidth={1}
      />
      {/* Cyan average line */}
      <SvgLine x1={plotLeft} y1={refY} x2={plotRight} y2={refY} stroke={NEON.ref} strokeWidth={1.75} />
      {/* Amber connecting line */}
      {xs.length > 1 && (
        <SvgPolyline
          points={poly}
          fill="none"
          stroke={NEON.lineFrom}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* Dots */}
      {xs.map((x, i) => (
        <SvgCircle key={i} cx={x} cy={ys[i]} r={4.5} fill={above[i] ? NEON.up : NEON.down} />
      ))}
      {/* Crosshair + halo */}
      {scrubbing && (
        <SvgLine x1={dx} y1={plotTop} x2={dx} y2={plotBottom} stroke={NEON.crosshair} strokeWidth={1.5} />
      )}
      <SvgCircle cx={dx} cy={dy} r={7} fill="none" stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: { width: "100%", height: HEIGHT, position: "relative" },
  avg: {
    position: "absolute",
    fontWeight: "700",
    textAlign: "right",
  },
  label: {
    position: "absolute",
    top: HEIGHT - LABEL_H + 8,
    width: 48,
    textAlign: "center",
  },
  tip: {
    position: "absolute",
    top: 2,
    left: 0,
    width: TIP_W,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: "rgba(10,13,22,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  tipDate: { color: "rgba(226,231,242,0.6)" },
  tipValue: { color: "#FFFFFF", fontWeight: "700" },
});
