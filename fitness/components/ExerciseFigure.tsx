/**
 * ExerciseFigure — an animated figure demonstrating an exercise's movement.
 * Native, zero-asset replacement for the old demo GIFs.
 *
 * TWO LOOKS, ONE SKELETON (see animation/characterArt.ts):
 *
 *   character (the default) — a friendly athlete with curly hair, a face that
 *     acts (it blinks, glances, breathes, and works as hard as the movement
 *     does), a ringer tee, shorts, socks and trainers. It is built the way a
 *     rigged cartoon is — shapes parented to bones, a face of separate layers,
 *     an idle layer that never blocks the body — and it moves with a feel per
 *     exercise rather than one ease (see animation/tempo.ts). Its kit is fixed.
 *   pictogram — the original classic stick-figure reference: detached circular
 *     head, blocky trunk, uniform round-capped limbs, one flat colour (`color`).
 *     Kept whole behind `look="pictogram"`.
 *
 * Muscles worked are shown by the MuscleMap diagram alongside, never painted
 * onto the figure.
 *
 * Two panels stand side by side — a FRONT view and a SIDE view of the same
 * movement — driven by ONE shared clock so they move at the exact same rhythm.
 * Each panel holds a fixed orientation; there is no flip. A movement that only
 * reads from one camera (floor work, a side plank) shows one panel — see
 * animation/cameras.ts. Equipment the body rests on (a bench, a wall, a bar)
 * sits behind the figure at the far-limb opacity — see animation/props.ts.
 *
 * THE CLOCK runs over a MACRO cycle of several reps (animation/tempo.ts), so the
 * limbs repeat every rep, as an exercise must, while the face does not: a blink
 * every few reps, a glance now and then. One clock, one pose solver
 * (animation/motion.ts), for the animated panel and the still alike.
 *
 * Animation stops the moment the panel is off screen — pass `playing={false}`
 * while a host sheet is closed.
 *
 * Renders the Skia implementation when available (animated, or frozen at the
 * first pose under reduced motion) and a calm static react-native-svg still
 * otherwise (the window before a native rebuild, or any Skia-less surface) —
 * the same character, drawn in the same order.
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { motionCameras } from "@/fitness/animation/cameras";
import {
  KIT,
  buildCharacterArt,
  faceMirrored,
  type ArtDetail,
  type FigureLook,
  type Shape,
} from "@/fitness/animation/characterArt";
import {
  buildMotionKit,
  framePanel,
  headFrame,
  headRadius,
  motionBounds,
  motionTempo,
  poseBounds,
  solvePose,
  type MotionKit,
} from "@/fitness/animation/motion";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { propsFor } from "@/fitness/animation/props";
import { SIDE_FAR_BONES, buildFrontRig, buildSideRig, type Rig } from "@/fitness/animation/rig";
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
import Svg, { Circle, G, Rect, Path as SvgPath } from "react-native-svg";
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
  /**
   * Which orientations to show. Defaults to every camera the movement reads
   * from; an angle it was never authored for is dropped (animation/cameras.ts).
   */
  views?: readonly FigureView[];
  /** Which figure demonstrates. Defaults to the character. */
  look?: FigureLook;
  /**
   * Make the figure as big as it can be while its whole silhouette, over the whole
   * rep, stays inside a circle of this radius (px) around the panel's centre —
   * the live player passes the ring's inner edge. Without it the figure stands on
   * a baseline, scaled to the panel.
   */
  fit?: number;
  /**
   * The pictogram's one flat colour (and its equipment's), and the tint of the
   * character's ground shadow. Defaults to the brand. The character wears its
   * own kit and ignores it otherwise.
   */
  color?: string;
  /**
   * Fade the whole figure — how the live player sets it "one step back" while
   * it stands at ease, and quietens its corner panel. (It used to do this by
   * dimming `color`, which a figure in several colours cannot express.)
   */
  opacity?: number;
  /** Set false to freeze the clock while the host is hidden. */
  playing?: boolean;
  /**
   * An externally-owned clock (see `useFigureClock`). Pass the SAME one to two
   * panels living in different parts of a screen and they move as one body —
   * which is the only way a corner panel can stay in rhythm with a hero panel,
   * since two instances each running their own loop drift apart the moment
   * either remounts.
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

/**
 * Movements a side-on camera reads best; everything else faces the viewer.
 * Only consulted for movements that have both cameras — a single-camera
 * movement always gets its one camera (see animation/cameras.ts).
 */
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
  // Squat family: the hip travelling back is what reads.
  "gobletSquat",
  "jumpSquat",
  "squatPulse",
  "deepSquat",
  // The pull toward the face, and the step under the foot, only show side-on.
  "facePull",
  "toeTap",
]);

