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
 *
 * THE MEDALLION IS STRUCK, NOT PAINTED. It used to be a two-stop wash of the
 * tier colour with a white glyph on top, which made every bronze and gold badge
 * in the app the same orange disc. It now renders the badge's own MATERIAL (see
 * services/achievementBadges): a deep rim, a three-stop ramp with a lit
 * top-left and a shadowed bottom-right, and the glyph cut in an ink chosen
 * against that metal. Copper, ice, amethyst, jade, obsidian — you can tell what
 * you won across the room.
 */

import { Confetti } from "@/components/Confetti";
import { AppText, Button, useColors } from "@/components/ui";
import { useTheme } from "@/components/ThemeContext";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import { badgePalette } from "@/services/achievementBadges";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * The stars around the medallion.
 *
 * They used to be circles fading between 0.15 and 1 on a symmetric loop — a set
 * of dots pulsing, which is not a twinkle. A twinkle is a FLARE: it arrives
 * fast, decays slowly, and then the star is dark for a while before the next
 * one. Each spark below carries its own beat and its own dark interval so the
 * field never blinks in unison.
 */
const SPARKLES = [
  { x: -86, y: -54, size: 15, delay: 120, beat: 2400, spin: -18 },
  { x: 92, y: -38, size: 10, delay: 900, beat: 2900, spin: 14 },
  { x: -72, y: 60, size: 12, delay: 1600, beat: 2600, spin: 20 },
  { x: 80, y: 64, size: 17, delay: 420, beat: 3200, spin: -12 },
  { x: 0, y: -96, size: 13, delay: 2100, beat: 2700, spin: 16 },
  { x: -104, y: 6, size: 9, delay: 1300, beat: 3400, spin: -22 },
  { x: 104, y: 14, size: 11, delay: 300, beat: 3000, spin: 18 },
  { x: 40, y: -84, size: 8, delay: 1900, beat: 2500, spin: -16 },
  { x: -44, y: -80, size: 10, delay: 700, beat: 3100, spin: 12 },
  { x: 22, y: 92, size: 9, delay: 2400, beat: 2800, spin: -20 },
];

/**
 * A four-point star with concave sides — the shape a highlight actually makes.
 * Drawn as one path on a -1..1 box so it scales to any size crisply.
 */
const STAR_PATH =
  "M0,-1 C0.13,-0.34 0.34,-0.13 1,0 C0.34,0.13 0.13,0.34 0,1 " +
  "C-0.13,0.34 -0.34,0.13 -1,0 C-0.34,-0.13 -0.13,-0.34 0,-1 Z";

export function AchievementCelebration() {
  const { colors } = useColors();
  const { isDarkMode } = useTheme();
  const { celebrations, dismissCelebration } = useSystem();
  const current = celebrations[0] ?? null;
  const visible = current != null;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  /** One slow sweep of light across the metal, once, as the medallion lands. */
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    glow.setValue(0);
    sheen.setValue(0);
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
      Animated.sequence([
        Animated.delay(240),
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
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
  }, [visible, current?.id, scale, opacity, glow, sheen]);

  const palette = useMemo(
    () => (current ? badgePalette(current.finish) : undefined),
    [current],
  );

  if (!current) return null;

  const accent = current.accent;
  const finish = current.finish;
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-130, 130] });
  const sheenOpacity = sheen.interpolate({
    inputRange: [0, 0.18, 0.82, 1],
    outputRange: [0, 0.55, 0.55, 0],
  });

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
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={dismissCelebration}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

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

          {/* Struck medallion — halo, stars, rim, metal, sheen, glyph. */}
          <View style={styles.medallionWrap}>
            {SPARKLES.map((s, i) => (
              <Twinkle key={i} {...s} color={finish.ramp[0]} />
            ))}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  backgroundColor: alpha(finish.glow, 0.18),
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            {/* The rim: the metal's own shadow stop, so the disc has an edge
                instead of dissolving into the card. */}
            <View style={[styles.rim, { backgroundColor: finish.ramp[2] }]} />
            <LinearGradient
              colors={finish.ramp}
              locations={[0, 0.52, 1]}
              start={{ x: 0.12, y: 0 }}
              end={{ x: 0.88, y: 1 }}
              style={styles.medallion}
            >
              {/* One pass of light across the face as it lands. */}
              <Animated.View
                style={[
                  styles.sheen,
                  { opacity: sheenOpacity, transform: [{ translateX: sheenX }, { rotate: "18deg" }] },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={["#FFFFFF00", "#FFFFFFAA", "#FFFFFF00"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Ionicons name={current.icon} size={52} color={finish.ink} />
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

        {/* Headline burst — keyed by id so every new celebration re-fires once,
            and coloured from the badge's own metal. */}
        <Confetti
          key={current.id}
          tierColor={accent}
          palette={palette}
          intensity={current.intensity}
        />
      </View>
    </Modal>
  );
}

/**
 * One star. Flares fast, decays slowly, then sits dark for the rest of its
 * beat — the asymmetry is the whole difference between a twinkle and a pulse.
 * It rotates a little as it goes, so no two flares are the same shape.
 */
function Twinkle({
  x,
  y,
  size,
  delay,
  beat,
  spin,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  /** Full cycle: flare + decay + dark. */
  beat: number;
  /** Degrees turned across one flare. */
  spin: number;
  color: string;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const flare = 190;
    const decay = 820;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, {
          toValue: 1,
          duration: flare,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(a, {
          toValue: 0,
          duration: decay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(120, beat - flare - decay)),
      ]),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [a, delay, beat]);

  const opacity = a.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.5, 1] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.15] });
  const rotate = a.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${spin}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        { marginLeft: x, marginTop: y, opacity, transform: [{ scale }, { rotate }] },
      ]}
    >
      <Svg width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3">
        <Path d={STAR_PATH} fill={color} />
      </Svg>
    </Animated.View>
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
  /** The struck edge under the metal — 4px of the ramp's shadow stop. */
  rim: { position: "absolute", width: 112, height: 112, borderRadius: 56 },
  medallion: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sheen: { position: "absolute", top: -30, bottom: -30, width: 34 },
  sparkle: { position: "absolute", left: "50%", top: "50%" },
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
