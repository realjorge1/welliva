/**
 * ProgressCard — Progress Detective findings. Each finding carries its evidence
 * (the numbers behind it) and an optional lever, so it's always explainable.
 */

import { AppText, Card, Divider } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { FindingKind, GozlinProgressReport } from "@/services/gozlin";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Bullet, CardHeader, Chip, kitStyles } from "./GozlinCardKit";

export function ProgressCard({ data }: { data: GozlinProgressReport }) {
  const { colors } = useColors();

  const kindColor = (kind: FindingKind): string =>
    kind === "hidden_win" ? colors.success : kind === "correlation" ? colors.water : colors.warning;

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="search" label="Progress detective" color={colors.primary} />

        {data.findings.map((f, i) => {
          const c = kindColor(f.kind);
          return (
            <View key={i} style={{ gap: Spacing.sm }}>
              {i > 0 ? <Divider /> : null}
              <Bullet icon={f.icon} title={f.title} detail={f.detail} color={c} />
              {f.evidence.length > 0 ? (
                <View style={[kitStyles.chipsRow, styles.indent]}>
                  {f.evidence.map((e, j) => (
                    <Chip key={j} text={e} />
                  ))}
                </View>
              ) : null}
              {f.lever ? (
                <View style={[styles.lever, styles.indent, { backgroundColor: alpha(c, 0.08) }]}>
                  <AppText variant="subhead" style={{ color: c }}>
                    → {f.lever}
                  </AppText>
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
  lever: { borderRadius: Radius.sm, padding: Spacing.sm },
});
