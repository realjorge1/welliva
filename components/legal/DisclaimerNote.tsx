/**
 * DISCLAIMER NOTE — the medical disclaimer, wherever Welliva hands out a number.
 *
 * The app computes calorie, protein and sodium targets for people who are
 * pregnant, diabetic or living with kidney disease. Wherever one of those
 * numbers (or a generated plan) is shown, this line sits with it and links to
 * the full disclaimer. One component, so the wording is identical everywhere.
 *
 *   <DisclaimerNote />              footnote under a card or plan
 *   <DisclaimerNote variant="card" /> a soft panel, for a first-run moment
 *   <DisclaimerNote text={…} />     override the copy (e.g. the AI coach line)
 */
import { AppText, useColors } from "@/components/ui";
import { INLINE_MEDICAL_DISCLAIMER, SHORT_MEDICAL_DISCLAIMER } from "@/constants/legal";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export interface DisclaimerNoteProps {
  /** `inline` = quiet footnote (default). `card` = a soft, tinted panel. */
  variant?: "inline" | "card";
  /** Override the sentence. Defaults to the standard medical disclaimer. */
  text?: string;
  /** Use the compact one-liner instead of the full sentence (inline only). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DisclaimerNote({
  variant = "inline",
  text,
  compact = false,
  style,
}: DisclaimerNoteProps) {
  const { colors } = useColors();
  const router = useRouter();
  const copy =
    text ?? (compact ? INLINE_MEDICAL_DISCLAIMER : SHORT_MEDICAL_DISCLAIMER);

  const open = () => router.push("/legal/disclaimer" as never);

  if (variant === "card") {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel="Read the full medical disclaimer"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: alpha(colors.warning, 0.1),
            borderColor: alpha(colors.warning, 0.32),
          },
          pressed && { opacity: 0.85 },
          style,
        ]}
      >
        <Ionicons name="medkit-outline" size={18} color={colors.warning} />
        <View style={styles.flex}>
          <AppText variant="footnote" color="secondary" style={styles.copy}>
            {copy}
          </AppText>
          <AppText variant="caption" color="brand" style={styles.link}>
            Read the full disclaimer
          </AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel="Read the full medical disclaimer"
      style={({ pressed }) => [styles.inline, pressed && { opacity: 0.7 }, style]}
    >
      <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
      <AppText variant="caption" color="tertiary" style={styles.flex}>
        {copy}{" "}
        <AppText variant="caption" color="brand" style={styles.link}>
          Learn more
        </AppText>
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  copy: { lineHeight: 19 },
  link: { fontWeight: "700" },
});
