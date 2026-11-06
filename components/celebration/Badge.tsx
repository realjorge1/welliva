/**
 * BADGE — an achievement, struck as an object you'd want to hold.
 *
 * The owner (2026-10-16), after the flame: "clean up the achievement badges to
 * be just as cool — without changing it entirely." So the badge is drawn in
 * the flame's language instead of as a gradient disc:
 *
 *   · FLAT TONES, NOT A GRADIENT. The material's three stops become three
 *     flat shapes: the rim in the deep stop, the face in the body, and a flat
 *     crescent of shadow along the face's lower edge where it is struck down
 *     into the rim. A gradient disc reads as a button; flat tones read as an
 *     illustrated object, like the flame.
 *   · A LIP. The plate stands on its own thickness — a darker edge below it —
 *     so it has weight. (The same lip the session ring and its slab carry.)
 *   · TWO STROKES OF SHINE, one on the rim and one on the face, from the top
 *     left — the flame's single shine stroke, once per surface.
 *
 * And then (2026-11-01, Duolingo as the reference — "appears premium, but
 * poor"): every badge was the same round coin, so a shelf of them read as a
 * list of coloured circles. Now —
 *
 *   · A SHAPE PER TIER (see badgeGeometry): coin, hexagon, shield, rosette,
 *     star. The rank is legible before a word is read, the way Duolingo gives
 *     every league its own emblem.
 *   · A RIBBON with the rank written on it, across the badge's foot — the
 *     band Duolingo writes "LEVEL 3" on. Optional: below about 60 points wide
 *     the letters stop being letters, so small badges go without.
 *   · AN EMBOSSED GLYPH: drawn twice, the second a hair lower in the metal's
 *     light (on a dark glyph — engraved) or its shadow (on a light one —
 *     raised). Flat glyph-on-disc was the "app icon" look; this is struck.
 *
 * `BadgeArt` is the drawing alone: no hooks, one Svg plus the glyph, cheap
 * enough for every tile on the Profile shelf. `Badge` is the hero for the
 * unlock moment, and arrives the way the flame does — see below.
 *
 * Geometry: a 100 × 108 box (see badgeGeometry), sized by width.
 */
import { useColors } from "@/components/ui/useColors";
import { alpha } from "@/constants/theme";
import type { BadgeFinish, BadgeShape } from "@/services/achievementBadges";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
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
import Svg, { Path } from "react-native-svg";
import { BADGE_ASPECT, BADGE_BOX_H, badgeGeometry } from "./badgeGeometry";

export { BADGE_ASPECT };

/** Below this width a ribbon's letters stop being legible — the ribbon goes. */
const RIBBON_MIN_SIZE = 56;

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
const lightness = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/**
 * The glyph's second impression: a dark glyph gets the metal's light a hair
 * below it (cut INTO the face), a light glyph gets the metal's shadow (raised
 * OFF it). Either way the glyph has an edge, which is what makes it struck.
 */
function emboss(finish: BadgeFinish): { color: string; opacity: number } {
  return lightness(finish.ink) < 0.5
    ? { color: finish.ramp[0], opacity: 0.55 }
    : { color: deepen(finish.ramp[2], 0.35), opacity: 0.7 };
}

/* ── The drawing ──────────────────────────────────────────────────────────── */

