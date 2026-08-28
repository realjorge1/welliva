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
 *
 * ── LAYOUT ──────────────────────────────────────────────────────────────────
 * An FDA label is a legal document, not a good screen. It's a flat wall of rows
 * where "Calories" and "Riboflavin" carry identical visual weight — fine on a
 * packet you scan with your eyes, poor on a phone. So this reads top-down in the
 * order a person actually asks:
 *
 *   how much energy?    → the hero number
 *   where's it from?    → the macro split bar + the protein/carb/fat trio
 *   the fine print      → label rows, %DV with an inline bar
 *   says who?           → provenance
 *
 * The trio uses the theme's per-macro colours (protein/carbs/fat) — the same
 * hues the rings and charts use elsewhere, so a number here reads as the same
 * quantity the user already recognises from Home.
 *
 * ── TWO SURFACES ────────────────────────────────────────────────────────────
 * `surface="card"` (default) plates the panel; `surface="bare"` drops the box
 * entirely for screens where the panel is the page rather than one block among
 * carded siblings. Only the wrapper and the title's weight change — see the
 * prop. Everything between them is the same component either way, so the two
 * mounts can't drift apart.
 *
 * ── COLOURS ─────────────────────────────────────────────────────────────────
 * Every colour comes from `useColors()`. Nothing here is a literal, and nothing
 * passes a raw string to AppText's `color`. An earlier version passed
 * `color="textSecondary"`, which is NOT one of AppText's roles (they are
 * `secondary` / `tertiary`), so it fell through to being treated as a literal
 * colour, resolved to nothing valid, and rendered BLACK — unreadable on the dark
 * theme. If you add a colour here, use a role or a `colors.*` token.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
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
  /**
   * How the panel is mounted.
   *
   *   • `"card"` (default) — the standard Card surface. Right when the panel is
   *     one block among siblings that are also cards, where the box is what
   *     says "this is the total, separate from the items above it".
   *   • `"bare"` — no surface, no padding of its own. For a screen where the
   *     panel IS the page at that point: a card there just draws a second frame
   *     inside the one the screen already has, and costs the label a chunk of
   *     width it has better uses for. The title drops to the app's section-label
   *     style so it reads as a heading ON the page rather than as a card's own
   *     title.
   *
   * The panel's internals don't change either way — the split bar, the macro
   * cells, the %DV bars and the label rules are the data, not decoration.
   */
  surface?: "card" | "bare";
}

const CONFIDENCE_TONE: Record<
  NutrientConfidence,
  "good" | "ok" | "weak" | "none"
> = {
  measured: "good",
  "portion-estimated": "ok",
  "recipe-estimated": "ok",
  "macros-only": "weak",
  // Deliberately the same alarm colour as "not identified". An AI estimate is
  // the one figure here with no measurement behind it, and dressing it in the
  // calm grey of "macros only" would understate that.
  "ai-estimated": "none",
  unmatched: "none",
};

