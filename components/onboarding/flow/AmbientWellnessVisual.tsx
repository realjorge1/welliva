/**
 * AmbientWellnessVisual — the quiet visual moment that opens a screen.
 *
 * Every step in the reference language begins with something to look at before
 * it asks anything. These are those moments. They are deliberately almost
 * nothing: a hairline, a few ticks, an arc closing. Their job is to hold the
 * screen for the half-second before the question arrives, so the question
 * reads as the next thing said rather than the first thing shown.
 *
 * Each motif draws itself once on mount and then either rests or drifts. None
 * of them loop fast enough to be noticed, and all of them stop under Reduce
 * Motion.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { useColors } from "@/components/ui";
import { alpha as tint } from "@/constants/theme";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { BreathingPulse, FloatingElement } from "./Ambient";
import { Appear } from "./Appear";
import { Dur, Ease, Stagger, useMotion } from "./onboardingMotion";
import { HAIRLINE, HALO } from "./onboardingTheme";
import { VitalLine } from "./VitalLine";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ─────────────────────────────── Halo ──────────────────────────────────── */

/**
 * Three nested hairline rings behind a hero. Nested rather than stacked as
 * siblings so each one centres inside the last regardless of the container's
 * width — the same structure the de-glow pass introduced, kept because it is
 * what holds a hero without lighting it.
 *
 * The rings are NORMAL flex children, not absolutes: nesting plus centring is
 * what does the work. Giving them `position: absolute` would pin each one to
 * its parent's top-left corner and the halo would sit down and to the
 * right of the mark it is supposed to surround. Callers place the whole halo
 * behind their hero by handing it an absolutely-filled layer to live in.
 */
export function Halo({
  size = 196,
  tone,
  style,
}: {
  size?: number;
  tone: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = (n: number, child?: React.ReactNode) => {
    const d = size * [1, 0.745, 0.52][n];
    return (
      <View
        style={[
          styles.ring,
          { width: d, height: d, borderRadius: d / 2, borderColor: tint(tone, HALO[n]) },
        ]}
      >
        {child}
      </View>
    );
  };
  return (
    <View style={[styles.center, style]} pointerEvents="none">
      {ring(0, ring(1, ring(2)))}
    </View>
  );
}

/* ────────────────────────── The welcome composition ────────────────────── */

/**
 * The opening: the mark alone for the first beat, the halo settling behind it,
 * then the vital line drawing itself underneath. Nothing else is on screen
 * while this plays.
 */
export function WelcomeVisual({ width }: { width: number }) {
  const { colors } = useColors();
  const lineWidth = Math.min(width - 48, 300);
  return (
    <View style={styles.welcome} pointerEvents="none">
      <View style={styles.badgeStage}>
        <Appear
          delay={260}
          duration={Dur.cinematic}
          scaleFrom={0.9}
          distance={0}
          style={styles.haloLayer}
          pointerEvents="none"
        >
          <Halo size={Math.min(width * 0.58, 210)} tone={colors.primary} />
        </Appear>
        <Appear delay={0} duration={Dur.content} scaleFrom={0.94} distance={0}>
          <BreathingPulse scale={1.02} opacityFrom={0.94}>
            <AILogoBadge size={66} />
          </BreathingPulse>
        </Appear>
      </View>
      <Appear delay={450} duration={Dur.ui} distance={0}>
        <VitalLine
          progress={1}
          width={lineWidth}
          tone={colors.primary}
          trackOpacity={0.07}
          strokeWidth={HAIRLINE + 0.15}
          duration={900}
          delay={0}
        />
      </Appear>
    </View>
  );
}

/* ──────────────────────── Per-question motifs ──────────────────────────── */

/**
 * MEASURE — a vertical hairline with a few ticks, for "a little about you".
 * A measuring edge, not a medical chart: the ticks are uneven and unlabelled.
 */
export function MeasureMotif({ tone, height = 54 }: { tone: string; height?: number }) {
  const ticks = [0.16, 0.38, 0.62, 0.86];
  return (
    <View style={[styles.measure, { height }]} pointerEvents="none">
      <Appear delay={0} duration={Dur.content} distance={0}>
        <View style={[styles.measureRule, { height, backgroundColor: tint(tone, 0.28) }]} />
      </Appear>
      {ticks.map((t, i) => (
        <Appear
          key={t}
          delay={Stagger.layer + i * Stagger.item}
          duration={Dur.ui}
          distance={0}
          style={[styles.tickWrap, { top: height * t }]}
        >
          <View
            style={[
              styles.tick,
              {
                width: i % 2 === 0 ? 13 : 8,
                backgroundColor: tint(tone, i % 2 === 0 ? 0.5 : 0.3),
              },
            ]}
          />
        </Appear>
      ))}
    </View>
  );
}

/**
 * SAFETY — a hairline circle that completes itself around a small mark. The
 * health step motif: something closing protectively, never a warning glyph.
 */
export function SafetyMotif({ tone, size = 56 }: { tone: string; size?: number }) {
  const motion = useMotion();
  const r = size / 2 - HAIRLINE;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      motion.delay(120),
      withTiming(1, { duration: motion.dur(Dur.cinematic), easing: Ease.draw }),
    );
  }, [motion, p]);

  const offset = useDerivedValue(() => c * (1 - p.value));
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={HAIRLINE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c + " " + c}
          animatedProps={animatedProps}
          // Start the draw at 12 o'clock rather than 3.
          transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
        />
      </Svg>
      <Appear delay={Dur.cinematic * 0.55} duration={Dur.ui} distance={0} scaleFrom={0.8}>
        <View style={[styles.safetyDot, { backgroundColor: tint(tone, 0.9) }]} />
      </Appear>
    </View>
  );
}

/**
 * INGREDIENTS — three soft line-art forms (a leaf, a seed, a bowl rim) that
 * drift out of phase. Abstract on purpose: a photograph of food would date the
 * screen and contradict a diet the user has not chosen yet.
 */
export function IngredientMotif({ tone, width = 190 }: { tone: string; width?: number }) {
  const h = width * 0.3;
  const stroke = tint(tone, 0.5);
  const forms = [
    { d: "M30 6 C 45 12, 48 30, 30 36 C 12 30, 15 12, 30 6 M30 8 L30 36", amp: 4 },
    { d: "M30 8 C 40 16, 40 28, 30 36 C 20 28, 20 16, 30 8", amp: 6 },
    { d: "M10 18 C 16 34, 44 34, 50 18 M6 16 L54 16", amp: 5 },
  ];
  return (
    <View style={styles.ingredients} pointerEvents="none">
      {forms.map((f, i) => (
        <Appear
          key={f.d}
          delay={i * Stagger.item}
          duration={Dur.content}
          distance={0}
          scaleFrom={0.9}
        >
          <FloatingElement amplitude={f.amp} delay={i * 900}>
            <Svg width={width / 3.4} height={h} viewBox="0 0 60 42">
              <Path
                d={f.d}
                stroke={stroke}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </FloatingElement>
        </Appear>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
  /** The layer a halo is dropped into so it sits BEHIND, not above, its hero. */
  haloLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  welcome: { alignItems: "center", justifyContent: "center" },
  badgeStage: { alignItems: "center", justifyContent: "center", height: 172 },

  measure: { width: 22, alignItems: "flex-start", justifyContent: "flex-start" },
  measureRule: { width: HAIRLINE, borderRadius: 1 },
  tickWrap: { position: "absolute", left: 3 },
  tick: { height: HAIRLINE, borderRadius: 1 },

  safetyDot: { width: 7, height: 7, borderRadius: 4 },

  ingredients: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
});
