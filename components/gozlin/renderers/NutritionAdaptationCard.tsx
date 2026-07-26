/**
 * NutritionAdaptationCard — Adaptive Nutrition Intelligence (Phase 6).
 *
 * Renders the nutrition decision engine's ranked adjustments — calorie/protein
 * alerts, macro optimization, learned food preferences, meal swaps — each with
 * its evidence and an optional concrete next action, plus the single focus for
 * next week. Food-preference adaptations carry an Apply action that records the
 * preference and reshapes future plans (via AppContext.setFoodPreference).
 */

import { AppText, Button, Card, Divider } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import type { GozlinNutritionAdaptation } from "@/services/gozlin";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Bullet, CardHeader, Chip, kitStyles, LeverBox, toneColor } from "./GozlinCardKit";

export function NutritionAdaptationCard({ data }: { data: GozlinNutritionAdaptation }) {
  const { colors } = useColors();
  const { setFoodPreference } = useProfile();
  const [applied, setApplied] = useState<Record<number, boolean>>({});

  const onApplyTag = async (tag: string, i: number) => {
    await setFoodPreference(tag);
    setApplied((prev) => ({ ...prev, [i]: true }));
  };

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="nutrition" label="Adaptive nutrition" color={colors.primary} />
        <AppText variant="subhead" color="secondary">
          {data.summary}
        </AppText>

        {data.adaptations.map((a, i) => {
          const c = toneColor(colors, a.tone);
          const isApplied = applied[i];
          return (
            <View key={i} style={{ gap: Spacing.sm }}>
              <Divider />
              <Bullet icon={a.icon} title={a.title} detail={a.explanation} color={c} />
              {a.evidence.length > 0 ? (
                <View style={[kitStyles.chipsRow, styles.indent]}>
                  {a.evidence.map((e, j) => (
                    <Chip key={j} text={e} />
                  ))}
                </View>
              ) : null}
              {a.tag ? (
                <View style={styles.indent}>
                  <Button
                    label={isApplied ? "Preference saved" : `Make plans ${a.tag}-free`}
                    icon={isApplied ? "checkmark-done" : "options-outline"}
                    variant={isApplied ? "ghost" : "tonal"}
                    size="sm"
                    fullWidth={false}
                    disabled={isApplied}
                    onPress={() => onApplyTag(a.tag!, i)}
                  />
                </View>
              ) : a.action ? (
                <View style={[styles.action, styles.indent, { backgroundColor: alpha(c, 0.08) }]}>
                  <AppText variant="subhead" style={{ color: c }}>
                    → {a.action}
                  </AppText>
                </View>
              ) : null}
            </View>
          );
        })}

        {!data.dataLimited ? (
          <LeverBox label="Focus next week" text={data.weeklyFocus} color={colors.primary} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  indent: { paddingLeft: 42 },
  action: { borderRadius: Radius.sm, padding: Spacing.sm },
});
