/**
 * CONFETTI — the achievement-unlock burst.
 *
 * A physics-driven, GPU-rendered confetti cannon built on Reanimated. Every
 * piece is a flat paper ribbon (or foil dot) that is fired outward from the
 * medallion, pulled down by gravity, drifts with air-drag, flutters side to
 * side, and tumbles on all three axes. The tumble foreshortens each ribbon and
 * flips between its lit front face and a darker back face — that two-sided,
 * catches-the-light flip is what makes it read as real 3D paper instead of flat
 * 2D sprites.
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

const LIFE_MS = 2600;
const LIFE_S = LIFE_MS / 1000;
const BASE_COUNT = 42;
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
  g: number;
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
}

function makePieces(
  originX: number,
  originY: number,
  tierColor: string,
  count: number,
): Piece[] {
  // A cohesive, brand-aligned palette — tier color weighted twice, gold + aqua
  // accents, a little white foil for sparkle. Deliberately NOT a rainbow.
  const palette = [
    tierColor,
    tierColor,
    Palette.gold,
    Palette.brandSoft,
    Palette.brand,
    Palette.water,
    Palette.caloriesSoft,
    "#FFFFFF",
  ];

  return Array.from({ length: count }, () => {
    const isDot = Math.random() < 0.3;
    const d = rand(7, 13);
    const w = isDot ? d : rand(6, 12);
    const h = isDot ? d : rand(12, 22);

    // Cannon: fired up-and-out from the medallion in a ±70° fan.
    const ang = rand(-1, 1) * (70 * (Math.PI / 180));
    const speed = rand(520, 1080);
    const color = pick(palette);

    return {
      x0: originX,
      y0: originY,
      w,
      h,
      radius: isDot ? d / 2 : 2,
      color,
      back: shade(color, 0.6),
      vx: Math.sin(ang) * speed,
      vy: -Math.cos(ang) * speed * rand(0.8, 1.3),
      g: rand(1500, 1900),
      tau: rand(0.55, 1.05),
      sway: rand(8, 30),
      swayFreq: rand(1.5, 4),
      swayPhase: rand(0, TWO_PI),
      spinZ: rand(-1, 1) * rand(4, 10),
      spinX: rand(-1, 1) * rand(5, 12),
      spinY: rand(-1, 1) * rand(5, 12),
      phaseX: rand(0, TWO_PI),
      phaseY: rand(0, TWO_PI),
      phaseZ: rand(0, TWO_PI),
      delay: rand(0, 0.12),
    };
  });
}

interface ConfettiProps {
  /** Burst origin (defaults to the medallion's approximate screen position). */
  originX?: number;
  originY?: number;
  /** Drives the palette so the burst matches the achievement's tier. */
  tierColor?: string;
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
  intensity = 1,
}: ConfettiProps) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);

  const i = Math.max(0, Math.min(1, intensity));
  // Always keep a real burst (never a sad handful), but let intensity scale it.
  const count = Math.round(BASE_COUNT * (0.4 + 0.6 * i));

  const pieces = useMemo(
    () => makePieces(originX, originY, tierColor, count),
    [originX, originY, tierColor, count],
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

    // Horizontal: initial burst velocity bled off by air-drag, plus a fluttering
    // sway — the gentle side-to-side of falling paper.
    const ex = 1 - Math.exp(-td / p.tau);
    const x = p.vx * p.tau * ex + p.sway * Math.sin(p.swayFreq * td + p.swayPhase);
    // Vertical: launch velocity + gravity → a natural arc.
    const y = p.vy * td + 0.5 * p.g * td * td;

    const rx = p.spinX * td + p.phaseX;
    const ry = p.spinY * td + p.phaseY;
    const rz = p.spinZ * td + p.phaseZ;

    const appear = interpolate(td, [0, 0.1], [0.3, 1], Extrapolation.CLAMP);
    const fade = interpolate(
      t,
      [0, LIFE_S * 0.72, LIFE_S],
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
