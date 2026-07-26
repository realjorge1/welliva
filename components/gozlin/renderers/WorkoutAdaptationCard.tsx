/**
 * WorkoutAdaptationCard — Adaptive Workout Intelligence (Phase 5).
 *
 * Renders the decision engine's ranked training adjustments. Each carries its
 * explanation + the evidence behind it, and — where the change is concrete
 * (replace / volume / rest) — an Apply action that mutates the live plan via
 * AppContext. The card consumes useWorkout directly so the renderer dispatch
 * stays presentational.
 */

import { AppText, Button, Card, Divider } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Spacing } from "@/constants/theme";
import { useWorkout } from "@/contexts/AppContext";
import {
  isApplicable,
  type GozlinWorkoutAdaptation,
  type WorkoutAdaptation,
} from "@/services/gozlin";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Bullet, CardHeader, Chip, kitStyles, toneColor } from "./GozlinCardKit";

export function WorkoutAdaptationCard({ data }: { data: GozlinWorkoutAdaptation }) {
  const { colors } = useColors();
  const { applyWorkoutAdaptation, workoutPlan } = useWorkout();
  const [applied, setApplied] = useState<Record<number, boolean>>({});

  const onApply = async (adaptation: WorkoutAdaptation, i: number) => {
    await applyWorkoutAdaptation(adaptation);
    setApplied((prev) => ({ ...prev, [i]: true }));
  };

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="barbell" label="Adaptive training" color={colors.primary} />
        <AppText variant="subhead" color="secondary">
          {data.summary}
        </AppText>

        {data.adaptations.map((a, i) => {
          const c = toneColor(colors, a.tone);
          const canApply = isApplicable(a) && !!workoutPlan;
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
              {canApply ? (
                <View style={styles.indent}>
                  <Button
                    label={isApplied ? "Applied" : "Apply to my plan"}
                    icon={isApplied ? "checkmark-done" : "checkmark"}
                    variant={isApplied ? "ghost" : "tonal"}
                    size="sm"
                    fullWidth={false}
                    disabled={isApplied}
                    onPress={() => onApply(a, i)}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  indent: { paddingLeft: 42 },
});
