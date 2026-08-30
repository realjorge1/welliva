/**
 * ExerciseFigure — an animated stick figure demonstrating an exercise's
 * movement pattern. Native, zero-asset replacement for the old demo GIFs.
 *
 * The look is a PICTOGRAM, held to the classic stick-figure reference: detached
 * circular head, blocky trunk, uniform round-capped limbs, one flat colour. No
 * gradients, outlines, shading or highlighting — a pictogram reads because of
 * its silhouette, and every embellishment costs legibility. Muscles worked are
 * shown by the MuscleMap diagram alongside, not painted onto the figure.
 *
 * Two panels stand side by side — a FRONT view and a SIDE view of the same
 * movement — driven by ONE shared rep clock so they move at the exact same
 * rhythm. Each panel holds a fixed orientation; there is no flip.
 *
 * The figure is a skeletal rig (see animation/rig.ts): bones are built once and
 * moved by a matrix, so a panel costs a few small transforms per frame instead
 * of a native path per limb per frame. Animation stops the moment the panel is
 * off screen — pass `playing={false}` while a host sheet is closed.
 *
 * Renders the Skia implementation when available (animated, or frozen at the
 * top-of-rep pose under reduced motion) and a calm static react-native-svg
 * silhouette otherwise (the window before a native rebuild, or any Skia-less
 * surface).
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig, poseRig, type Rig } from "@/fitness/animation/rig";
import type { ExerciseCategory } from "@/models/exercise";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path as SvgPath } from "react-native-svg";
import type { FigureView, SkiaFigurePanelProps } from "./ExerciseFigure.skia";

// Load the Skia impl once, only when the native module is present, so the
// static Skia import inside it never runs on a Skia-less surface.
let SkiaPanel: React.ComponentType<SkiaFigurePanelProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaPanel = require("./ExerciseFigure.skia").SkiaFigurePanel;
}

export interface ExerciseFigureProps {
  exerciseId?: string;
  category?: ExerciseCategory;
  /** Explicit movement override — wins over exerciseId/category resolution. */
  motion?: FigureMotion;
  /** Per-panel height in px. */
  size?: number;
  /** Which orientations to show. Defaults to both (front + side). */
  views?: readonly FigureView[];
  /** The one flat colour the figure is drawn in. Defaults to the brand. */
  color?: string;
  /** Set false to freeze the rep clock while the host is hidden. */
  playing?: boolean;
  /**
   * An externally-owned rep clock (see `useFigureClock`). Pass the SAME one to
   * two panels living in different parts of a screen and they move as one body
   * — which is the only way a corner panel can stay in rhythm with a hero
   * panel, since two instances each running their own loop drift apart the
   * moment either remounts.
   */
  clock?: SharedValue<number>;
  /**
   * Drop the panel's card chrome (fill, border, radius) so the figure floats on
   * whatever it is standing in. The live player stage uses this: the figure is
   * inside the instrument ring there, and a card edge cutting through the ring
   * would read as two competing frames.
   */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_VIEWS: readonly FigureView[] = ["front", "side"];

/** Movements a side-on camera reads best; everything else faces the viewer. */
const SIDE_READS_BEST = new Set<FigureMotion>([
  "squat",
  "hinge",
  "push",
  "core",
  "flexibility",
  // Anything that happens along the body's own front-back axis: a camera
  // square-on to a push-up or a hip hinge sees a foreshortened blob.
  "pushup",
  "plank",
  "sidePlank",
  "gluteBridge",
  "legRaise",
  "row",
  "superman",
  "birdDog",
  "catCow",
  "childsPose",
  "russianTwist",
  "wallSit",
  "lunge",
  "burpee",
  "inchworm",
  "bearCrawl",
  "mountainClimber",
  "broadJump",
  "tuckJump",
  "curl",
]);

/*
 * ALTERNATING MOVEMENTS FACE THE VIEWER — high knees, butt kicks, marching.
 *
 * They look like side-view movements and they are not, because of how the two
 * rigs differ: the front rig can author a left side (so one knee is up while
 * the other is planted), while the side rig draws ONE leg and echoes it dimmed
 * behind for depth. Side-on, "drive the near knee up" therefore lifts both legs
 * at once and the athlete appears to levitate. Front-on it reads as a cadence,
 * which is what it is. Their absence from the set above is deliberate — the
 * side view is still shown, as the small second angle, where it costs nothing.
 */

/**
 * The single best camera angle for a movement — for the places only one panel
 * fits, like the live player stage where the figure IS the screen.
 */
export function primaryView(motion: FigureMotion): FigureView {
  return SIDE_READS_BEST.has(motion) ? "side" : "front";
}

/** The camera angle the primary one doesn't cover. */
export function secondaryView(motion: FigureMotion): FigureView {
  return primaryView(motion) === "side" ? "front" : "side";
}

