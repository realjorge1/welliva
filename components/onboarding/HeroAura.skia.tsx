/**
 * HeroAura.skia — the ambient brand light behind onboarding heroes (Skia impl).
 *
 * Two modes, one component:
 *  • "roam" — 3 defined radial orbs of DIFFERENT sizes that drift across the
 *    whole canvas, BOUNCE off every edge, AND collide with each other like slow,
 *    soft billiard balls. A tiny per-frame physics loop (position + velocity,
 *    wall reflection, springy two-body impulse with a speed clamp) runs entirely
 *    on the UI thread via `useFrameCallback`.
 *  • "glow" — a single pronounced, breathing centered bloom (with a hot core and
 *    a hint of orange) used as the halo behind the logo/title.
 *
 * Loaded lazily (only when isSkiaAvailable) by the wrapper, so this file's
 * static Skia import is never evaluated on a Skia-less surface.
 */
import { alpha } from "@/constants/theme";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export interface HeroAuraSkiaProps {
  width: number;
  height: number;
  colors: readonly [string, string, ...string[]];
  mode: "roam" | "glow";
  animated?: boolean;
}

/**
 * Roaming orbs: fractional radius (of the short side), color index, a start
 * position (fraction of the canvas) and an initial drift direction. Three orbs
 * of DELIBERATELY different sizes — a big, a medium and a small — so they read
 * as distinct lights that meet and nudge each other rather than a matched pair.
 */
const ROAM_BLOBS = [
  { fr: 0.42, tint: 0, ix: 0.28, iy: 0.26, dx: 0.9, dy: 0.7 },
  { fr: 0.3, tint: 2, ix: 0.74, iy: 0.55, dx: -0.85, dy: -0.6 },
  { fr: 0.22, tint: 1, ix: 0.5, iy: 0.82, dx: 0.7, dy: -0.95 },
] as const;

/** Motion feel, as fractions of the short side (resolution-independent):
 *  a slightly livelier baseline drift, a hard speed ceiling so the springy
 *  bounces below can never accumulate energy into runaway motion. */
const BASE_SPEED_FR = 0.06; // px/sec baseline drift
const MAX_SPEED_FR = 0.15; // px/sec hard ceiling (~2.5× base)
/** Restitution >1 = orbs rebound a touch faster than they met — a springier,
 *  livelier collision. Bounded by the speed clamp so it stays stable. */
const RESTITUTION = 1.12;

/** Per-frame physics state carried on the UI thread. */
interface BlobState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function clamp(v: number, lo: number, hi: number): number {
  "worklet";
  return v < lo ? lo : v > hi ? hi : v;
}

/** Build a valid, non-overlapping start layout for the current canvas. */
function initialStates(width: number, height: number): BlobState[] {
  const minDim = Math.min(width, height);
  const base = minDim * BASE_SPEED_FR;
  return ROAM_BLOBS.map((b) => {
    const R = b.fr * minDim;
    return {
      x: clamp(b.ix * width, R, width - R),
      y: clamp(b.iy * height, R, height - R),
      vx: b.dx * base,
      vy: b.dy * base,
    };
  });
}

export function HeroAuraSkia(props: HeroAuraSkiaProps) {
  const reduced = useReducedMotion();
  const live = (props.animated ?? true) && !reduced;
  // Split by mode so "glow" never spins up the frame clock when static.
  return props.mode === "glow" ? (
    <GlowAura {...props} live={live} />
  ) : (
    <RoamAura {...props} live={live} />
  );
}

/* ─────────────────────────────── Roam ─────────────────────────────── */

