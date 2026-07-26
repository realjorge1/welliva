/**
 * TrainingGauge.skia — the workout HUD instrument (Skia impl).
 *
 * A Mercedes-Benz digital-cluster gauge: a 270° ring of graduated tick marks
 * that light up in a brand-cyan sweep as progress fills, a glowing "needle
 * head" riding the leading edge, and a soft radial core glow that breathes.
 * It is the single hero of every session phase — countdown charges it up, the
 * active set fills it with reps/seconds, rest drains it, completion floods it
 * gold. Pure Skia shapes, zero assets.
 *
 * All motion lives on the UI thread: one animated `progress` shared value
 * drives the lit ticks (a path rebuilt per-frame in a worklet, exactly like
 * ExerciseFigure), the needle head transform and the glow — so the dial stays
 * glassy-smooth even while the JS thread services a session tick.
 *
 * Loaded lazily (only when isSkiaAvailable), so this file's static Skia import
 * is safe: it is never evaluated on a surface without the native module.
 */
import { alpha } from "@/constants/theme";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useMemo } from "react";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface SkiaTrainingGaugeProps {
  /** 0–1 fill. */
  progress: number;
  size: number;
  /** Sweep ramp for the lit ticks + needle head. */
  colors: readonly [string, string, ...string[]];
  /** Dim graduation color for the unlit track. */
  track: string;
  /** Breathe the core glow (rest / final-push states). */
  pulse?: boolean;
  /** Sweep animation duration in ms. */
  duration?: number;
}

// Gap centered at the bottom (6 o'clock): start bottom-left, sweep clockwise.
const START_DEG = 135;
const SWEEP_DEG = 270;
const DEG2RAD = Math.PI / 180;
const START = START_DEG * DEG2RAD;
const SWEEP = SWEEP_DEG * DEG2RAD;
const TICKS = 60;

export function SkiaTrainingGauge({
  progress,
  size,
  colors,
  track,
  pulse = false,
  duration = 620,
}: SkiaTrainingGaugeProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress || 0));

  // ── Geometry (all on the JS thread, captured into the worklets below) ──
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - size * 0.02;
  const minorLen = size * 0.058;
  const majorLen = size * 0.095;
  const minorInnerR = outerR - minorLen;
  const majorInnerR = outerR - majorLen;
  const tickW = Math.max(2, size * 0.013);
  const majorW = Math.max(2.5, size * 0.02);
  const headOrbit = outerR - minorLen * 0.5;
  const headR = size * 0.032;

  // ── Animated fill ──
  const value = useSharedValue(reduced ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      value.value = clamped;
      return;
    }
    value.value = withTiming(clamped, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, duration, reduced, value]);

  // ── Breathing pulse for the core glow ──
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced || !pulse) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [pulse, reduced, breath]);

  // ── Static dim graduation ring (built once) ──
  const dimTicks = useMemo(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < TICKS; i++) {
      const a = START + (i / (TICKS - 1)) * SWEEP;
      const major = i % 6 === 0;
      const rIn = major ? majorInnerR : minorInnerR;
      const c = Math.cos(a);
      const s = Math.sin(a);
      path.moveTo(cx + rIn * c, cy + rIn * s);
      path.lineTo(cx + outerR * c, cy + outerR * s);
    }
    return path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // ── Lit graduation — only the ticks up to the current fill, rebuilt each
  //    frame on the UI thread (cheap: ≤60 short segments). ──
  const litTicks = useDerivedValue(() => {
    "worklet";
    const p = value.value;
    const path = Skia.Path.Make();
    const litCount = Math.round(p * TICKS);
    for (let i = 0; i < litCount; i++) {
      const a = START + (i / (TICKS - 1)) * SWEEP;
      const major = i % 6 === 0;
      const rIn = major ? majorInnerR : minorInnerR;
      const c = Math.cos(a);
      const s = Math.sin(a);
      path.moveTo(cx + rIn * c, cy + rIn * s);
      path.lineTo(cx + outerR * c, cy + outerR * s);
    }
    return path;
  });

  // ── Needle head riding the leading edge ──
  const headCx = useDerivedValue(() => {
    "worklet";
    return cx + headOrbit * Math.cos(START + value.value * SWEEP);
  });
  const headCy = useDerivedValue(() => {
    "worklet";
    return cy + headOrbit * Math.sin(START + value.value * SWEEP);
  });
  const headOpacity = useDerivedValue(() => {
    "worklet";
    // Hide the head at the very start / very end so it reads as a live cursor.
    return value.value > 0.02 && value.value < 0.999 ? 1 : 0;
  });

  // ── Core glow: brightens with fill, breathes when asked ──
  const glowOpacity = useDerivedValue(() => {
    "worklet";
    const base = 0.22 + 0.5 * value.value;
    const b = 0.78 + 0.22 * breath.value;
    return Math.min(1, base * b);
  });
  const glowTransform = useDerivedValue(() => {
    "worklet";
    const s = 1 + 0.05 * breath.value;
    return [{ scale: s }];
  });

  const c0 = colors[0];
  const cLast = colors[colors.length - 1];
  const cMid = colors[Math.floor(colors.length / 2)] ?? c0;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Core glow */}
      <Group
        transform={glowTransform}
        origin={vec(cx, cy)}
        opacity={glowOpacity}
      >
        <Circle cx={cx} cy={cy} r={outerR * 0.82}>
          <RadialGradient
            c={vec(cx, cy)}
            r={outerR * 0.82}
            colors={[alpha(cMid, 0.5), alpha(cMid, 0.12), "transparent"]}
            positions={[0, 0.55, 1]}
          />
          <BlurMask blur={size * 0.05} style="normal" />
        </Circle>
      </Group>

      {/* Dim graduation */}
      <Path
        path={dimTicks}
        style="stroke"
        strokeWidth={tickW}
        strokeCap="round"
        color={track}
      />

      {/* Lit graduation — soft glow underlay then the crisp sweep */}
      <Group>
        <Path
          path={litTicks}
          style="stroke"
          strokeWidth={majorW}
          strokeCap="round"
        >
          <SweepGradient
            c={vec(cx, cy)}
            start={START_DEG}
            end={START_DEG + SWEEP_DEG}
            colors={[c0, cMid, cLast]}
          />
          <BlurMask blur={size * 0.028} style="normal" />
        </Path>
        <Path
          path={litTicks}
          style="stroke"
          strokeWidth={tickW}
          strokeCap="round"
        >
          <SweepGradient
            c={vec(cx, cy)}
            start={START_DEG}
            end={START_DEG + SWEEP_DEG}
            colors={[c0, cMid, cLast]}
          />
        </Path>
      </Group>

      {/* Needle head */}
      <Group opacity={headOpacity}>
        <Circle cx={headCx} cy={headCy} r={headR * 1.7} color={alpha(cLast, 0.45)}>
          <BlurMask blur={size * 0.03} style="normal" />
        </Circle>
        <Circle cx={headCx} cy={headCy} r={headR} color="#FFFFFF" />
        <Circle cx={headCx} cy={headCy} r={headR * 0.55} color={cLast} />
      </Group>
    </Canvas>
  );
}
