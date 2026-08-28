/**
 * ExerciseFigure.skia — one animated demonstration PANEL (Skia impl).
 *
 * A PICTOGRAM athlete, held to the classic stick-figure reference: a detached
 * circular head over a blocky trunk, uniform round-capped limbs, one flat
 * colour. No gradients, no outlines, no shading, no glow, no highlighting —
 * the silhouette does all the work, which is exactly why pictograms read at a
 * glance.
 *
 * Under it is a skeletal rig (see animation/rig.ts): every bone is a capsule
 * built ONCE and moved by a matrix, nested so a forearm rides its upper arm
 * rides its shoulder. Nothing is rebuilt per frame — the renderer this replaced
 * allocated a native path per limb per frame, which is what made the exercise
 * screens stutter and eventually kill the app.
 *
 * Motion is deliberately loose rather than mechanical: each bone runs the rep
 * clock slightly BEHIND its parent (`FOLLOW_LAG` per level of the chain), so a
 * hand trails a forearm trails an upper arm. That overlapping action is what
 * separates a figure that moves from a figure that is merely posed.
 *
 * A panel holds ONE orientation (front OR side) so the parent can stand both
 * next to each other on a single shared rep clock. No flip.
 *
 * Loaded lazily (only when isSkiaAvailable), so this file's static Skia import
 * is safe: it is never evaluated on a surface without the native module.
 */
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import {
  SIDE_FAR_BONES,
  buildFrontRig,
  buildSideRig,
  type Rig,
} from "@/fitness/animation/rig";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  type SkPath,
  type Transforms3d,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export type FigureView = "front" | "side";

export interface SkiaFigurePanelProps {
  view: FigureView;
  motion: FigureMotion;
  size: number;
  /** The one flat colour the whole figure is drawn in. */
  color: string;
  /** Shared rep clock, 0→1 looping. Frozen at 0 = static top-of-rep pose. */
  progress: SharedValue<number>;
}

/**
 * How far each level of the chain trails the one above it, as a fraction of the
 * rep. Small on purpose: enough to loosen the movement, not enough to pull a
 * joint visibly out of its socket.
 */
const FOLLOW_LAG = 0.013;
/** The far arm/leg of a side view, set back so the body reads with depth. */
const FAR_OPACITY = 0.42;

/* ─────────────────────────────── Geometry ──────────────────────────────── */

/**
 * A capsule running from the bone's origin along +x to (length, 0), `w0` wide
 * at the base and `w1` at the tip, fully rounded at both ends. Built once per
 * bone, then only ever transformed.
 */
function capsule(length: number, w0: number, w1: number, tip: number): SkPath {
  const h0 = w0 / 2;
  const h1 = w1 / 2;
  const cap = Math.max(h1, tip);
  const len = Math.max(0.1, length);
  const p = Skia.Path.Make();
  p.moveTo(0, -h0);
  p.lineTo(len, -h1);
  p.cubicTo(len + cap * 1.34, -cap, len + cap * 1.34, cap, len, h1);
  p.lineTo(0, h0);
  p.cubicTo(-h0 * 1.34, h0, -h0 * 1.34, -h0, 0, -h0);
  p.close();
  return p;
}

interface PanelGeometry {
  rig: Rig;
  panelW: number;
  k: number;
  pad: number;
  cx: number;
  /** Drawable capsule per bone; null for positioning-only bones. */
  art: (SkPath | null)[];
  headR: number;
  depth: number;
  /** Draw order, back to front. */
  legs: number[];
  arms: number[];
  spine: number[];
}

function indicesWhere(rig: Rig, test: (name: string) => boolean): number[] {
  const out: number[] = [];
  rig.bones.forEach((b, i) => {
    if (test(b.name) && b.draw) out.push(i);
  });
  return out;
}

function buildGeometry(
  view: FigureView,
  motion: FigureMotion,
  size: number,
): PanelGeometry {
  const rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
  const pad = size * 0.08;
  const panelW = size * (view === "side" ? 0.78 : 0.94);
  // Shrink the drawing scale rather than let a wide pose (a jumping jack) run
  // off the edge of its panel.
  const k = Math.min(
    (size - pad * 2) / 100,
    (panelW / 2 - size * 0.03) / (rig.reach + 9),
  );

  const art = rig.bones.map((b) =>
    b.draw
      ? capsule(
          (b.length - b.drawInset) * k,
          b.w0 * k,
          b.w1 * k,
          b.tip * k,
        )
      : null,
  );

  return {
    rig,
    panelW,
    k,
    pad,
    cx: panelW / 2,
    art,
    headR: rig.headR * k,
    depth: 3.2 * k,
    legs: indicesWhere(rig, (n) => /^(thigh|shin|foot)/.test(n)),
    arms: indicesWhere(rig, (n) => /^(upArm|foreArm)/.test(n)),
    spine: indicesWhere(rig, (n) => n.endsWith("Spine")),
  };
}

/* ──────────────────────────────── Bone ─────────────────────────────────── */

