/**
 * FLAME — welliva's one celebration.
 *
 * The owner's brief (2026-10-15): the confetti, the twinkling stars and the
 * glowing medallion were "too noisy, too amateur — and boring". The reference
 * was Duolingo's streak flame: one simple object, beautifully timed. So this is
 * the whole celebration now — a flame that catches, settles and flickers. No
 * particles, no rays, no burst.
 *
 * OUR OWN DRAWING, in that style rather than a trace of anyone's asset: a
 * chunky flat body with BLUNT tips (a pointed tip reads as an emoji; a rounded
 * one reads as a character), the main tongue leaning right with a small one on
 * the left, a three-tone heart (amber → gold → pale core) and one stroke of
 * shine. On a light ground it stands on a pale warm floor shadow; on a dark one
 * that shadow would read as a hole, so it becomes light cast on the floor plus
 * a faint halo behind the body.
 *
 * ── HOW IT MOVES ────────────────────────────────────────────────────────────
 *
 * NOTHING IS REDRAWN PER FRAME. The shapes are static SVG built once; every bit
 * of motion is a transform on the view that holds them, anchored at the base of
 * the flame (`transformOrigin`), so the body sways and stretches while its foot
 * stays planted on the floor. That is also what makes it cheap enough for the
 * 1 GB phones this app is tested on — three views moving, not paths morphing.
 *
 *   ignite  — sprouts out of the floor: stretched tall and thin, squashed wide,
 *             settled. The heart pops a beat later, so the flame lands as two
 *             objects, which is what makes it look alive rather than scaled.
 *   light   — starts OUT (grey), tries once (a small shiver), then catches:
 *             fire grows out of the foot of the grey shell until it swallows
 *             it, the heart pops, and the whole flame jumps. This is the
 *             daily-commitment beat — the
 *             flame you see go grey on a day you have not shown up yet is the
 *             same object that lights here.
 *   still   — drawn lit, no entrance (a returning screen, reduce-motion).
 *
 * THE FLICKER IS ONE CLOCK. A single linear 0→1 loop drives every layer, each
 * reading its own sway and stretch as whole-number cycles of it, so the loop
 * point is seamless and nothing can drift out of phase. The body sways ±2°,
 * the heart counter-sways at a different rate, and the floor shadow shrinks as
 * the flame stretches up — the small physical tell that sells it. Amplitude is
 * ridden in by `flickerGain` after the entrance, so the idle motion never
 * fights the landing.
 *
 * Reduce-motion gets the lit flame, still, and `onLit` straight away.
 */
import { useColors } from "@/components/ui/useColors";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
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
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/* ── The drawing (viewBox 0 0 100 125; the flame stands on y≈117) ─────────── */

const VIEWBOX = "0 0 100 125";
/** Width : height of the drawing box. */
export const FLAME_ASPECT = 1.25;

const OUTER =
  "M50 117 C23 117 4 99 4 76 C4 58 10 44 15 33 C17 28 22 27 24 31 C27 37 30 41 35 44 " +
  "C38 34 42 22 49 13 C53 8 58 5 62 6 C67 7 68 12 66 17 C64 26 70 34 79 43 " +
  "C90 54 96 65 96 78 C96 100 77 117 50 117 Z";
const INNER =
  "M50 113 C34 113 25 103 25 90 C25 78 34 70 42 62 C47 57 50 52 52 46 " +
  "C53 43 57 43 58 46 C62 55 71 66 74 76 C75 80 75 85 75 90 C75 103 66 113 50 113 Z";
const CORE =
  "M50 110 C41 110 36 104 36 97 C36 90 42 85 47 80 C49 78 51 75 52 72 " +
  "C53 70 55 70 56 72 C58 78 63 84 64 90 C65 93 65 95 65 97 C65 104 59 110 50 110 Z";
const SHINE = "M15 88 C14 78 16 69 20 62";

/**
 * Fixed hexes, like the badge metals: a flame is the colour of a flame in
 * either theme. Only the UNLIT state follows the ground it sits on.
 */
