/**
 * "WHAT'S BEEN DIFFERENT THIS CYCLE" — while a period is late.
 *
 * Every word is services/cycle/late's: up to three things that genuinely
 * changed this cycle against her own previous cycles, each with her numbers;
 * one line saying changes like these CAN delay a period (or that nothing stands
 * out); then the next steps in the app's own thresholds, and the page about a
 * late period. Never a cause, never a diagnosis, never on the lock screen.
 *
 * This file lays it out and nothing else.
 */
import { AppText, Card, SectionHeader, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { CYCLE_LIBRARY, type LateChangeId, type LateContext } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

const ICON: Record<LateChangeId, keyof typeof Ionicons.glyphMap> = {
  illness: "bandage-outline",
  travel: "airplane-outline",
  eating: "restaurant-outline",
  training: "barbell-outline",
  weight: "scale-outline",
  sleep: "moon-outline",
  mood: "cloud-outline",
};

export function LateSection({ context, style }: { context: LateContext; style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const page = CYCLE_LIBRARY["late-period"];
  const against =
    context.baseline > 0
      ? `From your own logs, against your last ${context.baseline === 1 ? "cycle" : `${context.baseline} cycles`}`
      : "From your own logs";

  return (
    <View style={style}>
      <SectionHeader title="What's been different this cycle" subtitle={against} weight="700" />
      <Card padding="lg">
        {context.changes.map((c) => (
          <View key={c.id} style={styles.lineRow}>
            <Ionicons name={ICON[c.id]} size={16} color={palette.period} />
            <AppText variant="subhead" style={styles.flex}>
              {c.text}
            </AppText>
          </View>
        ))}
        <AppText
          variant={context.changes.length ? "footnote" : "subhead"}
          color="secondary"
          style={context.changes.length ? styles.summary : undefined}
        >
          {context.summary}
        </AppText>
        {context.context ? (
          <AppText variant="footnote" color="secondary" style={styles.summary}>
            {context.context}
          </AppText>
        ) : null}
        <View style={[styles.rule, { backgroundColor: colors.divider }]} />
        {context.nextSteps.map((line, i) => (
          <AppText key={i} variant="footnote" color="secondary" style={i > 0 ? styles.step : undefined}>
            {line}
          </AppText>
        ))}
        <Pressable
          onPress={() => router.push({ pathname: "/cycle/learn/[id]", params: { id: page.id } } as never)}
          accessibilityRole="button"
          accessibilityLabel={`Read: ${page.title}`}
          hitSlop={8}
          style={styles.link}
        >
          <AppText variant="footnote" color="brand" weight="700">
            Read: {page.title}
          </AppText>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, paddingVertical: 6 },
  flex: { flex: 1 },
  summary: { marginTop: Spacing.sm },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  step: { marginTop: Spacing.sm },
  link: { alignSelf: "flex-start", marginTop: Spacing.md, paddingVertical: 2 },
});
