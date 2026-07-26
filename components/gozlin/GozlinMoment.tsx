/**
 * GozlinMoment — Gozlin's presence on any screen.
 *
 * Drops the single highest-leverage coach beat for a surface into the page as a
 * tappable card: the coach's avatar, a kind eyebrow (Win / Heads up / Forecast…),
 * a line in Gozlin's voice, and a doorway into the full conversation with the
 * relevant question pre-asked. This is what makes the app feel alive and keeps
 * the user from ever feeling alone — Gozlin shows up where the user already is.
 *
 * All selection logic is in services/gozlin/GozlinMomentEngine (pure); this is
 * presentation + the deep-link.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { GozlinMoment as Moment, GozlinMomentKind, GozlinSurface } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GozlinAvatar } from "./GozlinAvatar";
import { toneColor } from "./renderers/GozlinCardKit";
import { useGozlinMoments } from "./useGozlinMoments";

type IconName = keyof typeof Ionicons.glyphMap;

/** Kind → eyebrow label + default CTA. Accent is tone-driven (toneColor). */
const KIND_META: Record<GozlinMomentKind, { eyebrow: string; cta: string }> = {
  celebration: { eyebrow: "Win", cta: "See more" },
  risk: { eyebrow: "Heads up", cta: "Ask Gozlin" },
  intervention: { eyebrow: "Let's talk", cta: "Ask Gozlin" },
  insight: { eyebrow: "Insight", cta: "Ask Gozlin" },
  forecast: { eyebrow: "Forecast", cta: "See forecast" },
  coach: { eyebrow: "Gozlin", cta: "Ask Gozlin" },
};

export function GozlinMoment({
  surface,
  style,
}: {
  surface: GozlinSurface;
  /** Margin/layout from the host screen (e.g. horizontal gutter). */
  style?: object;
}) {
  const { top } = useGozlinMoments(surface);
  if (!top) return null;
  return <GozlinMomentCard moment={top} style={style} />;
}

/** The card itself — also usable directly with a pre-built moment. */
export function GozlinMomentCard({
  moment,
  style,
}: {
  moment: Moment;
  style?: object;
}) {
  const { colors } = useColors();
  const router = useRouter();
  const accent = toneColor(colors, moment.tone);
  const meta = KIND_META[moment.kind];
  const cta = moment.cta ?? meta.cta;
  const celebratory = moment.kind === "celebration";

  const open = () =>
    router.push({ pathname: "/gozlin", params: { prompt: moment.prompt } } as any);

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: celebratory ? alpha(accent, 0.08) : colors.surface,
          borderColor: alpha(accent, celebratory ? 0.35 : 0.22),
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {/* Tone rail — a quiet signal of register. */}
      <View style={[styles.rail, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <View style={styles.head}>
          <GozlinAvatar size={34} pulsing={celebratory} />
          <View style={styles.flex}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.kindIcon, { backgroundColor: alpha(accent, 0.16) }]}>
                <Ionicons name={moment.icon as IconName} size={11} color={accent} />
              </View>
              <AppText variant="caption" uppercase style={[styles.eyebrow, { color: accent }]}>
                {meta.eyebrow}
              </AppText>
            </View>
            <AppText variant="callout" style={styles.title}>
              {moment.title}
            </AppText>
          </View>
        </View>

        <AppText variant="subhead" color="secondary" style={styles.message}>
          {moment.message}
        </AppText>

        <View style={styles.footer}>
          <AppText variant="footnote" style={[styles.cta, { color: accent }]}>
            {cta}
          </AppText>
          <Ionicons name="arrow-forward" size={14} color={accent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  rail: { width: 4 },
  body: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kindIcon: {
    width: 18,
    height: 18,
    borderRadius: Radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { letterSpacing: 0.6, fontWeight: "700" },
  title: { marginTop: 2 },
  message: { lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  cta: { fontWeight: "700" },
});
