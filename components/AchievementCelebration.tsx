/**
 * CELEBRATION HOST
 *
 * The app-wide moment. Hosted once at the root (see app/_layout.tsx) so a
 * celebration earned on ANY screen — an achievement, a goal/chapter milestone,
 * a coach-noticed moment, the day's kept commitment — appears immediately.
 * Reads the celebration queue from AppContext and shows them one at a time.
 *
 * ── REBUILT 2026-10-15: ONE HERO, NO PARTY ─────────────────────────────────
 *
 * The owner's verdict on the old moment — a card over a blurred scrim with a
 * breathing halo, ten twinkling stars and a physics confetti cannon — was "too
 * noisy, too amateur, and boring". The brief was Duolingo: very simple, and
 * amazing because of the timing, not the amount. So each moment is now a quiet
 * full screen with exactly ONE thing that moves:
 *
 *   · a KEPT DAY → the flame. It starts grey (the day you hadn't shown up for
 *     yet), shivers, catches; then the count rolls up and today's disc in the
 *     week lands. Same flame as Home's strip — the object you keep alive.
 *   · an ACHIEVEMENT, a MOMENT, a CHAPTER → the badge you earned, struck in its
 *     own metal (see services/achievementBadges). It drops in with one bounce
 *     and catches the light once. The badge stays the prize; only the party
 *     around it is gone.
 *
 * Words arrive after the hero lands — one thing at a time — and the only way
 * forward is the button pinned to the bottom, in the thumb's reach (the
 * Session-complete rule: the answer sits on the floor, never mid-screen).
 *
 * Each celebration is its own mount (keyed by id), so a queue of two plays
 * two full entrances rather than swapping text under a medallion that already
 * landed.
 */

import { Badge } from "@/components/celebration/Badge";
import { CommitmentWeek } from "@/components/celebration/Commitment";
import { FLAME_COLORS, Flame } from "@/components/celebration/Flame";
import { RollingNumber, enterRise } from "@/components/motion";
import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import type { BadgeFinish } from "@/services/achievementBadges";
import type { Celebration } from "@/services/CelebrationService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Modal, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AchievementCelebration() {
  const { celebrations, dismissCelebration } = useSystem();
  const current = celebrations[0] ?? null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={current != null}
      animationType="fade"
      onRequestClose={dismissCelebration}
    >
      {current ? (
        <CelebrationScreen key={current.id} celebration={current} onDone={dismissCelebration} />
      ) : null}
    </Modal>
  );
}

function CelebrationScreen({
  celebration: c,
  onDone,
}: {
  celebration: Celebration;
  onDone: () => void;
}) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();

  const handleCta = useCallback(() => {
    const route = c.cta?.route;
    onDone();
    if (route) router.push(route as never);
  }, [c.cta?.route, onDone]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          // A gesture-nav phone can report a zero bottom inset; the button
          // still keeps a deliberate distance off the glass.
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md,
        },
      ]}
    >
      <View style={styles.stage}>
        {c.kind === "commitment" && c.commitment ? (
          <CommitmentHero celebration={c} />
        ) : (
          <BadgeHero celebration={c} />
        )}
      </View>

      <Animated.View entering={enterRise(5)} style={styles.actions}>
        {c.cta ? (
          <>
            <Button label={c.cta.label} icon={c.cta.icon} size="lg" onPress={handleCta} />
            <Button label="Later" variant="ghost" onPress={onDone} />
          </>
        ) : (
          <Button
            label={c.kind === "commitment" ? "I showed up" : "Continue"}
            size="lg"
            onPress={onDone}
          />
        )}
      </Animated.View>
    </View>
  );
}

/* ── A kept day: the flame ──────────────────────────────────────────────── */