export const FLAME_COLORS = {
  outer: "#FF8A1C",
  inner: "#FFC23A",
  core: "#FFE68A",
  shine: "#FFD08A",
  floor: "#FFB547",
} as const;

const UNLIT = {
  dark: { outer: "#3A3C42", inner: "#4A4D54" },
  light: { outer: "#D5D8DE", inner: "#E4E6EA" },
} as const;

/** Where the flame stands, as a transform origin — the middle of its foot. */
const ORIGIN = "50% 93.6%";

/* ── Timing ───────────────────────────────────────────────────────────────── */

/** One flicker loop. Every layer runs whole cycles of it, so it loops seamlessly. */
const FLICKER_MS = 3600;
/** The shiver before a grey flame catches. */
const SHIVER_MS = 380;
/** How long the fire takes to grow out to the edges of the grey shell. */
const CATCH_MS = 380;

export type FlameEntrance = "ignite" | "light" | "still";

export interface FlameProps {
  /** Width of the drawing in points; its height is `size * FLAME_ASPECT`. */
  size: number;
  entrance?: FlameEntrance;
  /**
   * Draw it OUT — grey, still, no heart. A day not kept yet. Overrides the
   * entrance: an unlit flame has nothing to celebrate.
   */
  unlit?: boolean;
  /** Idle flicker once lit. Leave off for small glyphs that sit on a screen. */
  flicker?: boolean;
  /** Wait this long before the entrance starts, ms. */
  delay?: number;
  /** Fired once, the moment the flame is fully lit. */
  onLit?: () => void;
  /** Halo + floor light. Defaults on in the dark theme, off in light. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Flame({
  size,
  entrance = "ignite",
  unlit = false,
  flicker = true,
  delay = 0,
  onLit,
  glow,
  style,
}: FlameProps) {
  const { isDark } = useColors();
  const reduceMotion = useReducedMotion();
  const showGlow = (glow ?? isDark) && !unlit;
  const lightsUp = entrance === "light" && !unlit;
  /** Anything may move at all: lit, and motion not reduced. */
  const canMove = !unlit && !reduceMotion;
  /** There is an entrance to play. */
  const animated = canMove && entrance !== "still";

  /* Body squash-and-stretch, the shiver, the fire catching, the heart. */
  const growX = useSharedValue(animated && entrance === "ignite" ? 0.55 : 1);
  const growY = useSharedValue(animated && entrance === "ignite" ? 0 : 1);
  const bodyIn = useSharedValue(animated && entrance === "ignite" ? 0 : 1);
  const shiver = useSharedValue(0);
  const fill = useSharedValue(animated && lightsUp ? 0 : 1);
  const heart = useSharedValue(animated ? 0 : 1);
  const floor = useSharedValue(animated && entrance === "ignite" ? 0 : 1);
  /* Idle motion: one clock, ridden in after the landing. */
  const clock = useSharedValue(0);
  const flickerGain = useSharedValue(0);

