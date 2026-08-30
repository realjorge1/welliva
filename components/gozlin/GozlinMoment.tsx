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

/**
 * Where each surface lives, so a moment never routes to the screen it's already
 * sitting on. A card on Progress whose CTA says "See my progress" would be a
 * tap that does nothing — worse than one that opens the chat. When the route
 * IS the host, the card falls back to the conversation.
 */
const SURFACE_ROUTE: Record<GozlinSurface, string | null> = {
  home: "/",
  workout: "/exercise",
  diet: "/diet",
  progress: "/profile",
  habits: "/habits",
  reviews: null,
  goals: null,
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
  return <GozlinMomentCard moment={top} surface={surface} style={style} />;
}

/** The card itself — also usable directly with a pre-built moment. */
export function GozlinMomentCard({
  moment,
  surface,
  style,
}: {
  moment: Moment;
  /** The screen this card is on — suppresses a route back to that same screen. */
  surface?: GozlinSurface;
  style?: object;
}) {
  const { colors } = useColors();
  const router = useRouter();
  const accent = toneColor(colors, moment.tone);
  const meta = KIND_META[moment.kind];
  const cta = moment.cta ?? meta.cta;
  const celebratory = moment.kind === "celebration";

  // A moment with a route is a signpost, not a conversation opener: the CTA
  // named a screen, so the tap has to land there. Everything else — and any
  // route that would just reload the host screen — is still a doorway into the
  // chat with the question already asked.
  const route =
    moment.route && (!surface || moment.route !== SURFACE_ROUTE[surface])
      ? moment.route
      : null;

  const open = () =>
    route
      ? router.push(route as any)
      : router.push({ pathname: "/gozlin", params: { prompt: moment.prompt } } as any);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${meta.eyebrow}. ${moment.title}. ${moment.message}`}
      accessibilityHint={cta}
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
      {/* NO SIDE RAIL. A 4pt bar down the left edge read as an alert stripe —
          wrong register for a coach who is usually just noticing something —
          and it forced the card's whole body to sit off-centre from every
          other card on the page. The tone now lives where the eye already is:
          the kind badge, the tinted border, and the CTA. */}
      <View style={styles.head}>
        <GozlinAvatar size={34} pulsing={celebratory} />
        <View style={styles.flex}>
          {/* Icon and label as one pill, so the eyebrow is a single object
              rather than a square chip with a word floating beside it. */}
          <View style={[styles.kindPill, { backgroundColor: alpha(accent, 0.14) }]}>
            <Ionicons name={moment.icon as IconName} size={11} color={accent} />
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

      {/* A full-width doorway under a hairline, not a link floating at the end
          of the copy — it's the whole card's action, so it spans the card. */}
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <AppText variant="footnote" style={[styles.cta, { color: accent, flex: 1 }]}>
          {cta}
        </AppText>
        <Ionicons name="arrow-forward" size={15} color={accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  eyebrow: { letterSpacing: 0.6, fontWeight: "700" },
  title: { marginTop: 3 },
  message: { lineHeight: 19 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  cta: { fontWeight: "700" },
});