function CommitmentHero({ celebration: c }: { celebration: Celebration }) {
  const { colors } = useColors();
  const { width, height } = useWindowDimensions();
  const m = c.commitment!;
  // The count and today's disc wait for the flame to catch, then move on the
  // same beat — the flame lighting IS the day being counted.
  const [lit, setLit] = useState(false);
  const onLit = useCallback(() => setLit(true), []);
  // Sized from the HEIGHT as well as the width: on a 569dp TECNO the full-size
  // flame and count push the stack past the button (welliva-responsive-layout).
  const short = height < 700;
  const flameSize = Math.round(Math.min(168, width * 0.4, height * 0.2));

  return (
    <View style={styles.hero}>
      <Flame size={flameSize} entrance="light" onLit={onLit} />

      <View style={styles.countRow} accessible accessibilityLabel={c.title}>
        <RollingNumber
          value={lit ? m.streak : m.previous}
          color={FLAME_COLORS.outer}
          textStyle={short ? styles.countTextShort : styles.countText}
        />
      </View>
      <AppText variant="headline" weight="800" style={{ color: FLAME_COLORS.outer }}>
        day streak
      </AppText>

      <Animated.View entering={enterRise(3)} style={styles.commitBody}>
        <View style={[styles.weekPanel, { backgroundColor: alpha(colors.text, 0.04) }]}>
          <CommitmentWeek week={m.week} size={32} todayKept={lit} animateToday />
        </View>
        <AppText variant="callout" color="secondary" align="center" style={styles.line}>
          {m.line}
        </AppText>
      </Animated.View>
    </View>
  );
}

/* ── An achievement, a moment, a chapter: the badge ─────────────────────── */

function BadgeHero({ celebration: c }: { celebration: Celebration }) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.hero}>
      <Animated.View entering={enterRise(0)}>
        <AppText variant="caption" color="tertiary" align="center" style={styles.eyebrow}>
          {c.eyebrow}
        </AppText>
      </Animated.View>

      <Medallion finish={c.finish} icon={c.icon} size={height < 700 ? 112 : 136} />

      <Animated.View entering={enterRise(3)} style={styles.badgeText}>
        <AppText variant="title" align="center">
          {c.title}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center" style={styles.desc}>
          {c.description}
        </AppText>
        <View style={[styles.tierRow, { backgroundColor: alpha(c.accent, 0.14) }]}>
          <Ionicons name={c.badgeIcon} size={15} color={c.accent} />
          <AppText variant="caption" weight="700" style={{ color: c.accent }}>
            {c.badgeLabel}
          </AppText>
        </View>
        {c.meta ? (
          <AppText variant="caption" color="tertiary" align="center" style={styles.meta}>
            {c.meta}
          </AppText>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * THE MEDALLION — the badge you earned, arriving.
 *
 * Since 2026-10-16 the badge itself is components/celebration/Badge: the same
 * medallion in its own material, drawn in the flame's language (flat tones, a
 * lip, a stroke of shine), and arriving the way the flame does — it drops,
 * lands squashed on its lip and springs round, the glyph pops a beat later,
 * the light crosses its face once, and it floats. Behind it, a still pool of
 * the metal's own light, so it sits in a lit room rather than on a flat page.
 * No halo loop, no stars: both were the noise.
 */
function Medallion({
  finish,
  icon,
  size,
}: {
  finish: BadgeFinish;
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const pool = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    // The light comes up as the badge lands, not before it.
    pool.value = withDelay(380, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [pool, reduceMotion]);
  const poolStyle = useAnimatedStyle(() => ({
    opacity: pool.value * 0.9,
    transform: [{ scale: 0.7 + 0.3 * pool.value }],
  }));

  return (
    <View style={[styles.medalWrap, { width: size * 1.6, height: size * 1.4 }]}>
      <Animated.View
        style={[
          styles.pool,
          {
            width: size * 1.45,
            height: size * 1.45,
            borderRadius: size,
            backgroundColor: alpha(finish.glow, 0.13),
          },
          poolStyle,
        ]}
      />
      <Badge finish={finish} icon={icon} size={size} delay={140} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.screen + Spacing.sm },
  /** Everything above the button; the hero centres in it on any phone. */
  stage: { flex: 1, justifyContent: "center" },
  hero: { alignItems: "center" },
  actions: { gap: Spacing.xs },

  // Commitment
  countRow: { marginTop: Spacing.lg, alignItems: "center" },
  countText: { fontSize: 76, lineHeight: 86, fontWeight: "800", letterSpacing: -1.5 },
  countTextShort: { fontSize: 60, lineHeight: 70, fontWeight: "800", letterSpacing: -1.2 },
  commitBody: { alignSelf: "stretch", alignItems: "center", marginTop: Spacing.xl },
  weekPanel: {
    alignSelf: "stretch",
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  line: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },

  // Badge
  eyebrow: { letterSpacing: 2, fontWeight: "700" },
  medalWrap: { alignItems: "center", justifyContent: "center", marginVertical: Spacing.sm },
  pool: { position: "absolute" },
  badgeText: { alignItems: "center", alignSelf: "stretch" },
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
  meta: { marginTop: Spacing.sm },
});
