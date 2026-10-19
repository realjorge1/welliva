/**
 * BADGE — an achievement, struck as an object you'd want to hold.
 *
 * The owner (2026-10-16), after the flame: "clean up the achievement badges to
 * be just as cool — without changing it entirely." So the badge is still the
 * round medallion in its own material with its glyph cut into the face (see
 * services/achievementBadges) — every badge is recognisably the one you
 * earned — but it is drawn in the flame's language now instead of as a
 * gradient disc:
 *
 *   · FLAT TONES, NOT A GRADIENT. The material's three stops become three
 *     flat shapes: the rim in the deep stop, the face in the body, and a flat
 *     crescent of shadow along the face's lower edge where it is struck down
 *     into the rim. A gradient disc reads as a button; flat tones read as an
 *     illustrated object, like the flame.
 *   · A LIP. The coin stands on its own thickness — a darker edge below it —
 *     so it has weight. (The same lip the session ring and its slab carry.)
 *   · TWO STROKES OF SHINE, one on the rim and one on the face, from the top
 *     left — the flame's single shine stroke, once per surface.
 *
 * `BadgeArt` is the drawing alone: no hooks, one Svg plus the glyph, cheap
 * enough for every tile on the Profile shelf. `Badge` is the hero for the
 * unlock moment, and arrives the way the flame does — see below.
 *
 * Geometry: a 100 × 108 box. The coin is a 46-radius disc centred at (50, 50);
 * the lip is the same disc dropped 6 below it; the face is a 37-radius disc,
 * and the lit part of the face a 34.8 disc nudged up-left inside it.
 */
import { useColors } from "@/components/ui/useColors";
import { alpha } from "@/constants/theme";
import type { BadgeFinish } from "@/services/achievementBadges";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

/** Height : width of the drawing (the lip hangs below the coin). */
export const BADGE_ASPECT = 1.08;

/** The lit face's centre and radius, in the 100-wide box — where the glyph sits. */
const FACE = { cx: 48.4, cy: 48.4, r: 34.8 } as const;
/** The glyph, as a fraction of the badge's width. */
const GLYPH = 0.4;

/**
 * How far below the box's middle the FACE sits, as a fraction of the badge's
 * width — for callers that centre the face (not the box) inside something
 * round, like the detail sheet's progress ring.
 */
export const BADGE_FACE_OFFSET = (BADGE_ASPECT * 100) / 2 - FACE.cy;

