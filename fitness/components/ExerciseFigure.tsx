/**
 * ExerciseFigure — an animated schematic athlete demonstrating an exercise's
 * movement pattern. Native, zero-asset replacement for the old demo GIFs.
 *
 * By default it stands TWO panels side by side — a FRONT view and a SIDE view
 * of the same movement — both driven by ONE shared rep clock so they move at
 * the exact same rhythm and pace. There is no flip/turntable: each panel holds
 * a fixed orientation. The muscles the exercise trains are shaded with a warm
 * activation accent (resolved from the exercise's target muscles), and there is
 * no glow anywhere — just a lit gradient body and a soft contact shadow.
 *
 * Renders the Skia implementation when available (animated, or frozen at the
 * top-of-rep pose under reduced motion) and a calm static react-native-svg
 * silhouette otherwise (the window before a native rebuild, or any Skia-less
 * surface).
 */
import { isSkiaAvailable } from "@/components/skia/skiaSafe";
import { AppText, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getFrontProfile } from "@/fitness/animation/frontProfiles";
import { resolveEmphasisZones, type FigureZone } from "@/fitness/animation/muscleEmphasis";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { getSideProfile } from "@/fitness/animation/sideProfiles";
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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path as SvgPath,
  Stop,
} from "react-native-svg";
import type { FigureView, SkiaFigurePanelProps } from "./ExerciseFigure.skia";

// Load the Skia impl once, only when the native module is present, so the
// static Skia import inside it never runs on a Skia-less surface.
let SkiaPanel: React.ComponentType<SkiaFigurePanelProps> | null = null;
if (isSkiaAvailable) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SkiaPanel = require("./ExerciseFigure.skia").SkiaFigurePanel;
}

const EMBER = ["#FFC178", "#FF6A3D"] as const;
/** Muscle activation breathes over this window (ms). */
const PULSE_MS = 1500;

