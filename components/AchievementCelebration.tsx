/**
 * CELEBRATION HOST
 *
 * The app-wide unlock moment. Hosted once at the root (see app/_layout.tsx) so a
 * celebration earned on ANY screen — an achievement, a finished monthly
 * challenge, a goal/chapter milestone — pops immediately. Reads the unified
 * celebration queue from AppContext and shows them one at a time.
 *
 * It is source-agnostic: it renders a normalized `Celebration` (see
 * services/CelebrationService), so achievements, challenges, and chapters all
 * flow through the same medallion + confetti without special-casing here. The
 * confetti volume follows `celebration.intensity` — the maturity dial.
 */

import { Confetti } from "@/components/Confetti";
import { AppText, Button, useColors } from "@/components/ui";
import { useTheme } from "@/components/ThemeContext";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";

const SPARKLES = [
  { x: -86, y: -54, size: 10, delay: 120 },
  { x: 92, y: -38, size: 7, delay: 220 },
  { x: -72, y: 60, size: 8, delay: 320 },
  { x: 80, y: 64, size: 11, delay: 200 },
  { x: 0, y: -96, size: 9, delay: 380 },
  { x: -104, y: 6, size: 6, delay: 280 },
  { x: 104, y: 14, size: 8, delay: 160 },
];

export function AchievementCelebration() {
  const { colors } = useColors();
  const { isDarkMode } = useTheme();
  const { celebrations, dismissCelebration } = useSystem();
  const current = celebrations[0] ?? null;
  const visible = current != null;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    glow.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 90,
        friction: 9,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, current?.id, scale, opacity, glow]);

  if (!current) return null;

  const accent = current.accent;
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const handleCta = () => {
    const route = current.cta?.route;
    dismissCelebration();
    if (route) router.push(route as never);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={dismissCelebration}>
      <View style={styles.root}>
        <BlurView
          intensity={36}
          tint={isDarkMode ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={dismissCelebration} />

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: alpha(accent, 0.5),
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <AppText variant="footnote" color="tertiary" align="center" style={styles.eyebrow}>
            {current.eyebrow}
          </AppText>

          {/* Glowing medallion */}
          <View style={styles.medallionWrap}>
            {SPARKLES.map((s, i) => (
              <Sparkle key={i} {...s} color={accent} />
            ))}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  backgroundColor: alpha(accent, 0.18),
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            <LinearGradient
              colors={[alpha(accent, 0.95), alpha(accent, 0.6)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.medallion}
            >
              <Ionicons name={current.icon} size={52} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <AppText variant="title" align="center" style={styles.name}>
            {current.title}
          </AppText>
          <AppText variant="subhead" color="secondary" align="center" style={styles.desc}>
            {current.description}
          </AppText>

          <View style={[styles.tierRow, { backgroundColor: alpha(accent, 0.14) }]}>
            <Ionicons name={current.badgeIcon} size={15} color={accent} />
            <AppText variant="caption" style={[styles.tierLabel, { color: accent }]}>
              {current.badgeLabel}
            </AppText>
          </View>

          {current.meta && (
            <AppText variant="caption" color="tertiary" align="center" style={styles.meta}>
              {current.meta}
            </AppText>
          )}

          {current.cta ? (
            <View style={styles.ctaCol}>
              <Button label={current.cta.label} icon={current.cta.icon} onPress={handleCta} style={styles.btn} />
              <Button label="Later" variant="ghost" onPress={dismissCelebration} style={styles.btnGhost} />
            </View>
          ) : (
            <Button label="Nice!" icon="checkmark" onPress={dismissCelebration} style={styles.btn} />
          )}
        </Animated.View>

        {/* Headline burst — keyed by id so every new celebration re-fires once. */}
        <Confetti key={current.id} tierColor={accent} intensity={current.intensity} />
      </View>
    </Modal>
  );
}

function Sparkle({
  x,
  y,
  size,
  delay,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] });
  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateX: x }, { translateY: y }, { scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: "center",
  },
  eyebrow: { letterSpacing: 2, fontWeight: "700" },
  medallionWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.md,
  },
  glowRing: { position: "absolute", width: 132, height: 132, borderRadius: 66 },
  medallion: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: { position: "absolute" },
  name: { marginTop: Spacing.xs },
  desc: { marginTop: Spacing.xs, paddingHorizontal: Spacing.sm },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: Spacing.lg,
  },
  tierLabel: { fontWeight: "700" },
  meta: { marginTop: Spacing.sm },
  ctaCol: { alignSelf: "stretch", marginTop: Spacing.lg, gap: Spacing.xs },
  btn: { marginTop: Spacing.lg, alignSelf: "stretch" },
  btnGhost: { alignSelf: "stretch", marginTop: 0 },
});
