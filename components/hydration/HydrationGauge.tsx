/**
 * HydrationGauge — a measuring cylinder that fills as you drink.
 *
 * A tall glass with a mark up its side for every glass in the goal and a longer
 * one at each litre, the way a laboratory cylinder is graduated. The water rises
 * to the day's level once, when the level changes, and then it is STILL: nothing
 * here loops. (The classic card's drifting wave and bubbles redraw the whole
 * window sixty times a second on the phones this app is tuned for; this one costs
 * nothing at rest.)
 *
 * The goal is the rim, so a full gauge IS the goal and there is no mark at it —
 * only the glasses below. The marks live in `hydrationLogic.gaugeTicks`.
 *
 * It is decoration for the figure beside it, which already says everything it
 * shows, so it is hidden from a screen reader instead of being read out twice.
 */
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Ease } from "@/components/motion/motion";
import { Gradients, Motion, alpha } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { gaugeTicks } from "./hydrationLogic";

const GLASS_W = 34;
const TICK_W = 14;
const GAP = 6;
const BORDER = 1.5;
const RADIUS = 12;

const GAUGE_WIDTH = GLASS_W + GAP + TICK_W;

const n1 = (v: number) => Math.round(v * 10) / 10;

export function HydrationGauge({
  level,
  goalMl,
  height = 108,
}: {
  /** 0–1: how full the day is. */
  level: number;
  goalMl: number;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  const target = Math.max(0, Math.min(1, level || 0));
  const inner = height - BORDER * 2;

  // Rise from empty on a cold-start reveal; snap on a warm mount. Drinking
  // always animates the change.
  const fill = useSharedValue(reduced || !intro ? target : 0);
  useEffect(() => {
    if (reduced) {
      fill.value = target;
      return;
    }
    fill.value = withTiming(target, { duration: Motion.duration.slow + 240, easing: Ease.standard });
  }, [target, fill, reduced]);

  // Transform only — no layout — so the rise is cheap even on a busy page.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inner * (1 - fill.value) }],
  }));

  const ticks = useMemo(() => {
    let minor = "";
    let major = "";
    for (const t of gaugeTicks(goalMl)) {
      // The glass interior runs from BORDER to height - BORDER.
      const y = n1(BORDER + inner * (1 - t.at));
      if (t.major) major += `M0 ${y}H${TICK_W}`;
      else minor += `M0 ${y}H${TICK_W * 0.6}`;
    }
    return { minor, major };
  }, [goalMl, inner]);

  return (
    <View
      style={{ width: GAUGE_WIDTH, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.glass,
          { width: GLASS_W, height, backgroundColor: alpha(Gradients.water[0], 0.07) },
        ]}
      >
        <Animated.View style={[styles.water, { height: inner }, fillStyle]}>
          <LinearGradient
            colors={Gradients.water}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* The surface: a thin bright line, so the level reads at a glance. */}
          <View style={styles.surface} />
        </Animated.View>
      </View>

      <Svg width={TICK_W} height={height} style={styles.ticks}>
        <Path d={ticks.minor} stroke={alpha("#FFFFFF", 0.4)} strokeWidth={1.25} />
        <Path d={ticks.major} stroke={alpha("#FFFFFF", 0.8)} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: RADIUS,
    borderWidth: BORDER,
    borderColor: alpha("#FFFFFF", 0.34),
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  // Full-height and slid down out of sight; the animated style raises it.
  water: { position: "absolute", left: 0, right: 0, bottom: 0 },
  surface: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: alpha("#FFFFFF", 0.72),
  },
  ticks: { position: "absolute", left: GLASS_W + GAP, top: 0 },
});
