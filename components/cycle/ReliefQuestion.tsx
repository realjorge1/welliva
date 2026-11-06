/**
 * "YESTERDAY'S CRAMPS: WHAT HELPED MOST?" — one question, one tap.
 *
 * WHEN it appears is entirely services/cycle/relief's `reliefAsk`, carried on
 * the view: the day after she logs cramps, a headache, back pain or nausea, about
 * the most significant of them, once a day at most, never in pregnancy, and no
 * longer about a symptom she has skipped three times running. This file is the
 * card and nothing else. Never a notification.
 *
 * Two places mount it — the cycle screen and the Home cycle card (`compact`) —
 * and both answer through the same provider write, onto yesterday's own log.
 *
 * AFTER THE TAP it says "Noted" in place rather than vanishing under her thumb.
 * A "Nothing helped" gets the page on that symptom: what tends to help, and
 * where the line is. It is information she can open, never advice pushed at her.
 */
import { AppText, ChipGrid, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import {
  CYCLE_LIBRARY,
  readingForSymptom,
  RELIEF_OPTIONS,
  type Relief,
  type ReliefSymptom,
} from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

export function ReliefQuestion({
  style,
  compact = false,
  onAnswer,
}: {
  style?: StyleProp<ViewStyle>;
  /** Inside the Home card: no surface of its own, tighter spacing. */
  compact?: boolean;
  /** Told when she answers or skips, so a parent slot can keep the "Noted" in place. */
  onAnswer?: () => void;
}) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const ask = cycle.view.reliefAsk;
  const [done, setDone] = useState<{ symptom: ReliefSymptom; helped: Relief } | null>(null);
  const openPage = (symptom: ReliefSymptom) =>
    router.push({ pathname: "/cycle/learn/[id]", params: { id: readingForSymptom(symptom) } } as never);

  if (done) {
    const page = CYCLE_LIBRARY[readingForSymptom(done.symptom)];
    return (
      <View style={[compact ? styles.compact : [styles.card, { backgroundColor: palette.wash }], style]}>
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={palette.period} />
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            {done.helped === "nothing" ? "Noted. Sorry nothing helped." : "Noted, thanks."}
          </AppText>
        </View>
        {done.helped === "nothing" ? (
          <Pressable
            onPress={() => openPage(done.symptom)}
            accessibilityRole="button"
            accessibilityLabel={`Read: ${page.title}`}
            hitSlop={8}
            style={styles.link}
          >
            <AppText variant="footnote" color="brand" weight="700">
              What tends to help, and when to see someone
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (!ask) return null;

  const answer = (helped: Relief) => {
    setDone({ symptom: ask.symptom, helped });
    onAnswer?.();
    void cycle.answerRelief(ask.date, ask.symptom, helped);
  };
  const skip = () => {
    onAnswer?.();
    void cycle.skipRelief(ask.date, ask.symptom);
  };

  return (
    <View
      style={[compact ? styles.compact : [styles.card, { backgroundColor: palette.wash }], style]}
      accessibilityLabel={ask.question}
    >
      <AppText variant={compact ? "footnote" : "callout"} weight="600">
        {ask.question}
      </AppText>
      <View style={styles.chips}>
        <ChipGrid<Relief>
          options={RELIEF_OPTIONS}
          selected={() => false}
          onToggle={answer}
          tone={palette.period}
          size="sm"
        />
      </View>
      <View style={styles.foot}>
        <Pressable
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Skip this question"
          hitSlop={8}
          style={styles.skip}
        >
          <AppText variant="footnote" style={{ color: alpha(colors.text, 0.55) }} weight="600">
            Skip
          </AppText>
        </Pressable>
        {compact ? null : (
          <Pressable
            onPress={() => openPage(ask.symptom)}
            accessibilityRole="button"
            accessibilityLabel={`Read: ${CYCLE_LIBRARY[readingForSymptom(ask.symptom)].title}`}
            hitSlop={8}
            style={styles.skip}
          >
            <AppText variant="footnote" color="brand" weight="600">
              What tends to help
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl },
  compact: { marginTop: Spacing.md },
  chips: { marginTop: Spacing.md },
  foot: { flexDirection: "row", flexWrap: "wrap", columnGap: Spacing.xl, marginTop: Spacing.sm },
  skip: { paddingVertical: 4 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  link: { alignSelf: "flex-start", marginTop: Spacing.sm, paddingVertical: 2 },
  flex: { flex: 1 },
});