/**
 * One bone. Its own derived transform reads the shared pose array, so the whole
 * body costs a handful of tiny matrices per frame and not one allocation.
 */
const Bone = React.memo(function Bone({
  pose,
  index,
  path,
  color,
}: {
  pose: SharedValue<number[]>;
  index: number;
  path: SkPath;
  color: string;
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    return [
      { translateX: p[index * 3] },
      { translateY: p[index * 3 + 1] },
      { rotate: p[index * 3 + 2] },
    ];
  }, [pose, index]);

  return (
    <Group transform={transform}>
      <Path path={path} color={color} />
    </Group>
  );
});

/* ──────────────────────────────── Panel ────────────────────────────────── */

export function SkiaFigurePanel({
  view,
  motion,
  size,
  color,
  progress,
}: SkiaFigurePanelProps) {
  const geo = useMemo(() => buildGeometry(view, motion, size), [view, motion, size]);
  const { rig, art, cx, pad, k, panelW, headR } = geo;

  // The whole skeleton, walked once per frame on the UI thread. Every bone
  // transform below reads this one array.
  const boneCount = rig.bones.length;
  const parents = useMemo(() => rig.bones.map((b) => b.parent), [rig]);
  const lengths = useMemo(() => rig.bones.map((b) => b.length * k), [rig, k]);
  const lags = useMemo(() => rig.bones.map((b) => b.depth * FOLLOW_LAG), [rig]);
  const { anglesA, anglesB } = rig;
  const rootAx = cx + (rig.rootA[0] - 50) * k;
  const rootAy = pad + rig.rootA[1] * k;
  const rootBx = cx + (rig.rootB[0] - 50) * k;
  const rootBy = pad + rig.rootB[1] * k;

  const pose = useDerivedValue<number[]>(() => {
    "worklet";
    // smootherstep over a ping-pong — the athlete decelerates into the bottom
    // of the movement instead of snapping between the two authored poses.
    const ease = (raw: number) => {
      "worklet";
      const tri = raw < 0.5 ? raw * 2 : (1 - raw) * 2;
      const c = tri < 0 ? 0 : tri > 1 ? 1 : tri;
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    const p = progress.value;
    const tRoot = ease(p);
    const rootX = rootAx + (rootBx - rootAx) * tRoot;
    const rootY = rootAy + (rootBy - rootAy) * tRoot;

    const out = new Array<number>(boneCount * 3);
    const tipX = new Array<number>(boneCount);
    const tipY = new Array<number>(boneCount);
    for (let i = 0; i < boneCount; i++) {
      // Each level of the chain runs slightly behind the one above it, so the
      // limbs whip and settle instead of moving as one rigid piece.
      let lagged = p - lags[i];
      if (lagged < 0) lagged += 1;
      const t = ease(lagged);

      const parent = parents[i];
      const a = anglesA[i] + (anglesB[i] - anglesA[i]) * t;
      const sx = parent < 0 ? rootX : tipX[parent];
      const sy = parent < 0 ? rootY : tipY[parent];
      tipX[i] = sx + lengths[i] * Math.cos(a);
      tipY[i] = sy + lengths[i] * Math.sin(a);
      out[i * 3] = sx;
      out[i * 3 + 1] = sy;
      out[i * 3 + 2] = a;
    }
    return out;
  }, [
    progress,
    boneCount,
    parents,
    lengths,
    lags,
    anglesA,
    anglesB,
    rootAx,
    rootAy,
    rootBx,
    rootBy,
  ]);

  // Head rides the tip of the (undrawn) neck bone.
  const headBone = rig.headBone;
  const headXf = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    const a = p[headBone * 3 + 2];
    return [
      { translateX: p[headBone * 3] + lengths[headBone] * Math.cos(a) },
      { translateY: p[headBone * 3 + 1] + lengths[headBone] * Math.sin(a) },
    ];
  }, [pose, headBone, lengths]);

  const draw = (indices: number[], keyPrefix: string) =>
    indices.map((i) => {
      const path = art[i];
      if (!path) return null;
      return (
        <Bone key={`${keyPrefix}${i}`} pose={pose} index={i} path={path} color={color} />
      );
    });

  const farBones = view === "side" ? [...SIDE_FAR_BONES].filter((i) => art[i]) : [];

  return (
    <Canvas style={{ width: panelW, height: size }}>
      {/* Far side (side view only) — the same silhouette set back, so a profile
          figure doesn't read as a person missing an arm and a leg. */}
      {farBones.length > 0 && (
        <Group transform={[{ translateX: -geo.depth }]} opacity={FAR_OPACITY}>
          {draw(farBones, "far")}
        </Group>
      )}

      {draw(geo.legs, "leg")}
      {draw(geo.spine, "spine")}
      {draw(geo.arms, "arm")}

      <Group transform={headXf}>
        <Circle cx={0} cy={0} r={headR} color={color} />
      </Group>
    </Canvas>
  );
}
