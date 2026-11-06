/**
 * SessionChart — the whole session as one strip: a column of dots per set, a
 * pill per move, a ▼ on now, and the blocks named underneath.
 *
 * The geometry and every rule about what lights are in ./sessionChartLayout (pure,
 * tested). This draws it: each layer of dots is ONE <Path>, rebuilt only when
 * the session moves — at most once a second, while a set is live and its column
 * is filling. The ▼ glides to the next set rather than jumping, and on the
 * completion card the strip draws itself on from the left, once.
 */
import { Mono, useColors } from "@/components/ui";
import { HOME_ORANGE } from "@/components/home/surface";
import { Ease } from "@/components/motion";
import { Motion, Spacing } from "@/constants/theme";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import {
  axisLabels,
  blockStops,
  chartDots,
  chartGeometry,
  chartPaths,
  chartPills,
  chartTally,
  markerX,
  type ChartColumn,
  type Cursor,
  type PillState,
} from "./sessionChartLayout";

/** The pill bar's thickness. */
const BAR = 6;
/** The ▼ marker's height. */
const MARKER = 5;
/** Axis label face. */
const AXIS_SIZE = 9;
const AXIS_TRACKING = 0.6;
/** SpaceMono's advance is 0.6 em; a hair over, so a label is never under-measured. */
const MONO_ADVANCE = 0.62;

/** Not reached yet — the plan, as a ghost. */
const GHOST = "rgba(255, 255, 255, 0.11)";
const DONE = "rgba(255, 255, 255, 0.92)";
const PILL_IDLE = "rgba(255, 255, 255, 0.12)";
const PILL_DONE = "rgba(255, 255, 255, 0.86)";

export interface SessionChartProps {
  columns: ChartColumn[];
  cursor: Cursor | null;
  /** Height of the dot strip. 0 leaves only the pills and the axis — for a short phone. */
  stripHeight?: number;
  /** Draw on from the left, once, on mount — the completion card. */
  drawOn?: boolean;
}

export const SessionChart = React.memo(function SessionChart({
  columns,
  cursor,
  stripHeight = 40,
  drawOn = false,
}: SessionChartProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === w ? prev : w));
  };

  // The strip and the pills share one geometry, so a move's pill sits exactly
  // under its set columns. With no strip, a token height still lays the pills.
  const geometry = useMemo(
    () => (width > 0 ? chartGeometry(columns, width, Math.max(stripHeight, 24)) : null),
    [columns, width, stripHeight],
  );
  const paths = useMemo(
    () => (geometry && stripHeight > 0 ? chartPaths(chartDots(columns, geometry), geometry.radius) : null),
    [columns, geometry, stripHeight],
  );
  const pills = useMemo(
    () => (geometry ? chartPills(columns, geometry, cursor) : []),
    [columns, geometry, cursor],
  );
  const stops = useMemo(() => (geometry ? blockStops(columns, geometry) : []), [columns, geometry]);
  const charWidth = AXIS_SIZE * Math.min(fontScale, 1.2) * MONO_ADVANCE + AXIS_TRACKING;
  const labels = useMemo(
    () => (geometry ? axisLabels(columns, geometry, charWidth) : []),
    [columns, geometry, charWidth],
  );
  const nowX = geometry ? markerX(columns, geometry, cursor) : null;
  const nowBlock = cursor ? columns.find((c) => c.exercise === cursor.exercise)?.block : undefined;

  // The ▼ glides between sets; it lands in place the first time it has somewhere to be.
  const marker = useSharedValue(nowX ?? 0);
  const placed = useRef(nowX != null);
  useEffect(() => {
    if (nowX == null) return;
    if (!placed.current || reduced) {
      marker.value = nowX;
      placed.current = true;
      return;
    }
    marker.value = withTiming(nowX, { duration: Motion.duration.slow, easing: Ease.standard });
  }, [nowX, reduced, marker]);
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: marker.value - MARKER }],
  }));

  // The completion card's draw-on: a window over the strip and pills, opening
  // from the left. A one-shot — at rest nothing animates.
  const reveal = useSharedValue(drawOn && !reduced ? 0 : 1);
  useEffect(() => {
    if (!drawOn || reduced || width === 0) return;
    reveal.value = withTiming(1, { duration: Motion.duration.hero, easing: Ease.standard });
  }, [drawOn, reduced, width, reveal]);
  const windowStyle = useAnimatedStyle(() => ({ width: reveal.value * width }));

  const tally = chartTally(columns);
  const pillFill = (s: PillState) =>
    s === "done" ? PILL_DONE : s === "live" ? colors.primary : PILL_IDLE;

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${tally.done} of ${tally.total} sets done`}
    >
      {geometry ? (
        <>
          <Animated.View style={[styles.window, windowStyle]}>
            <View style={{ width }}>
              {paths ? (
                <Svg width={width} height={geometry.height}>
                  <Path d={paths.ghost} fill={GHOST} />
                  <Path d={paths.done} fill={DONE} />
                  <Path d={paths.live} fill={colors.primary} />
                  <Path d={paths.over} fill={HOME_ORANGE} />
                </Svg>
              ) : null}

              <View style={styles.markerRow}>
                {nowX != null ? (
                  <Animated.View style={[styles.marker, markerStyle]}>
                    <Svg width={MARKER * 2} height={MARKER}>
                      <Path
                        d={`M0 0H${MARKER * 2}L${MARKER} ${MARKER}Z`}
                        fill="rgba(255, 255, 255, 0.72)"
                      />
                    </Svg>
                  </Animated.View>
                ) : null}
              </View>

              <Svg width={width} height={BAR}>
                {pills.map((p) => (
                  <Rect
                    key={p.exercise}
                    x={p.x}
                    y={0}
                    width={p.w}
                    height={BAR}
                    rx={BAR / 2}
                    fill={pillFill(p.state)}
                  />
                ))}
                {stops.map((x) => (
                  <Rect
                    key={`stop-${x}`}
                    x={x - BAR * 0.7}
                    y={0}
                    width={BAR * 1.4}
                    height={BAR}
                    rx={BAR / 2}
                    fill={HOME_ORANGE}
                  />
                ))}
              </Svg>
            </View>
          </Animated.View>

          {labels.length > 0 ? (
            <View style={[styles.axis, { width }]}>
              {labels.map((l) => (
                <Mono
                  key={l.block + l.x}
                  size={AXIS_SIZE}
                  tracking={AXIS_TRACKING}
                  numberOfLines={1}
                  color={l.block === nowBlock ? colors.text : colors.textTertiary}
                  style={[styles.label, { left: l.x }]}
                >
                  {l.text}
                </Mono>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        // Hold the strip's height until the width is known, so the card doesn't jump.
        <View style={{ height: stripHeight + MARKER + Spacing.xs * 2 + BAR }} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  window: { overflow: "hidden" },
  markerRow: { height: MARKER + Spacing.xs * 2, justifyContent: "center" },
  marker: { position: "absolute", left: 0, top: Spacing.xs },
  axis: { height: 14, marginTop: Spacing.xs },
  label: { position: "absolute", top: 0 },
});
