/**
 * ONE PAGE — /cycle/learn/cramps, /cycle/learn/late-period, and seventeen more.
 *
 * One route for the whole library: the id comes from the path, the writing from
 * services/cycle/library. Nothing here reads her log.
 *
 * THE SHAPE OF A PAGE, top to bottom:
 *   title and how long it takes to read — so she can decide before she starts
 *   the sections, each a heading with paragraphs or a short list
 *   "worth seeing someone about", in the warning tone, on the pages that have
 *     one — specific lines, never a general "see a doctor if worried"
 *   where to go next, and the one tap that shares her own numbers
 *
 * A stale or mistyped id lands on an honest empty state with a way into the
 * library, never a blank screen.
 */
import { useCyclePalette } from "@/components/cycle";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { AppText, Button, Card, IconBadge, Reveal, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import { CYCLE_LIBRARY, doctorSummary, findArticle, type CycleArticle } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";

export default function CycleArticleScreen() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const article = findArticle(id);
  const cycle = useCycle();

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/cycle/learn" as never);
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="callout" color="secondary" numberOfLines={1} style={styles.flex}>
        Learn
      </AppText>
    </View>
  );

  if (!article) {
    return (
      <Screen header={header}>
        <Card padding="xl" style={styles.missing}>
          <IconBadge name="help-outline" tone={colors.textTertiary} size={44} />
          <AppText variant="title">That page has moved</AppText>
          <AppText variant="body" color="secondary">
            Everything welliva has written about cycles is in the library.
          </AppText>
          <Button
            label="Open the library"
            onPress={() => router.replace("/cycle/learn" as never)}
            fullWidth
            style={styles.missingCta}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <Reveal index={0}>
        <View style={styles.title}>
          <IconBadge name={article.icon as never} tone={palette.period} size={44} />
          <AppText variant="display" style={styles.titleText}>
            {article.title}
          </AppText>
          <AppText variant="footnote" color="tertiary">
            {article.minutes} min read
          </AppText>
        </View>
      </Reveal>

      {article.sections.map((section, i) => (
        <Reveal key={section.heading} index={i + 1}>
          <View style={styles.section}>
            <AppText variant="headline" weight="700">
              {section.heading}
            </AppText>
            {section.body?.map((para) => (
              <AppText key={para.slice(0, 40)} variant="body" color="secondary" style={styles.para}>
                {para}
              </AppText>
            ))}
            {section.points?.length ? (
              <Card padding="lg" style={styles.points}>
                {section.points.map((point, j) => (
                  <View key={point.slice(0, 40)} style={[styles.point, j > 0 && styles.pointGap]}>
                    {/* A dot, not a dash: the owner's standing rule is that no
                        dashed or dotted RULE appears anywhere, and a bullet
                        glyph is the one mark that reads as a list without one. */}
                    <View style={[styles.bullet, { backgroundColor: palette.period }]} />
                    <AppText variant="subhead" color="secondary" style={styles.flex}>
                      {point}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
        </Reveal>
      ))}

      {article.seeSomeone?.length ? (
        <Reveal index={article.sections.length + 1}>
          <Card padding="lg" style={[styles.warn, { borderColor: alpha(colors.warning, 0.4) }]}>
            <View style={styles.warnHead}>
              <Ionicons name="medical-outline" size={16} color={colors.warning} />
              <AppText variant="callout" style={styles.flex}>
                Worth seeing someone about
              </AppText>
            </View>
            {article.seeSomeone.map((line) => (
              <View key={line.slice(0, 40)} style={styles.warnRow}>
                <View style={[styles.bullet, { backgroundColor: colors.warning }]} />
                <AppText variant="subhead" color="secondary" style={styles.flex}>
                  {line}
                </AppText>
              </View>
            ))}
            {/* Her own numbers, in one tap, from the page that just told her
                they were worth raising. The summary is built from the log, so
                it is the same one Cycle settings shares. */}
            <Button
              label="Share a summary for your doctor"
              variant="ghost"
              size="sm"
              onPress={() =>
                void Share.share({
                  message: doctorSummary({
                    data: cycle.data,
                    cycles: cycle.view.cycles,
                    prediction: cycle.view.prediction,
                    notes: cycle.view.allNotes,
                    today: cycle.today,
                  }),
                }).catch(() => undefined)
              }
              style={styles.warnCta}
            />
          </Card>
        </Reveal>
      ) : null}

      {article.seeAlso.length ? (
        <Reveal index={article.sections.length + 2}>
          <View style={styles.section}>
            <AppText variant="headline" weight="700">
              Next
            </AppText>
            <Card padding="none">
              {article.seeAlso.map((nextId, i) => (
                <NextRow key={nextId} article={CYCLE_LIBRARY[nextId]} divider={i > 0} />
              ))}
            </Card>
          </View>
        </Reveal>
      ) : null}

      <AppText variant="caption" color="tertiary" style={styles.foot}>
        General information, not medical advice, and never a diagnosis.
      </AppText>
    </Screen>
  );
}

function NextRow({ article, divider }: { article: CycleArticle; divider: boolean }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/cycle/learn/[id]", params: { id: article.id } } as never)
      }
      accessibilityRole="button"
      accessibilityLabel={article.title}
      style={({ pressed }) => [
        styles.nextRow,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
        pressed && { backgroundColor: alpha(colors.text, 0.05) },
      ]}
    >
      <Ionicons name={article.icon as never} size={18} color={palette.period} />
      <View style={styles.flex}>
        <AppText variant="subhead" weight="600">
          {article.title}
        </AppText>
        <AppText variant="caption" color="tertiary" numberOfLines={2}>
          {article.blurb}
        </AppText>
      </View>
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

  title: { gap: Spacing.sm, marginBottom: Spacing.lg },
  titleText: { marginTop: Spacing.xs },

  section: { gap: Spacing.sm, marginBottom: Spacing.xl },
  para: { lineHeight: 23 },
  points: { gap: 0 },
  point: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  pointGap: { marginTop: Spacing.md },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },

  warn: { borderWidth: StyleSheet.hairlineWidth, gap: Spacing.sm, marginBottom: Spacing.xl },
  warnHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  warnRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  warnCta: { marginTop: Spacing.md },

  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },

  missing: { gap: Spacing.md, alignItems: "flex-start" },
  missingCta: { marginTop: Spacing.sm },
  foot: { marginBottom: Spacing.xl },
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="cycle-article" />;
}