export interface ExerciseFigureProps {
  exerciseId?: string;
  category?: ExerciseCategory;
  /** Explicit movement override — wins over exerciseId/category resolution. */
  motion?: FigureMotion;
  /** Target muscles (as in EXERCISE_DATABASE); falls back to DB lookup by id. */
  muscles?: readonly string[];
  /** Per-panel height in px. */
  size?: number;
  /** Which orientations to show. Defaults to both (front + side). */
  views?: readonly FigureView[];
  /** Body gradient — defaults to the brand ramp. */
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_VIEWS: readonly FigureView[] = ["front", "side"];

export function ExerciseFigure({
  exerciseId,
  category,
  motion: motionOverride,
  muscles,
  size = 150,
  views = DEFAULT_VIEWS,
  gradient,
  style,
}: ExerciseFigureProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  // Default the body gradient to the theme brand ramp (orange light / gold dark).
  const grad = gradient ?? colors.brandGradient;
  const motion = useMemo(
    () => motionOverride ?? resolveFigureMotion(exerciseId, category),
    [motionOverride, exerciseId, category],
  );
  const zones = useMemo(
    () => resolveEmphasisZones({ muscles, exerciseId }),
    [muscles, exerciseId],
  );
  const loopMs = useMemo(() => getFrontProfile(motion).loopMs, [motion]);

  // One clock shared across both panels → identical rhythm, no drift.
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const animate = !!SkiaPanel && !reduced;
  useEffect(() => {
    progress.value = 0;
    pulse.value = 0;
    if (!animate) return;
    progress.value = withRepeat(
      withTiming(1, { duration: loopMs, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [animate, loopMs, progress, pulse]);

  const showLabels = views.length > 1;

  return (
    <View style={[styles.row, style]}>
      {views.map((view) => (
        <View key={view} style={styles.col}>
          {SkiaPanel ? (
            <SkiaPanel
              view={view}
              motion={motion}
              size={size}
              colors={grad}
              zones={zones}
              progress={progress}
              pulse={pulse}
            />
          ) : (
            <StaticFigure view={view} size={size} motion={motion} zones={zones} gradient={grad} />
          )}
          {showLabels && (
            <AppText variant="caption" color="tertiary" uppercase>
              {view}
            </AppText>
          )}
        </View>
      ))}
    </View>
  );
}

/* ── Static SVG fallback: top-of-rep pose with muscle emphasis, no animation ── */

function StaticFigure({
  view,
  size,
  motion,
  zones,
  gradient,
}: {
  view: FigureView;
  size: number;
  motion: FigureMotion;
  zones: readonly FigureZone[];
  gradient: readonly [string, string, ...string[]];
}) {
  const c0 = gradient[0];
  const cLast = gradient[gradient.length - 1];
  const pad = size * 0.1;
  const k = (size - pad * 2) / 100;
  const groundY = pad + 96 * k;

  const has = (z: FigureZone) => zones.includes(z);
  const hotTorsoU = has("torsoUpper");
  const hotTorsoL = has("torsoLower") || has("pelvis");
  const hotShoulder = has("shoulder");
  const hotUpperArm = has("upperArm");
  const hotForeArm = has("foreArm");
  const hotThigh = has("thigh");
  const hotShin = has("shin");

  const seg = (a: [number, number], b: [number, number]) => `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  let panelW: number;
  let body: string;
  let torso = "";
  let torsoMass = "";
  let head: [number, number];
  let emphTorso = "";
  let emphArm = "";
  let emphLeg = "";
  let joints: [number, number][];
  let feet: [number, number][];

  if (view === "front") {
    panelW = size * 0.86;
    const cx = panelW / 2;
    const f = getFrontProfile(motion).frames[0];
    const R = (i: number): [number, number] => [cx + (f[i * 2] - 50) * k, pad + f[i * 2 + 1] * k];
    const L = (i: number): [number, number] => [cx + (50 - f[i * 2]) * k, pad + f[i * 2 + 1] * k];
    const hd = R(0), ch = R(1), pv = R(2);
    const shR = R(3), elR = R(4), haR = R(5), hipR = R(6), knR = R(7), ftR = R(8);
    const shL = L(3), elL = L(4), haL = L(5), hipL = L(6), knL = L(7), ftL = L(8);
    head = hd;
    // Volumetric torso: shoulders → pinched waist → hips.
    const hipHalf = Math.abs(hipR[0] - hipL[0]) / 2;
    const waistHalf = hipHalf * 0.8;
    const waistY = (ch[1] + pv[1]) / 2;
    torsoMass =
      `M${shL[0]},${shL[1]} L${shR[0]},${shR[1]} ` +
      `Q${ch[0] + waistHalf},${waistY} ${hipR[0]},${hipR[1]} ` +
      `L${hipL[0]},${hipL[1]} ` +
      `Q${ch[0] - waistHalf},${waistY} ${shL[0]},${shL[1]} Z`;
    body =
      `M${hd[0]},${hd[1]} L${ch[0]},${ch[1]} ` +
      `M${ch[0]},${ch[1]} L${shR[0]},${shR[1]} L${elR[0]},${elR[1]} L${haR[0]},${haR[1]} ` +
      `M${ch[0]},${ch[1]} L${shL[0]},${shL[1]} L${elL[0]},${elL[1]} L${haL[0]},${haL[1]} ` +
      `M${pv[0]},${pv[1]} L${hipR[0]},${hipR[1]} L${knR[0]},${knR[1]} L${ftR[0]},${ftR[1]} ` +
      `M${pv[0]},${pv[1]} L${hipL[0]},${hipL[1]} L${knL[0]},${knL[1]} L${ftL[0]},${ftL[1]}`;
    const m = mid(ch, pv);
    if (hotTorsoU) emphTorso += seg(ch, m) + " ";
    if (hotTorsoL) emphTorso += seg(m, pv) + " ";
    if (hotUpperArm) emphArm += seg(shR, elR) + " " + seg(shL, elL) + " ";
    if (hotForeArm) emphArm += seg(elR, haR) + " " + seg(elL, haL) + " ";
    if (hotShoulder) emphArm += seg(shR, mid(shR, elR)) + " " + seg(shL, mid(shL, elL)) + " ";
    if (hotThigh) emphLeg += seg(hipR, knR) + " " + seg(hipL, knL) + " ";
    if (hotShin) emphLeg += seg(knR, ftR) + " " + seg(knL, ftL) + " ";
    joints = [shR, elR, hipR, knR, shL, elL, hipL, knL];
    feet = [ftR, ftL];
  } else {
    panelW = size * 0.7;
    const cx = panelW / 2;
    const f = getSideProfile(motion).frames[0];
    const N = (i: number): [number, number] => [cx + (f[i * 2] - 50) * k, pad + f[i * 2 + 1] * k];
    const hd = N(0), sh = N(1), el = N(2), ha = N(3), hip = N(4), kn = N(5), ft = N(6);
    head = hd;
    torso = seg(sh, hip);
    body =
      `M${hd[0]},${hd[1]} L${sh[0]},${sh[1]} L${hip[0]},${hip[1]} ` +
      `M${sh[0]},${sh[1]} L${el[0]},${el[1]} L${ha[0]},${ha[1]} ` +
      `M${hip[0]},${hip[1]} L${kn[0]},${kn[1]} L${ft[0]},${ft[1]}`;
    const m = mid(sh, hip);
    if (hotTorsoU) emphTorso += seg(sh, m) + " ";
    if (hotTorsoL) emphTorso += seg(m, hip) + " ";
    if (hotUpperArm) emphArm += seg(sh, el) + " ";
    if (hotForeArm) emphArm += seg(el, ha) + " ";
    if (hotShoulder) emphArm += seg(sh, mid(sh, el)) + " ";
    if (hotThigh) emphLeg += seg(hip, kn) + " ";
    if (hotShin) emphLeg += seg(kn, ft) + " ";
    joints = [sh, el, hip, kn];
    feet = [ft];
  }

  const shadowCx = feet.reduce((s, p) => s + p[0], 0) / feet.length;
  const gid = `fig-${view}`;

  return (
    <Svg width={panelW} height={size} viewBox={`0 0 ${panelW} ${size}`}>
      <Defs>
        <SvgGradient id={gid} x1="0" y1={pad} x2="0" y2={pad + 100 * k} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c0} />
          <Stop offset="1" stopColor={cLast} />
        </SvgGradient>
        <SvgGradient id={`${gid}-e`} x1="0" y1={pad} x2="0" y2={pad + 100 * k} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={EMBER[0]} />
          <Stop offset="1" stopColor={EMBER[1]} />
        </SvgGradient>
      </Defs>
      {/* contact shadow */}
      <SvgPath
        d={`M${shadowCx - 15 * k},${groundY} a${15 * k},${2.4 * k} 0 1,0 ${30 * k},0 a${15 * k},${2.4 * k} 0 1,0 ${-30 * k},0`}
        fill={cLast}
        opacity={0.14}
      />
      {torsoMass ? <SvgPath d={torsoMass} fill={`url(#${gid})`} /> : null}
      {torso ? <SvgPath d={torso} stroke={`url(#${gid})`} strokeWidth={15 * k} strokeLinecap="round" fill="none" /> : null}
      <SvgPath d={body} stroke={`url(#${gid})`} strokeWidth={9.5 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={head[0]} cy={head[1]} r={8.5 * k} fill={`url(#${gid})`} />
      {emphLeg ? <SvgPath d={emphLeg} stroke={`url(#${gid}-e)`} strokeWidth={6.3 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85} /> : null}
      {emphTorso ? <SvgPath d={emphTorso} stroke={`url(#${gid}-e)`} strokeWidth={8.7 * k} strokeLinecap="round" fill="none" opacity={0.85} /> : null}
      {emphArm ? <SvgPath d={emphArm} stroke={`url(#${gid}-e)`} strokeWidth={4.6 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85} /> : null}
      {joints.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={2.1 * k} fill="#FFFFFF" opacity={0.32} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: Spacing.md },
  col: { alignItems: "center", gap: 4 },
});
