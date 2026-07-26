/**
 * NutrientPanel — the full nutrition label for a resolved food or meal.
 *
 * Presentation rules that carry real weight here:
 *
 *  1. A MISSING nutrient renders as "—", never as 0. Sparse panels are the norm
 *     (see models/nutrients), and showing an unmeasured vitamin as zero would
 *     tell the user something false in the most literal way available.
 *  2. Partial totals are prefixed "≥". If only some items in a meal have iron
 *     data, the total is a floor, not a figure.
 *  3. The confidence chip and the source line are ALWAYS rendered. There is no
 *     variant of this component that shows numbers without saying where they
 *     came from — that's the whole contract of the feature.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_NOTE,
  describeSource,
  EXTENDED_ORDER,
  formatNutrient,
  LABEL_ORDER,
  NUTRIENT_META,
  percentDV,
  type NutrientConfidence,
  type NutrientKey,
  type NutrientPanel as Panel,
  type NutrientSource,
} from "@/models/nutrients";

export interface NutrientPanelProps {
  panel: Panel;
  /** Nutrients whose total is incomplete — rendered with a "≥" prefix. */
  partialKeys?: NutrientKey[];
  confidence: NutrientConfidence;
  source?: NutrientSource | null;
  /** Extra sources when the panel is a sum over several foods. */
  sources?: (NutrientSource | null)[];
  title?: string;
  subtitle?: string;
  /** Start with the micronutrient section open. */
  defaultExpanded?: boolean;
}

const CONFIDENCE_TONE: Record<
  NutrientConfidence,
  "good" | "ok" | "weak" | "none"
> = {
  measured: "good",
  "portion-estimated": "ok",
  "recipe-estimated": "ok",
  "macros-only": "weak",
  unmatched: "none",
};

export function NutrientPanel({
  panel,
  partialKeys = [],
  confidence,
  source,
  sources,
  title,
  subtitle,
  defaultExpanded = false,
}: NutrientPanelProps) {
  const { colors } = useColors();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showSources, setShowSources] = useState(false);

  const partial = new Set(partialKeys);
  const tone = CONFIDENCE_TONE[confidence];
  const toneColor =
    tone === "good"
      ? colors.success
      : tone === "ok"
        ? colors.warning
        : tone === "weak"
          ? colors.textSecondary
          : colors.error;

  // Only show extended rows the panel actually has data for — a wall of dashes
  // is noise, not honesty. The dash is for a nutrient the user asked to see.
  const extendedPresent = EXTENDED_ORDER.filter((k) => panel[k] !== undefined);

  const allSources = (sources ?? [source ?? null]).filter(
    (s, i, arr): s is NutrientSource =>
      s !== null && arr.findIndex((o) => o && describeSource(o) === describeSource(s)) === i,
  );

  return (
    <Card padding="xl">
      {title ? (
        <View style={styles.header}>
          <AppText variant="headline" weight="700">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Confidence — stated before the numbers, not after them. */}
      <View style={[styles.chip, { backgroundColor: `${toneColor}1A`, borderColor: `${toneColor}40` }]}>
        <Ionicons
          name={
            confidence === "measured"
              ? "checkmark-circle"
              : confidence === "unmatched"
                ? "help-circle"
                : "information-circle"
          }
          size={14}
          color={toneColor}
        />
        <AppText variant="caption" weight="700" style={{ color: toneColor }}>
          {CONFIDENCE_LABEL[confidence]}
        </AppText>
      </View>
      <AppText variant="caption" color="textSecondary" style={styles.note}>
        {CONFIDENCE_NOTE[confidence]}
      </AppText>

      {confidence === "unmatched" ? null : (
        <>
          {/* Calories headline */}
          <View style={[styles.calorieRow, { borderBottomColor: colors.border }]}>
            <AppText variant="title" weight="800">
              Calories
            </AppText>
            <AppText variant="display" weight="800">
              {panel.calories !== undefined ? Math.round(panel.calories) : "—"}
            </AppText>
          </View>

          <View style={[styles.dvHeader, { borderBottomColor: colors.border }]}>
            <AppText variant="caption" color="textSecondary" weight="700">
              % Daily Value*
            </AppText>
          </View>

          {LABEL_ORDER.filter((k) => k !== "calories").map((key) => (
            <NutrientRow
              key={key}
              nutrientKey={key}
              value={panel[key]}
              isPartial={partial.has(key)}
            />
          ))}

          {extendedPresent.length > 0 ? (
            <>
              <Pressable
                onPress={() => setExpanded((e) => !e)}
                style={styles.expandRow}
                hitSlop={8}
              >
                <AppText variant="caption" weight="700" color="primary">
                  {expanded ? "Hide" : "Show"} vitamins & minerals
                </AppText>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
              {expanded
                ? extendedPresent.map((key) => (
                    <NutrientRow
                      key={key}
                      nutrientKey={key}
                      value={panel[key]}
                      isPartial={partial.has(key)}
                    />
                  ))
                : null}
            </>
          ) : null}

          <AppText variant="caption" color="textSecondary" style={styles.footnote}>
            * Percent Daily Values are based on a 2,000 calorie diet (FDA
            reference values).
          </AppText>
        </>
      )}

      {/* Provenance — always available, one tap away. */}
      {allSources.length > 0 ? (
        <Pressable onPress={() => setShowSources((s) => !s)} hitSlop={8} style={styles.sourceToggle}>
          <Ionicons name="library-outline" size={14} color={colors.textSecondary} />
          <AppText variant="caption" color="textSecondary" weight="600">
            {showSources ? "Hide sources" : `Source${allSources.length > 1 ? "s" : ""}`}
          </AppText>
        </Pressable>
      ) : null}
      {showSources
        ? allSources.map((s, i) => (
            <AppText key={i} variant="caption" color="textSecondary" style={styles.sourceLine}>
              • {describeSource(s)}
            </AppText>
          ))
        : null}
    </Card>
  );
}

function NutrientRow({
  nutrientKey,
  value,
  isPartial,
}: {
  nutrientKey: NutrientKey;
  value: number | undefined;
  isPartial: boolean;
}) {
  const { colors } = useColors();
  const meta = NUTRIENT_META[nutrientKey];
  const dv = value !== undefined ? percentDV(nutrientKey, value) : null;
  const indented = Boolean(meta.parent);

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <AppText
        variant="body"
        weight={indented ? "400" : "700"}
        style={indented ? styles.indent : undefined}
      >
        {meta.label}
      </AppText>
      <View style={styles.values}>
        <AppText variant="body" weight={indented ? "400" : "600"}>
          {value === undefined
            ? "—"
            : `${isPartial ? "≥ " : ""}${formatNutrient(nutrientKey, value)}`}
        </AppText>
        <AppText
          variant="body"
          weight="700"
          color="textSecondary"
          style={styles.dv}
        >
          {dv !== null ? `${dv}%` : ""}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.md, gap: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: { marginTop: Spacing.sm, lineHeight: 17 },
  calorieRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 3,
    paddingBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  dvHeader: {
    alignItems: "flex-end",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  indent: { paddingLeft: Spacing.lg },
  values: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  dv: { minWidth: 44, textAlign: "right" },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
  },
  footnote: { marginTop: Spacing.md, lineHeight: 16 },
  sourceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.lg,
  },
  sourceLine: { marginTop: 4, lineHeight: 16 },
});
