/**
 * RecoveryCard — the readiness signal. Honest about its basis (training-load
 * proxy, no wearables yet), with the drivers behind the score + a recommendation.
 */

import { AppText, Card, Ring } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Spacing } from "@/constants/theme";
import type { GozlinRecoveryCard as RecoveryCardData, RecoveryLevel } from "@/services/gozlin";
import React from "react";
import { StyleSheet, View } from "react-native";
import { CardHeader, Chip, kitStyles } from "./GozlinCardKit";

const LEVEL_LABEL: Record<RecoveryLevel, string> = {
  green: "Well recovered",
  amber: "Moderate",
  red: "Run down",
};

export function RecoveryCard({ data }: { data: RecoveryCardData }) {
  const { colors } = useColors();
  const s = data.state;
  const color =
    s.level === "green" ? colors.success : s.level === "amber" ? colors.warning : colors.error;

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="pulse" label="Recovery" color={colors.primary} />

        <View style={styles.heroRow}>
          <Ring progress={s.score / 100} size={84} strokeWidth={9} tone={color}>
            <AppText variant="headline" style={{ color }}>
              {s.score}
            </AppText>
          </Ring>
          <View style={styles.heroText}>
            <AppText variant="headline" style={{ color }}>
              {LEVEL_LABEL[s.level]}
            </AppText>
            <AppText variant="body" color="secondary" style={{ marginTop: 2 }}>
              {s.recommendation}
            </AppText>
          </View>
        </View>

        {s.drivers.length > 0 ? (
          <View style={kitStyles.chipsRow}>
            {s.drivers.map((d, i) => (
              <Chip key={i} text={d} />
            ))}
          </View>
        ) : null}

        <AppText variant="caption" color="tertiary" style={styles.basis}>
          Basis: {s.basis}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  heroText: { flex: 1 },
  basis: { fontStyle: "italic" },
});
