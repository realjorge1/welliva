/**
 * WaterTracker — the hydration hero. A circular progress ring (same visual
 * language as the calorie/macro rings) whose interior orb fills with a live,
 * drifting water wave. A bold liters readout sits alongside, with quick-add
 * pills that give a subtle pulse + haptic on every pour.
 */

import { AppText, Card, Ring, useColors } from "@/components/ui";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useProfile } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/utils/haptics";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const WATER_GOAL_FALLBACK = 2500;
const GLASS_SIZE = 250;
const QUICK_ADDS = [150, 250, 500];

// Ring + interior orb geometry. The orb tucks inside the ring's clear center
// with a small gap so it never touches the gradient stroke.
const RING_SIZE = 118;
const RING_STROKE = 9;
const ORB = 90;
// Wave: crest amplitude + how much solid water hangs below the crest so the
// trough never exposes a seam above the solid body.
const AMP = 6;
const WAVE_H = AMP * 2 + 44;
const WAVE_TOTAL_W = ORB * 2; // two wavelengths → seamless -ORB loop
const WAVE_COLOR = "#8FD8FB";

// Rising bubbles: a small fixed pool, each with its own size + horizontal sway.
// A burst occasionally sends 2–3 of them up from the floor to the surface.
const BUBBLES = [
  { size: 3, drift: 3 },
  { size: 2.5, drift: -3 },
  { size: 3.5, drift: 2 },
];

/** Static two-period sine crest, filled down to WAVE_H. Built once. */
const WAVE_PATH = (() => {
  const period = ORB;
  const steps = 48;
  const dx = WAVE_TOTAL_W / steps;
  let d = `M 0 ${AMP.toFixed(2)}`;
  for (let i = 1; i <= steps; i++) {
    const x = dx * i;
    const y = AMP + AMP * Math.sin((x / period) * Math.PI * 2);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += ` L ${WAVE_TOTAL_W} ${WAVE_H} L 0 ${WAVE_H} Z`;
  return d;
})();

export default function WaterTracker() {
  const { colors } = useColors();
  const { consumedNutrition, addWater } = useNutrition();
  const { userGoals, nutritionTargets } = useProfile();

  const waterGoal =
    userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? WATER_GOAL_FALLBACK;
  const waterIntake = consumedNutrition?.waterMl || 0;

  const progress = Math.min(waterIntake / waterGoal, 1);
  const pct = Math.round(progress * 100);
  const glassesConsumed = Math.floor(waterIntake / GLASS_SIZE);
  const glassesNeeded = Math.max(1, Math.ceil(waterGoal / GLASS_SIZE));
  const remainingMl = Math.max(waterGoal - waterIntake, 0);
  const reached = remainingMl === 0;

  const pulse = useRef(new Animated.Value(1)).current;

  const handleAdd = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.05, useNativeDriver: true, tension: 320, friction: 8 }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, tension: 320, friction: 9 }),
    ]).start();
    addWater(amount);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Ring
            progress={progress}
            size={RING_SIZE}
            strokeWidth={RING_STROKE}
            gradient={Gradients.water}
          >
            <WaterOrb progress={progress} empty={colors.surfaceSunken} pct={pct} textColor={colors.text} />
          </Ring>
        </Animated.View>

        <View style={styles.info}>
          <View style={styles.litersRow}>
            <AppText variant="display" style={styles.liters}>
              {(waterIntake / 1000).toFixed(2)}
            </AppText>
            <AppText variant="headline" color="tertiary" style={styles.unit}>
              L
            </AppText>
          </View>
          <AppText variant="footnote" color="tertiary" numberOfLines={1}>
            of {(waterGoal / 1000).toFixed(1)}L · {glassesConsumed}/{glassesNeeded} glasses
          </AppText>

          <View style={styles.statusRow}>
            <Ionicons
              name={reached ? "checkmark-circle" : "water-outline"}
              size={16}
              color={reached ? colors.success : colors.water}
            />
            <AppText variant="subhead" color="secondary" numberOfLines={1} style={styles.flex}>
              {reached ? "Goal reached 🎉" : `${remainingMl} ml to go`}
            </AppText>
          </View>
        </View>
      </View>

      {/* ── Quick add ── */}
      <View style={styles.actions}>
        {QUICK_ADDS.map((amount) => {
          const primary = amount === GLASS_SIZE;
          return (
            <Pressable
              key={amount}
              onPress={() => handleAdd(amount)}
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: primary ? colors.water : alpha(colors.water, 0.12),
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Ionicons name="add" size={16} color={primary ? "#FFFFFF" : colors.water} />
              <AppText
                variant="callout"
                color={primary ? "#FFFFFF" : colors.water}
                style={styles.addLabel}
              >
                {amount}ml
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/* ── Circular water-fill orb (sits inside the progress Ring) ── */

function WaterOrb({
  progress,
  empty,
  pct,
  textColor,
}: {
  progress: number;
  empty: string;
  pct: number;
  textColor: string;
}) {
  const intro = useIntroReveal();
  // Fill up from empty only on a cold-start reveal; on warm mounts start at the
  // real level so it snaps. Pouring water still animates the rise either way.
  const level = useRef(new Animated.Value(intro ? 0 : progress)).current;
  const drift = useRef(new Animated.Value(0)).current;

  // Fill rises to the current level with the app's hero curve.
  useEffect(() => {
    Animated.timing(level, {
      toValue: progress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, level]);

  // Endless horizontal drift of the wave crest (one wavelength, then repeat).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const bodyHeight = level.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ORB],
  });
  const waveX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -ORB],
  });

  return (
    <View style={[styles.orb, { backgroundColor: empty }]}>
      <Animated.View style={[styles.body, { height: bodyHeight }]}>
        <LinearGradient
          colors={Gradients.water}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.wave, { transform: [{ translateX: waveX }] }]}>
          <Svg width={WAVE_TOTAL_W} height={WAVE_H}>
            <Path d={WAVE_PATH} fill={WAVE_COLOR} />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Bubbles live in a layer clipped to the water line, so they pop at the surface. */}
      <Animated.View style={[styles.bubbleLayer, { height: bodyHeight }]} pointerEvents="none">
        <Bubbles progress={progress} />
      </Animated.View>

      <View style={[StyleSheet.absoluteFill, styles.orbCenter]} pointerEvents="none">
        <View style={styles.pctRow}>
          <AppText variant="title" style={[styles.pctNum, { color: textColor }]}>
            {pct}
          </AppText>
          <AppText variant="footnote" style={[styles.pctSign, { color: textColor }]}>
            %
          </AppText>
        </View>
      </View>
    </View>
  );
}

