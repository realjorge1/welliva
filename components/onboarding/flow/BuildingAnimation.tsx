/**
 * BuildingAnimation — the moment the plan is actually being made.
 *
 * No spinner, no percentage, no fake technical log. A spinner says "the device
 * is busy"; this says "something is being made for you". The whole composition
 * is three things: the mark breathing, one hairline ring drawing itself around
 * it, and a single sentence at a time.
 *
 * THE MESSAGES SOFTEN RATHER THAN CUT. Each line leaves by fading out while
 * drifting up and shrinking a hair — the closest honest equivalent to the
 * reference's blur, since React Native cannot blur live text without a
 * full-screen blur layer that would cost more than the effect is worth.
 *
 * IT WAITS FOR SOMETHING REAL. The beat holds for `minimumMs`, but it will not
 * end until `ready` is true — that is the lazily-loaded diet library and
 * exercise pool, which the plan reveal reads synchronously. So the pause is not
 * theatre with a timer behind it: on a slow device it genuinely covers work,
 * and on a fast one it is the beat the moment deserves.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { BreathingPulse } from "./Ambient";
import { AnimatedText } from "./AnimatedText";
import { Dur, Ease, useMotion } from "./onboardingMotion";
import { HAIRLINE } from "./onboardingTheme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 148;

export interface BuildingAnimationProps {
  /** The rotating lines. Shown in order, evenly across the beat. */
  lines: string[];
  /** Floor for how long the beat lasts. */
  minimumMs?: number;
  /** Gate: the beat will not finish until this is true. */
  ready?: boolean;
  onComplete: () => void;
}

export function BuildingAnimation({
  lines,
  minimumMs = 2000,
  ready = true,
  onComplete,
}: BuildingAnimationProps) {
  const { colors } = useColors();
  const motion = useMotion();
  const [index, setIndex] = useState(0);
  const done = useRef(false);
  const elapsed = useRef(false);

  // One hairline ring, drawn once around the mark over the life of the beat.
  const r = RING / 2 - HAIRLINE;
  const c = 2 * Math.PI * r;
  const draw = useSharedValue(0);

  useEffect(() => {
    draw.value = withDelay(
      motion.delay(200),
      withTiming(1, { duration: motion.dur(minimumMs - 200), easing: Ease.draw }),
    );
  }, [minimumMs, motion, draw]);

  // Rotate the lines evenly across the floor duration.
  useEffect(() => {
    const per = Math.max(360, Math.floor(minimumMs / lines.length));
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), per);
    return () => clearInterval(t);
  }, [lines.length, minimumMs]);

  // `onComplete` and `ready` are read through refs so the floor timer is armed
  // exactly ONCE. In the dependency array they would re-arm it on every render
  // — and this component re-renders four times as its lines rotate, so the beat
  // would keep pushing its own finish line away.
  const finish = useRef(onComplete);
  finish.current = onComplete;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const settle = React.useCallback(() => {
    if (done.current || !elapsed.current || !readyRef.current) return;
    done.current = true;
    finish.current();
  }, []);

  // Finish when BOTH the floor has passed and the catalogs are warm.
  useEffect(() => {
    const t = setTimeout(() => {
      elapsed.current = true;
      settle();
    }, minimumMs);
    return () => clearTimeout(t);
  }, [minimumMs, settle]);

  // …and again if the catalogs land after the floor already expired.
  useEffect(() => {
    if (ready) settle();
  }, [ready, settle]);

  const offset = useDerivedValue(() => c * (1 - draw.value));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={alpha(colors.primary, 0.08)}
            strokeWidth={HAIRLINE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={alpha(colors.primary, 0.75)}
            strokeWidth={HAIRLINE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c + " " + c}
            animatedProps={ringProps}
            transform={"rotate(-90 " + RING / 2 + " " + RING / 2 + ")"}
          />
        </Svg>
        <BreathingPulse scale={1.035} opacityFrom={0.9} duration={2400}>
          <AILogoBadge size={76} />
        </BreathingPulse>
      </View>

      <AnimatedText variant="statement" align="center" delay={120} duration={Dur.content}>
        Building your plan
      </AnimatedText>

      {/* One sentence at a time, in a fixed slot so the composition never
          shifts as the wording changes length. */}
      <View style={styles.lineSlot}>
        {lines.map((line, i) => (
          <BuildLine key={line} text={line} active={i === index} />
        ))}
      </View>
    </View>
  );
}

function BuildLine({ text, active }: { text: string; active: boolean }) {
  const motion = useMotion();
  const p = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, {
      duration: motion.dur(active ? Dur.ui : Dur.ui * 0.7),
      easing: active ? Ease.soft : Ease.exit,
    });
  }, [active, motion, p]);

  // Resolved on the JS side. A worklet may only close over plain values —
  // calling `motion.dist` from inside one would be a non-worklet call on the
  // UI thread, which throws at runtime rather than at build time.
  const rise = motion.dist(8);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: rise * (1 - p.value) },
      { scale: 0.985 + 0.015 * p.value },
    ],
  }));

  return (
    <Animated.View style={[styles.line, style]} pointerEvents="none">
      <AppText
        variant="bodyLg"
        color="secondary"
        align="center"
        accessibilityLiveRegion={active ? "polite" : "none"}
        importantForAccessibility={active ? "yes" : "no-hide-descendants"}
      >
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: Spacing.lg },
  stage: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  lineSlot: { height: 30, alignSelf: "stretch", justifyContent: "center" },
  line: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