  useEffect(() => {
    const done = () => onLit?.();

    if (canMove && flicker) {
      const lands = !animated
        ? delay
        : delay + (entrance === "ignite" ? 520 : SHIVER_MS + CATCH_MS + 420);
      clock.value = withDelay(
        lands,
        withRepeat(withTiming(1, { duration: FLICKER_MS, easing: Easing.linear }), -1, false),
      );
      flickerGain.value = withDelay(lands, withTiming(1, { duration: 600 }));
    }
    const stop = () => {
      cancelAnimation(clock);
      cancelAnimation(flickerGain);
    };

    if (!animated) {
      // Nothing to watch arrive — but a lit flame is still lit, and whoever
      // is waiting on it (the commitment count) should not wait forever.
      if (!unlit) done();
      return stop;
    }

    const settle = { damping: 9, stiffness: 210, mass: 0.8 };
    const heartPop = { damping: 7, stiffness: 230, mass: 0.7 };

    if (entrance === "ignite") {
      floor.value = withDelay(delay, withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }));
      bodyIn.value = withDelay(delay, withTiming(1, { duration: 90 }));
      // Out of the floor tall and thin, squashed wide, then settled.
      growY.value = withDelay(
        delay,
        withSequence(
          withTiming(1.18, { duration: 280, easing: Easing.out(Easing.cubic) }),
          withTiming(0.9, { duration: 130, easing: Easing.inOut(Easing.quad) }),
          withSpring(1, settle),
        ),
      );
      growX.value = withDelay(
        delay,
        withSequence(
          withTiming(0.9, { duration: 280, easing: Easing.out(Easing.cubic) }),
          withTiming(1.08, { duration: 130, easing: Easing.inOut(Easing.quad) }),
          withSpring(1, settle),
        ),
      );
      heart.value = withDelay(
        delay + 170,
        withSpring(1, heartPop, (fin) => {
          if (fin) runOnJS(done)();
        }),
      );
    } else {
      // "light": a shiver — it tries — then fire grows out from the foot of
      // the grey shell, overshooting just enough to swallow its edge.
      const caught = delay + SHIVER_MS;
      shiver.value = withDelay(
        delay,
        withSequence(
          withTiming(-4, { duration: SHIVER_MS * 0.25 }),
          withTiming(4, { duration: SHIVER_MS * 0.3 }),
          withTiming(-2, { duration: SHIVER_MS * 0.25 }),
          withTiming(0, { duration: SHIVER_MS * 0.2 }),
        ),
      );
      fill.value = withDelay(
        caught,
        withTiming(1, { duration: CATCH_MS, easing: Easing.out(Easing.back(1.5)) }, (fin) => {
          if (fin) runOnJS(done)();
        }),
      );
      // The overshoot covers the shell about halfway through the catch; that
      // is the moment the heart lands and the whole flame jumps.
      const bounce = caught + CATCH_MS * 0.5;
      growY.value = withDelay(
        bounce,
        withSequence(
          withTiming(1.12, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(0.94, { duration: 120, easing: Easing.inOut(Easing.quad) }),
          withSpring(1, settle),
        ),
      );
      growX.value = withDelay(
        bounce,
        withSequence(
          withTiming(0.93, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(1.05, { duration: 120, easing: Easing.inOut(Easing.quad) }),
          withSpring(1, settle),
        ),
      );
      heart.value = withDelay(bounce, withSpring(1, heartPop));
    }

    return stop;
    // The entrance plays once per mount. Re-keying the component replays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyStyle = useAnimatedStyle(() => {
    const t = clock.value * Math.PI * 2;
    const g = flickerGain.value;
    const sway = 2.2 * Math.sin(3 * t) * g;
    const stretch = 0.03 * Math.sin(4 * t + 1.1) * g;
    return {
      opacity: bodyIn.value,
      transform: [
        { rotate: `${shiver.value}deg` },
        { skewX: `${sway}deg` },
        { scaleX: growX.value * (1 - stretch * 0.5) },
        { scaleY: growY.value * (1 + stretch) },
      ],
    };
  });

  const heartStyle = useAnimatedStyle(() => {
    const t = clock.value * Math.PI * 2;
    const g = flickerGain.value;
    const sway = -3.6 * Math.sin(4 * t + 0.6) * g;
    const stretch = 0.07 * Math.sin(5 * t + 2) * g;
    return {
      transform: [
        { skewX: `${sway}deg` },
        { scaleX: heart.value * (1 - stretch * 0.5) },
        { scaleY: heart.value * (1 + stretch) },
      ],
    };
  });

