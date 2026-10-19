/**
 * SessionRing.skia — the workout player's instrument (Skia impl).
 *
 * The FRAME around the demonstration figure. It carries the shape of the
 * exercise at a glance — one arc per set, banked sets lit, the live set filling,
 * the sets to come sitting in the track — and when the box runs out, a gold
 * OVERTIME hand sweeps the outside on a 60-second loop, so "+0:24" is something
 * you can read from the floor.
 *
 * ── REBUILT 2026-10-16: A CHUNKY OBJECT, NOT A HAIRLINE ─────────────────────
 *
 * The owner: "the ring that circles while exercise progress seems rather
 * basic." It was: a 2.6%-of-size stroke (≈7pt), and everything that was meant
 * to give it depth — a graduation band, reticle brackets, a bloom — drawn at
 * 13–28% opacity, so on the phone it read as one thin line. It now speaks the
 * language the flame, the badges and the session button speak:
 *
 *   · CHUNKY, FLAT, WITH A LIP. A thick band in one flat colour, sitting on a
 *     darker LIP offset below it — so the ring reads as a raised object, the
 *     way the struck badges and the primary button do — and ONE stroke of
 *     shine along it. No gradients, no glow on the band.
 *   · A KNOB rides the leading edge of the live set: white, with the phase
 *     colour at its heart and a soft light under it. Where you are, now.
 *   · THE SETS YOU'VE BANKED POP IN, one after another, every time a set
 *     starts — a beat of "look how far you've come" before the work, rather
 *     than a ring that simply redraws.
 *   · A BEAT in the last seconds of the box: the knob (or, in overtime, the
 *     gold hand's tip) thumps once a second. The clock says how long; the ring
 *     says NOW.
 *   · A still plate behind the figure, in place of the hairline, so the figure
 *     stands ON something.
 *
 * Colour is still the phase language: brand while you work, gold on overtime
 * and the final push, water on rest.
 *
 * MEMORY. Every path is built ONCE per (size, sets) and animated with
 * matrices, trims and opacities — except the live arc and its shine, rebuilt
 * on the UI thread each frame and marked VOLATILE. That is not optional: a
 * path whose geometry changes every frame gets a new GPU cache entry every
 * frame unless it is volatile, and with a blur on it that filled the GPU
 * cache and got the app killed a minute into a session (2026-10-16). Nothing
 * blurred here changes shape per frame; the only blurs are on circles.
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
  withSequence,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from "react-native-reanimated";
import { ringGeometry, ringPalette } from "./sessionRingStyle";

export interface SkiaSessionRingProps {
  /** 0–1 through the CURRENT segment. */
  progress: number;
  /** How many segments the ring is cut into — one per set. */
  segments: number;
  /** Which segment is live, 1-based. */
  currentSegment: number;
  size: number;
  colors: readonly [string, string, ...string[]];
  /** The page the ring sits on — the track and its lip are mixed against it. */
  ground: string;
  /** Seconds past the work box. Drives the gold hand on the outside. */
  overtimeSeconds?: number;
  /** Breathe the halo (rest / final push). */
  pulse?: boolean;
  /** Thump the knob once a second (the last seconds of the box, overtime). */
  beat?: boolean;
  duration?: number;
  /** Linear travel for clock-driven phases; eased for discrete jumps. */
  linear?: boolean;
}

const DEG = Math.PI / 180;
/** One full sweep of the overtime hand. */
const OVERTIME_LOOP_SEC = 60;
/** Banked sets pop in this far apart, then each takes POP_MS to land. */
const POP_STAGGER_MS = 110;
const POP_MS = 300;

