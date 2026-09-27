/**
 * CuriosityChip — the one question Gozlin has, sitting above the composer.
 * docs/gozlin/11-trying-something-new.md §7.1.
 *
 * WHY IT IS NOT IN THE SUGGESTION BAR. The bar is a rotating pool of things YOU
 * might say: its chips swap on a clock, and tapping one sends it as your
 * message. This is the opposite on both counts — Gozlin's question, which must
 * stay put while it is read, and which opens an answer sheet rather than
 * speaking for you. So it gets its own still row, and the bar keeps its motion.
 *
 * Easy to wave off: the × is "not now", one tap, no confirmation. A question
 * that is hard to dismiss is a demand.
 *
 * The label is a small fixed set of phrasings, drawn by the question's id so it
 * never changes under a finger. It is a button, not Gozlin speaking — the
 * coach's own words about this happen in the conversation, where the model
 * says them.
 */

import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { parseLocalDate, toLocalDateString } from "@/services/OfflineStorage";
import { stableHash } from "@/services/gozlin/GozlinTrackerHabits";
import type { CuriosityEntry } from "@/services/gozlin/novelty";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function whenSaid(triedOn: string): string {
  const today = parseLocalDate(toLocalDateString(new Date()));
  const days = Math.round((today.getTime() - parseLocalDate(triedOn).getTime()) / 86_400_000);
  return days === 1 ? "yesterday" : `on ${WEEKDAY[parseLocalDate(triedOn).getDay()]}`;
}

const PHRASINGS: ((name: string, when: string) => string)[] = [
  (n, w) => `${n} ${w} — how did it land?`,
  (n) => `How did the ${n} sit with you?`,
  (n) => `Feeling the ${n} today?`,
  (n, w) => `First go at ${n} ${w} — how was it?`,
];

export function curiosityChipLabel(entry: CuriosityEntry): string {
  const pick = PHRASINGS[stableHash(entry.id) % PHRASINGS.length];
  return pick(entry.label, whenSaid(entry.triedOn));
}

export function CuriosityChip({
  entry,
  onOpen,
  onDismiss,
  disabled,
}: {
  entry: CuriosityEntry;
  onOpen: () => void;
  onDismiss: () => void;
  disabled?: boolean;
}) {
  const { colors } = useColors();
  const label = curiosityChipLabel(entry);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.22) },
      ]}
    >
      <Pressable
        onPress={onOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens a quick answer. New movements often show up a day or two later."
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
        <AppText variant="footnote" weight="600" numberOfLines={1} style={styles.text}>
          {label}
        </AppText>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  text: { flexShrink: 1 },
  close: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
