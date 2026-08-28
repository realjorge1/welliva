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
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_VIEWS: readonly FigureView[] = ["front", "side"];

export function ExerciseFigure({
  exerciseId,
  category,
  motion: motionOverride,
  size = 150,
  views = DEFAULT_VIEWS,
  color,
  playing = true,
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

  // One clock shared across both panels → identical rhythm, no drift.
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

  const showLabels = views.length > 1;

  return (
    <View style={[styles.row, style]}>
      {views.map((view) => (
        <View
          key={view}
          style={[
            styles.panel,
            {
              height: size,
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
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
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