export function SkiaSessionRing({
  progress,
  segments,
  currentSegment,
  size,
  colors,
  ground,
  overtimeSeconds = 0,
  pulse = false,
  beat = false,
  duration = 560,
  linear = false,
}: SkiaSessionRingProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const g = useMemo(() => ringGeometry(size, segments), [size, segments]);
  const { count, cx, cy, R, arcR, arcW, lip, handR, shineR, shineW, plateR } = g;
  const liveIndex = Math.max(0, Math.min(count - 1, Math.round(currentSegment) - 1));
  const pal = useMemo(() => ringPalette(colors, ground), [colors, ground]);

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

  const breath = useSharedValue(0);
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

  // The beat: one thump per second while it's on. Keyed to the values that
  // change once a second, so it lands with the clock rather than beside it.
  const thump = useSharedValue(0);
  useEffect(() => {
    if (reduced || !beat) return;
    thump.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
  }, [clamped, overtimeSeconds, beat, reduced, thump]);

  // The banked sets pop in, one after another, whenever the layout changes —
  // which is the start of every set (rest is drawn as a ring of its own).
  const popMs = useSharedValue(reduced ? 1e6 : 0);
  useEffect(() => {
    if (reduced) return;
    const total = liveIndex * POP_STAGGER_MS + POP_MS;
    popMs.value = 0;
    popMs.value = withTiming(total, { duration: total, easing: Easing.linear });
  }, [count, liveIndex, reduced, popMs]);

  /* ── Static geometry, built once per (size, segment count) ───────────── */

  const paths = useMemo(() => {
    const oval = Skia.XYWHRect(cx - arcR, cy - arcR, arcR * 2, arcR * 2);
    const shineOval = Skia.XYWHRect(cx - shineR, cy - shineR, shineR * 2, shineR * 2);
    const handOval = Skia.XYWHRect(cx - handR, cy - handR, handR * 2, handR * 2);

    // One path per set — the track — and its shine. Separate paths (rather
    // than subpaths of one) because each banked set pops on its own.
    const segs = Array.from({ length: count }, (_, i) => {
      const p = Skia.Path.Make();
      p.addArc(oval, g.startDeg(i), g.sweepDeg);
      return p;
    });
    const shines = Array.from({ length: count }, (_, i) => {
      const p = Skia.Path.Make();
      if (g.sweepDeg > g.shineInsetDeg * 2) {
        p.addArc(shineOval, g.startDeg(i) + g.shineInsetDeg, g.sweepDeg - g.shineInsetDeg * 2);
      }
      return p;
    });

    const hand = Skia.Path.Make();
    hand.addArc(handOval, -90, 359.9);

    return { segs, shines, hand };
    // `g` is derived from exactly these two.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, count]);

  /* ── Animated bindings ───────────────────────────────────────────────── */

  const liveStart = g.startDeg(liveIndex);
  const liveSweep = g.sweepDeg;
  const shineInset = g.shineInsetDeg;

  const liveOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, Math.max(0, charge.value / 0.02));
  }, [charge]);

  /**
   * THE LIVE ARC IS REBUILT EVERY FRAME, AND IT IS VOLATILE — see the header.
   * On a circle a fraction of the length is the same fraction of the sweep,
   * so this is exactly the old trim. The floor keeps a non-degenerate sliver,
   * and the group fades it out below that — so an empty set shows nothing
   * rather than a round stroke-cap dot parked at the segment's start.
   */
  const liveOval = useMemo(
    () => ({ x: cx - arcR, y: cy - arcR, width: arcR * 2, height: arcR * 2 }),
    [cx, cy, arcR],
  );
  const liveArc = useDerivedValue(() => {
    "worklet";
    const p = Skia.Path.Make();
    p.setIsVolatile(true);
    p.addArc(liveOval, liveStart, liveSweep * Math.max(0.004, charge.value));
    return p;
  }, [charge, liveOval, liveStart, liveSweep]);

  // The shine runs inside the fill: it starts after the fill's rounded start
  // and stops short of the knob, so it never pokes past the colour.
  const shineOvalRect = useMemo(
    () => ({ x: cx - shineR, y: cy - shineR, width: shineR * 2, height: shineR * 2 }),
    [cx, cy, shineR],
  );
  const liveShine = useDerivedValue(() => {
    "worklet";
    const p = Skia.Path.Make();
    p.setIsVolatile(true);
    const sweep = liveSweep * charge.value - shineInset * 2.6;
    if (sweep > 0.5) p.addArc(shineOvalRect, liveStart + shineInset, sweep);
    return p;
  }, [charge, shineOvalRect, liveStart, liveSweep, shineInset]);

  const headAngle = useDerivedValue(() => {
    "worklet";
    return (liveStart + charge.value * liveSweep) * DEG;
  }, [charge, liveStart, liveSweep]);
  const knobX = useDerivedValue(() => {
    "worklet";
    return cx + arcR * Math.cos(headAngle.value);
  }, [headAngle, cx, arcR]);
  const knobY = useDerivedValue(() => {
    "worklet";
    return cy + arcR * Math.sin(headAngle.value);
  }, [headAngle, cy, arcR]);
  const knobOpacity = useDerivedValue(() => {
    "worklet";
    return charge.value > 0.02 && charge.value < 0.995 ? 1 : 0;
  }, [charge]);
  const knobR = useDerivedValue(() => {
    "worklet";
    return arcW * 0.62 * (1 + 0.3 * thump.value);
  }, [thump, arcW]);
  const knobCoreR = useDerivedValue(() => {
    "worklet";
    return arcW * 0.28 * (1 + 0.3 * thump.value);
  }, [thump, arcW]);
  const knobGlowR = useDerivedValue(() => {
    "worklet";
    return arcW * (1.05 + 0.7 * thump.value);
  }, [thump, arcW]);

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
  const handDotR = useDerivedValue(() => {
    "worklet";
    return size * 0.02 * (1 + 0.45 * thump.value);
  }, [thump, size]);

  const haloOpacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, (0.3 + 0.45 * charge.value) * (0.8 + 0.2 * breath.value));
  }, [charge, breath]);
  const haloXf = useDerivedValue(() => {
    "worklet";
    return [{ scale: 1 + 0.035 * breath.value }];
  }, [breath]);

  const center = vec(cx, cy);
  const showHand = overtimeSeconds > 0;
  const lipXf = useMemo(() => [{ translateY: lip }], [lip]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Halo — the field the figure stands in, brightening with the charge. */}
      <Group transform={haloXf} origin={center} opacity={haloOpacity}>
        <Circle cx={cx} cy={cy} r={R * 0.8}>
          <RadialGradient
            c={center}
            r={R * 0.8}
            colors={[alpha(pal.fill, 0.22), alpha(pal.fill, 0.08), "transparent"]}
            positions={[0, 0.62, 1]}
          />
          <BlurMask blur={size * 0.05} style="normal" />
        </Circle>
      </Group>

      {/* The plate the figure stands on. */}
      <Circle cx={cx} cy={cy} r={plateR} color={pal.plate} />

      {/* The track: every set, lip first, then the band. */}
      <Group transform={lipXf}>
        {paths.segs.map((p, i) => (
          <Path
            key={`tl-${i}`}
            path={p}
            style="stroke"
            strokeWidth={arcW}
            strokeCap="round"
            color={pal.trackLip}
          />
        ))}
      </Group>
      {paths.segs.map((p, i) => (
        <Path
          key={`t-${i}`}
          path={p}
          style="stroke"
          strokeWidth={arcW}
          strokeCap="round"
          color={pal.track}
        />
      ))}

      {/* The sets already banked — popping in, one after another. */}
      {paths.segs.slice(0, liveIndex).map((p, i) => (
        <BankedSet
          key={`b-${count}-${i}`}
          index={i}
          path={p}
          shine={paths.shines[i]}
          popMs={popMs}
          arcW={arcW}
          shineW={shineW}
          lip={lip}
          fill={pal.fill}
          fillLip={pal.fillLip}
          shineColor={pal.shine}
        />
      ))}

      {/* The live set: lip, band, shine. */}
      <Group opacity={liveOpacity}>
        <Group transform={lipXf}>
          <Path path={liveArc} style="stroke" strokeWidth={arcW} strokeCap="round" color={pal.fillLip} />
        </Group>
        <Path path={liveArc} style="stroke" strokeWidth={arcW} strokeCap="round" color={pal.fill} />
        <Path
          path={liveShine}
          style="stroke"
          strokeWidth={shineW}
          strokeCap="round"
          color={pal.shine}
        />
      </Group>

      {/* The knob on the leading edge — where the set is, right now. */}
      <Group opacity={knobOpacity}>
        <Circle cx={knobX} cy={knobY} r={knobGlowR} color={alpha(pal.fill, 0.45)}>
          <BlurMask blur={arcW * 0.7} style="normal" />
        </Circle>
        <Circle cx={knobX} cy={knobY} r={knobR} color="#FFFFFF" />
        <Circle cx={knobX} cy={knobY} r={knobCoreR} color={pal.fillLip} />
      </Group>

      {/* Overtime hand — the box is spent and the clock is still running. */}
      {showHand && (
        <Group>
          <Path
            path={paths.hand}
            style="stroke"
            strokeWidth={size * 0.012}
            strokeCap="round"
            start={0}
            end={handTrim}
            color={alpha(colors[0], 0.9)}
          />
          <Circle cx={handX} cy={handY} r={handDotR} color={colors[0]} />
        </Group>
      )}
    </Canvas>
  );
}

