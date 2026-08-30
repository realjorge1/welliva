/**
 * SessionRing.skia — the workout player's instrument (Skia impl).
 *
 * The demoted, rebuilt SessionCore. The old cell was the hero of the stage, and
 * an abstract shape cannot carry a stage; the demonstration figure can. So the
 * instrument became the FRAME around the figure — and in exchange for the
 * centre of the screen it got sharper, because a ring that only shows one
 * number is decoration.
 *
 * This one carries the shape of the exercise at a glance:
 *
 *   · the ring is cut into ONE ARC PER SET, with real gaps between them —
 *     finished sets stay lit, the live set fills, the sets to come sit dim, so
 *     "set 3 of 5" is legible without reading a word;
 *   · a comet rides the leading edge of the live arc — where you are, right now;
 *   · a machined graduation band inside the arcs gives the thing its precision;
 *   · four reticle brackets turn slowly, so the instrument is alive at rest;
 *   · a halo behind it brightens with the charge and breathes on rest;
 *   · and when the box runs out, a gold OVERTIME hand sweeps the outside on a
 *     60-second loop, so "+0:24" is something you can read from the floor.
 *
 * Colour is still the phase language inherited from the cell: brand while you
 * work, gold on overtime and completion, water on rest.
 *
 * Every path is built ONCE per (size, sets) and animated with trims, matrices
 * and opacities. There is no per-frame path construction in this file — that is
 * what keeps the player at 60fps while the JS thread services a session tick.
 *
 * Loaded lazily (only when isSkiaAvailable), so the static Skia import here is
 * never evaluated on a surface without the native module.
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
  type EasingFunction,
} from "react-native-reanimated";

export interface SkiaSessionRingProps {
  /** 0–1 through the CURRENT segment. */
  progress: number;
  /** How many segments the ring is cut into — one per set. */
  segments: number;
  /** Which segment is live, 1-based. */
  currentSegment: number;
  size: number;
  colors: readonly [string, string, ...string[]];
  /** Seconds past the work box. Drives the gold hand on the outside. */
  overtimeSeconds?: number;
  /** Breathe the halo (rest / final push). */
  pulse?: boolean;
  duration?: number;
  /** Linear travel for clock-driven phases; eased for discrete jumps. */
  linear?: boolean;
}

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
/** One full turn of the reticle. */
const SPIN_MS = 18000;
/** One full sweep of the overtime hand. */
const OVERTIME_LOOP_SEC = 60;
/** Graduations in the machined band. */
const TICKS = 60;