  const floorStyle = useAnimatedStyle(() => {
    const t = clock.value * Math.PI * 2;
    const stretch = 0.03 * Math.sin(4 * t + 1.1) * flickerGain.value;
    return {
      opacity: floor.value,
      // Shrinks as the flame stretches up, spreads as it squats.
      transform: [{ scaleX: floor.value * (1 - stretch * 1.4) }],
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, heart.value) * 0.9 * Math.min(1, fill.value * 1.4),
  }));

  // The fire catching: the lit body grows out of the foot of the grey one —
  // the same shape, scaled from the floor up — so the fire is visibly INSIDE
  // the unlit flame until it fills it. (A straight wipe up the body was tried
  // first; it read as a glass filling, not a flame catching.)
  const catchStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.3 + 0.7 * fill.value }, { scaleY: fill.value }],
  }));

  const boxH = size * FLAME_ASPECT;
  const box = { width: size, height: boxH };
  const unlitTone = isDark ? UNLIT.dark : UNLIT.light;

  return (
    <View style={[box, style]} pointerEvents="none">
      {showGlow ? (
        <Animated.View
          style={[
            styles.abs,
            {
              left: -size * 0.35,
              top: size * 0.72 - size * 0.85,
              width: size * 1.7,
              height: size * 1.7,
            },
            haloStyle,
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="flameHalo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={FLAME_COLORS.outer} stopOpacity={0.3} />
                <Stop offset="0.55" stopColor={FLAME_COLORS.outer} stopOpacity={0.1} />
                <Stop offset="1" stopColor={FLAME_COLORS.outer} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#flameHalo)" />
          </Svg>
        </Animated.View>
      ) : null}

      {/* The floor. A pale warm shadow on light ground, cast light on dark. */}
      {!unlit ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.origin, floorStyle]}>
          <Svg width="100%" height="100%" viewBox={VIEWBOX}>
            {showGlow ? (
              <>
                <Defs>
                  <RadialGradient id="flameFloor" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={FLAME_COLORS.floor} stopOpacity={0.5} />
                    <Stop offset="1" stopColor={FLAME_COLORS.floor} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="50" cy="119" rx="44" ry="7" fill="url(#flameFloor)" />
              </>
            ) : (
              <Ellipse cx="50" cy="119" rx="36" ry="5.5" fill={FLAME_COLORS.floor} opacity={0.34} />
            )}
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, styles.origin, bodyStyle]}>
        {/* OUT: the grey flame. Under the lit one, so the colour climbs over it. */}
        {unlit || lightsUp ? (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEWBOX}>
            <Path d={OUTER} fill={unlitTone.outer} />
            <Path d={INNER} fill={unlitTone.inner} />
          </Svg>
        ) : null}

        {!unlit ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, styles.origin, catchStyle]}>
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEWBOX}>
                <Path d={OUTER} fill={FLAME_COLORS.outer} />
                <Path
                  d={SHINE}
                  stroke={FLAME_COLORS.shine}
                  strokeWidth={5.5}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.6}
                />
              </Svg>
            </Animated.View>

            {/* The heart — its own object, so it can pop and counter-sway. */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.origin, heartStyle]}>
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEWBOX}>
                <Path d={INNER} fill={FLAME_COLORS.inner} />
                <Path d={CORE} fill={FLAME_COLORS.core} />
              </Svg>
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * The flame as a plain glyph — no hooks, no animation, one Svg. For rows and
 * strips where it sits on a screen all day (a flickering icon on Home is a
 * perpetual animation the low-end phones pay for on every frame).
 */
export function FlameGlyph({
  size,
  unlit = false,
  dark,
}: {
  /** Width in points; height is `size * FLAME_ASPECT`. */
  size: number;
  unlit?: boolean;
  /** Which ground the UNLIT grey is chosen for. Lit colours never change. */
  dark: boolean;
}) {
  const tone = dark ? UNLIT.dark : UNLIT.light;
  return (
    <Svg width={size} height={size * FLAME_ASPECT} viewBox={VIEWBOX}>
      <Path d={OUTER} fill={unlit ? tone.outer : FLAME_COLORS.outer} />
      <Path d={INNER} fill={unlit ? tone.inner : FLAME_COLORS.inner} />
      {!unlit ? <Path d={CORE} fill={FLAME_COLORS.core} /> : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  origin: { transformOrigin: ORIGIN },
});