/*
 * KNEE DRIVES ARE SIDE-ON ONLY — high knees, marching, butt kicks.
 *
 * They used to face the viewer, because the side rig echoed one leg and a
 * driven knee lifted both (the athlete levitated). The side rig now authors its
 * far leg, so side-on is honest. Front-on never was: a constant-length thigh can
 * only rise toward the camera by swinging OUT through horizontal, so every rep
 * flashed both legs into a sideways split. Those front views are gone.
 */

/**
 * The single best camera angle for a movement — for the places only one panel
 * fits, like the live player stage where the figure IS the screen. A movement
 * authored for one camera only (floor work, a side plank) gets that camera.
 */
export function primaryView(motion: FigureMotion): FigureView {
  const cameras = motionCameras(motion);
  if (cameras.length === 1) return cameras[0];
  return SIDE_READS_BEST.has(motion) ? "side" : "front";
}

/**
 * The camera angle the primary one doesn't cover — or null when the movement
 * only reads from one camera, and a second panel would draw a different
 * exercise (a "front" plank was a person standing upright).
 */
export function secondaryView(motion: FigureMotion): FigureView | null {
  if (motionCameras(motion).length < 2) return null;
  return primaryView(motion) === "side" ? "front" : "side";
}

/**
 * A clock a caller owns, to drive several `ExerciseFigure`s in unison.
 *
 * One linear 0→1 pass per MACRO cycle (several reps — see animation/tempo.ts),
 * frozen at 0 when it isn't playing. A panel handed this clock behaves exactly
 * as it would on its own, only in step with its siblings.
 */
