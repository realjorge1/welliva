/**
 * ExerciseFigure.skia — one animated demonstration PANEL (Skia impl).
 *
 * TWO LOOKS ON ONE SKELETON.
 *
 *   character (default) — the athlete drawn in animation/characterArt.ts: a
 *     slim, seven-heads-tall body in a tee, shorts, socks and trainers, cropped
 *     hair and a plain resting face. Every part is a shape parented to a bone;
 *     the face is drawn once and never moves, and the only thing layered on the
 *     body is the breath, which keeps time with the rep.
 *   pictogram — the original: a detached circular head over a blocky trunk,
 *     uniform round-capped limbs, one flat colour. Kept whole, one prop away.
 *
 * Both look at the same solved pose (animation/motion.ts): the skeleton walked
 * once per frame on the UI thread, every joint on the same curve at the same
 * instant, and the planted foot held to the floor. Every shape is built
 * ONCE and moved by a matrix; nothing native is allocated per frame — the first
 * renderer allocated a path per limb per frame, which is what killed the app.
 *
 * Everything is drawn in the rig's own 0–100 box units inside ONE group that
 * scales and places it, so a bone transform is just (x, y, angle).
 *
 * The clock handed in runs over one 12 s cycle of whole reps (see tempo.ts).
 *
 * A panel holds ONE orientation (front OR side) so the parent can stand both
 * next to each other on a single shared clock. No flip.
 *
 * Loaded lazily (only when isSkiaAvailable), so this file's static Skia import
 * is safe: it is never evaluated on a surface without the native module.
 */
import {
  buildCharacterArt,
  faceMirrored,
  frontShoeTurn,
  type CharacterArt,
  type FigureLook,
  type FigureView,
  type HeadArt,
  type Shape,
} from "@/fitness/animation/characterArt";
import {
  buildMotionKit,
  framePanel,
  headFrame,
  headRadius,
  motionBounds,
  repPhase,
  solveLife,
  solvePose,
  type MotionKit,
} from "@/fitness/animation/motion";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { propsFor } from "@/fitness/animation/props";
import { SIDE_FAR_BONES, buildFrontRig, buildSideRig, type Rig } from "@/fitness/animation/rig";
import { FX } from "@/fitness/animation/tempo";
import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
  type SkPath,
  type Transforms3d,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export type { FigureView };

export interface SkiaFigurePanelProps {
  view: FigureView;
  motion: FigureMotion;
  size: number;
  /** The pictogram's one flat colour. The character wears its own kit and ignores it. */
  color: string;
  /** Shared clock, 0→1 looping over the macro cycle. Frozen at 0 = the first pose. */
  progress: SharedValue<number>;
  /** Which figure demonstrates. Defaults to the character. */
  look?: FigureLook;
  /**
   * Radius in px, around the panel's centre, the figure's whole silhouette must
   * stay inside — see `framePanel`. Omit it for the standard standing-on-a-line
   * framing.
   */
  fit?: number;
}

/** The pictogram's far arm/leg, and every look's equipment, set back by opacity. */
const FAR_OPACITY = 0.42;
/** How far the side view's far limbs are set back, in box units. */
const FAR_SHIFT = 3.2;
/** Equipment under the character — a neutral, so a bench never wears the kit. */
const PROP_COLOR = "#8E949E";
/** The chest's breath: how much the tee swells along and across the torso. */
const BREATH_ALONG = 0.01;
const BREATH_ACROSS = 0.035;

const svgPath = (d: string): SkPath => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();

/* ─────────────────────────── Shapes, built once ──────────────────────────── */

/** A shape with its path parsed — built once per panel, never per frame. */
interface Prepared {
  path: SkPath;
  fill?: string;
  opacity?: number;
  stroke?: { color: string; width: number };
}

const prepare = (shapes: Shape[]): Prepared[] =>
  shapes.map((s) => ({ path: svgPath(s.d), fill: s.fill, opacity: s.opacity, stroke: s.stroke }));

const Shapes = React.memo(function Shapes({ shapes }: { shapes: Prepared[] }) {
  return (
    <>
      {shapes.map((s, i) =>
        s.stroke ? (
          <Path
            key={i}
            path={s.path}
            style="stroke"
            strokeWidth={s.stroke.width}
            strokeCap="round"
            color={s.stroke.color}
          />
        ) : (
          <Path key={i} path={s.path} color={s.fill} opacity={s.opacity} />
        ),
      )}
    </>
  );
});