/**
 * A rep clock a caller owns, to drive several `ExerciseFigure`s in unison.
 *
 * Mirrors the loop the component runs internally — one linear 0→1 pass per rep,
 * frozen at 0 when it isn't playing — so a panel handed this clock behaves
 * exactly as it would on its own, only in step with its siblings.
 */
export function useFigureClock(
  motion: FigureMotion,
  playing: boolean = true,
): SharedValue<number> {
  const reduced = useReducedMotion();
  const loopMs = useMemo(() => buildFrontRig(motion).loopMs, [motion]);
  const progress = useSharedValue(0);
  const animate = !!SkiaPanel && !reduced && playing;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: loopMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [animate, loopMs, progress]);

  return progress;
}

export type { FigureView };

export function ExerciseFigure({
  exerciseId,
  category,
  motion: motionOverride,
  size = 150,
  views = DEFAULT_VIEWS,
  color,
  playing = true,
  bare = false,
  clock,
  style,
}: ExerciseFigureProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  const tint = color ?? colors.primary;
  const motion = useMemo(
    () => motionOverride ?? resolveFigureMotion(exerciseId, category),
    [motionOverride, exerciseId, category],
  );
  const loopMs = useMemo(() => buildFrontRig(motion).loopMs, [motion]);

  // One clock shared across this instance's panels → identical rhythm, no
  // drift. A caller can supply its own instead, to keep panels on OPPOSITE
  // sides of a screen beating together.
  const own = useSharedValue(0);
  const progress = clock ?? own;
  const animate = !!SkiaPanel && !reduced && playing && !clock;
  useEffect(() => {
    if (!animate) {
      cancelAnimation(own);
      own.value = 0;
      return;
    }
    own.value = 0;
    own.value = withRepeat(
      withTiming(1, { duration: loopMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(own);
  }, [animate, loopMs, own]);

  const showLabels = views.length > 1;

  return (
    <View style={[styles.row, style]}>
      {views.map((view) => (
        <View
          key={view}
          style={[
            styles.panel,
            { height: size },
            !bare && {
              borderRadius: Radius.xl,
              borderWidth: StyleSheet.hairlineWidth,
              backgroundColor: alpha(colors.text, 0.035),
              borderColor: alpha(colors.borderStrong, 0.5),
            },
          ]}
        >
          {SkiaPanel ? (
            <SkiaPanel view={view} motion={motion} size={size} color={tint} progress={progress} />
          ) : (
            <StaticFigure view={view} size={size} motion={motion} color={tint} />
          )}
          {showLabels && (
            <View style={[styles.tag, { backgroundColor: alpha(colors.background, 0.7) }]}>
              <AppText variant="caption" color="tertiary" uppercase>
                {view}
              </AppText>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/* ── Static SVG fallback: the top-of-rep pose, same pictogram, no animation ── */

function StaticFigure({
  view,
  size,
  motion,
  color,
}: {
  view: FigureView;
  size: number;
  motion: FigureMotion;
  color: string;
}) {
  const { panelW, bones, headCx, headCy, headR } = useMemo(() => {
    const rig: Rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
    const pad = size * 0.08;
    const width = size * (view === "side" ? 0.78 : 0.94);
    const k = Math.min(
      (size - pad * 2) / 100,
      (width / 2 - size * 0.03) / (rig.reach + 9),
    );
    const cx = width / 2;
    const pose = poseRig(rig, 0);

    const segs = rig.bones
      .map((b, i) => {
        if (!b.draw) return null;
        const x1 = cx + (pose[i * 3] - 50) * k;
        const y1 = pad + pose[i * 3 + 1] * k;
        const a = pose[i * 3 + 2];
        const drawn = (b.length - b.drawInset) * k;
        return {
          x1,
          y1,
          x2: x1 + drawn * Math.cos(a),
          y2: y1 + drawn * Math.sin(a),
          w: ((b.w0 + b.w1) / 2) * k,
        };
      })
      .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; w: number }[];

    const neck = rig.bones[rig.headBone];
    const na = pose[rig.headBone * 3 + 2];
    return {
      panelW: width,
      bones: segs,
      headCx: cx + (pose[rig.headBone * 3] - 50) * k + neck.length * k * Math.cos(na),
      headCy: pad + pose[rig.headBone * 3 + 1] * k + neck.length * k * Math.sin(na),
      headR: rig.headR * k,
    };
  }, [view, size, motion]);

  return (
    <Svg width={panelW} height={size}>
      {bones.map((b, i) => (
        <SvgPath
          key={i}
          d={`M${b.x1},${b.y1} L${b.x2},${b.y2}`}
          stroke={color}
          strokeWidth={b.w}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <Circle cx={headCx} cy={headCy} r={headR} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  panel: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tag: {
    position: "absolute",
    left: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
});