/** The plate without its glyph — static Svg, so it can sit under a moving glyph. */
function Plate({
  finish,
  size,
  shape,
  label,
}: {
  finish: BadgeFinish;
  size: number;
  shape: BadgeShape;
  label?: string;
}) {
  const [light, body, deep] = finish.ramp;
  const g = badgeGeometry(shape, !!label);
  const k = size / 100;
  const t = g.ribbon?.text;
  return (
    <>
      <Svg width={size} height={size * BADGE_ASPECT} viewBox={`0 0 100 ${BADGE_BOX_H}`}>
        {/* The lip — the plate's own thickness, under it. */}
        <Path d={g.lip} fill={deepen(deep, 0.32)} />
        {/* The rim, and the light catching it. */}
        <Path d={g.rim} fill={deep} />
        <Path
          d={g.rimShine}
          stroke={light}
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.75}
        />
        {/* The face, struck down into the rim: a flat crescent of shadow along
            its lower edge, then the lit body. */}
        <Path d={g.faceShadow} fill={mix(body, deep, 0.55)} />
        <Path d={g.face} fill={body} />
        <Path
          d={g.faceShine}
          stroke={light}
          strokeWidth={4.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.95}
        />
        {/* The ribbon: its tails behind, the folds where it turns under, then
            the band the rank is written on. */}
        {g.ribbon ? (
          <>
            <Path d={g.ribbon.tails} fill={deepen(deep, 0.25)} />
            <Path d={g.ribbon.folds} fill={deepen(deep, 0.5)} />
            <Path d={g.ribbon.band} fill={deep} />
          </>
        ) : null}
      </Svg>
      {label && t ? (
        // Part of the drawing, not body text: it must not grow with the OS
        // font size, or the word would run off its own ribbon.
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.abs,
            styles.ribbonText,
            {
              left: (t.cx - t.width / 2) * k,
              width: t.width * k,
              top: (t.cy - t.size * 0.62) * k,
              height: t.size * 1.24 * k,
              fontSize: t.size * k,
              lineHeight: t.size * 1.24 * k,
              letterSpacing: t.size * k * 0.06,
              color: finish.ribbonInk ?? light,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </>
  );
}

/** Where the glyph sits on a badge `size` wide. */
function glyphBox(size: number, shape: BadgeShape, labelled: boolean) {
  const { glyph } = badgeGeometry(shape, labelled);
  const g = Math.round((glyph.size / 100) * size);
  return { left: (glyph.cx / 100) * size - g / 2, top: (glyph.cy / 100) * size - g / 2, g };
}

/** The glyph, struck: its embossed second impression, then the glyph itself. */
function Glyph({
  finish,
  icon,
  size,
  g,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  g: number;
}) {
  const e = emboss(finish);
  return (
    <>
      <Ionicons
        name={icon}
        size={g}
        color={e.color}
        style={[styles.abs, { left: 0, top: size * 0.022, opacity: e.opacity }]}
      />
      <Ionicons name={icon} size={g} color={finish.ink} style={[styles.abs, { left: 0, top: 0 }]} />
    </>
  );
}

/**
 * The badge, drawn: no hooks, no animation. For the shelf, the detail sheet,
 * anywhere it simply sits.
 */
export function BadgeArt({
  finish,
  icon,
  size,
  shape = "coin",
  label,
  style,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  /** Width in points; the height is `size * BADGE_ASPECT`. */
  size: number;
  /** The outline — one per tier (see TIER_SHAPE). */
  shape?: BadgeShape;
  /** The word on the ribbon. Dropped on a badge too small to read it. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ribbon = size >= RIBBON_MIN_SIZE ? label : undefined;
  const { left, top, g } = glyphBox(size, shape, !!ribbon);
  return (
    <View style={[{ width: size, height: size * BADGE_ASPECT }, style]}>
      <Plate finish={finish} size={size} shape={shape} label={ribbon} />
      <View style={[styles.abs, { left, top, width: g, height: g }]}>
        <Glyph finish={finish} icon={icon} size={size} g={g} />
      </View>
    </View>
  );
}

/* ── The unlock: the badge arrives ────────────────────────────────────────── */

/** How long the fall takes, ms — then it lands. */
const FALL_MS = 300;
/** One slow bob, once it has landed. Whole cycles, so it loops seamlessly. */
const FLOAT_MS = 3600;

/**
 * THE BADGE, ARRIVING — the flame's choreography, for a badge.
 *
 *   · It DROPS from above, stretched thin by the speed; its shadow on the
 *     floor grows and darkens as it comes.
 *   · It LANDS: squashed wide on its lip, then springs back into shape.
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
  shape = "coin",
  label,
  delay = 0,
  float = true,
  onLanded,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  /** Width in points; the height is `size * BADGE_ASPECT`. */
  size: number;
  /** The outline — one per tier (see TIER_SHAPE). */
  shape?: BadgeShape;
  /** The word on the ribbon. Dropped on a badge too small to read it. */
  label?: string;
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
    // Thin while it falls, squashed wide on impact, then back into shape.
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

  const ribbon = size >= RIBBON_MIN_SIZE ? label : undefined;
  const { faceDisc } = badgeGeometry(shape, !!ribbon);
  const faceD = (faceDisc.r / 100) * size * 2;
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.18, 0.82, 1], [0, 0.55, 0.55, 0]),
    transform: [{ translateX: (sheen.value - 0.5) * faceD * 1.7 }, { rotate: "18deg" }],
  }));

  const { left, top, g } = glyphBox(size, shape, !!ribbon);
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
        <Plate finish={finish} size={size} shape={shape} label={ribbon} />
        {/* One pass of light across the face, clipped to its round heart. */}
        <View
          style={[
            styles.abs,
            styles.faceClip,
            {
              left: ((faceDisc.cx - faceDisc.r) / 100) * size,
              top: ((faceDisc.cy - faceDisc.r) / 100) * size,
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
          <Glyph finish={finish} icon={icon} size={size} g={g} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  /** The badge squashes on its lip — the bottom of the drawing, not its middle. */
  origin: { transformOrigin: "50% 95%" },
  floor: { position: "absolute" },
  faceClip: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  sheen: { position: "absolute" },
  ribbonText: { fontWeight: "800", textAlign: "center", includeFontPadding: false },
});