/**
 * The per-frame transform of one bone, read off the solved pose. `flip` −1
 * turns the bone's art over across its own axis — the side view of a pose that
 * faces −x (animation/facing.ts), whose front is on the other side of every bone.
 */
function useBoneTransform(pose: SharedValue<number[]>, index: number, flip = 1, showsAt = -1) {
  return useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    return [
      { translateX: p[index * 3] },
      { translateY: p[index * 3 + 1] },
      { rotate: p[index * 3 + 2] },
      { scaleY: flip },
      // A bone turning toward the camera shows only part of its length.
      { scaleX: showsAt < 0 ? 1 : p[showsAt] },
    ];
  }, [pose, index, flip, showsAt]);
}

/** One of the character's bones — everything it wears, on one transform. */
const DressedBone = React.memo(function DressedBone({
  pose,
  index,
  shapes,
  flip = 1,
  showsAt = -1,
}: {
  pose: SharedValue<number[]>;
  index: number;
  shapes: Prepared[];
  flip?: number;
  /** Where in the pose this bone's shown length is, when it can foreshorten. */
  showsAt?: number;
}) {
  const transform = useBoneTransform(pose, index, flip, showsAt);
  return (
    <Group transform={transform}>
      <Shapes shapes={shapes} />
    </Group>
  );
});

/** The upper spine: a bone like any other, but the chest swells with the breath. */
const Chest = React.memo(function Chest({
  pose,
  fx,
  index,
  shapes,
  flip = 1,
}: {
  pose: SharedValue<number[]>;
  fx: SharedValue<number[]>;
  index: number;
  shapes: Prepared[];
  flip?: number;
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    const b = fx.value[FX.BREATH];
    return [
      { translateX: p[index * 3] },
      { translateY: p[index * 3 + 1] },
      { rotate: p[index * 3 + 2] },
      { scaleX: 1 + BREATH_ALONG * b },
      { scaleY: (1 + BREATH_ACROSS * b) * flip },
    ];
  }, [pose, fx, index, flip]);
  return (
    <Group transform={transform}>
      <Shapes shapes={shapes} />
    </Group>
  );
});

/**
 * A front-on trainer. The front rig has no foot bone, so the shoe hangs off the
 * tip of the shin — LEVEL while the leg stands on it (a foot stays flat on the
 * floor through a squat or a jumping jack, whatever the leg above it does), and
 * carried on the end of a leg that lies along the floor or rises off it
 * (`frontShoeTurn`).
 */
const FrontShoe = React.memo(function FrontShoe({
  pose,
  index,
  length,
  out,
  drop,
  shapes,
}: {
  pose: SharedValue<number[]>;
  index: number;
  length: number;
  out: number;
  drop: number;
  shapes: Prepared[];
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    const a = p[index * 3 + 2];
    return [
      { translateX: p[index * 3] + length * Math.cos(a) + out },
      { translateY: p[index * 3 + 1] + length * Math.sin(a) + drop },
      { rotate: frontShoeTurn(a) },
    ];
  }, [pose, index, length, out, drop]);
  return (
    <Group transform={transform}>
      <Shapes shapes={shapes} />
    </Group>
  );
});

/* ─────────────────────────────── The head ────────────────────────────────── */

interface PreparedHead {
  back: Prepared[];
  skull: Prepared[];
  face: Prepared[];
  front: Prepared[];
}

function prepareHead(head: HeadArt): PreparedHead {
  return {
    back: prepare(head.back),
    skull: prepare(head.skull),
    face: prepare(head.face),
    front: prepare(head.front),
  };
}

/**
 * The character's head, drawn in its own unit frame — half-height 1, crown
 * toward −y, face toward +x. The parent group turns it to follow the neck (so a
 * face looks at the floor in a plank and at the sky in a bridge) and mirrors it
 * for the few poses authored the other way round.
 *
 * Nothing on it moves of its own accord: the face is drawn once, and the hair
 * is cropped close. It used to carry a rig of its own — blinking lids, a
 * glancing pupil, brows, swapping mouths, and then a cloud of curls that dragged
 * behind every turn of the head on its own lag — and each was one more thing
 * moving out of time with the body.
 */
function CharacterHead({ head, frame }: { head: PreparedHead; frame: SharedValue<Transforms3d> }) {
  return (
    <Group transform={frame}>
      <Shapes shapes={head.back} />
      <Shapes shapes={head.skull} />
      <Shapes shapes={head.face} />
      <Shapes shapes={head.front} />
    </Group>
  );
}