/* ── Colour helpers (a finish is plain hexes) ─────────────────────────────── */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return [128, 128, 128];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
const toHex = (c: number[]) =>
  `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const deepen = (hex: string, t: number) => toHex(rgb(hex).map((v) => v * (1 - t)));
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v * t + y[i] * (1 - t)));
};

/** An arc of a circle as SVG path data, clockwise from `a0` to `a1` degrees. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const RIM_SHINE = arc(50, 50, 41.5, 198, 258);
const FACE_SHINE = arc(FACE.cx, FACE.cy, 28, 200, 250);

/* ── The drawing ──────────────────────────────────────────────────────────── */

/** The coin without its glyph — static Svg, so it can sit under a moving glyph. */
function Coin({ finish, size }: { finish: BadgeFinish; size: number }) {
  const [light, body, deep] = finish.ramp;
  return (
    <Svg width={size} height={size * BADGE_ASPECT} viewBox={`0 0 100 ${100 * BADGE_ASPECT}`}>
      {/* The lip — the coin's own thickness, under it. */}
      <Circle cx={50} cy={56} r={46} fill={deepen(deep, 0.32)} />
      {/* The rim, and the light catching it. */}
      <Circle cx={50} cy={50} r={46} fill={deep} />
      <Path d={RIM_SHINE} stroke={light} strokeWidth={3.6} strokeLinecap="round" fill="none" opacity={0.75} />
      {/* The face, struck down into the rim: a flat crescent of shadow along its
          lower edge, then the lit body. */}
      <Circle cx={50} cy={50} r={37} fill={mix(body, deep, 0.55)} />
      <Circle cx={FACE.cx} cy={FACE.cy} r={FACE.r} fill={body} />
      <Path d={FACE_SHINE} stroke={light} strokeWidth={4.2} strokeLinecap="round" fill="none" opacity={0.95} />
    </Svg>
  );
}

/** Where the glyph sits on a badge `size` wide. */
function glyphBox(size: number) {
  const g = Math.round(size * GLYPH);
  return { left: (FACE.cx / 100) * size - g / 2, top: (FACE.cy / 100) * size - g / 2, g };
}

/**
 * The badge, drawn: no hooks, no animation. For the shelf, the detail sheet,
 * anywhere it simply sits.
 */
export function BadgeArt({
  finish,
  icon,
  size,
  style,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  /** Width in points; the height is `size * BADGE_ASPECT`. */
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { left, top, g } = glyphBox(size);
  return (
    <View style={[{ width: size, height: size * BADGE_ASPECT }, style]}>
      <Coin finish={finish} size={size} />
      <Ionicons name={icon} size={g} color={finish.ink} style={[styles.abs, { left, top }]} />
    </View>
  );
}

/* ── The unlock: the badge arrives ────────────────────────────────────────── */

/** How long the fall takes, ms — then it lands. */
const FALL_MS = 300;
/** One slow bob, once it has landed. Whole cycles, so it loops seamlessly. */
const FLOAT_MS = 3600;

/**
 * THE BADGE, ARRIVING — the flame's choreography, for a coin.
 *
 *   · It DROPS from above, stretched thin by the speed; its shadow on the
 *     floor grows and darkens as it comes.
 *   · It LANDS: squashed wide on its lip, then springs back to round.
 *   · The GLYPH pops a beat later — so the badge lands as two objects (the
 *     same trick as the flame's heart), which is what makes it feel struck
 *     rather than scaled.
 *   · The light crosses its face ONCE.
 *   · Then it floats: a slow bob a few points high, the shadow shrinking as it
 *     rises. One clock, ridden in after the landing, so idle motion never
 *     fights the entrance.
 *
 * No halo loop, no sparkles, no rays: the badge is the whole moment.
 * Reduce-motion gets it landed and still, and `onLanded` straight away.
 */
export function Badge({
  finish,
  icon,
  size,
  delay = 0,
  float = true,
  onLanded,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  /** Width in points; the height is `size * BADGE_ASPECT`. */
  size: number;
  delay?: number;
  /** The slow idle bob once landed. */
  float?: boolean;
  /** Fired once, when the glyph has landed in the face. */
  onLanded?: () => void;
}) {
  const { isDark } = useColors();
  const reduced = useReducedMotion();
  const fallH = size * 0.95;

  const drop = useSharedValue(reduced ? 0 : 1); // 1 = up in the air, 0 = landed
  const shown = useSharedValue(reduced ? 1 : 0);
  const sx = useSharedValue(reduced ? 1 : 0.9);
  const sy = useSharedValue(reduced ? 1 : 1.12);
  const glyph = useSharedValue(reduced ? 1 : 0);
  const sheen = useSharedValue(0);
  const clock = useSharedValue(0);
  const gain = useSharedValue(0);

  useEffect(() => {
    const landed = () => onLanded?.();
    if (reduced) {
      landed();
      return;
    }
    const settle = { damping: 8, stiffness: 210, mass: 0.85 };
    const lands = delay + FALL_MS;

    shown.value = withDelay(delay, withTiming(1, { duration: 90 }));
    drop.value = withDelay(delay, withTiming(0, { duration: FALL_MS, easing: Easing.in(Easing.quad) }));
    // Thin while it falls, squashed wide on impact, then round again.
    sy.value = withDelay(
      lands,
      withSequence(withTiming(0.8, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, settle)),
    );
    sx.value = withDelay(
      lands,
      withSequence(withTiming(1.15, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, settle)),
    );
    glyph.value = withDelay(
      lands + 130,
      withSpring(1, { damping: 7, stiffness: 240, mass: 0.7 }, (fin) => {
        if (fin) runOnJS(landed)();
      }),
    );
    sheen.value = withDelay(lands + 420, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    if (float) {
      clock.value = withDelay(
        lands + 700,
        withRepeat(withTiming(1, { duration: FLOAT_MS, easing: Easing.linear }), -1, false),
      );
      gain.value = withDelay(lands + 700, withTiming(1, { duration: 900 }));
    }
    return () => {
      cancelAnimation(clock);
      cancelAnimation(gain);
    };
    // The entrance plays once per mount; re-key the component to replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyStyle = useAnimatedStyle(() => {
    const bob = Math.sin(clock.value * Math.PI * 2) * size * 0.025 * gain.value;
    return {
      opacity: shown.value,
      transform: [
        { translateY: -drop.value * fallH - bob },
        { scaleX: sx.value },
        { scaleY: sy.value },
      ],
    };
  });

  const glyphStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, glyph.value * 3),
    transform: [{ scale: glyph.value }],
  }));

  const floorStyle = useAnimatedStyle(() => {
    const bob = Math.sin(clock.value * Math.PI * 2) * gain.value; // −1…1, up is +
    const near = 1 - drop.value; // 0 high in the air → 1 on the floor
    return {
      opacity: shown.value * (0.25 + 0.75 * near) * (1 - 0.18 * bob),
      transform: [{ scaleX: (0.45 + 0.55 * near) * sx.value * (1 - 0.1 * bob) }],
    };
  });

  const faceD = (FACE.r / 100) * size * 2;
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.18, 0.82, 1], [0, 0.55, 0.55, 0]),
    transform: [{ translateX: (sheen.value - 0.5) * faceD * 1.7 }, { rotate: "18deg" }],
  }));

  const { left, top, g } = glyphBox(size);
  const h = size * BADGE_ASPECT;

  return (
    <View style={{ width: size, height: h + size * 0.08 }} pointerEvents="none">
      {/* The floor: the metal's own light on a dark ground, a pale shadow on a
          light one (a dark shadow on black reads as a hole). */}
      <Animated.View
        style={[
          styles.floor,
          {
            left: size * 0.12,
            width: size * 0.76,
            top: h - size * 0.07,
            height: size * 0.13,
            borderRadius: size,
            backgroundColor: isDark ? alpha(finish.glow, 0.3) : "rgba(0,0,0,0.10)",
          },
          floorStyle,
        ]}
      />
      <Animated.View style={[{ width: size, height: h }, styles.origin, bodyStyle]}>
        <Coin finish={finish} size={size} />
        {/* One pass of light across the face, clipped to it. */}
        <View
          style={[
            styles.abs,
            styles.faceClip,
            {
              left: ((FACE.cx - FACE.r) / 100) * size,
              top: ((FACE.cy - FACE.r) / 100) * size,
              width: faceD,
              height: faceD,
              borderRadius: faceD / 2,
            },
          ]}
        >
          <Animated.View style={[styles.sheen, { height: faceD * 1.4, width: faceD * 0.26 }, sheenStyle]}>
            <LinearGradient
              colors={["#FFFFFF00", "#FFFFFFB0", "#FFFFFF00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.abs, { left, top, width: g, height: g }, glyphStyle]}>
          <Ionicons name={icon} size={g} color={finish.ink} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  /** The coin squashes on its lip — the bottom of the drawing, not its middle. */
  origin: { transformOrigin: "50% 95%" },
  floor: { position: "absolute" },
  faceClip: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  sheen: { position: "absolute" },
});
