/**
 * GozlinSuggestionBar — horizontal smart-prompt chips that lower the effort to
 * engage the coach (Phase 1 §10). Tapping a chip submits its prompt.
 *
 * Chips never compress: each is intrinsically sized and pinned with
 * `flexShrink: 0`, its label kept to a single line, so the row scrolls
 * horizontally instead of squeezing chips into each other.
 */

import { AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { GozlinSuggestion } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

export function GozlinSuggestionBar({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: GozlinSuggestion[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useColors();

  if (!suggestions.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      {suggestions.map((s) => (
        <Pressable
          key={s.label}
          disabled={disabled}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPick(s.prompt);
          }}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: alpha(colors.primary, 0.12) }]}>
            <Ionicons name={s.icon as IconName} size={14} color={colors.primary} />
          </View>
          <AppText
            variant="footnote"
            weight="600"
            numberOfLines={1}
            style={[styles.label, { color: colors.text }]}
          >
            {s.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.sm,
    // Let the row grow with its content so chips keep their natural width.
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    // Critical: never let a chip be squeezed by its neighbours — scroll instead.
    flexShrink: 0,
    flexGrow: 0,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flexShrink: 0 },
});