function RoamAura({
  width,
  height,
  colors,
  live,
}: HeroAuraSkiaProps & { live: boolean }) {
  const minDim = Math.min(width, height);
  // Static per-blob properties, captured into the physics worklet below.
  const radii = ROAM_BLOBS.map((b) => b.fr * minDim);
  const masses = ROAM_BLOBS.map((b) => b.fr * b.fr); // ∝ area; absolute scale cancels
  const maxSpeed = minDim * MAX_SPEED_FR;
  const restitution = RESTITUTION;

  const state = useSharedValue<BlobState[]>(initialStates(width, height));

  // Reset the layout whenever the canvas is (re)sized.
  useEffect(() => {
    state.value = initialStates(width, height);
  }, [width, height, state]);

  // The simulation: integrate, reflect off walls, resolve blob-blob collisions.
  const frame = useFrameCallback((info) => {
    "worklet";
    // Clamp dt so a dropped frame / resume can't teleport a blob across the wall.
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const next = state.value.map((s) => ({ ...s }));

    // Move + bounce off the four walls (rim kisses the edge, then reflects).
    for (let i = 0; i < next.length; i++) {
      const s = next[i];
      const r = radii[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < r) {
        s.x = r;
        s.vx = Math.abs(s.vx);
      } else if (s.x > width - r) {
        s.x = width - r;
        s.vx = -Math.abs(s.vx);
      }
      if (s.y < r) {
        s.y = r;
        s.vy = Math.abs(s.vy);
      } else if (s.y > height - r) {
        s.y = height - r;
        s.vy = -Math.abs(s.vy);
      }
    }

    // Elastic two-body collisions (n is tiny, so the O(n²) pass is free).
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i];
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const minDist = radii[i] + radii[j];
        if (dist >= minDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const ma = masses[i];
        const mb = masses[j];
        const invTotal = 1 / ma + 1 / mb;

        // Push the pair apart so they stop overlapping (weighted by mass).
        const pen = minDist - dist;
        a.x -= nx * pen * (1 / ma) / invTotal;
        a.y -= ny * pen * (1 / ma) / invTotal;
        b.x += nx * pen * (1 / mb) / invTotal;
        b.y += ny * pen * (1 / mb) / invTotal;

        // Only exchange momentum if they're actually approaching.
        const relN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relN < 0) {
          const impulse = (-(1 + restitution) * relN) / invTotal; // e>1 = springy
          a.vx -= (impulse * nx) / ma;
          a.vy -= (impulse * ny) / ma;
          b.vx += (impulse * nx) / mb;
          b.vy += (impulse * ny) / mb;
        }
      }
    }

    // Clamp each orb's speed so the springy (e>1) bounces above can never
    // accumulate energy into runaway motion — keeps the drift calm over time.
    for (let i = 0; i < next.length; i++) {
      const s = next[i];
      const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (sp > maxSpeed) {
        const k = maxSpeed / sp;
        s.vx *= k;
        s.vy *= k;
      }
    }

    state.value = next;
  }, false);

  // Run the loop only while live; otherwise the static initial layout stands.
  useEffect(() => {
    frame.setActive(live);
  }, [live, frame]);

  return (
    <Canvas style={{ width, height }}>
      {ROAM_BLOBS.map((b, i) => (
        <RoamBlob
          key={i}
          index={i}
          state={state}
          R={radii[i]}
          blur={minDim * 0.028}
          hue={colors[b.tint] ?? colors[colors.length - 1]}
        />
      ))}
    </Canvas>
  );
}

function RoamBlob({
  index,
  state,
  R,
  blur,
  hue,
}: {
  index: number;
  state: SharedValue<BlobState[]>;
  R: number;
  blur: number;
  hue: string;
}) {
  const transform = useDerivedValue(() => {
    "worklet";
    const s = state.value[index];
    if (!s) return [{ translateX: 0 }, { translateY: 0 }];
    return [{ translateX: s.x }, { translateY: s.y }];
  });

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={R}>
        {/* Fuller body out to ~0.82, then a quick soft rim — reads as a defined
            orb (like the sign-in bubbles) rather than a diffuse shade. Low
            peak alpha keeps the whole field gentle behind the form. */}
        <RadialGradient
          c={vec(0, 0)}
          r={R}
          colors={[alpha(hue, 0.28), alpha(hue, 0.2), "transparent"]}
          positions={[0, 0.82, 1]}
        />
        <BlurMask blur={blur} style="normal" />
      </Circle>
    </Group>
  );
}

/* ─────────────────────────────── Glow ─────────────────────────────── */

function GlowAura({
  width,
  height,
  colors,
  live,
}: HeroAuraSkiaProps & { live: boolean }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [live, breath]);

  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) * 0.46;
  const main = colors[1] ?? colors[0];
  const accent = colors[colors.length - 1];

  const transform = useDerivedValue(() => {
    "worklet";
    return [{ scale: 0.9 + 0.16 * breath.value }];
  });
  const opacity = useDerivedValue(() => {
    "worklet";
    return 0.78 + 0.22 * breath.value;
  });

  return (
    <Canvas style={{ width, height }}>
      <Group transform={transform} origin={vec(cx, cy)} opacity={opacity}>
        {/* Outer bloom */}
        <Circle cx={cx} cy={cy} r={baseR}>
          <RadialGradient
            c={vec(cx, cy)}
            r={baseR}
            colors={[alpha(main, 0.5), alpha(main, 0.15), "transparent"]}
            positions={[0, 0.5, 1]}
          />
          <BlurMask blur={baseR * 0.18} style="normal" />
        </Circle>
        {/* Hot core — the pronounced ring glow, warmed with a touch of orange */}
        <Circle cx={cx} cy={cy} r={baseR * 0.62}>
          <RadialGradient
            c={vec(cx, cy)}
            r={baseR * 0.62}
            colors={[alpha(main, 0.62), alpha(accent, 0.2), "transparent"]}
            positions={[0, 0.62, 1]}
          />
          <BlurMask blur={baseR * 0.12} style="normal" />
        </Circle>
      </Group>
    </Canvas>
  );
}
