/**
 * ExerciseFigure.skia — one animated demonstration PANEL (Skia impl).
 *
 * A volumetric, camera-facing athlete performing one clean, looping rep. There
 * is NO turntable/flip: a panel holds a single orientation (front OR side) so
 * the parent can stand a front panel and a side panel next to each other, both
 * driven by the SAME rep clock. There is NO glow — the body is a lit gradient
 * form with a soft contact shadow and crisp joints; the muscles the movement
 * trains are shaded with a warm activation accent that gently breathes.
 *
 * Anatomically-weighted capsule limbs (heavier thighs, leaner arms), a tapering
 * torso and a rounded head share one vertical brand gradient. The front figure
 * is bilaterally symmetric (centerline + right limbs sampled, left mirrored);
 * the side figure draws the near arm/leg with faint far limbs for depth. Every
 * path is rebuilt on the UI thread from pure keyframe data — zero assets.
 *
 * Loaded lazily (only when isSkiaAvailable), so this file's static Skia import
 * is safe: it's never evaluated on a surface without the native module.
 */
import { Gradients } from "@/constants/theme";
import { getFrontProfile } from "@/fitness/animation/frontProfiles";
import type { FigureZone } from "@/fitness/animation/muscleEmphasis";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { getSideProfile } from "@/fitness/animation/sideProfiles";
import { Canvas, Circle, Group, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export type FigureView = "front" | "side";

export interface SkiaFigurePanelProps {
  view: FigureView;
  motion: FigureMotion;
  size: number;
  colors: readonly [string, string, ...string[]];
  zones: readonly FigureZone[];
  /** Shared rep clock, 0→1 looping. Frozen at 0 = static top-of-rep pose. */
  progress: SharedValue<number>;
  /** Shared 0↔1 breath for the muscle activation accent. */
  pulse: SharedValue<number>;
}

// Warm activation ramp for worked muscles — reads as "firing" against the
// cool cyan body without any blur/glow.
const EMBER = ["#FFC178", "#FF6A3D"] as const;

/** Ping-pong + smoothstep, inlined so it workletizes without a captured helper. */
function ease(p: number): number {
  "worklet";
  const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
  return tri * tri * (3 - 2 * tri);
}

export function SkiaFigurePanel(props: SkiaFigurePanelProps) {
  return props.view === "side" ? <SideFigure {...props} /> : <FrontFigure {...props} />;
}

/* ────────────────────────────── FRONT ────────────────────────────── */

function FrontFigure({ motion, size, colors, zones, progress, pulse }: SkiaFigurePanelProps) {
  const profile = useMemo(() => getFrontProfile(motion), [motion]);
  const fa = profile.frames[0];
  const fb = profile.frames[1];

  const pad = size * 0.1;
  const draw = size - pad * 2;
  const k = draw / 100;
  const panelW = size * 0.86;
  const cx = panelW / 2;
  const groundY = pad + 96 * k;

  const wTorso = 15 * k;
  const wArm = 7 * k;
  const wLeg = 9.5 * k;
  const headR = 8.5 * k;

  const hotTorsoU = zones.includes("torsoUpper");
  const hotTorsoL = zones.includes("torsoLower") || zones.includes("pelvis");
  const hotShoulder = zones.includes("shoulder");
  const hotUpperArm = zones.includes("upperArm");
  const hotForeArm = zones.includes("foreArm");
  const hotThigh = zones.includes("thigh");
  const hotShin = zones.includes("shin");

  // Full symmetric skeleton in px. Indices (×2): 0 head 1 chest 2 pelvis
  // 3 shR 4 elR 5 haR 6 hipR 7 knR 8 ftR 9 shL 10 elL 11 haL 12 hipL 13 knL 14 ftL.
  const J = useDerivedValue(() => {
    "worklet";
    const t = ease(progress.value);
    const out = new Array<number>(30);
    for (let i = 0; i < 9; i++) {
      const nx = fa[i * 2] + (fb[i * 2] - fa[i * 2]) * t;
      const ny = fa[i * 2 + 1] + (fb[i * 2 + 1] - fa[i * 2 + 1]) * t;
      const y = pad + ny * k;
      out[i * 2] = cx + (nx - 50) * k;
      out[i * 2 + 1] = y;
      if (i >= 3) {
        const li = i + 6; // right node i (3..8) → left node (9..14)
        out[li * 2] = cx + (50 - nx) * k;
        out[li * 2 + 1] = y;
      }
    }
    return out;
  });

  // Volumetric torso: shoulders → pinched waist → hips, so the athlete reads
  // as a built body rather than a stick. Drawn filled under the skeleton.
  const torsoMass = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const chestX = j[2];
    const waistY = (j[3] + j[5]) * 0.5;
    const hipHalf = Math.abs(j[12] - j[24]) * 0.5;
    const waistHalf = hipHalf * 0.8;
    const p = Skia.Path.Make();
    p.moveTo(j[18], j[19]); // left shoulder
    p.lineTo(j[6], j[7]); // right shoulder
    p.quadTo(chestX + waistHalf, waistY, j[12], j[13]); // → right hip (waist pinch)
    p.lineTo(j[24], j[25]); // right hip → left hip
    p.quadTo(chestX - waistHalf, waistY, j[18], j[19]); // → left shoulder
    p.close();
    return p;
  });

  const armPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[0], j[1]); // head → chest (neck)
    p.lineTo(j[2], j[3]);
    p.moveTo(j[2], j[3]); // chest → right shoulder → elbow → hand
    p.lineTo(j[6], j[7]);
    p.lineTo(j[8], j[9]);
    p.lineTo(j[10], j[11]);
    p.moveTo(j[2], j[3]); // chest → left shoulder → elbow → hand
    p.lineTo(j[18], j[19]);
    p.lineTo(j[20], j[21]);
    p.lineTo(j[22], j[23]);
    return p;
  });

  const legPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[4], j[5]); // pelvis → right hip → knee → foot
    p.lineTo(j[12], j[13]);
    p.lineTo(j[14], j[15]);
    p.lineTo(j[16], j[17]);
    p.moveTo(j[4], j[5]); // pelvis → left hip → knee → foot
    p.lineTo(j[24], j[25]);
    p.lineTo(j[26], j[27]);
    p.lineTo(j[28], j[29]);
    return p;
  });

  // ── Muscle activation overlays (drawn over the base body) ──
  const torsoEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    const mx = (j[2] + j[4]) / 2;
    const my = (j[3] + j[5]) / 2;
    if (hotTorsoU) {
      p.moveTo(j[2], j[3]);
      p.lineTo(mx, my);
    }
    if (hotTorsoL) {
      p.moveTo(mx, my);
      p.lineTo(j[4], j[5]);
    }
    return p;
  });

  const armEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    if (hotShoulder) {
      p.moveTo(j[6], j[7]);
      p.lineTo(j[6] + (j[8] - j[6]) * 0.4, j[7] + (j[9] - j[7]) * 0.4);
      p.moveTo(j[18], j[19]);
      p.lineTo(j[18] + (j[20] - j[18]) * 0.4, j[19] + (j[21] - j[19]) * 0.4);
    }
    if (hotUpperArm) {
      p.moveTo(j[6], j[7]);
      p.lineTo(j[8], j[9]);
      p.moveTo(j[18], j[19]);
      p.lineTo(j[20], j[21]);
    }
    if (hotForeArm) {
      p.moveTo(j[8], j[9]);
      p.lineTo(j[10], j[11]);
      p.moveTo(j[20], j[21]);
      p.lineTo(j[22], j[23]);
    }
    return p;
  });

  const legEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    if (hotThigh) {
      p.moveTo(j[12], j[13]);
      p.lineTo(j[14], j[15]);
      p.moveTo(j[24], j[25]);
      p.lineTo(j[26], j[27]);
    }
    if (hotShin) {
      p.moveTo(j[14], j[15]);
      p.lineTo(j[16], j[17]);
      p.moveTo(j[26], j[27]);
      p.lineTo(j[28], j[29]);
    }
    return p;
  });

  const jointDots = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const r = 2.1 * k;
    const p = Skia.Path.Make();
    for (const n of [3, 4, 6, 7, 9, 10, 12, 13]) {
      p.addCircle(j[n * 2], j[n * 2 + 1], r);
    }
    return p;
  });

  const shadowPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const centerX = (j[16] + j[28]) * 0.5;
    const spread = Math.abs(j[16] - j[28]);
    const rx = draw * 0.15 + spread * 0.5;
    const ry = draw * 0.024;
    const p = Skia.Path.Make();
    p.addOval(Skia.XYWHRect(centerX - rx, groundY - ry, rx * 2, ry * 2));
    return p;
  });

  const headCx = useDerivedValue(() => J.value[0]);
  const headCy = useDerivedValue(() => J.value[1]);
  const specCx = useDerivedValue(() => J.value[0] - headR * 0.3);
  const specCy = useDerivedValue(() => J.value[1] - headR * 0.3);
  const emphOpacity = useDerivedValue(() => 0.6 + 0.35 * pulse.value);

  const gStart = vec(0, pad);
  const gEnd = vec(0, pad + draw);

  return (
    <Canvas style={{ width: panelW, height: size }}>
      {/* Soft contact shadow — a shadow, not a glow (no blur). */}
      <Path path={shadowPath} color={colors[colors.length - 1]} opacity={0.14} />

      {/* Volumetric torso mass — a built core, not a stick. */}
      <Path path={torsoMass}>
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>

      {/* Limbs over the mass — one shared vertical gradient. */}
      <Path path={legPath} style="stroke" strokeWidth={wLeg} strokeCap="round" strokeJoin="round">
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>
      <Path path={armPath} style="stroke" strokeWidth={wArm} strokeCap="round" strokeJoin="round">
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>
      <Circle cx={headCx} cy={headCy} r={headR}>
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Circle>
      {/* Crisp specular highlight (offset, no blur). */}
      <Circle cx={specCx} cy={specCy} r={headR * 0.34} color="#FFFFFF" opacity={0.18} />

      {/* Muscle activation — worked segments shaded warm, gently breathing,
          with a hot core line for a premium "firing" read. */}
      <Group opacity={emphOpacity}>
        <Path path={legEmph} style="stroke" strokeWidth={wLeg * 0.72} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={torsoEmph} style="stroke" strokeWidth={wTorso * 0.6} strokeCap="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={armEmph} style="stroke" strokeWidth={wArm * 0.72} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={legEmph} style="stroke" strokeWidth={wLeg * 0.24} strokeCap="round" strokeJoin="round" color="#FFE7C2" opacity={0.7} />
        <Path path={torsoEmph} style="stroke" strokeWidth={wTorso * 0.2} strokeCap="round" color="#FFE7C2" opacity={0.7} />
        <Path path={armEmph} style="stroke" strokeWidth={wArm * 0.26} strokeCap="round" strokeJoin="round" color="#FFE7C2" opacity={0.7} />
      </Group>

      {/* Joint articulation — clean white caps, no blur. */}
      <Path path={jointDots} color="#FFFFFF" opacity={0.32} />
    </Canvas>
  );
}

