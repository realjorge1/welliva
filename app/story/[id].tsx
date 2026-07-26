/**
 * STORY — a long-horizon recap surface (Proactive Companion P6).
 *
 * Renders one archived StoryArtifact (year / anniversary / five-year / documentary),
 * reached from the archive or a story notification deep-link (`/story/<id>`). All copy +
 * numbers come from the deterministic StoryService — this screen is presentation only.
 */
import { AppText, Card, IconBadge, Screen, useColors } from "@/components/ui";
import { useStory } from "@/components/story/useStory";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function StoryScreen() {
  const { colors } = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { loading, story } = useStory(id);

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle} numberOfLines={1}>
        {story?.subtitle ?? "Your story"}
      </AppText>
      <View style={styles.iconBtn} />
    </View>
  );

  return (
    <Screen header={header}>
      {loading ? (
        <Card style={styles.block}>
          <AppText color="tertiary">Loading…</AppText>
        </Card>
      ) : !story ? (
        <Card style={styles.block} padding="xxl">
          <View style={styles.empty}>
            <IconBadge name="film-outline" tone={colors.primary} size={52} />
            <AppText variant="headline" align="center" style={styles.emptyTitle}>
              This story isn&apos;t ready yet
            </AppText>
            <AppText variant="subhead" color="tertiary" align="center">
              Keep logging — your year, anniversary and journey recaps build themselves from
              what you do.
            </AppText>
          </View>
        </Card>
      ) : (
        <>
          <Card style={styles.hero} padding="xxl">
            <AppText variant="displayLg" align="center" style={styles.heroTitle}>
              {story.title}
            </AppText>
            <AppText variant="headline" color="brand" align="center" style={styles.headline}>
              {story.headline}
            </AppText>
            <View style={styles.heroStat}>
              <AppText variant="display" color="brand" style={styles.heroValue}>
                {story.hero.value}
              </AppText>
              <AppText variant="subhead" color="tertiary">
                {story.hero.label}
              </AppText>
            </View>
          </Card>

          {story.sections.map((s, i) => (
            <Card key={i} style={styles.block} padding="lg">
              <View style={styles.sectionRow}>
                <IconBadge name={s.icon as any} tone={colors.primary} size={44} />
                <View style={styles.flex}>
                  <AppText variant="callout">{s.title}</AppText>
                  <AppText variant="subhead" color="secondary" style={styles.sectionBody}>
                    {s.body}
                  </AppText>
                </View>
                {s.stat ? (
                  <View style={styles.statBox}>
                    <AppText variant="title" color="brand">
                      {s.stat.value}
                    </AppText>
                    <AppText variant="caption" color="tertiary">
                      {s.stat.label}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Card>
          ))}

          <AppText variant="subhead" color="secondary" align="center" style={styles.signoff}>
            {story.signoff}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center" },
  block: { marginBottom: Spacing.md },
  flex: { flex: 1 },
  empty: { alignItems: "center", gap: Spacing.sm },
  emptyTitle: { marginTop: Spacing.sm },
  hero: { marginBottom: Spacing.lg, alignItems: "center" },
  heroTitle: { marginBottom: Spacing.sm },
  headline: { marginBottom: Spacing.lg },
  heroStat: { alignItems: "center", gap: 2 },
  heroValue: { fontSize: 44, lineHeight: 50 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  sectionBody: { marginTop: 4 },
  statBox: { alignItems: "center", minWidth: 56 },
  signoff: { marginTop: Spacing.sm, marginBottom: Spacing.xxl },
});