export function useFigureClock(
  motion: FigureMotion,
  playing: boolean = true,
): SharedValue<number> {
  const reduced = useReducedMotion();
  const macroMs = useMemo(() => motionTempo(motion).macroMs, [motion]);
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
      withTiming(1, { duration: macroMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [animate, macroMs, progress]);

  return progress;
}

export type { FigureView };

export function ExerciseFigure({
  exerciseId,
  category,
  motion: motionOverride,
  size = 150,
  views: viewsProp,
  look = "character",
  fit,
  color,
  opacity = 1,
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
  const macroMs = useMemo(() => motionTempo(motion).macroMs, [motion]);
  // Only the cameras this movement reads from — a requested angle it was never
  // authored for would draw a different exercise, so it is left out.
  const views = useMemo(() => {
    const cameras = motionCameras(motion);
    return (viewsProp ?? cameras).filter((v) => cameras.includes(v));
  }, [viewsProp, motion]);

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
      withTiming(1, { duration: macroMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(own);
  }, [animate, macroMs, own]);

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
          <View style={opacity < 1 ? { opacity } : undefined}>
            {SkiaPanel ? (
              <SkiaPanel
                view={view}
                motion={motion}
                size={size}
                color={tint}
                progress={progress}
                look={look}
                fit={fit}
              />
            ) : (
              <FigureStill view={view} size={size} motion={motion} color={tint} look={look} />
            )}
          </View>
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

/* ── Still frame: one pose, same figure, no animation ── */

/** The pictogram's far arm/leg, and every look's equipment, set back by opacity. */
const FAR_OPACITY = 0.42;
/** Equipment under the character — a neutral, so a bench never wears the kit. */
const PROP_COLOR = "#8E949E";
/** How far the side view's far limbs are set back, in box units. */
const FAR_SHIFT = 3.2;
/** A still this small (px tall) is a list thumbnail and is drawn without its fine detail. */
const THUMB_MAX_SIZE = 96;

export interface FigureStillProps {
  motion: FigureMotion;
  view: FigureView;
  /** Panel height in px; the width follows the view — see {@link figureStillWidth}. */
  size: number;
  /** The pictogram's colour. The character ignores it. */
  color: string;
  /** Which figure. Defaults to the character. */
  look?: FigureLook;
  /**
   * Rep progress to freeze at: 0 is the first authored pose, 0.5 the second. For
   * the frame that best identifies a movement, use {@link stillFrame}.
   */
  at?: number;
  /**
   * Scale the POSE to fill a `fitWidth` × `size` frame, instead of placing it as
   * the animated panel does.
   *
   * The panel's placement is right where the figure must not change size
   * mid-rep. It is wrong for a thumbnail: a push-up occupies a thin strip of the
   * panel, so at panel scale it came out as a small smudge in a tall tile while
   * every standing figure filled its tile. Fitting the pose's own bounds gives a
   * horizontal body the width it needs.
   */
  fitWidth?: number;
}

/** Width of a figure panel `size` tall — the side view is the narrower one. */
export function figureStillWidth(view: FigureView, size: number): number {
  return size * (view === "side" ? 0.78 : 0.94);
}

/**
 * Motions whose TOP of rep is the frame that says what they are. At the bottom
 * a push-up is a body lying on the floor with its arms folded out of sight —
 * nothing about it says push-up; at the top it is the unmistakable straight
 * body on locked arms.
 */
const TOP_OF_REP_STILLS = new Set<FigureMotion>([
  "pushup",
  "plank",
  // Every push-up variant reads at lockout, and so do the presses.
  "kneePushup",
  "inclinePushup",
  "declinePushup",
  "pikePushup",
  "scapPushup",
  "wallPushup",
  "handstandPushup",
  "chestPress",
  // At the bottom the tapping hand is the dimmed far one; at the top it's near.
  "shoulderTap",
]);

/**
 * The rep position a still should freeze at to be recognisable. For almost
 * every movement that is the bottom — the working position: a squat at the top
 * of its rep is just a person standing; at the bottom it is a squat.
 */
export function stillFrame(motion: FigureMotion): number {
  return TOP_OF_REP_STILLS.has(motion) ? 0 : 0.5;
}

const deg = (rad: number): number => (rad * 180) / Math.PI;

/** One SVG path per shape — fills, or a stroked line. */
function SvgShapes({ shapes }: { shapes: Shape[] }) {
  return (
    <>
      {shapes.map((s, i) => (
        <SvgPath
          key={i}
          d={s.d}
          fill={s.stroke ? "none" : s.fill}
          opacity={s.opacity}
          stroke={s.stroke?.color}
          strokeWidth={s.stroke?.width}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/**
 * The character in SVG, in exactly the Skia panel's order: far limbs (shaded),
 * legs and trainers, torso, the shoulders' caps, collar, head, arms. The face is
 * relaxed and smiling — the blink, the strain and the glances are the live
 * panel's: a still is a list thumbnail, and a row of gritted teeth is not an
 * invitation.
 */
const CharacterStill = React.memo(function CharacterStill({
  rig,
  kit,
  pose,
  view,
  motion,
  detail,
}: {
  rig: Rig;
  kit: MotionKit;
  pose: number[];
  view: FigureView;
  motion: FigureMotion;
  detail: ArtDetail;
}) {
  const art = useMemo(() => buildCharacterArt(rig, view, detail), [rig, view, detail]);
  const r = headRadius(rig);
  const h = headFrame(kit, pose, r);
  const mirror = faceMirrored(motion, view) ? -1 : 1;
  const head = art.head;

  const at = (i: number) =>
    `translate(${pose[i * 3]} ${pose[i * 3 + 1]}) rotate(${deg(pose[i * 3 + 2])})`;
  const bone = (i: number, prefix: string) => (
    <G key={`${prefix}${i}`} transform={at(i)}>
      <SvgShapes shapes={art.bones[i]} />
    </G>
  );
  const cap = (i: number) => (
    <G key={`cap${i}`} transform={at(i)}>
      <SvgShapes shapes={art.behind[i]} />
    </G>
  );

  return (
    <>
      {art.layers.far.length > 0 && (
        <G transform={`translate(${-FAR_SHIFT} 0)`}>
          {art.layers.far.flatMap((i) => [cap(i), bone(i, "far")])}
        </G>
      )}
      {art.layers.legs.map((i) => bone(i, "leg"))}
      {art.shoes.map((s) => {
        const i = s.bone;
        const a = pose[i * 3 + 2];
        const out = /L$/.test(rig.bones[i].name) ? -art.shoeOut : art.shoeOut;
        const x = pose[i * 3] + rig.bones[i].length * Math.cos(a) + out;
        const y = pose[i * 3 + 1] + rig.bones[i].length * Math.sin(a) + art.shoeDrop;
        return (
          <G key={`shoe${i}`} transform={`translate(${x} ${y})`}>
            <SvgShapes shapes={s.shapes} />
          </G>
        );
      })}
      {art.layers.torso.map((i) => bone(i, "torso"))}
      {art.layers.caps.map(cap)}
      {art.layers.collar.map((i) => bone(i, "collar"))}
      <G transform={`translate(${h.x} ${h.y}) rotate(${deg(h.rot)}) scale(${h.r * mirror} ${h.r})`}>
        <SvgShapes shapes={head.puffs} />
        <SvgShapes shapes={head.back} />
        <SvgShapes shapes={head.skull} />
        <SvgShapes shapes={head.face} />
        <SvgShapes shapes={head.front} />
      </G>
      {art.layers.arms.map((i) => bone(i, "arm"))}
    </>
  );
});

/** The pictogram, as the Skia panel draws it: far dimmed, legs → spine → arms. */
const PictogramStill = React.memo(function PictogramStill({
  rig,
  kit,
  pose,
  view,
  color,
}: {
  rig: Rig;
  kit: MotionKit;
  pose: number[];
  view: FigureView;
  color: string;
}) {
  const line = (i: number, dx = 0) => {
    const b = rig.bones[i];
    const a = pose[i * 3 + 2];
    const x1 = pose[i * 3] + dx;
    const y1 = pose[i * 3 + 1];
    const L = b.length - b.drawInset;
    return (
      <SvgPath
        key={`${b.name}${dx}`}
        d={`M${x1},${y1} L${x1 + L * Math.cos(a)},${y1 + L * Math.sin(a)}`}
        stroke={color}
        strokeWidth={(b.w0 + b.w1) / 2}
        strokeLinecap="round"
        fill="none"
      />
    );
  };
  const layer = (test: (name: string) => boolean) =>
    rig.bones.flatMap((b, i) => (b.draw && test(b.name) ? [line(i)] : []));
  const far =
    view === "side"
      ? SIDE_FAR_BONES.filter((i) => rig.bones[i]?.draw).map((i) => line(i, -FAR_SHIFT))
      : [];
  const hb = kit.headBone;
  const ha = pose[hb * 3 + 2];
  return (
    <>
      {far.length > 0 && <G opacity={FAR_OPACITY}>{far}</G>}
      {layer((n) => /^(thigh|shin|foot)/.test(n))}
      {layer((n) => n.endsWith("Spine"))}
      {layer((n) => /^(upArm|foreArm)/.test(n))}
      <Circle
        cx={pose[hb * 3] + kit.lengths[hb] * Math.cos(ha)}
        cy={pose[hb * 3 + 1] + kit.lengths[hb] * Math.sin(ha)}
        r={rig.headR}
        fill={color}
      />
    </>
  );
});

/**
 * The figure frozen at one point of the rep, as plain SVG.
 *
 * It draws the same art, in the same order, from the same solver as the Skia
 * panel — so a thumbnail frozen at the bottom of a rep is exactly the pose the
 * animation passes through there, and the side view's far limbs are set back the
 * same way. Two renderers that disagree about draw order show the same exercise
 * with the arm hidden in one and visible in the other.
 *
 * Cheap enough for a list row: one pose solve per mount, a few dozen shapes, no
 * animation and no Skia canvas.
 */
export const FigureStill = React.memo(function FigureStill({
  motion,
  view,
  size,
  color,
  look = "character",
  at = 0,
  fitWidth,
}: FigureStillProps) {
  const geo = useMemo(() => {
    const rig: Rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
    const kit = buildMotionKit(motion, view, look);
    const pose = solvePose(kit, at);
    // The bench / box / wall / bar it rests on — same box units as the bones.
    const props = propsFor(motion, view);

    // Everything is laid out in the rig's 0–100 box units, then placed with ONE
    // scale + offset, from either the whole rep (as the panel is) or the pose.
    let width: number;
    let s: number;
    let tx: number;
    let ty: number;
    if (fitWidth) {
      const b = poseBounds(kit, rig, pose);
      let minX = b.minX;
      let maxX = b.maxX;
      let minY = b.minY;
      let maxY = b.maxY;
      for (const p of props) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + p.w);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + p.h);
      }
      const margin = size * 0.07;
      width = fitWidth;
      // Capped, so a compact pose (a tuck) isn't blown up into thick limbs
      // beside its neighbours.
      s = Math.min(
        (fitWidth - margin * 2) / (maxX - minX),
        (size - margin * 2) / (maxY - minY),
        size * 0.0125,
      );
      tx = fitWidth / 2 - ((minX + maxX) / 2) * s;
      ty = size / 2 - ((minY + maxY) / 2) * s;
    } else {
      const fr = framePanel(motionBounds(kit, rig), view, size);
      width = fr.panelW;
      s = fr.k;
      tx = fr.tx;
      ty = fr.ty;
    }
    return { rig, kit, pose, props, width, s, tx, ty };
  }, [view, size, motion, at, fitWidth, look]);

  const character = look === "character";
  const propColor = character ? PROP_COLOR : color;
  // A list row is mounted by the dozen and seen at ~70px: it gets the art
  // without the decoration nobody can make out there.
  const detail: ArtDetail = fitWidth || size <= THUMB_MAX_SIZE ? "thumb" : "full";

  return (
    <Svg width={geo.width} height={size}>
      <G transform={`translate(${geo.tx} ${geo.ty}) scale(${geo.s})`}>
        {geo.props.length > 0 && (
          <G opacity={FAR_OPACITY}>
            {geo.props.map((p, i) => (
              <Rect
                key={`prop${i}`}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={Math.min(1.5, p.w / 2, p.h / 2)}
                fill={propColor}
              />
            ))}
          </G>
        )}
        {character ? (
          <CharacterStill
            rig={geo.rig}
            kit={geo.kit}
            pose={geo.pose}
            view={view}
            motion={motion}
            detail={detail}
          />
        ) : (
          <PictogramStill rig={geo.rig} kit={geo.kit} pose={geo.pose} view={view} color={color} />
        )}
      </G>
    </Svg>
  );
});

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
