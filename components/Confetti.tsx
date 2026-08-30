/**
 * CONFETTI — the achievement-unlock burst.
 *
 * A physics-driven, GPU-rendered confetti cannon built on Reanimated. Every
 * piece is a flat paper ribbon (or a foil dot, or a long streamer) fired
 * outward from the medallion, slowed by air-drag, fluttering side to side, and
 * tumbling on all three axes. The tumble foreshortens each ribbon and flips
 * between its lit front face and a darker back face — that two-sided,
 * catches-the-light flip is what makes it read as real 3D paper instead of flat
 * 2D sprites.
 *
 * ── WHY THE MOTION CHANGED ─────────────────────────────────────────────────
 *
 * The fall used to be `y = v·t + ½g·t²` with gravity around 1700 — pure
 * free-fall, no terminal velocity. Paper does not do that. Everything launched,
 * stalled, and then RAINED, accelerating off the bottom of the screen in about
 * half a second; the burst read as fast and cheap rather than as a celebration.
 *
 * Both axes now run the same linear-drag solution, so a piece leaves fast,
 * bleeds off its launch speed, and settles into a steady flutter-fall at its
 * own terminal velocity — the drift a real scrap of foil has. Pieces also enter
 * in two waves and fade on their own schedule, so the field thins out instead
 * of switching off together.
 *
 * One linear `clock` (0→1 over the burst lifetime) drives the whole field, so
 * each particle is a pure function of elapsed time — cheap, deterministic, and
 * buttery on the UI thread. Decorative + `pointerEvents="none"`: it never
 * blocks the dismiss button, costs nothing once unmounted, and is skipped
 * entirely when the OS requests reduced motion.
 */

import { Palette } from "@/constants/theme";
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const { width: W, height: H } = Dimensions.get("window");

/** Long enough for the last pieces to drift, not so long they loiter. */
const LIFE_MS = 3400;
const LIFE_S = LIFE_MS / 1000;
const BASE_COUNT = 56;
const TWO_PI = Math.PI * 2;

/** Darken a hex toward black by factor f (0..1) — the ribbon's shaded back face. */
function shade(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Math.round(parseInt(full.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(full.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(full.slice(4, 6), 16) * f);
  const to = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

interface Piece {
  x0: number;
  y0: number;
  w: number;
  h: number;
  radius: number;
  color: string;
  back: string;
  vx: number;
  vy: number;
  /** Terminal fall speed, px/s — what drag settles this piece down to. */
  vTerm: number;
  /** Drag time-constant, s. Bigger = floatier. */
  tau: number;
  sway: number;
  swayFreq: number;
  swayPhase: number;
  spinZ: number;
  spinX: number;
  spinY: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  delay: number;
  /** Fraction of the burst this piece stays lit before it starts to fade. */
  fadeAt: number;
}

/**
 * The default palette. Deliberately NOT a rainbow: the burst is the badge
 * catching the light, so it is built from the badge's own metal (passed in as
 * `palette`) and only falls back to this brand mix when there isn't one.
 */
function defaultPalette(tierColor: string): string[] {
  return [
    tierColor,
    tierColor,
    Palette.gold,
    Palette.brandSoft,
    Palette.brand,
    Palette.water,
    Palette.caloriesSoft,
    "#FFFFFF",
  ];
}

function makePieces(
  originX: number,
  originY: number,
  palette: readonly string[],
  count: number,
): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const roll = Math.random();
    // Three shapes rather than two: round foil dots, paper rectangles, and a
    // few long streamers that hang in the air and read as ribbon.
    const kind = roll < 0.24 ? "dot" : roll < 0.86 ? "chip" : "streamer";
    const d = rand(6, 11);
    const w = kind === "dot" ? d : kind === "streamer" ? rand(4, 6) : rand(7, 13);
    const h =
      kind === "dot" ? d : kind === "streamer" ? rand(26, 42) : rand(11, 20);

    // Cannon: fired up-and-out from the medallion in a ±72° fan. A second
    // wave leaves a beat later, so the field arrives in two breaths.
    const wave = i % 3 === 2 ? rand(0.18, 0.34) : rand(0, 0.1);
    const ang = rand(-1, 1) * (72 * (Math.PI / 180));
    const speed = rand(420, 900);
    const color = pick(palette);

    return {
      x0: originX,
      y0: originY,
      w,
      h,
      radius: kind === "dot" ? d / 2 : 1.5,
      color,
      back: shade(color, 0.58),
      vx: Math.sin(ang) * speed,
      vy: -Math.cos(ang) * speed * rand(0.85, 1.25),
      // Streamers are light and hang; dots are dense and drop.
      vTerm: kind === "streamer" ? rand(150, 260) : kind === "dot" ? rand(320, 470) : rand(230, 380),
      tau: kind === "streamer" ? rand(1.1, 1.6) : rand(0.7, 1.15),
      sway: rand(10, 34),
      swayFreq: rand(1.1, 2.8),
      swayPhase: rand(0, TWO_PI),
      spinZ: rand(-1, 1) * rand(2, 6),
      spinX: rand(-1, 1) * rand(3, 8),
      spinY: rand(-1, 1) * rand(3, 8),
      phaseX: rand(0, TWO_PI),
      phaseY: rand(0, TWO_PI),
      phaseZ: rand(0, TWO_PI),
      delay: wave,
      fadeAt: rand(0.6, 0.86),
    };
  });
}