/* ── Rising bubbles (burst every few seconds, only when there's water) ── */

function Bubbles({ progress }: { progress: number }) {
  // Keep the latest fill in a ref so the long-lived scheduler reads it live.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const rises = useRef(BUBBLES.map(() => new Animated.Value(0))).current;
  const bases = useRef(BUBBLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const burst = () => {
      if (cancelled) return;
      // Skip the burst when the orb is essentially empty.
      if (progressRef.current > 0.05) {
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        const count = 2 + Math.round(Math.random()); // 2 or 3
        order.slice(0, count).forEach((i, k) => {
          bases[i].setValue(6 + Math.random() * (ORB - 18));
          rises[i].setValue(0);
          // Small stagger so they don't all launch on the same frame.
          setTimeout(() => {
            if (cancelled) return;
            Animated.timing(rises[i], {
              toValue: 1,
              duration: 1700 + Math.random() * 900,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }).start();
          }, k * (140 + Math.random() * 160));
        });
      }
      timer = setTimeout(burst, 3200 + Math.random() * 3400); // 3.2–6.6s between bursts
    };

    timer = setTimeout(burst, 1200 + Math.random() * 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bases, rises]);

  return (
    <>
      {BUBBLES.map((cfg, i) => {
        const translateY = rises[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-2, -(ORB + 6)],
        });
        const wobble = rises[i].interpolate({
          inputRange: [0, 0.35, 0.7, 1],
          outputRange: [0, cfg.drift, -cfg.drift, 0],
        });
        const opacity = rises[i].interpolate({
          inputRange: [0, 0.12, 0.75, 1],
          outputRange: [0, 0.85, 0.7, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.bubble,
              {
                width: cfg.size * 2,
                height: cfg.size * 2,
                borderRadius: cfg.size,
                opacity,
                transform: [{ translateX: bases[i] }, { translateY }, { translateX: wobble }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.screen },
  flex: { flex: 1 },

  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },

  // Circular water orb
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  body: { position: "absolute", left: 0, right: 0, bottom: 0 },
  wave: { position: "absolute", top: -AMP, left: 0 },

  // Bubble layer is clipped to the current water height so bubbles vanish at the surface.
  bubbleLayer: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  bubble: {
    position: "absolute",
    left: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  orbCenter: { alignItems: "center", justifyContent: "center" },
  pctRow: { flexDirection: "row", alignItems: "baseline" },
  pctNum: { fontWeight: "800" },
  pctSign: { fontWeight: "700", marginLeft: 1 },

  // Readout
  info: { flex: 1, gap: 4 },
  litersRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  liters: { fontWeight: "800" },
  unit: { marginBottom: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },

  // Quick add
  actions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 46,
    borderRadius: Radius.md,
  },
  addLabel: { fontWeight: "700" },
});
