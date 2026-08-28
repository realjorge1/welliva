/**
 * SessionCore.skia — the workout player's hero instrument (Skia impl).
 *
 * NOT a speedometer. A charged ENERGY CELL: a containment ring of graduated
 * micro-ticks, a fluid core that fills with two counter-drifting waves as the
 * set builds, a trimmed progress arc with a comet riding its leading edge, and
 * a slow-turning reticle. Countdown drains it, a set fills it, rest empties it
 * again, completion floods it gold — one continuous instrument the athlete
 * never loses track of, rather than a dial that resets every phase.
 *
 * Every element is built ONCE and animated with matrices, trims and opacities.
 * There is no per-frame path construction anywhere in this file: that is what
 * keeps the player at 60fps while the JS thread services a session tick, and
 * what stops the old renderer's native-object churn from killing the app.
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
  LinearGradient,
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

export interface SkiaSessionCoreProps {
  /** 0–1 charge level. */
  progress: number;
  size: number;
  /** Ramp for the fluid, the arc and the comet. */
  colors: readonly [string, string, ...string[]];
  /** Breathe the containment field (rest / final push). */
  pulse?: boolean;
  /** How long the charge takes to reach a new level, in ms. */
  duration?: number;
  /** Linear travel for clock-driven phases; eased for discrete rep bumps. */
  linear?: boolean;
}

const TICKS = 72;
const TWO_PI = Math.PI * 2;
/** One full turn of the reticle. */
const SPIN_MS = 16000;
/** One wavelength of drift for the fluid surface. */
const DRIFT_MS = 3400;

