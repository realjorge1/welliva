/**
 * MindPanel — the state-of-mind read-back on /knows.
 *
 * ── A GAP IS NOT A NEUTRAL DAY ──────────────────────────────────────────────
 * Valence is signed, so the chart is diverging: bars grow up from a midline on
 * pleasant days and down on unpleasant ones. That makes zero a REAL READING —
 * zero is "Neutral", a thing someone chose — and it means a day with no entry
 * cannot be drawn as a zero-height bar without inventing an answer. Unlogged
 * days get a hollow tick on the midline instead, which reads as "nothing here"
 * rather than "felt nothing". Same rule as the intake ledger: never show a
 * number you did not read.
 *
 * ── WHY IT DOESN'T LOG ──────────────────────────────────────────────────────
 * The Deck's quick-log owns the sheet, and it already mounts it. A second owner
 * here would mean two Modals racing — RN silently refuses to present the second
 * while the first is mounted, which is the failure the Sheet's own `onClosed`
 * exists to work around. So this panel reads, and its empty state says where to
 * write.
 */
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { valenceColor, valenceLabel } from "@/services/gozlin/mind";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import type { AssociationRead, MindDay } from "./useMindLog";

/** Half-height of the diverging chart, in px. Full height is twice this. */
const HALF = 34;
const MIDLINE = 1;
/** Words and domains are both long tails — show the head, not the tail. */
const TOP_N = 5;

interface Props {
  series: MindDay[];
  average: number | null;
  topLabels: { label: string; n: number }[];
  associations: AssociationRead[];
}

export function MindPanel({ series, average, topLabels, associations }: Props) {
  const { colors } = useColors();

  const logged = series.filter((d) => d.valence !== null).length;

  if (logged === 0) {
    return (
      <Card padding="lg" style={styles.card}>
        <View style={styles.emptyRow}>
          <View style={[styles.emptyIcon, { backgroundColor: alpha(colors.primary, 0.12) }]}>
            <Ionicons name="partly-sunny-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="subhead">No state of mind logged yet</AppText>
            <AppText variant="footnote" color="secondary">
              Tap the + on any screen and choose “Check in” to record how you
              feel. Two weeks of it is enough for welliva to start connecting it
              to how you eat and train.
            </AppText>
          </View>
        </View>
      </Card>
    );
  }

  const tint = average !== null ? valenceColor(average) : colors.textTertiary;

  return (
    <Card padding="lg" style={styles.card}>
      {/* Headline — the name of the stop, not a number. */}
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="footnote" color="tertiary" uppercase>
            Last {series.length} days
          </AppText>
          <AppText variant="title" style={{ color: tint }}>
            {average !== null ? valenceLabel(average) : "—"}
          </AppText>
          <AppText variant="footnote" color="secondary">
            {/* The scope is stated, because the average is over LOGGED days and
                an unqualified figure would imply all of them. */}
            Across {logged} logged {logged === 1 ? "day" : "days"}
          </AppText>
        </View>
      </View>

      {/* Diverging strip. */}
      <View style={styles.chart}>
        <View style={[styles.mid, { backgroundColor: alpha(colors.text, 0.14) }]} />
        <View style={styles.bars}>
          {series.map((d) => {
            if (d.valence === null) {
              return (
                <View key={d.date} style={styles.col}>
                  <View
                    style={[styles.gap, { borderColor: alpha(colors.text, 0.22) }]}
                  />
                </View>
              );
            }
            const h = Math.max(3, Math.abs(d.valence) * HALF);
            const up = d.valence >= 0;
            return (
              <View key={d.date} style={styles.col}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: valenceColor(d.valence),
                      // Grow away from the midline in the direction of the sign.
                      marginTop: up ? HALF - h : HALF + MIDLINE,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {topLabels.length > 0 && (
        <View style={styles.block}>
          <AppText variant="footnote" color="tertiary" uppercase>
            Words you reach for
          </AppText>
          <View style={styles.wrapRow}>
            {topLabels.slice(0, TOP_N).map((l) => (
              <View
                key={l.label}
                style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}
              >
                <AppText variant="caption" weight="600">
                  {l.label}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {l.n}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      )}

      {associations.length > 0 && (
        <View style={styles.block}>
          <AppText variant="footnote" color="tertiary" uppercase>
            What it tends to be about
          </AppText>
          {associations.slice(0, TOP_N).map((a) => (
            <View key={a.value} style={styles.assocRow}>
              <AppText variant="subhead" style={styles.flex} numberOfLines={1}>
                {a.label}
              </AppText>
              {a.avgValence !== null ? (
                <AppText variant="caption" style={{ color: valenceColor(a.avgValence) }}>
                  {valenceLabel(a.avgValence)}
                </AppText>
              ) : (
                <AppText variant="caption" color="tertiary">
                  —
                </AppText>
              )}
              <AppText variant="caption" color="tertiary" style={styles.assocN}>
                ×{a.n}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start" },
  emptyRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chart: { height: HALF * 2 + MIDLINE, justifyContent: "center" },
  mid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: HALF,
    height: MIDLINE,
  },
  bars: { flexDirection: "row", alignItems: "flex-start", gap: 4, height: HALF * 2 + MIDLINE },
  col: { flex: 1 },
  bar: { width: "100%", borderRadius: 3, minHeight: 3 },
  gap: {
    width: "100%",
    height: 0,
    marginTop: HALF - 1,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  block: { gap: Spacing.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  assocRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  assocN: { minWidth: 26, textAlign: "right" },
});