/* ─────────────────────────────── The pictogram ───────────────────────────── */

/**
 * A capsule running from the bone's origin along +x to (length, 0), `w0` wide at
 * the base and `w1` at the tip, fully rounded at both ends. Built once per bone,
 * then only ever transformed.
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
  const transform = useBoneTransform(pose, index);
  return (
    <Group transform={transform}>
      <Path path={path} color={color} />
    </Group>
  );
});

function indicesWhere(rig: Rig, test: (name: string) => boolean): number[] {
  const out: number[] = [];
  rig.bones.forEach((b, i) => {
    if (test(b.name) && b.draw) out.push(i);
  });
  return out;
}

/* ──────────────────────────────── Panel ──────────────────────────────────── */

export function SkiaFigurePanel({
  view,
  motion,
  size,
  color,
  progress,
  look = "character",
  fit,
}: SkiaFigurePanelProps) {
  const character = look === "character";
  const model = useMemo(() => {
    const rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
    const kit = buildMotionKit(motion, view, look);
    const bounds = motionBounds(kit, rig);
    return { rig, kit, bounds };
  }, [view, motion, look]);
  const { rig, kit, bounds } = model;
  const frame = useMemo(() => framePanel(bounds, view, size, fit), [bounds, view, size, fit]);

  // The whole skeleton and the whole face, solved once per frame on the UI
  // thread. Every transform below reads one of these two arrays.
  const pose = useDerivedValue<number[]>(() => {
    "worklet";
    return solvePose(kit, repPhase(kit, progress.value));
  }, [kit, progress]);
  const fx = useDerivedValue<number[]>(() => {
    "worklet";
    return solveLife(kit, progress.value);
  }, [kit, progress]);

  // Equipment: the bench / box / wall / bar the movement rests on, placed once.
  const props = useMemo(() => propsFor(motion, view), [motion, view]);
  // No ground shadow (owner, 2026-11-01): the figure stands on whatever floor
  // its host draws — the player's stage has a real one. And no squash and
  // stretch on a hop: this is a demonstration, not a cartoon.

  const placement: Transforms3d = useMemo(
    () => [{ translateX: frame.tx }, { translateY: frame.ty }, { scale: frame.k }],
    [frame],
  );

  const scene = character ? (
    <CharacterScene rig={rig} kit={kit} view={view} motion={motion} pose={pose} fx={fx} />
  ) : (
    <PictogramScene rig={rig} kit={kit} view={view} pose={pose} color={color} />
  );

  return (
    <Canvas style={{ width: frame.panelW, height: size }}>
      <Group transform={placement}>
        {/* Equipment sits furthest back, at the far-limb opacity: the setting,
            not part of the body. */}
        {props.length > 0 && (
          <Group opacity={FAR_OPACITY}>
            {props.map((p, i) => (
              <RoundedRect
                key={`prop${i}`}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                r={Math.min(1.5, p.w / 2, p.h / 2)}
                color={character ? PROP_COLOR : color}
              />
            ))}
          </Group>
        )}
        {scene}
      </Group>
    </Canvas>
  );
}

/* ────────────────────────────── The scenes ───────────────────────────────── */

