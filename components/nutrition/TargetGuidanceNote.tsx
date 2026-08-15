/**
 * TARGET GUIDANCE NOTE — the words that have to travel with a constrained number.
 *
 * When a medical condition moves a target (CKD capping protein at 0.8 g/kg,
 * type 2 capping carbohydrate, a fat ceiling for pancreatitis), showing only the
 * new number is worse than showing nothing: the user reads it as a prescription
 * we're qualified to write. It isn't — it's a conservative starting point built
 * from population guidance, without their staging, labs or medication doses.
 *
 * So this renders at the point the target is shown, never in settings:
 *   · referrals — "who should actually set this, and why we can't"
 *   · unmodeled — the levers that genuinely matter and that we don't compute
 *
 * Content comes from `targets.guidance`, produced by the constraints layer
 * (services/nutrition/ConditionConstraints.ts). No guidance ⇒ renders nothing,
 * so healthy users see no change at all.
 */
import React, { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { NutritionGuidance } from "@/models/nutrition";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TargetGuidanceNoteProps {
  guidance?: NutritionGuidance;
  style?: View["props"]["style"];
}

export function TargetGuidanceNote({ guidance, style }: TargetGuidanceNoteProps) {
  const { colors } = useColors();
  const [expanded, setExpanded] = useState(false);

  if (!guidance) return null;
  const { referrals = [], unmodeled = [], purineRestricted, potassiumMgMax } = guidance;
  if (!referrals.length && !unmodeled.length && !purineRestricted && !potassiumMgMax) {
    return null;
  }

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={style}>
      {/* Referrals lead — they're the ones that change what a user should DO. */}
      {referrals.length > 0 && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: alpha(colors.warning, 0.1),
              borderColor: alpha(colors.warning, 0.32),
            },
          ]}
        >
          <Ionicons name="medkit-outline" size={18} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="callout" style={styles.heading}>
              About these numbers
            </AppText>
            {referrals.map((line) => (
              <AppText
                key={line}
                variant="footnote"
                color="secondary"
                style={styles.copy}
              >
                {line}
              </AppText>
            ))}
          </View>
        </View>
      )}

      {/* The honest limits, one tap away — present but never shouting. */}
      {(unmodeled.length > 0 || purineRestricted || potassiumMgMax != null) && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel="What these targets don't account for"
          style={({ pressed }) => [styles.discloser, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={14}
            color={colors.textTertiary}
          />
          <AppText variant="caption" color="tertiary">
            What these targets don&apos;t account for
          </AppText>
        </Pressable>
      )}

      {expanded && (
        <View style={styles.list}>
          {potassiumMgMax != null && (
            <Bullet
              color={colors.textTertiary}
              text={`Potassium: aim under ${potassiumMgMax.toLocaleString()} mg — we show it here but don't track it daily.`}
            />
          )}
          {purineRestricted && (
            <Bullet
              color={colors.textTertiary}
              text="Purine-rich foods (organ meats, some fish, beer) — your meal picks avoid them; the daily numbers can't express it."
            />
          )}
          {unmodeled.map((item) => (
            <Bullet key={item} color={colors.textTertiary} text={item} />
          ))}
        </View>
      )}
    </View>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="footnote" color="tertiary" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  heading: { marginBottom: Spacing.xs },
  copy: { marginTop: 2, lineHeight: 18 },
  discloser: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  list: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  dot: { width: 3, height: 3, borderRadius: 2, marginTop: 8 },
});