/** Energy per gram — how the split bar turns grams back into calories. */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function NutrientPanel({
  panel,
  partialKeys = [],
  confidence,
  source,
  sources,
  title,
  subtitle,
  defaultExpanded = false,
  surface = "card",
}: NutrientPanelProps) {
  const { colors } = useColors();
  const bare = surface === "bare";
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAll, setShowAll] = useState(defaultExpanded);
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

  const macros = [
    { key: "protein" as const, label: "Protein", color: colors.protein },
    { key: "carbs" as const, label: "Carbs", color: colors.carbs },
    { key: "fat" as const, label: "Fat", color: colors.fat },
  ];

  // The energy split. Computed from the macros' own calorie values rather than
  // from `calories`, so the three segments always fill the width even when a
  // source's stated calories don't match its macros exactly (rounding, fibre,
  // alcohol). The bar is a proportion and should look like one.
  const energy = macros.map((m) => (panel[m.key] ?? 0) * KCAL_PER_G[m.key]);
  const energyTotal = energy.reduce((a, b) => a + b, 0);

  const body = (
    <>
      {/* Bare: the section-label treatment the rest of the app gives a heading
          on the page ("HOW MUCH", "LOG IT AS"), with the portion it describes
          set opposite it on the same line. Carded: the panel's own title, which
          has to carry the block on its own because there's a box around it. */}
      {title ? (
        bare ? (
          <View style={styles.bareHeader}>
            <AppText variant="caption" color="tertiary" uppercase>
              {title}
            </AppText>
            {subtitle ? (
              <AppText
                variant="caption"
                color="tertiary"
                numberOfLines={1}
                style={styles.bareSubtitle}
              >
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.header}>
            <AppText variant="headline" weight="700">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="footnote" color="tertiary">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        )
      ) : null}

      {/* Confidence — stated before the numbers, not after them. Tappable so the
          explanation is available without permanently occupying four lines. */}
      <Pressable
        onPress={() => setNoteOpen((e) => !e)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Data quality: ${CONFIDENCE_LABEL[confidence]}`}
        accessibilityHint={noteOpen ? "Hides the explanation" : "Explains what this means"}
        style={[
          styles.chip,
          { backgroundColor: alpha(toneColor, 0.14), borderColor: alpha(toneColor, 0.35) },
        ]}
      >
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
        <Ionicons
          name={noteOpen ? "chevron-up" : "chevron-down"}
          size={12}
          color={toneColor}
        />
      </Pressable>
      {noteOpen ? (
        <AppText variant="caption" color="secondary" style={styles.note}>
          {CONFIDENCE_NOTE[confidence]}
        </AppText>
      ) : null}

      {confidence === "unmatched" ? null : (
        <>
          {/* ── Hero: energy ───────────────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <AppText variant="caption" color="tertiary" uppercase weight="700">
                Calories
              </AppText>
              <AppText variant="display" weight="800" style={{ color: colors.calories }}>
                {panel.calories !== undefined
                  ? `${partial.has("calories") ? "≥" : ""}${Math.round(panel.calories)}`
                  : "—"}
              </AppText>
            </View>
            {panel.calories !== undefined ? (
              <AppText variant="caption" color="tertiary" style={styles.heroDv}>
                {percentDV("calories", panel.calories)}% of a 2,000 kcal day
              </AppText>
            ) : null}
          </View>

          {/* Where that energy comes from. */}
          {energyTotal > 0 ? (
            <View
              style={[styles.splitBar, { backgroundColor: alpha(colors.text, 0.08) }]}
              accessibilityRole="image"
              accessibilityLabel={`Energy split: ${macros
                .map((m, i) => `${Math.round((energy[i] / energyTotal) * 100)} percent ${m.label}`)
                .join(", ")}`}
            >
              {macros.map((m, i) =>
                energy[i] > 0 ? (
                  <View key={m.key} style={{ flex: energy[i], backgroundColor: m.color }} />
                ) : null,
              )}
            </View>
          ) : null}

          {/* ── The macro trio ─────────────────────────────────────────────── */}
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const value = panel[m.key];
              const dv = value !== undefined ? percentDV(m.key, value) : null;
              return (
                <View
                  key={m.key}
                  style={[
                    styles.macroCell,
                    {
                      backgroundColor: alpha(m.color, 0.1),
                      borderColor: alpha(m.color, 0.22),
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="700"
                    uppercase
                    style={{ color: m.color }}
                  >
                    {m.label}
                  </AppText>
                  <AppText variant="headline" weight="800">
                    {value === undefined
                      ? "—"
                      : `${partial.has(m.key) ? "≥" : ""}${formatNutrient(m.key, value)}`}
                  </AppText>
                  <AppText variant="caption" color="tertiary">
                    {dv !== null ? `${dv}% DV` : " "}
                  </AppText>
                </View>
              );
            })}
          </View>

          {/* ── The label ──────────────────────────────────────────────────── */}
          <View style={[styles.labelHead, { borderBottomColor: colors.borderStrong }]}>
            <AppText variant="caption" color="tertiary" uppercase weight="700">
              Full label
            </AppText>
            <AppText variant="caption" color="tertiary" weight="700">
              % Daily Value
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
              {showAll
                ? extendedPresent.map((key) => (
                    <NutrientRow
                      key={key}
                      nutrientKey={key}
                      value={panel[key]}
                      isPartial={partial.has(key)}
                    />
                  ))
                : null}
              <Pressable
                onPress={() => setShowAll((e) => !e)}
                style={styles.expandRow}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showAll ? "Hide vitamins and minerals" : "Show vitamins and minerals"
                }
              >
                <AppText variant="caption" weight="700" color="brand">
                  {showAll ? "Hide" : "Show"} vitamins & minerals
                </AppText>
                <Ionicons
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </>
          ) : null}

          <AppText variant="caption" color="tertiary" style={styles.footnote}>
            % Daily Values are based on a 2,000 calorie diet (FDA reference
            values). A dash means the figure wasn&apos;t measured — not zero.
          </AppText>
        </>
      )}

      {/* Provenance — always available, one tap away. */}
      {allSources.length > 0 ? (
        <>
          <Pressable
            onPress={() => setShowSources((s) => !s)}
            hitSlop={8}
            style={[styles.sourceToggle, { borderTopColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={showSources ? "Hide sources" : "Show sources"}
          >
            <Ionicons name="library-outline" size={14} color={colors.textTertiary} />
            <AppText variant="caption" color="tertiary" weight="600">
              {showSources ? "Hide sources" : `Source${allSources.length > 1 ? "s" : ""}`}
            </AppText>
            <Ionicons
              name={showSources ? "chevron-up" : "chevron-down"}
              size={12}
              color={colors.textTertiary}
            />
          </Pressable>
          {showSources
            ? allSources.map((s, i) => (
                <AppText key={i} variant="caption" color="secondary" style={styles.sourceLine}>
                  • {describeSource(s)}
                </AppText>
              ))
            : null}
        </>
      ) : null}
    </>
  );

  return bare ? <View>{body}</View> : <Card padding="xl">{body}</Card>;
}

/**
 * One label row. The %DV gets an inline bar rather than a bare percentage: "47%"
 * means little at a glance, and the bar is what turns the column into something
 * scannable. Limit nutrients (sodium, saturated fat) fill in the warning hue,
 * because a high number there is the opposite of good news.
 */
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
  const barColor = meta.isLimit ? colors.warning : colors.primary;

  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }]}>
      <AppText
        variant="subhead"
        color={indented ? "secondary" : "primary"}
        weight={indented ? "400" : "600"}
        style={[styles.rowLabel, indented ? styles.indent : null]}
        numberOfLines={1}
      >
        {meta.label}
      </AppText>

      <AppText variant="subhead" weight={indented ? "400" : "600"} style={styles.rowValue}>
        {value === undefined
          ? "—"
          : `${isPartial ? "≥ " : ""}${formatNutrient(nutrientKey, value)}`}
      </AppText>

      <View style={styles.dvCell}>
        {dv !== null ? (
          <>
            <View style={[styles.dvTrack, { backgroundColor: alpha(colors.text, 0.08) }]}>
              <View
                style={[
                  styles.dvFill,
                  { width: `${Math.min(100, dv)}%`, backgroundColor: barColor },
                ]}
              />
            </View>
            <AppText variant="caption" color="secondary" weight="700" style={styles.dvText}>
              {dv}%
            </AppText>
          </>
        ) : (
          <AppText variant="caption" color="tertiary" style={styles.dvText}>
            —
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.md, gap: 2 },
  // `marginLeft` matches the inset every other section label on a bare screen
  // sits at — four points off is small enough to look like a mistake and large
  // enough to see.
  bareHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  bareSubtitle: { flexShrink: 1, textAlign: "right" },
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

  hero: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  heroText: { gap: 2 },
  heroDv: { paddingBottom: 6, flexShrink: 1, textAlign: "right" },
  splitBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
    marginTop: Spacing.md,
  },

  macroRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  macroCell: {
    flex: 1,
    gap: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },

  labelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    paddingBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowLabel: { flex: 1 },
  indent: { paddingLeft: Spacing.lg },
  rowValue: { minWidth: 62, textAlign: "right" },
  dvCell: { width: 76, flexDirection: "row", alignItems: "center", gap: 6 },
  dvTrack: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: "hidden" },
  dvFill: { height: "100%", borderRadius: Radius.pill },
  dvText: { minWidth: 30, textAlign: "right" },

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
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sourceLine: { marginTop: 4, lineHeight: 16 },
});
