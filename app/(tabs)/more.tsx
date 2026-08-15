/**
 * MORE — the fourth tab. The same destinations as before, arranged into a calm
 * bento hierarchy and built entirely from the design system (Card / IconBadge /
 * Reveal) so it reads as one family with Profile, Diet & Fitness:
 *
 *   YOU      → the identity card  (avatar, name, age · weight · height)
 *              Gozlin's read of you
 *   EXPLORE  → Habits · Foods     (a pair of square tiles)
 *              What Welliva knows (wide row)
 *   SYSTEM   → Settings · Privacy (compact pair)
 *
 * Flat surfaces, hairline separation, staggered Reveal entrances — no bespoke
 * glows or gradients. Settings live here and ONLY here (the Profile screen's
 * gear was removed) so there's exactly one door to them.
 */
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { GozlinMoment } from "@/components/gozlin";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { AppText, Button, Card, IconBadge, Reveal, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import { fetchAvatarUrl } from "@/services/sync/StorageSync";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

interface Dest {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  label: string;
  sub: string;
  href: string;
}

/** Profile is a pushed screen, not a tab — it was never in the nav bar. */
const PROFILE_HREF = "/profile";

/** The five tile destinations — tones, copy and routes preserved verbatim. */
const DEST = {
  habits: {
    icon: "grid",
    tone: "#3FDD78",
    label: "Habits",
    sub: "Streaks & consistency heatmaps",
    href: "/habits",
  },
  foods: {
    icon: "nutrition",
    tone: "#F2A65A",
    label: "Foods",
    sub: "Browse & log fruits, veg & whole foods",
    href: "/foods",
  },
  knows: {
    icon: "sparkles",
    tone: "#8B7CFF",
    label: "What Welliva knows",
    sub: "Your memory & what's coming up",
    href: "/knows",
  },
  settings: {
    icon: "settings",
    tone: "#9FB3AE",
    label: "Settings",
    sub: "Account, plan & preferences",
    href: "/settings",
  },
  privacy: {
    icon: "shield-checkmark",
    tone: "#2DD0B0",
    label: "Privacy",
    sub: "Data, consent & controls",
    href: "/privacy",
  },
} satisfies Record<string, Dest>;

export default function MoreScreen() {
  const router = useRouter();
  const go = (href: string) => router.push(href as any);

  const header = (
    <Reveal index={0}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText variant="display">More</AppText>
          <AppText variant="subhead" color="secondary" style={styles.headerSub}>
            Everything else, in one place
          </AppText>
        </View>
      </View>
    </Reveal>
  );

  return (
    <Screen header={header}>
      {/* ── YOU ── identity first: who this is, then Gozlin's read of them. */}
      <Reveal index={1}>
        <ProfileCard onPress={() => go(PROFILE_HREF)} />
      </Reveal>

      <Reveal index={2}>
        <GozlinMoment surface="progress" style={styles.moment} />
      </Reveal>

      {/* TEMP dev button — replays the onboarding flow in preview mode, which
          does NOT overwrite the real profile, so the onboarding screens can be
          edited and tested like a brand-new user. Remove before ship. See the
          `?preview=1` handling in app/onboarding.tsx. */}
      <Reveal index={3}>
        <Button
          label="Board — replay onboarding"
          icon="albums-outline"
          variant="tonal"
          onPress={() => go("/onboarding?preview=1")}
          style={styles.boardBtn}
        />
      </Reveal>

      {/* ── EXPLORE ── */}
      <Reveal index={4}>
        <Label>Explore</Label>
        <View style={styles.row}>
          <Tile dest={DEST.habits} variant="square" onPress={go} />
          <Tile dest={DEST.foods} variant="square" onPress={go} />
        </View>
        <View style={styles.rowGap} />
        <Tile dest={DEST.knows} variant="wide" onPress={go} />
      </Reveal>

      {/* ── SYSTEM ── */}
      <Reveal index={5}>
        <Label>System</Label>
        <View style={styles.row}>
          <Tile dest={DEST.settings} variant="compact" onPress={go} />
          <Tile dest={DEST.privacy} variant="compact" onPress={go} />
        </View>
      </Reveal>
    </Screen>
  );
}

/* ───────────────────────────── Section label ───────────────────────────── */

function Label({ children }: { children: string }) {
  return (
    <AppText variant="caption" color="tertiary" uppercase style={styles.label}>
      {children}
    </AppText>
  );
}

/* ────────────────────────────── Profile card ───────────────────────────── */

/**
 * Pull a human name out of whatever the provider gave us. Google/Facebook/Apple
 * all land in `user_metadata` under slightly different keys; email sign-ups have
 * none of them, so we fall back to the address' local part ("jane.doe" → "Jane
 * Doe") and finally to a neutral label.
 */
function displayName(meta: Record<string, any> | undefined, email?: string): string {
  const named = meta?.full_name ?? meta?.name ?? meta?.user_name ?? meta?.preferred_username;
  if (typeof named === "string" && named.trim()) return named.trim();

  const local = email?.split("@")[0];
  if (!local) return "Your profile";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Provider avatar URL, whichever key it arrived under. */
function avatarUrl(meta: Record<string, any> | undefined): string | undefined {
  const url = meta?.avatar_url ?? meta?.picture ?? meta?.photo_url;
  return typeof url === "string" && url ? url : undefined;
}

/**
 * The identity marquee — the account's photo (or a neutral icon when the
 * provider gave us none), the user's name, and the bio they set in onboarding.
 */
function ProfileCard({ onPress }: { onPress: () => void }) {
  const { colors } = useColors();
  const { user } = useAuth();
  const { userBio } = useProfile();

  const meta = user?.user_metadata as Record<string, any> | undefined;
  const name = displayName(meta, user?.email ?? undefined);
  // Prefer the avatar the user uploaded here (users.avatar_url) over the OAuth
  // provider photo; fall back to the provider's when none has been set.
  const [uploaded, setUploaded] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setUploaded(null);
      return;
    }
    fetchAvatarUrl(user.id).then((url) => {
      if (alive) setUploaded(url);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const photo = uploaded ?? avatarUrl(meta);

  const bio = userBio
    ? [
        `${userBio.age} yrs`,
        `${Math.round(userBio.weightKg)} kg`,
        `${userBio.heightCm} cm`,
      ].join("  ·  ")
    : "Finish your setup to personalise your plan";

  return (
    <Card onPress={onPress} padding="lg" style={styles.block}>
      <View style={styles.rowInner}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={[styles.avatar, { borderColor: alpha(colors.primary, 0.35) }]}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${name}'s photo`}
          />
        ) : (
          <IconBadge name="person" tone={colors.primary} size={56} />
        )}

        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.sub}>
            {bio}
          </AppText>
        </View>

        <View style={[styles.goDot, { backgroundColor: alpha(colors.primary, 0.14) }]}>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}

/* ──────────────────────────────── Tile ─────────────────────────────────── */

type Variant = "square" | "wide" | "compact";

function Tile({
  dest,
  variant,
  onPress,
}: {
  dest: Dest;
  variant: Variant;
  onPress: (href: string) => void;
}) {
  const { colors } = useColors();
  const tone = dest.tone;

  if (variant === "square") {
    return (
      <Card onPress={() => onPress(dest.href)} padding="lg" style={styles.square}>
        <View style={styles.squareTop}>
          <IconBadge name={dest.icon} tone={tone} size={44} />
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
        <View style={styles.flex} />
        <AppText variant="bodyLg" weight="700">
          {dest.label}
        </AppText>
        <AppText variant="footnote" color="secondary" numberOfLines={2}>
          {dest.sub}
        </AppText>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <Card onPress={() => onPress(dest.href)} padding="md" style={styles.compact}>
        <View style={styles.rowInner}>
          <IconBadge name={dest.icon} tone={tone} size={38} />
          <AppText variant="bodyLg" weight="600" style={styles.flex} numberOfLines={1}>
            {dest.label}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
      </Card>
    );
  }

  // wide — a full-bleed horizontal row.
  return (
    <Card onPress={() => onPress(dest.href)} padding="lg" style={styles.wide}>
      <View style={styles.rowInner}>
        <IconBadge name={dest.icon} tone={tone} size={46} />
        <View style={styles.flex}>
          <AppText variant="headline">{dest.label}</AppText>
          <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.sub}>
            {dest.sub}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerSub: { marginTop: 2 },

  moment: { marginTop: Spacing.md },

  // TEMP dev "Board" button — remove with its JSX block.
  boardBtn: { marginTop: Spacing.lg },

  label: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  block: { marginBottom: 0 },
  wide: { marginBottom: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  row: { flexDirection: "row", gap: Spacing.md },
  rowGap: { height: Spacing.md },
  rowInner: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  sub: { marginTop: 2 },

  square: { flex: 1, height: 148 },
  squareTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  compact: { flex: 1 },

  goDot: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:more" />;
}