/**
 * One banked set. It lands with a little pop — fades in fat and settles to the
 * band's width — `index` beats after the first, so a ring of four sets fills
 * in as three quick knocks before the fourth starts.
 */
function BankedSet({
  index,
  path,
  shine,
  popMs,
  arcW,
  shineW,
  lip,
  fill,
  fillLip,
  shineColor,
}: {
  index: number;
  path: ReturnType<typeof Skia.Path.Make>;
  shine: ReturnType<typeof Skia.Path.Make>;
  popMs: SharedValue<number>;
  arcW: number;
  shineW: number;
  lip: number;
  fill: string;
  fillLip: string;
  shineColor: string;
}) {
  const local = useDerivedValue(() => {
    "worklet";
    const t = (popMs.value - index * POP_STAGGER_MS) / POP_MS;
    return t <= 0 ? 0 : t >= 1 ? 1 : t;
  }, [popMs, index]);
  const opacity = useDerivedValue(() => {
    "worklet";
    return Math.min(1, local.value * 2.5);
  }, [local]);
  const width = useDerivedValue(() => {
    "worklet";
    return arcW * (1 + 0.38 * Math.sin(Math.PI * local.value));
  }, [local, arcW]);
  const lipXf = useMemo(() => [{ translateY: lip }], [lip]);

  return (
    <Group opacity={opacity}>
      <Group transform={lipXf}>
        <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" color={fillLip} />
      </Group>
      <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" color={fill} />
      <Path path={shine} style="stroke" strokeWidth={shineW} strokeCap="round" color={shineColor} />
    </Group>
  );
}