function CharacterScene({
  rig,
  kit,
  view,
  motion,
  pose,
  fx,
}: {
  rig: Rig;
  kit: MotionKit;
  view: FigureView;
  motion: FigureMotion;
  pose: SharedValue<number[]>;
  fx: SharedValue<number[]>;
}) {
  const art: CharacterArt = useMemo(() => buildCharacterArt(rig, view), [rig, view]);
  const bones = useMemo(() => art.bones.map(prepare), [art]);
  const behind = useMemo(() => art.behind.map(prepare), [art]);
  const shoes = useMemo(() => art.shoes.map((s) => ({ bone: s.bone, shapes: prepare(s.shapes) })), [art]);
  const head = useMemo(() => prepareHead(art.head), [art]);
  const r = headRadius(rig);
  const mirror = faceMirrored(motion, view) ? -1 : 1;
  // A side pose facing −x has its front on the other side of every bone: turn
  // each one's art over, and set the far limbs back toward ITS back, not ours.
  const flip = view === "side" ? rig.facing : 1;

  const headXf = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const h = headFrame(kit, pose.value, r);
    return [
      { translateX: h.x },
      { translateY: h.y },
      { rotate: h.rot },
      { scaleX: h.r * mirror },
      { scaleY: h.r },
    ];
  }, [kit, pose, r, mirror]);

  const showsAt = (i: number) => (kit.depthSlot[i] < 0 ? -1 : kit.n * 3 + i);
  const wear = (indices: number[], prefix: string) =>
    indices.map((i) => (
      <DressedBone key={`${prefix}${i}`} pose={pose} index={i} shapes={bones[i]} flip={flip} showsAt={showsAt(i)} />
    ));
  const caps = (indices: number[], prefix: string) =>
    indices.map((i) => (
      <DressedBone key={`${prefix}${i}`} pose={pose} index={i} shapes={behind[i]} flip={flip} showsAt={showsAt(i)} />
    ));

  return (
    <Group>
      {/* Far side, set back — opaque and a shade darker, not see-through: on a
          body of several colours, transparency shows every overlap. */}
      {art.layers.far.length > 0 && (
        <Group transform={[{ translateX: -FAR_SHIFT * flip }]}>
          {art.layers.far.flatMap((i) => [
            <DressedBone key={`fb${i}`} pose={pose} index={i} shapes={behind[i]} flip={flip} />,
            <DressedBone key={`ff${i}`} pose={pose} index={i} shapes={bones[i]} flip={flip} />,
          ])}
        </Group>
      )}
      {wear(art.layers.legs, "leg")}
      {shoes.map((s) => (
        <FrontShoe
          key={`shoe${s.bone}`}
          pose={pose}
          index={s.bone}
          length={rig.bones[s.bone].length}
          out={/L$/.test(rig.bones[s.bone].name) ? -art.shoeOut : art.shoeOut}
          drop={art.shoeDrop}
          shapes={s.shapes}
        />
      ))}
      {art.layers.torso.map((i) =>
        rig.bones[i].name === "upperSpine" ? (
          <Chest key={`torso${i}`} pose={pose} fx={fx} index={i} shapes={bones[i]} flip={flip} />
        ) : (
          <DressedBone key={`torso${i}`} pose={pose} index={i} shapes={bones[i]} flip={flip} />
        ),
      )}
      {/* The shoulders' caps sit under the head. */}
      {caps(art.layers.caps, "cap")}
      {wear(art.layers.collar, "collar")}
      <CharacterHead head={head} frame={headXf} />
      {wear(art.layers.arms, "arm")}
    </Group>
  );
}

function PictogramScene({
  rig,
  kit,
  view,
  pose,
  color,
}: {
  rig: Rig;
  kit: MotionKit;
  view: FigureView;
  pose: SharedValue<number[]>;
  color: string;
}) {
  const art = useMemo(
    () =>
      rig.bones.map((b) =>
        b.draw ? capsule(b.length - b.drawInset, b.w0, b.w1, b.tip) : null,
      ),
    [rig],
  );
  const legs = useMemo(() => indicesWhere(rig, (n) => /^(thigh|shin|foot)/.test(n)), [rig]);
  const arms = useMemo(() => indicesWhere(rig, (n) => /^(upArm|foreArm)/.test(n)), [rig]);
  const spine = useMemo(() => indicesWhere(rig, (n) => n.endsWith("Spine")), [rig]);
  const farBones = view === "side" ? [...SIDE_FAR_BONES].filter((i) => art[i]) : [];
  const headBone = kit.headBone;
  const headLen = kit.lengths[headBone];
  const headXf = useDerivedValue<Transforms3d>(() => {
    "worklet";
    const p = pose.value;
    const a = p[headBone * 3 + 2];
    return [
      { translateX: p[headBone * 3] + headLen * Math.cos(a) },
      { translateY: p[headBone * 3 + 1] + headLen * Math.sin(a) },
    ];
  }, [pose, headBone, headLen]);

  const draw = (indices: number[], prefix: string) =>
    indices.map((i) => {
      const path = art[i];
      return path ? <Bone key={`${prefix}${i}`} pose={pose} index={i} path={path} color={color} /> : null;
    });

  return (
    <>
      {/* Far side (side view only) — the far arm and leg set back, so a profile
          figure doesn't read as a person missing an arm and a leg. */}
      {farBones.length > 0 && (
        <Group transform={[{ translateX: -FAR_SHIFT }]} opacity={FAR_OPACITY}>
          {draw(farBones, "far")}
        </Group>
      )}
      {draw(legs, "leg")}
      {draw(spine, "spine")}
      {draw(arms, "arm")}
      <Group transform={headXf}>
        <Circle cx={0} cy={0} r={rig.headR} color={color} />
      </Group>
    </>
  );
}
