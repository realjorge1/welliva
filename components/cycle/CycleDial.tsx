/**
 * CycleDial — her whole cycle as one circle.
 *
 * Day 1 sits at the top and the days run clockwise, so the top of the circle is
 * also where the NEXT period begins: the lighter arc climbing toward it is the
 * window it's likely to start in. Logged period days are solid; the rest of an
 * ongoing period and every forecast are the same rose, lighter — a prediction
 * must never look like a record. The fertile window (lilac) is drawn only when
 * she has chosen to see it. Today is the bright marker.
 *
 * MOTION. The arcs draw themselves in once, on the UI thread, with the
 * dash-offset trick the Ring uses (dash = the arc's full length, so no dash is
 * ever visible — see welliva-no-dashed-lines). Then today's marker settles in.
 * Nothing loops: a perpetual animation commits a frame forever, and the low-end
 * phones this app runs on pay for that (welliva-low-end-perf).
 */
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Ease } from "@/components/motion/motion";
import { useColors } from "@/components/ui";
import { alpha, Motion } from "@/constants/theme";
import type { DialArc, DialModel } from "@/services/cycle";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useCyclePalette, type CyclePalette } from "./cycleTheme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface CycleDialProps {
  model: DialModel;
  size: number;
  strokeWidth?: number;
  /** Today's marker tint — rose during a period, the brand otherwise. */
  todayTone?: string;
  /**
   * "always" draws in on every mount (the cycle screen, where it's the hero);
   * "intro" only on the app's cold-start reveal, like every Ring on Home.
   */
  animate?: "always" | "intro" | "never";
  children?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

interface Geometry {
  cx: number;
  cy: number;
  r: number;
  capDeg: number;
}

function polar(g: Geometry, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: g.cx + g.r * Math.cos(rad), y: g.cy + g.r * Math.sin(rad) };
}

/** An SVG arc from `fromDeg` to `toDeg`, clockwise, 0° at the top. */
function arcPath(g: Geometry, fromDeg: number, toDeg: number): string {
  const end = Math.min(toDeg, fromDeg + 359.9);
  const s = polar(g, fromDeg);
  const e = polar(g, end);
  const large = end - fromDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${g.r} ${g.r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function colorOf(kind: DialArc["kind"], p: CyclePalette): string {
  switch (kind) {
    case "period":
      return p.period;
    case "periodAhead":
      return p.periodAhead;
    case "predicted":
      return p.predicted;
    case "fertile":
      return p.fertile;
  }
}

/** Fertile under forecasts under the period, so the record is always on top. */
const LAYER: Record<DialArc["kind"], number> = { fertile: 0, predicted: 1, periodAhead: 2, period: 3 };

function DrawnArc({
  d,
  length,
  color,
  width,
  progress,
}: {
  d: string;
  length: number;
  color: string;
  width: number;
  progress: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${length} ${length}`}
      animatedProps={props}
    />
  );
}

export function CycleDial({
  model,
  size,
  strokeWidth,
  todayTone,
  animate = "always",
  children,
  accessibilityLabel,
  style,
}: CycleDialProps) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const sw = strokeWidth ?? Math.max(6, Math.round(size * 0.064));
  // Room for the marker's halo, which overhangs the ring.
  const pad = sw * 0.55;
  const g: Geometry = useMemo(() => {
    const r = size / 2 - sw / 2 - pad;
    return { cx: size / 2, cy: size / 2, r, capDeg: ((sw / 2) / r) * (180 / Math.PI) };
  }, [size, sw, pad]);

  const dayDeg = 360 / Math.max(1, model.length);
  const inset = g.capDeg + Math.min(1.2, dayDeg * 0.08);

  const arcs = useMemo(
    () =>
      [...model.arcs]
        .sort((a, b) => LAYER[a.kind] - LAYER[b.kind])
        .map((a, i) => {
          const from = (a.from - 1) * dayDeg + inset;
          const to = a.to * dayDeg - inset;
          const color = colorOf(a.kind, palette);
          if (to <= from) {
            // Too short for an arc at this size: a dot in the middle of the run.
            const mid = polar(g, ((a.from - 1 + a.to) / 2) * dayDeg);
            return { key: `${a.kind}-${i}`, dot: mid, color };
          }
          const length = g.r * (((to - from) * Math.PI) / 180);
          return { key: `${a.kind}-${i}`, d: arcPath(g, from, to), length, color };
        }),
    [model.arcs, dayDeg, inset, palette, g],
  );

  const ovulation = model.ovulation !== null ? polar(g, (model.ovulation - 0.5) * dayDeg) : null;
  const marker = model.today !== null ? polar(g, (model.today - 0.5) * dayDeg) : null;
  const tone = todayTone ?? colors.primary;

  const still = reduced || animate === "never" || (animate === "intro" && !intro);
  const progress = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: Motion.duration.hero,
      easing: Ease.decelerate,
    });
    // Redraw when the shape of the cycle changes, not on every render.
  }, [still, progress, model.length, model.arcs.length]);

  const markerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 0.9], [0, 1], "clamp"),
    transform: [{ scale: interpolate(progress.value, [0.55, 1], [0.6, 1], "clamp") }],
  }));

  const halo = sw * 1.9;
  const knob = sw * 1.12;
  const dot = sw * 0.42;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        <Circle cx={g.cx} cy={g.cy} r={g.r} stroke={palette.track} strokeWidth={sw} fill="none" />
        {arcs.map((a) =>
          "dot" in a && a.dot ? (
            <Circle key={a.key} cx={a.dot.x} cy={a.dot.y} r={sw / 2} fill={a.color} />
          ) : "d" in a && a.d ? (
            <DrawnArc
              key={a.key}
              d={a.d}
              length={a.length}
              color={a.color}
              width={sw}
              progress={progress}
            />
          ) : null,
        )}
        {ovulation ? (
          <Circle cx={ovulation.x} cy={ovulation.y} r={Math.max(2.5, sw * 0.3)} fill={palette.ovulation} />
        ) : null}
      </Svg>

      {marker ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.marker,
            { left: marker.x - halo / 2, top: marker.y - halo / 2, width: halo, height: halo },
            markerStyle,
          ]}
        >
          <View
            style={[
              styles.center,
              { width: halo, height: halo, borderRadius: halo / 2, backgroundColor: alpha(tone, 0.22) },
            ]}
          >
            <View
              style={[
                styles.center,
                {
                  width: knob,
                  height: knob,
                  borderRadius: knob / 2,
                  backgroundColor: colors.text,
                },
              ]}
            >
              <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: tone }} />
            </View>
          </View>
        </Animated.View>
      ) : null}

      {children != null ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  marker: { position: "absolute" },
});
