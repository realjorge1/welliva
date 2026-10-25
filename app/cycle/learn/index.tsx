/**
 * CYCLE LIBRARY — /cycle/learn
 *
 * Nineteen pages, grouped, with the three that bear on today lifted to the top.
 *
 * WHY THIS SCREEN EXISTS. welliva would tell someone that two of her last six
 * cycles were shorter than 21 days and that it was worth mentioning to a doctor,
 * and then say nothing else: it named a thing and explained nothing. The
 * writing lives in services/cycle/library (pure, testable); this screen is the
 * shelf, and the flags, the symptoms and the dial are the three doors to it.
 *
 * "FOR YOU TODAY" IS A SUGGESTION, NOT A DIAGNOSIS. It is chosen by
 * `suggestedReading` from the flags already raised and what she logged today —
 * which page to OFFER, never what she has. The rest of the library is listed
 * in full underneath, in reading order, so nothing is hidden behind a guess.
 */
import { useCyclePalette } from "@/components/cycle";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { AppText, Card, IconBadge, Reveal, Screen, SectionHeader, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import {
  GROUP_LABEL,
  GROUP_ORDER,
  articlesInGroup,
  suggestedReading,
  type CycleArticle,
} from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function CycleLearnScreen() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const { view, settings } = useCycle();

  const suggested = useMemo(() => suggestedReading(view, settings), [view, settings]);
  const suggestedIds = useMemo(() => new Set(suggested.map((a) => a.id)), [suggested]);

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.flex}>
        <AppText variant="title">Learn</AppText>
        <AppText variant="footnote" color="tertiary">
          Plain answers about your cycle
        </AppText>
      </View>
    </View>
  );

  return (
    <Screen header={header}>
      {suggested.length ? (
        <Reveal index={0}>
          <View style={styles.section}>
            <SectionHeader
              title="For you today"
              subtitle="From what you've logged and what welliva has raised"
              weight="700"
            />
            {suggested.map((article) => (
              <ArticleCard key={article.id} article={article} tone={palette.period} featured />
            ))}
          </View>
        </Reveal>
      ) : null}

      {GROUP_ORDER.map((group, i) => {
        const rest = articlesInGroup(group);
        return (
          <Reveal key={group} index={i + 1}>
            <View style={styles.section}>
              <SectionHeader title={GROUP_LABEL[group]} weight="700" />
              <Card padding="none">
                {rest.map((article, j) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    tone={palette.period}
                    divider={j > 0}
                    // Already in "For you today". Marked rather than removed:
                    // dropping it would leave a hole in a list whose order is
                    // the reading order.
                    seen={suggestedIds.has(article.id)}
                  />
                ))}
              </Card>
            </View>
          </Reveal>
        );
      })}

      <AppText variant="caption" color="tertiary" style={styles.foot}>
        General information, not medical advice, and never a diagnosis. Anything that worries you is
        worth a doctor&apos;s time.
      </AppText>
    </Screen>
  );
}

const open = (article: CycleArticle) =>
  router.push({ pathname: "/cycle/learn/[id]", params: { id: article.id } } as never);

/** The featured treatment — a card, because it was chosen for her. */
function ArticleCard({
  article,
  tone,
  featured,
}: {
  article: CycleArticle;
  tone: string;
  featured?: boolean;
}) {
  return (
    <Card
      padding="lg"
      style={featured ? styles.cardGap : undefined}
      onPress={() => open(article)}
      accessibilityLabel={article.title}
      accessibilityHint={`${article.blurb} About ${article.minutes} minutes to read`}
    >
      <View style={styles.cardRow}>
        <IconBadge name={article.icon as never} tone={tone} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">{article.title}</AppText>
          <AppText variant="footnote" color="secondary" style={styles.blurb}>
            {article.blurb}
          </AppText>
          <AppText variant="caption" color="tertiary" style={styles.minutes}>
            {article.minutes} min read
          </AppText>
        </View>
      </View>
    </Card>
  );
}

/** The list treatment — a row in the full library. */
function ArticleRow({
  article,
  tone,
  divider,
  seen,
}: {
  article: CycleArticle;
  tone: string;
  divider: boolean;
  seen: boolean;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={() => open(article)}
      accessibilityRole="button"
      accessibilityLabel={article.title}
      accessibilityHint={article.blurb}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
        pressed && { backgroundColor: alpha(colors.text, 0.05) },
      ]}
    >
      <Ionicons name={article.icon as never} size={18} color={seen ? tone : colors.textTertiary} />
      <View style={styles.flex}>
        <AppText variant="subhead" weight="600" numberOfLines={1}>
          {article.title}
        </AppText>
        <AppText variant="caption" color="tertiary" numberOfLines={2}>
          {article.blurb}
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary">
        {article.minutes}m
      </AppText>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  section: { gap: Spacing.sm, marginBottom: Spacing.xl },
  cardGap: { marginBottom: Spacing.sm },
  cardRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  blurb: { marginTop: 2 },
  minutes: { marginTop: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  foot: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="cycle-learn" />;
}