export function SkiaSessionCore({
  progress,
  size,
  colors,
  pulse = false,
  duration = 560,
  linear = false,
}: SkiaSessionCoreProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress || 0));

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;
  const arcR = R * 0.93;
  const tickOuter = R * 0.83;
  const tickInner = R * 0.775;
  const cellR = R * 0.665;
  const reticleR = R * 0.995;
  const arcW = size * 0.026;
  const tickW = size * 0.013;
  const wavelength = size * 0.58;

  const c0 = colors[0];
  const cMid = colors[Math.floor(colors.length / 2)] ?? c0;
  const cDeep = colors[colors.length - 1];

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

  const drift = useSharedValue(0);
  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.linear }),
      -1,
      false,
    );
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(drift);
      cancelAnimation(spin);
    };
  }, [reduced, drift, spin]);

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

  /* ── Static geometry, built once per size ────────────────────────────── */

  const geo = useMemo(() => {
    // Progress arc + tick ring both start at 12 o'clock and run clockwise, so
    // trimming them with the same value keeps them locked together.
    const arcRect = Skia.XYWHRect(cx - arcR, cy - arcR, arcR * 2, arcR * 2);
    const arc = Skia.Path.Make();
    arc.addArc(arcRect, -90, 359.9);

    const ticks = Skia.Path.Make();
    for (let i = 0; i < TICKS; i++) {
      const a = -Math.PI / 2 + (i / TICKS) * TWO_PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const major = i % 6 === 0;
      const rIn = major ? tickInner - size * 0.022 : tickInner;
      ticks.moveTo(cx + rIn * c, cy + rIn * s);
      ticks.lineTo(cx + tickOuter * c, cy + tickOuter * s);
    }

    const cell = Skia.Path.Make();
    cell.addCircle(cx, cy, cellR);

    // Containment lattice: hairline spokes + rings inside the cell. Quiet
    // structure that makes the fluid read as held inside something built.
    const lattice = Skia.Path.Make();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TWO_PI;
      lattice.moveTo(cx, cy);
      lattice.lineTo(cx + cellR * Math.cos(a), cy + cellR * Math.sin(a));
    }
    for (const f of [0.4, 0.72]) {
      lattice.addCircle(cx, cy, cellR * f);
    }

    // Four reticle brackets riding just outside the tick ring.
    const reticle = Skia.Path.Make();
    const rRect = Skia.XYWHRect(
      cx - reticleR,
      cy - reticleR,
      reticleR * 2,
      reticleR * 2,
    );
    for (let i = 0; i < 4; i++) {
      reticle.addArc(rRect, -68 + i * 90, 26);
    }

    // The fluid surface: one long sine run, filled downward. It is translated
    // rather than rebuilt, which is why the wave costs nothing per frame.
    const buildWave = (amp: number, phase: number, closed: boolean) => {
      const p = Skia.Path.Make();
      const from = -wavelength;
      const to = size + wavelength * 2;
      const step = wavelength / 14;
      p.moveTo(from, Math.sin((from / wavelength) * TWO_PI + phase) * amp);
      for (let x = from + step; x <= to; x += step) {
        p.lineTo(x, Math.sin((x / wavelength) * TWO_PI + phase) * amp);
      }
      if (closed) {
        p.lineTo(to, size * 1.6);
        p.lineTo(from, size * 1.6);
        p.close();
      }
      return p;
    };

    return {
      arc,
      ticks,
      cell,
      lattice,
      reticle,
      waveBack: buildWave(size * 0.019, 0, true),
      waveFront: buildWave(size * 0.014, Math.PI * 0.65, true),
      crest: buildWave(size * 0.014, Math.PI * 0.65, false),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  /* ── Animated bindings ───────────────────────────────────────────────── */

  // A trimmed path is only ever asked for a non-degenerate slice, and the whole
  // ring fades out under it — so an empty charge shows nothing at all rather
  // than a round stroke-cap dot parked at 12 o'clock.
  const trim = useDerivedValue(() => {
    "worklet";
    return Math.max(0.004, charge.value);
  }, [charge]);
  const litOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, Math.max(0, charge.value / 0.012));
  }, [charge]);

  const surfaceTop = cy - cellR;
  const cellSpan = cellR * 2;

  const waveBackXf = useDerivedValue(() => {
    "worklet";
    return [
      { translateX: -drift.value * wavelength },
      { translateY: surfaceTop + (1 - charge.value) * cellSpan },
    ];
  }, [drift, charge, wavelength, surfaceTop, cellSpan]);

  const waveFrontXf = useDerivedValue(() => {
    "worklet";
    return [
      { translateX: drift.value * wavelength * 0.72 },
      { translateY: surfaceTop + (1 - charge.value) * cellSpan },
    ];
  }, [drift, charge, wavelength, surfaceTop, cellSpan]);

  const cometX = useDerivedValue(() => {
    "worklet";
    return cx + arcR * Math.cos(-Math.PI / 2 + charge.value * TWO_PI);
  }, [charge, cx, arcR]);
  const cometY = useDerivedValue(() => {
    "worklet";
    return cy + arcR * Math.sin(-Math.PI / 2 + charge.value * TWO_PI);
  }, [charge, cy, arcR]);
  const cometOpacity = useDerivedValue(() => {
    "worklet";
    return charge.value > 0.012 && charge.value < 0.995 ? 1 : 0;
  }, [charge]);

  const reticleXf = useDerivedValue(() => {
    "worklet";
    return [{ rotate: spin.value * TWO_PI }];
  }, [spin]);

  const auraOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, (0.2 + 0.55 * charge.value) * (0.8 + 0.2 * breath.value));
  }, [charge, breath]);
  const auraXf = useDerivedValue(() => {
    "worklet";
    return [{ scale: 1 + 0.05 * breath.value }];
  }, [breath]);

  const center = vec(cx, cy);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Aura — the field around the cell, brightening as it charges. */}
      <Group transform={auraXf} origin={center} opacity={auraOpacity}>
        <Circle cx={cx} cy={cy} r={R * 0.86}>
          <RadialGradient
            c={center}
            r={R * 0.86}
            colors={[alpha(cMid, 0.34), alpha(cMid, 0.09), "transparent"]}
            positions={[0, 0.58, 1]}
          />
          <BlurMask blur={size * 0.05} style="normal" />
        </Circle>
      </Group>

      {/* The cell: lattice, fluid, rim. Everything inside is clipped to it. */}
      <Group clip={geo.cell}>
        <Circle cx={cx} cy={cy} r={cellR} color={alpha(cDeep, 0.16)} />
        <Path
          path={geo.lattice}
          style="stroke"
          strokeWidth={Math.max(0.6, size * 0.0035)}
          color={alpha(c0, 0.14)}
        />
        <Group transform={waveBackXf}>
          <Path path={geo.waveBack} color={alpha(cDeep, 0.42)} />
        </Group>
        <Group transform={waveFrontXf}>
          <Path path={geo.waveFront}>
            {/* Anchored to the surface (local y = 0) so the fluid always reads
                brightest at the waterline, however far the cell has filled. */}
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, cellSpan)}
              colors={[alpha(c0, 0.72), alpha(cMid, 0.3)]}
            />
          </Path>
          <Path
            path={geo.crest}
            style="stroke"
            strokeWidth={Math.max(1, size * 0.007)}
            color={alpha(c0, 0.9)}
          />
        </Group>
      </Group>
      <Circle
        cx={cx}
        cy={cy}
        r={cellR}
        style="stroke"
        strokeWidth={Math.max(1, size * 0.006)}
        color={alpha(c0, 0.34)}
      />

      {/* Graduated containment ring — dim throughout, lit up to the charge. */}
      <Path
        path={geo.ticks}
        style="stroke"
        strokeWidth={tickW}
        strokeCap="round"
        color={alpha(cMid, 0.17)}
      />
      <Group opacity={litOpacity}>
        <Path
          path={geo.ticks}
          style="stroke"
          strokeWidth={tickW}
          strokeCap="round"
          start={0}
          end={trim}
        >
          <SweepGradient
            c={center}
            start={-90}
            end={270}
            colors={[c0, cMid, cDeep, c0]}
          />
        </Path>
      </Group>

      {/* Progress arc — a soft bloom under a crisp edge. */}
      <Group opacity={litOpacity}>
        <Path
          path={geo.arc}
          style="stroke"
          strokeWidth={arcW * 1.7}
          strokeCap="round"
          start={0}
          end={trim}
          opacity={0.45}
        >
          <SweepGradient c={center} start={-90} end={270} colors={[c0, cMid, cDeep, c0]} />
          <BlurMask blur={size * 0.03} style="normal" />
        </Path>
        <Path
          path={geo.arc}
          style="stroke"
          strokeWidth={arcW}
          strokeCap="round"
          start={0}
          end={trim}
        >
          <SweepGradient c={center} start={-90} end={270} colors={[c0, cMid, cDeep, c0]} />
        </Path>
      </Group>

      {/* Comet riding the leading edge — where the set is, right now. */}
      <Group opacity={cometOpacity}>
        <Circle cx={cometX} cy={cometY} r={size * 0.05} color={alpha(c0, 0.5)}>
          <BlurMask blur={size * 0.028} style="normal" />
        </Circle>
        <Circle cx={cometX} cy={cometY} r={size * 0.024} color="#FFFFFF" />
        <Circle cx={cometX} cy={cometY} r={size * 0.013} color={cDeep} />
      </Group>

      {/* Reticle — a slow turn that keeps the instrument alive at rest. */}
      <Group transform={reticleXf} origin={center} opacity={0.32}>
        <Path
          path={geo.reticle}
          style="stroke"
          strokeWidth={Math.max(1, size * 0.006)}
          strokeCap="round"
          color={alpha(c0, 0.75)}
        />
      </Group>
    </Canvas>
  );
}