export function SkiaSessionRing({
  progress,
  segments,
  currentSegment,
  size,
  colors,
  overtimeSeconds = 0,
  pulse = false,
  duration = 560,
  linear = false,
}: SkiaSessionRingProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const count = Math.max(1, Math.round(segments));
  const liveIndex = Math.max(0, Math.min(count - 1, Math.round(currentSegment) - 1));

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;
  const arcR = R * 0.93;
  const handR = R * 0.995;
  const tickOuter = R * 0.865;
  const tickInner = R * 0.835;
  const innerR = R * 0.8;
  const arcW = size * 0.026;

  const c0 = colors[0];
  const cMid = colors[Math.floor(colors.length / 2)] ?? c0;
  const cDeep = colors[colors.length - 1];

  /* ── Segment geometry ────────────────────────────────────────────────── */

  const step = 360 / count;
  // The gap has to stay visible on a two-set ring and stay out of the way on a
  // six-set one, so it shrinks with the segment instead of being a constant.
  const gapDeg = count > 1 ? Math.min(7, 34 / count) : 0;
  const sweepDeg = step - gapDeg;
  const startDeg = (i: number) => -90 + i * step + gapDeg / 2;

  /* ── Clocks ──────────────────────────────────────────────────────────── */

  const charge = useSharedValue(reduced ? clamped : 0);
  useEffect(() => {
    if (reduced) {
      charge.value = clamped;
      return;
    }
    const easing: EasingFunction = linear ? Easing.linear : Easing.out(Easing.cubic);
    charge.value = withTiming(clamped, { duration, easing });
  }, [clamped, duration, linear, reduced, charge]);

  // The overtime hand travels linearly on the same 1Hz cadence the clock does,
  // so it glides between ticks instead of stepping once a second.
  const overtimeFrac = (overtimeSeconds % OVERTIME_LOOP_SEC) / OVERTIME_LOOP_SEC;
  const over = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      over.value = overtimeFrac;
      return;
    }
    // Wrapping past the minute must not animate BACKWARDS around the dial.
    if (overtimeFrac < over.value) over.value = 0;
    over.value = withTiming(overtimeFrac, { duration: 1000, easing: Easing.linear });
  }, [overtimeFrac, reduced, over]);

  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
  }, [reduced, spin]);

  useEffect(() => {
    if (reduced || !pulse) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 400 });
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [pulse, reduced, breath]);

  /* ── Static geometry, built once per (size, segment count) ───────────── */

  const geo = useMemo(() => {
    const arcRect = Skia.XYWHRect(cx - arcR, cy - arcR, arcR * 2, arcR * 2);
    const handRect = Skia.XYWHRect(cx - handR, cy - handR, handR * 2, handR * 2);

    // One path per set. Built separately (rather than as subpaths of a single
    // path) because the live one has to be trimmed on its own.
    const segs = Array.from({ length: count }, (_, i) => {
      const p = Skia.Path.Make();
      p.addArc(arcRect, startDeg(i), count === 1 ? 359.9 : sweepDeg);
      return p;
    });

    const ticks = Skia.Path.Make();
    for (let i = 0; i < TICKS; i++) {
      const a = -Math.PI / 2 + (i / TICKS) * TWO_PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const major = i % 5 === 0;
      const rIn = major ? tickInner - size * 0.018 : tickInner;
      ticks.moveTo(cx + rIn * c, cy + rIn * s);
      ticks.lineTo(cx + tickOuter * c, cy + tickOuter * s);
    }

    const reticle = Skia.Path.Make();
    for (let i = 0; i < 4; i++) reticle.addArc(handRect, -68 + i * 90, 26);

    const hand = Skia.Path.Make();
    hand.addArc(handRect, -90, 359.9);

    const inner = Skia.Path.Make();
    inner.addCircle(cx, cy, innerR);

    return { segs, ticks, reticle, hand, inner };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, count]);

  /* ── Animated bindings ───────────────────────────────────────────────── */

  // A trimmed path is only ever asked for a non-degenerate slice, and the arc
  // above it fades out — so an empty set shows nothing at all rather than a
  // round stroke-cap dot parked at the segment's start.
  const trim = useDerivedValue(() => {
    "worklet";
    return Math.max(0.004, charge.value);
  }, [charge]);
  const liveOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, Math.max(0, charge.value / 0.02));
  }, [charge]);

  const liveStart = startDeg(liveIndex);
  const liveSweep = count === 1 ? 359.9 : sweepDeg;

  const cometX = useDerivedValue(() => {
    "worklet";
    return cx + arcR * Math.cos((liveStart + charge.value * liveSweep) * DEG);
  }, [charge, cx, arcR, liveStart, liveSweep]);
  const cometY = useDerivedValue(() => {
    "worklet";
    return cy + arcR * Math.sin((liveStart + charge.value * liveSweep) * DEG);
  }, [charge, cy, arcR, liveStart, liveSweep]);
  const cometOpacity = useDerivedValue(() => {
    "worklet";
    return charge.value > 0.02 && charge.value < 0.995 ? 1 : 0;
  }, [charge]);

  const handTrim = useDerivedValue(() => {
    "worklet";
    return Math.max(0.002, over.value);
  }, [over]);
  const handX = useDerivedValue(() => {
    "worklet";
    return cx + handR * Math.cos((-90 + over.value * 360) * DEG);
  }, [over, cx, handR]);
  const handY = useDerivedValue(() => {
    "worklet";
    return cy + handR * Math.sin((-90 + over.value * 360) * DEG);
  }, [over, cy, handR]);

  const reticleXf = useDerivedValue(() => {
    "worklet";
    return [{ rotate: spin.value * TWO_PI }];
  }, [spin]);

  const haloOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, (0.24 + 0.4 * charge.value) * (0.82 + 0.18 * breath.value));
  }, [charge, breath]);
  const haloXf = useDerivedValue(() => {
    "worklet";
    return [{ scale: 1 + 0.035 * breath.value }];
  }, [breath]);

  const center = vec(cx, cy);
  const showHand = overtimeSeconds > 0;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Halo — the field the figure stands in, brightening with the charge. */}
      <Group transform={haloXf} origin={center} opacity={haloOpacity}>
        <Circle cx={cx} cy={cy} r={R * 0.84}>
          <RadialGradient
            c={center}
            r={R * 0.84}
            colors={[alpha(cMid, 0.2), alpha(cMid, 0.07), "transparent"]}
            positions={[0, 0.62, 1]}
          />
          <BlurMask blur={size * 0.05} style="normal" />
        </Circle>
      </Group>

      {/* The stage the figure occupies — one hairline, nothing more. */}
      <Path
        path={geo.inner}
        style="stroke"
        strokeWidth={Math.max(0.6, size * 0.0028)}
        color={alpha(cMid, 0.16)}
      />

      {/* Machined graduation band — texture, not a second signal. */}
      <Path
        path={geo.ticks}
        style="stroke"
        strokeWidth={size * 0.0075}
        strokeCap="round"
        color={alpha(cMid, 0.16)}
      />

      {/* One arc per set: the track, and the sets already banked. */}
      {geo.segs.map((p, i) => (
        <Path
          key={`track-${i}`}
          path={p}
          style="stroke"
          strokeWidth={arcW}
          strokeCap="round"
          color={alpha(cMid, i < liveIndex ? 0.9 : 0.13)}
        />
      ))}

      {/* The live set — a soft bloom under a crisp edge. */}
      <Group opacity={liveOpacity}>
        <Path
          path={geo.segs[liveIndex]}
          style="stroke"
          strokeWidth={arcW * 1.8}
          strokeCap="round"
          start={0}
          end={trim}
          opacity={0.4}
        >
          <SweepGradient c={center} start={-90} end={270} colors={[c0, cMid, cDeep, c0]} />
          <BlurMask blur={size * 0.03} style="normal" />
        </Path>
        <Path
          path={geo.segs[liveIndex]}
          style="stroke"
          strokeWidth={arcW}
          strokeCap="round"
          start={0}
          end={trim}
        >
          <SweepGradient c={center} start={-90} end={270} colors={[c0, cMid, cDeep, c0]} />
        </Path>
      </Group>

      {/* Comet on the leading edge — where the set is, right now. */}
      <Group opacity={cometOpacity}>
        <Circle cx={cometX} cy={cometY} r={size * 0.042} color={alpha(c0, 0.5)}>
          <BlurMask blur={size * 0.024} style="normal" />
        </Circle>
        <Circle cx={cometX} cy={cometY} r={size * 0.02} color="#FFFFFF" />
        <Circle cx={cometX} cy={cometY} r={size * 0.011} color={cDeep} />
      </Group>

      {/* Overtime hand — the box is spent and the clock is still running. */}
      {showHand && (
        <Group>
          <Path
            path={geo.hand}
            style="stroke"
            strokeWidth={size * 0.009}
            strokeCap="round"
            start={0}
            end={handTrim}
            color={alpha(c0, 0.85)}
          />
          <Circle cx={handX} cy={handY} r={size * 0.016} color={c0} />
        </Group>
      )}

      {/* Reticle — a slow turn that keeps the instrument alive at rest. */}
      <Group transform={reticleXf} origin={center} opacity={0.28}>
        <Path
          path={geo.reticle}
          style="stroke"
          strokeWidth={Math.max(1, size * 0.005)}
          strokeCap="round"
          color={alpha(c0, 0.75)}
        />
      </Group>
    </Canvas>
  );
}
