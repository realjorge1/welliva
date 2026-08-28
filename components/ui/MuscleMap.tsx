/**
 * MuscleMap — a deliberately schematic body diagram (front + back figures)
 * that lights up the regions an exercise works. Geometric capsules, not
 * anatomy-chart detail: it reads at a glance during a workout.
 *
 * Highlighted regions breathe gently (one shared UI-thread pulse drives them
 * all); the rest of the body stays a faint silhouette. Muscle names come
 * straight from EXERCISE_DATABASE `targetMuscles` and are resolved through
 * constants/muscleRegions.
 */
import {
  BACK_REGIONS,
  FRONT_REGIONS,
  musclesToRegions,
  type MuscleRegion,
} from "@/constants/muscleRegions";
import { Motion, alpha } from "@/constants/theme";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Rect } from "react-native-svg";
import { AppText } from "./Text";
import { useColors } from "./useColors";

const AnimatedG = Animated.createAnimatedComponent(G);

/** One capsule of the schematic figure. `region: null` = silhouette only. */
interface Capsule {
  region: MuscleRegion | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

const VB_W = 100;
const VB_H = 172;

/* Shared limbs/head used by both figures (regions differ per side). */
const head = { cx: 50, cy: 13, r: 9 };
const neck: Capsule = { region: null, x: 45.5, y: 22, w: 9, h: 7, rx: 3.5 };
const shoulderL: Capsule = { region: "shoulders", x: 21, y: 30, w: 15, h: 12, rx: 6 };
const shoulderR: Capsule = { region: "shoulders", x: 64, y: 30, w: 15, h: 12, rx: 6 };
const forearmL: Capsule = { region: "forearms", x: 19, y: 69, w: 10, h: 22, rx: 5 };
const forearmR: Capsule = { region: "forearms", x: 71, y: 69, w: 10, h: 22, rx: 5 };

const FRONT_SHAPES: Capsule[] = [
  neck,
  shoulderL,
  shoulderR,
  { region: "chest", x: 36, y: 30, w: 28, h: 21, rx: 8 },
  { region: "biceps", x: 20, y: 44, w: 11, h: 23, rx: 5.5 },
  { region: "biceps", x: 69, y: 44, w: 11, h: 23, rx: 5.5 },
  forearmL,
  forearmR,
  { region: "core", x: 38, y: 53, w: 24, h: 25, rx: 7 },
  { region: "obliques", x: 32, y: 54, w: 5, h: 21, rx: 2.5 },
  { region: "obliques", x: 63, y: 54, w: 5, h: 21, rx: 2.5 },
  { region: null, x: 36, y: 80, w: 28, h: 11, rx: 5.5 }, // pelvis
  { region: "quads", x: 34, y: 93, w: 12, h: 39, rx: 6 },
  { region: "quads", x: 54, y: 93, w: 12, h: 39, rx: 6 },
  { region: "adductors", x: 47, y: 93, w: 6, h: 24, rx: 3 },
  { region: null, x: 35.5, y: 136, w: 10, h: 33, rx: 5 }, // shins
  { region: null, x: 54.5, y: 136, w: 10, h: 33, rx: 5 },
];

const BACK_SHAPES: Capsule[] = [
  neck,
  shoulderL,
  shoulderR,
  { region: "upperBack", x: 42, y: 26, w: 16, h: 6, rx: 3 }, // traps
  { region: "upperBack", x: 35, y: 30, w: 30, h: 18, rx: 7 },
  { region: "upperBack", x: 32, y: 50, w: 9, h: 17, rx: 4.5 }, // lats
  { region: "upperBack", x: 59, y: 50, w: 9, h: 17, rx: 4.5 },
  { region: null, x: 42, y: 50, w: 16, h: 17, rx: 5 }, // spine column
  { region: "triceps", x: 20, y: 44, w: 11, h: 23, rx: 5.5 },
  { region: "triceps", x: 69, y: 44, w: 11, h: 23, rx: 5.5 },
  forearmL,
  forearmR,
  { region: "lowerBack", x: 40, y: 69, w: 20, h: 10, rx: 5 },
  { region: "glutes", x: 36, y: 81, w: 28, h: 13, rx: 6.5 },
  { region: "hamstrings", x: 34, y: 96, w: 12, h: 36, rx: 6 },
  { region: "hamstrings", x: 54, y: 96, w: 12, h: 36, rx: 6 },
  { region: "calves", x: 35, y: 136, w: 11, h: 33, rx: 5.5 },
  { region: "calves", x: 54, y: 136, w: 11, h: 33, rx: 5.5 },
];

export interface MuscleMapProps {
  /** Muscle names as written in EXERCISE_DATABASE, e.g. ["Chest", "Triceps"]. */
  muscles?: readonly string[];
  /** Pre-resolved regions (takes precedence over `muscles`). */
  regions?: readonly MuscleRegion[];
  /** Figure height in px; width follows the figure's aspect ratio. */
  height?: number;
  /** Highlight color — defaults to the brand primary. */
  accent?: string;
  /** Show "Front"/"Back" captions under the figures. */
  labels?: boolean;
}

export function MuscleMap({
  muscles,
  regions,
  height = 150,
  accent,
  labels = false,
}: MuscleMapProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const tint = accent ?? colors.primary;

  const active = useMemo(() => {
    const list = regions ?? musclesToRegions(muscles ?? []);
    return new Set<MuscleRegion>(list);
  }, [muscles, regions]);

  // One gentle shared pulse for every highlighted capsule — calm, not blinking.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced || active.size === 0) return;
    pulse.value = withRepeat(
      withTiming(0.68, {
        duration: Motion.duration.breath / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(pulse);
      pulse.value = 1;
    };
  }, [pulse, reduced, active.size]);

  const width = (height * VB_W) / VB_H;
  const silhouette = alpha(colors.text, 0.1);

  return (
    <View style={styles.row}>
      <Figure
        shapes={FRONT_SHAPES}
        visible={FRONT_REGIONS}
        active={active}
        width={width}
        height={height}
        tint={tint}
        silhouette={silhouette}
        pulse={pulse}
        reduced={reduced}
        label={labels ? "Front" : undefined}
      />
      <Figure
        shapes={BACK_SHAPES}
        visible={BACK_REGIONS}
        active={active}
        width={width}
        height={height}
        tint={tint}
        silhouette={silhouette}
        pulse={pulse}
        reduced={reduced}
        label={labels ? "Back" : undefined}
      />
    </View>
  );
}

/**
 * One figure. It owns its OWN `useAnimatedProps` on purpose: a single
 * animated-props object is a binding to one view, and attaching the same one to
 * both the front and the back `<G>` left the two figures fighting over one
 * descriptor. They share the `pulse` shared value instead, which is what
 * actually needs to be common — both breathe in step, each drives itself.
 */
function Figure({
  shapes,
  visible,
  active,
  width,
  height,
  tint,
  silhouette,
  pulse,
  reduced,
  label,
}: {
  shapes: Capsule[];
  visible: readonly MuscleRegion[];
  active: Set<MuscleRegion>;
  width: number;
  height: number;
  tint: string;
  silhouette: string;
  pulse: SharedValue<number>;
  reduced: boolean;
  label?: string;
}) {
  const pulseProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  const lit = shapes.filter(
    (s) => s.region && active.has(s.region) && visible.includes(s.region),
  );
  const dim = shapes.filter((s) => !lit.includes(s));
  const capsule = (s: Capsule, i: number, fill: string) => (
    <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill} />
  );

  return (
    <View style={styles.figure}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Circle cx={head.cx} cy={head.cy} r={head.r} fill={silhouette} />
        {dim.map((s, i) => capsule(s, i, silhouette))}
        {reduced ? (
          <G>{lit.map((s, i) => capsule(s, i, tint))}</G>
        ) : (
          <AnimatedG animatedProps={pulseProps}>
            {lit.map((s, i) => capsule(s, i, tint))}
          </AnimatedG>
        )}
      </Svg>
      {label && (
        <AppText variant="caption" color="tertiary" uppercase>
          {label}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 28 },
  figure: { alignItems: "center", gap: 6 },
});
