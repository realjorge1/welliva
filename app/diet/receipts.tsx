/**
 * RECEIPTS — where today's numbers came from.
 *
 * ── WHY THIS IS A SCREEN AND NOT A FOOTNOTE ─────────────────────────────────
 * Every number in this app already carries its provenance: which reference
 * table asserted it, at what confidence, down to a USDA id anyone can look up.
 * That machinery has been load-bearing since the beginning and almost entirely
 * invisible — a grey "86% measured" chip that hides itself on a good day.
 *
 * Which gets the emphasis exactly backwards. It is not a caveat about our
 * numbers, it is the single thing no competitor can copy. MyFitnessPal cannot
 * show you where a crowd-sourced entry came from; Cal AI cannot show you where
 * a vision model's calorie count came from, because there is no "where" — a
 * number a model computed has no provenance to display. Welliva forbade the
 * model from computing figures (services/gozlin/agent/receipts.ts,
 * services/nutrition/NutrientResolver.ts), and this screen is the receipt that
 * architecture was buying.
 *
 * ── WHAT IT PROMISES, AND THEREFORE WHAT IT MUST NOT DO ─────────────────────
 * The promise is: read down this list and you can check every calorie in your
 * day. That imposes hard constraints, all of them the "no cosmetic counters"
 * rule applied to the one screen where breaking it would be fatal:
 *
 *   • The rows must ADD UP to the headline. `sourceBreakdown` uses the same
 *     measured/estimated line `dayProvenance` draws for the percentage, so a
 *     user who totals the rows gets the number above them.
 *   • An unidentified food is SHOWN, not hidden. It is the row most likely to
 *     embarrass us and the one whose absence would make the rest a lie.
 *   • Nothing here interprets, encourages or reassures. A receipt that argues
 *     its numbers are correct has stopped being evidence — the same rule
 *     ReceiptSheet holds itself to for the coach's figures.
 *
 * ── THE 100% DAY ────────────────────────────────────────────────────────────
 * `provenanceLine` is deliberately silent at 100% so the inline chip earns
 * attention by being rare. This screen is not: someone who opened it asked the
 * question, and "every number today was measured" is the best possible answer
 * to it. Both rules are right, for different surfaces — see
 * services/nutrition/dayProvenance.ts.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useMealPlan } from "@/contexts/MealPlanContext";
import {
  CONFIDENCE_LABEL,
  describeSource,
  type NutrientConfidence,
} from "@/models/nutrients";
import {
  dayProvenance,
  isMeasured,
  provenanceHeadline,
  sourceBreakdown,
  type SourceTally,
} from "@/services/nutrition/dayProvenance";

export default function ReceiptsScreen() {
  const { colors } = useColors();
  const { todayFoodLog } = useMealPlan();

  const provenance = useMemo(() => dayProvenance(todayFoodLog), [todayFoodLog]);
  const tallies = useMemo(() => sourceBreakdown(todayFoodLog), [todayFoodLog]);

  const empty = todayFoodLog.length === 0;

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="headline" weight="700">
          Receipts
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/*
          The hero. One sentence, one bar. Deliberately the first thing on the
          screen and deliberately not a score — a percentage of calories whose
          source we can name is a fact about the log, not a grade on the user.
        */}
        <Card padding="xl" style={styles.hero}>
          <AppText variant="caption" color="tertiary" uppercase weight="700">
            Today
          </AppText>
          <AppText variant="title" weight="700" style={styles.headline}>
            {provenanceHeadline(provenance)}
          </AppText>

          {!empty ? (
            <>
              <ProvenanceBar
                measured={provenance.measuredCalories}
                estimated={provenance.estimatedCalories}
                unknown={provenance.unknownCalories}
              />
              <View style={styles.legend}>
                <LegendDot tone={colors.success} label="Measured" value={provenance.measuredCalories} />
                {provenance.estimatedCalories > 0 ? (
                  <LegendDot tone={colors.warning} label="Estimated" value={provenance.estimatedCalories} />
                ) : null}
                {provenance.unknownCalories > 0 ? (
                  <LegendDot
                    tone={colors.textTertiary}
                    label="Unidentified"
                    value={provenance.unknownCalories}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <AppText variant="subhead" color="secondary">
              Log something and every figure will appear here with the reference
              table it came from.
            </AppText>
          )}
        </Card>

        {/* Per-source totals. The rows a person can actually check. */}
        {tallies.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="caption" color="tertiary" uppercase weight="700">
              What asserted these numbers
            </AppText>
            {tallies.map((t) => (
              <TallyRow key={t.kind} tally={t} />
            ))}
          </View>
        ) : null}

        {/* Item by item, with the citation. This is the receipt proper. */}
        {todayFoodLog.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="caption" color="tertiary" uppercase weight="700">
              Every item, line by line
            </AppText>
            {todayFoodLog.map((entry) => (
              <Card key={entry.id} padding="lg" style={styles.entry}>
                <AppText variant="callout" weight="600" numberOfLines={2}>
                  {entry.label}
                </AppText>
                {entry.items.length === 0 ? (
                  <AppText variant="footnote" color="tertiary">
                    Nothing in this entry could be matched to a reference food,
                    so no figures are claimed for it.
                  </AppText>
                ) : (
                  entry.items.map((item, i) => (
                    <View
                      key={`${entry.id}_${i}`}
                      style={[styles.item, { borderTopColor: colors.divider }]}
                    >
                      <View style={styles.itemHead}>
                        <AppText variant="subhead" weight="600" style={styles.itemName}>
                          {item.name}
                        </AppText>
                        <AppText variant="subhead" color="secondary">
                          {item.nutrients.calories !== undefined
                            ? `${Math.round(item.nutrients.calories)} kcal`
                            : "—"}
                        </AppText>
                      </View>

                      <AppText variant="caption" color="tertiary">
                        {item.quantity} {item.unit}
                        {item.grams > 0 ? ` · ${Math.round(item.grams)} g` : ""}
                      </AppText>

                      {/*
                        The citation. For USDA this is an id anyone can check at
                        fdc.nal.usda.gov; for an estimate it names the model and
                        says outright that nothing measured it. Both are printed
                        with the same weight — the label is the evidence, and
                        hiding the weak one would defeat the exercise.
                      */}
                      <View style={styles.cite}>
                        <ConfidenceDot confidence={item.confidence} />
                        <AppText variant="caption" color="tertiary" style={styles.citeText}>
                          {CONFIDENCE_LABEL[item.confidence]} · {describeSource(item.source)}
                        </AppText>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            ))}
          </View>
        ) : null}

        {/*
          The explainer, last. Someone who scrolled this far has already seen
          the evidence; this says why it exists, once, without arguing that any
          particular number is right.
        */}
        <Card padding="xl" style={styles.why}>
          <AppText variant="callout" weight="700">
            Why we can show you this
          </AppText>
          <AppText variant="footnote" color="secondary" style={styles.whyBody}>
            Welliva&apos;s coach is not allowed to compute nutrition figures. It
            can read your log and name a food, but every number comes from a food
            composition table — USDA, the FAO&apos;s West African tables, or a
            manufacturer&apos;s printed label — and carries that source with it
            for the rest of its life.
          </AppText>
          <AppText variant="footnote" color="secondary" style={styles.whyBody}>
            That restriction is what makes this page possible. A calorie count a
            model produced has no source to show, which is why no other tracker
            shows one.
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/**
 * The stacked bar.
 *
 * Widths are the real calorie shares, not a padded minimum — a 2% estimated
 * sliver should look like 2%. The one concession is a floor of 2px on a
 * non-zero segment, so a genuinely small share is still visible rather than
 * rounding away to nothing and reading as "none".
 */
function ProvenanceBar({
  measured,
  estimated,
  unknown,
}: {
  measured: number;
  estimated: number;
  unknown: number;
}) {
  const { colors } = useColors();
  const total = measured + estimated + unknown;
  if (total <= 0) return null;

  const segments = [
    { value: measured, tone: colors.success },
    { value: estimated, tone: colors.warning },
    { value: unknown, tone: colors.textTertiary },
  ].filter((s) => s.value > 0);

  return (
    <View
      style={[styles.bar, { backgroundColor: alpha(colors.text, 0.08) }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${Math.round((measured / total) * 100)} percent of today's calories were measured`}
    >
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            flex: s.value / total,
            minWidth: 2,
            backgroundColor: s.tone,
          }}
        />
      ))}
    </View>
  );
}

function LegendDot({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <AppText variant="caption" color="secondary">
        {label} · {value} kcal
      </AppText>
    </View>
  );
}

function ConfidenceDot({ confidence }: { confidence: NutrientConfidence }) {
  const { colors } = useColors();
  const tone =
    confidence === "unmatched"
      ? colors.textTertiary
      : isMeasured(confidence)
        ? colors.success
        : colors.warning;
  return <View style={[styles.dot, { backgroundColor: tone }]} />;
}

function TallyRow({ tally }: { tally: SourceTally }) {
  const { colors } = useColors();
  const tone =
    tally.kind === "none"
      ? colors.textTertiary
      : tally.measured
        ? colors.success
        : colors.warning;

  return (
    <View style={[styles.tally, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={styles.tallyText}>
        <AppText variant="subhead" weight="600">
          {tally.label}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {tally.items} item{tally.items === 1 ? "" : "s"}
        </AppText>
      </View>
      <AppText variant="subhead" weight="600" color="secondary">
        {tally.calories} kcal
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl * 2, gap: Spacing.xl },

  hero: { gap: Spacing.sm },
  headline: { marginBottom: Spacing.xs },
  bar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: Spacing.xs,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  section: { gap: Spacing.sm },
  tally: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tallyText: { flex: 1, gap: 2 },

  entry: { gap: Spacing.xs },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 3,
  },
  itemHead: { flexDirection: "row", alignItems: "baseline", gap: Spacing.md },
  itemName: { flex: 1 },
  cite: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  citeText: { flex: 1 },

  why: { gap: Spacing.sm },
  whyBody: { lineHeight: 19 },
});