/* ─────────────────────────────── SIDE ─────────────────────────────── */

function SideFigure({ motion, size, colors, zones, progress, pulse }: SkiaFigurePanelProps) {
  const profile = useMemo(() => getSideProfile(motion), [motion]);
  const fa = profile.frames[0];
  const fb = profile.frames[1];

  const pad = size * 0.1;
  const draw = size - pad * 2;
  const k = draw / 100;
  const panelW = size * 0.7;
  const cx = panelW / 2;
  const groundY = pad + 96 * k;
  const depth = 2.6 * k; // how far the far limbs sit behind the near ones

  const wTorso = 15 * k;
  const wArm = 7 * k;
  const wLeg = 9.5 * k;
  const headR = 8.5 * k;

  const hotTorsoU = zones.includes("torsoUpper");
  const hotTorsoL = zones.includes("torsoLower") || zones.includes("pelvis");
  const hotShoulder = zones.includes("shoulder");
  const hotUpperArm = zones.includes("upperArm");
  const hotForeArm = zones.includes("foreArm");
  const hotThigh = zones.includes("thigh");
  const hotShin = zones.includes("shin");

  // Indices (×2): 0 head 1 shoulder 2 elbow 3 hand 4 hip 5 knee 6 foot.
  const J = useDerivedValue(() => {
    "worklet";
    const t = ease(progress.value);
    const out = new Array<number>(14);
    for (let i = 0; i < 7; i++) {
      const nx = fa[i * 2] + (fb[i * 2] - fa[i * 2]) * t;
      const ny = fa[i * 2 + 1] + (fb[i * 2 + 1] - fa[i * 2 + 1]) * t;
      out[i * 2] = cx + (nx - 50) * k;
      out[i * 2 + 1] = pad + ny * k;
    }
    return out;
  });

  const neckTorsoPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[0], j[1]); // head → shoulder
    p.lineTo(j[2], j[3]);
    p.lineTo(j[8], j[9]); // shoulder → hip
    return p;
  });

  const nearArmPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[2], j[3]); // shoulder → elbow → hand
    p.lineTo(j[4], j[5]);
    p.lineTo(j[6], j[7]);
    return p;
  });

  const nearLegPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[8], j[9]); // hip → knee → foot
    p.lineTo(j[10], j[11]);
    p.lineTo(j[12], j[13]);
    return p;
  });

  const farArmPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[2] - depth, j[3]);
    p.lineTo(j[4] - depth, j[5]);
    p.lineTo(j[6] - depth, j[7]);
    return p;
  });

  const farLegPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    p.moveTo(j[8] - depth, j[9]);
    p.lineTo(j[10] - depth, j[11]);
    p.lineTo(j[12] - depth, j[13]);
    return p;
  });

  // ── Muscle activation overlays (near side only) ──
  const torsoEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    const mx = (j[2] + j[8]) / 2;
    const my = (j[3] + j[9]) / 2;
    if (hotTorsoU) {
      p.moveTo(j[2], j[3]);
      p.lineTo(mx, my);
    }
    if (hotTorsoL) {
      p.moveTo(mx, my);
      p.lineTo(j[8], j[9]);
    }
    return p;
  });

  const armEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    if (hotShoulder) {
      p.moveTo(j[2], j[3]);
      p.lineTo(j[2] + (j[4] - j[2]) * 0.4, j[3] + (j[5] - j[3]) * 0.4);
    }
    if (hotUpperArm) {
      p.moveTo(j[2], j[3]);
      p.lineTo(j[4], j[5]);
    }
    if (hotForeArm) {
      p.moveTo(j[4], j[5]);
      p.lineTo(j[6], j[7]);
    }
    return p;
  });

  const legEmph = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const p = Skia.Path.Make();
    if (hotThigh) {
      p.moveTo(j[8], j[9]);
      p.lineTo(j[10], j[11]);
    }
    if (hotShin) {
      p.moveTo(j[10], j[11]);
      p.lineTo(j[12], j[13]);
    }
    return p;
  });

  const jointDots = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const r = 2.1 * k;
    const p = Skia.Path.Make();
    for (const n of [1, 2, 4, 5]) {
      p.addCircle(j[n * 2], j[n * 2 + 1], r);
    }
    return p;
  });

  const shadowPath = useDerivedValue(() => {
    "worklet";
    const j = J.value;
    const rx = draw * 0.13;
    const ry = draw * 0.024;
    const p = Skia.Path.Make();
    p.addOval(Skia.XYWHRect(j[12] - rx * 0.6, groundY - ry, rx * 2, ry * 2));
    return p;
  });

  const headCx = useDerivedValue(() => J.value[0]);
  const headCy = useDerivedValue(() => J.value[1]);
  const specCx = useDerivedValue(() => J.value[0] - headR * 0.3);
  const specCy = useDerivedValue(() => J.value[1] - headR * 0.3);
  const emphOpacity = useDerivedValue(() => 0.6 + 0.35 * pulse.value);

  const gStart = vec(0, pad);
  const gEnd = vec(0, pad + draw);

  return (
    <Canvas style={{ width: panelW, height: size }}>
      <Path path={shadowPath} color={colors[colors.length - 1]} opacity={0.14} />

      {/* Far limbs — dim, behind the torso, to hint the body's depth. */}
      <Group opacity={0.3}>
        <Path path={farLegPath} style="stroke" strokeWidth={wLeg * 0.9} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
        </Path>
        <Path path={farArmPath} style="stroke" strokeWidth={wArm * 0.9} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
        </Path>
      </Group>

      {/* Base body. */}
      <Path path={nearLegPath} style="stroke" strokeWidth={wLeg} strokeCap="round" strokeJoin="round">
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>
      <Path path={neckTorsoPath} style="stroke" strokeWidth={wTorso} strokeCap="round" strokeJoin="round">
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>
      <Path path={nearArmPath} style="stroke" strokeWidth={wArm} strokeCap="round" strokeJoin="round">
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Path>
      <Circle cx={headCx} cy={headCy} r={headR}>
        <LinearGradient start={gStart} end={gEnd} colors={[...colors]} />
      </Circle>
      <Circle cx={specCx} cy={specCy} r={headR * 0.34} color="#FFFFFF" opacity={0.18} />

      {/* Muscle activation — warm shade + hot core line. */}
      <Group opacity={emphOpacity}>
        <Path path={legEmph} style="stroke" strokeWidth={wLeg * 0.72} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={torsoEmph} style="stroke" strokeWidth={wTorso * 0.6} strokeCap="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={armEmph} style="stroke" strokeWidth={wArm * 0.72} strokeCap="round" strokeJoin="round">
          <LinearGradient start={gStart} end={gEnd} colors={[...EMBER]} />
        </Path>
        <Path path={legEmph} style="stroke" strokeWidth={wLeg * 0.24} strokeCap="round" strokeJoin="round" color="#FFE7C2" opacity={0.7} />
        <Path path={torsoEmph} style="stroke" strokeWidth={wTorso * 0.2} strokeCap="round" color="#FFE7C2" opacity={0.7} />
        <Path path={armEmph} style="stroke" strokeWidth={wArm * 0.26} strokeCap="round" strokeJoin="round" color="#FFE7C2" opacity={0.7} />
      </Group>

      <Path path={jointDots} color="#FFFFFF" opacity={0.32} />
    </Canvas>
  );
}

// Default brand ramp when a host doesn't override.
export const FIGURE_GRADIENT = Gradients.brand;
