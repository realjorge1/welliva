/**
 * TickRing — progress as a dial of graduated strokes, with a centre slot.
 *
 * A dial, not a bar: sixty short radial strokes, a long one every
 * five, and progress is how many of them are lit. The lit strokes wear the
 * gradient you give them, and the stretch not yet reached is NOT DRAWN at all
 * (owner, 2026-10-31: "keep the unreached area completely invisible") — the
 * dial grows round its centre as the day fills, and an empty one is just its
 * figure. Pass `idle` to draw the unreached strokes in a colour instead. The
 * stroke at the lit edge is drawn white and a little longer — a needle that
 * rides the fill, so where you are reads before how much.
 *
 * HOW IT ANIMATES. The lit strokes are one path
 * whose data is "the first k strokes", rebuilt on the UI thread only as k moves
 * — so the dial fills one whole stroke at a time and never smears a stroke
 * half-lit. The needle reads the same k. Nothing loops: once the fill lands,
 * nothing moves until the value does.
 *
 * WHEN IT FILLS: the cold-start reveal by default, or — given an `entrance` —
 * when its card scrolls into view from below (components/motion/
 * useEntranceProgress has the rules).
 *
 * SVG, not Skia: the paths are static strings and a per-frame Skia path is the
 * GPU-cache leak this app has already paid for once.
 */
import { useEntranceProgress } from "@/components/motion/useEntranceProgress";
import React, { useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { RING_MAJOR_EVERY, RING_TICKS, litTicks, tickRing } from "./tickRingLayout";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const NEEDLE = "#FFFFFF";
/** Draws nothing — a path with no segment. */
const EMPTY = "M0 0";

let TICK_RING_SEQ = 0;

export interface TickRingProps {
  /** 0–1. Anything past 1 lights every stroke. */
  progress: number;
  size?: number;
  /** A long stroke's length; short ones are a little over half of it. */
  length?: number;
  strokeWidth?: number;
  /** The lit strokes' colour, first stop top-left to last stop bottom-right. */
  gradient: readonly [string, string, ...string[]];
  /** Colour for the strokes not yet reached. Leave out to leave them undrawn. */
  idle?: string;
  /** 0 wait · 1 play · 2 show finished — see useEntranceProgress. */
  entrance?: SharedValue<number>;
  duration?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TickRing({
  progress,
  size = 132,
  length = 14,
  strokeWidth = 2.6,
  gradient,
  idle,
  entrance,
  duration,
  children,
  style,
}: TickRingProps) {
  const gradId = useRef(`tickring-${TICK_RING_SEQ++}`).current;
  const lit = litTicks(progress);
  const anim = useEntranceProgress(lit, { entrance, duration });

  const geo = useMemo(
    () => tickRing(size, length, strokeWidth, RING_TICKS, RING_MAJOR_EVERY),
    [size, length, strokeWidth],
  );

  // Plain arrays and numbers for the worklets below to capture.
  const segments = geo.segments;
  const ox = geo.outerX;
  const oy = geo.outerY;
  const c = size / 2;
  const outerR = Math.max(1, c - strokeWidth / 2);
  // The needle runs a third deeper than a long stroke.
  const needleInnerR = Math.max(0, outerR - length * 1.35);

  const litProps = useAnimatedProps(() => {
    const k = Math.min(segments.length, Math.max(0, Math.round(anim.value)));
    let d = "";
    for (let i = 0; i < k; i++) d += segments[i];
    return { d: d === "" ? EMPTY : d };
  });

  const needleProps = useAnimatedProps(() => {
    const k = Math.min(segments.length, Math.max(0, Math.round(anim.value)));
    if (k === 0) return { opacity: 0, x1: c, y1: c, x2: c, y2: c };
    const x = ox[k - 1];
    const y = oy[k - 1];
    const f = needleInnerR / outerR;
    return {
      opacity: 1,
      x1: c + (x - c) * f,
      y1: c + (y - c) * f,
      x2: x,
      y2: y,
    };
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          {/* In the dial's own coordinates: a gradient fitted to the lit
              strokes' bounding box would re-stretch every time a stroke lit. */}
          <LinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={size} y2={size}>
            {gradient.map((color, i) => (
              <Stop key={i} offset={i / (gradient.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        {idle ? (
          <Path
            d={geo.all}
            stroke={idle}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        <AnimatedPath
          d={EMPTY}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          animatedProps={litProps}
        />
        <AnimatedLine
          x1={c}
          y1={c}
          x2={c}
          y2={c}
          stroke={NEEDLE}
          strokeWidth={strokeWidth * 1.2}
          strokeLinecap="round"
          animatedProps={needleProps}
        />
      </Svg>
      {children != null && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