interface ConfettiProps {
  /** Burst origin (defaults to the medallion's approximate screen position). */
  originX?: number;
  originY?: number;
  /** Drives the shockwave and the fallback palette. */
  tierColor?: string;
  /**
   * The badge's own colours (see services/achievementBadges → badgePalette).
   * When present the burst is that material catching the light rather than a
   * generic brand mix.
   */
  palette?: readonly string[];
  /**
   * 0–1 fanfare. The maturity dial: scales the particle count and the shockwave
   * so a seasoned user's everyday unlock stays tasteful while big moments roar.
   */
  intensity?: number;
}

export function Confetti({
  originX = W / 2,
  originY = H * 0.34,
  tierColor = Palette.brand,
  palette,
  intensity = 1,
}: ConfettiProps) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);

  const i = Math.max(0, Math.min(1, intensity));
  // Always keep a real burst (never a sad handful), but let intensity scale it.
  const count = Math.round(BASE_COUNT * (0.4 + 0.6 * i));

  const colors = useMemo(
    () => (palette && palette.length > 0 ? palette : defaultPalette(tierColor)),
    [palette, tierColor],
  );

  const pieces = useMemo(
    () => makePieces(originX, originY, colors, count),
    [originX, originY, colors, count],
  );

  useEffect(() => {
    clock.value = 0;
    clock.value = withTiming(1, { duration: LIFE_MS, easing: Easing.linear });
    return () => cancelAnimation(clock);
  }, [clock]);

  if (reduced) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" needsOffscreenAlphaCompositing>
      {i >= 0.4 && (
        <Shockwave clock={clock} x={originX} y={originY} color={tierColor} strength={i} />
      )}
      {pieces.map((p, idx) => (
        <Confetto key={idx} piece={p} clock={clock} />
      ))}
    </View>
  );
}

/** A single tumbling ribbon — a pure function of the shared clock. */
function Confetto({ piece: p, clock }: { piece: Piece; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = clock.value * LIFE_S;
    const td = Math.max(0, t - p.delay);

    // BOTH axes run linear drag: v' = -(v - v∞)/τ. A piece leaves fast, bleeds
    // off its launch speed, and settles into a steady flutter-fall instead of
    // accelerating forever. Integrating that gives the closed forms below —
    // no per-frame state, so the whole field stays a pure function of time.
    const ex = 1 - Math.exp(-td / p.tau);
    const x = p.vx * p.tau * ex + p.sway * Math.sin(p.swayFreq * td + p.swayPhase);
    const y = (p.vy - p.vTerm) * p.tau * ex + p.vTerm * td;

    const rx = p.spinX * td + p.phaseX;
    const ry = p.spinY * td + p.phaseY;
    const rz = p.spinZ * td + p.phaseZ;

    const appear = interpolate(td, [0, 0.12], [0.4, 1], Extrapolation.CLAMP);
    // Each piece fades on its own schedule, so the field thins out rather than
    // switching off in one frame.
    const fade = interpolate(
      clock.value,
      [0, p.fadeAt, 1],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );

    // Which face is toward the viewer → blend between the lit front and shaded
    // back. This is the core of the 3D illusion.
    const lit = (Math.cos(rx) * Math.cos(ry) + 1) / 2;

    return {
      opacity: appear * fade,
      backgroundColor: interpolateColor(lit, [0, 1], [p.back, p.color]),
      transform: [
        { translateX: x },
        { translateY: y },
        { perspective: 700 },
        { rotateX: `${rx}rad` },
        { rotateY: `${ry}rad` },
        { rotateZ: `${rz}rad` },
        { scale: appear },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: p.x0 - p.w / 2,
          top: p.y0 - p.h / 2,
          width: p.w,
          height: p.h,
          borderRadius: p.radius,
        },
        style,
      ]}
    />
  );
}

/** A single soft shockwave ring that punches outward on the burst. */
function Shockwave({
  clock,
  x,
  y,
  color,
  strength = 1,
}: {
  clock: SharedValue<number>;
  x: number;
  y: number;
  color: string;
  strength?: number;
}) {
  const SIZE = 120;
  const peak = 0.45 * strength;
  const style = useAnimatedStyle(() => {
    const p = interpolate(clock.value, [0, 0.18], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0, 0.2, 1], [0, peak, 0], Extrapolation.CLAMP),
      transform: [{ scale: 0.2 + p * 2.6 }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x - SIZE / 2,
          top: y - SIZE / 2,
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: 3,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}
