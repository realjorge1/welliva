/**
 * PRICE TAG — the paid card's price: both billing periods, and the receipt for
 * the one chosen.
 *
 * ONE TAG, NOT TWO
 *
 * The previous pass had two: a Monthly/Annual picker at the top of the screen,
 * each tile with its own price, and then a second, bigger price block on the Pro
 * card repeating the chosen one with its details. Same numbers twice, a phone
 * height apart, and the second one read as a different offer. They are one
 * thing now, on the card whose button buys it:
 *
 *  · THE TILES are the tag. Monthly and Annual side by side, each with its own
 *    per-month figure, so the comparison is made at a glance and choosing is a
 *    tap. The saving hangs off the Annual tile's top edge — "SAVE ₦5,100" — the
 *    offer while Monthly is chosen and the receipt once Annual is. The amount
 *    leads; the percentage never appears without it.
 *  · THE PERFORATION separates what the plan costs from what gets charged.
 *  · THE RECEIPT is the chosen tile's charge: "Billed yearly  ₦17,400.00
 *    ₦12,300.00", the saving shown as the two numbers it's the difference of;
 *    "Due today · Free for 7 days" only when a trial makes today's charge differ
 *    from the price; then the inked "29% off" and "cancel any time".
 *
 * WHILE THE STORE IS STILL ANSWERING, THE FIGURES ARE BLANK, NOT GUESSED. The
 * fallback list prices are US dollars; showing them to someone in Lagos for the
 * seconds it takes Google Play to answer is showing a price nobody will charge
 * them, in a currency that isn't theirs. `pending` keeps the tag's shape with
 * the figures left as bars until the real ones arrive.
 *
 * Free wears a one-tile version of the same tag (FreePriceTag), in the reader's
 * own currency once the store has named it.
 */
import { alpha, Radius, Spacing } from "@/constants/theme";
import { AppText, useColors } from "@/components/ui";
import type { BillingPeriod } from "@/services/billing";
import * as Haptics from "@/utils/haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { BestSaving, PriceView } from "./planCopy";
import { goldInk, ON_GOLD } from "./tagInk";

/** Tile padding at a 1px border; a 2px (selected) border takes a pixel back. */
const TILE_PAD = Spacing.md;

export interface PriceTagProps {
  period: BillingPeriod;
  onChangePeriod: (period: BillingPeriod) => void;
  /** The tier's price at each period — `priceView(tier, period, plans)`. */
  monthly: PriceView;
  annual: PriceView;
  /** Null when no saving is worth claiming — the Annual tile carries no tag. */
  saving: BestSaving | null;
  /**
   * Days of free trial THIS reader would get. Null for anyone the store would
   * charge today — it reports a trial on the product whether or not the reader
   * is eligible.
   */
  trialDays?: number | null;
  /** The store can sell here but hasn't answered yet. See the header note. */
  pending?: boolean;
  /**
   * How far the perforation bleeds past the tag on each side — the padding of
   * the card it sits in, so the tear line runs edge to edge.
   */
  bleed?: number;
}

export function PriceTag({
  period,
  onChangePeriod,
  monthly,
  annual,
  saving,
  trialDays = null,
  pending = false,
  bleed = Spacing.lg,
}: PriceTagProps) {
  const { colors, isDark } = useColors();
  const ink = goldInk(colors, isDark);
  const chosen = period === "annual" ? annual : monthly;

  const pick = (p: BillingPeriod) => {
    if (p === period) return;
    Haptics.selectionAsync().catch(() => {});
    onChangePeriod(p);
  };

  return (
    <View>
      <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel="Billing period">
        <PeriodTile
          name="Monthly"
          price={monthly}
          tag={null}
          selected={period === "monthly"}
          pending={pending}
          onPress={() => pick("monthly")}
        />
        <PeriodTile
          name="Annual"
          price={annual}
          tag={saving && !pending ? `SAVE ${saving.amount}` : null}
          selected={period === "annual"}
          pending={pending}
          onPress={() => pick("annual")}
        />
      </View>

      <Perforation color={alpha(colors.textTertiary, 0.45)} bleed={bleed} />

      {/* ── Receipt for the chosen tile ─────────────────────────────────── */}
      {chosen.billedLabel ? (
        <LedgerRow label={chosen.billedLabel}>
          {pending ? (
            <Skeleton width={88} height={12} />
          ) : (
            <>
              {chosen.compareTotal ? (
                <AppText variant="footnote" color="tertiary" style={[styles.num, styles.struck]}>
                  {chosen.compareTotal}
                </AppText>
              ) : null}
              <AppText variant="callout" weight="700" style={styles.num}>
                {chosen.billedTotal ?? chosen.headline}
              </AppText>
            </>
          )}
        </LedgerRow>
      ) : null}
      {trialDays && !pending ? (
        <LedgerRow label="Due today">
          <AppText variant="callout" weight="700" color="success">
            {`Free for ${trialDays} days`}
          </AppText>
        </LedgerRow>
      ) : null}

      {!pending ? (
        <AppText variant="footnote" color="tertiary" style={styles.footnote}>
          {chosen.footnote.lead ? (
            <AppText variant="footnote" color={ink} weight="700">
              {`${chosen.footnote.lead} `}
            </AppText>
          ) : null}
          {chosen.footnote.rest}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * The free card's price, as a single tile of the same make as the paid tiles:
 * "₦0 forever", and underneath, what that means.
 */
export function FreePriceTag({ price }: { price: PriceView }) {
  const { colors, isDark } = useColors();
  return (
    <View
      style={[
        styles.freeTile,
        {
          borderColor: colors.borderStrong,
          backgroundColor: alpha(colors.surface, isDark ? 0.4 : 1),
        },
      ]}
      accessible
      accessibilityLabel={`${price.headline} ${price.unit}. ${price.detail}`}
    >
      <AppText variant="title" style={[styles.figure, styles.freeFigure]}>
        {price.headline}
      </AppText>
      <View style={styles.flex}>
        <AppText variant="subhead" color="secondary">
          {price.unit}
        </AppText>
        <AppText variant="footnote" color="tertiary">
          {price.footnote.rest}
        </AppText>
      </View>
    </View>
  );
}

function PeriodTile({
  name,
  price,
  tag,
  selected,
  pending,
  onPress,
}: {
  name: string;
  price: PriceView;
  tag: string | null;
  selected: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={
        pending
          ? `${name}, price loading`
          : [name, `${price.headline} per month`, tag?.toLowerCase()].filter(Boolean).join(", ")
      }
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: selected ? colors.gold : colors.borderStrong,
          borderWidth: selected ? 2 : 1,
          padding: selected ? TILE_PAD - 1 : TILE_PAD,
          backgroundColor: selected
            ? alpha(colors.gold, isDark ? 0.1 : 0.08)
            : alpha(colors.surface, isDark ? 0.4 : 1),
          opacity: pressed && !selected ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.head}>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? colors.gold : colors.textTertiary,
              backgroundColor: selected ? colors.gold : "transparent",
            },
          ]}
        >
          {selected ? <View style={[styles.radioDot, { backgroundColor: ON_GOLD }]} /> : null}
        </View>
        <AppText variant="callout" color={selected ? "primary" : "secondary"}>
          {name}
        </AppText>
      </View>

      {pending ? (
        <Skeleton width="78%" height={18} style={styles.skeletonFigure} />
      ) : (
        <AppText
          variant="title"
          style={styles.figure}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {price.headline}
        </AppText>
      )}
      <AppText variant="footnote" color="secondary">
        per month
      </AppText>

      {/* Across the top edge, not inside: a tag hung on the tile rather than
          another line of text in it. Rendered last so it paints over the border. */}
      {tag ? (
        <View style={[styles.tag, { backgroundColor: colors.gold }]}>
          <AppText variant="caption" color={ON_GOLD} style={styles.tagText} numberOfLines={1}>
            {tag}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * A dashed rule across the full width of the card, like the tear line on a
 * ticket. Drawn as the top edge of a dashed box clipped to one pixel: Android
 * will not dash a single-sided border, but it dashes a whole box.
 */
function Perforation({ color, bleed }: { color: string; bleed: number }) {
  return (
    <View style={[styles.perfClip, { marginHorizontal: -bleed }]}>
      <View style={[styles.perfBox, { borderColor: color }]} />
    </View>
  );
}

function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.ledgerRow}>
      <AppText variant="footnote" color="secondary">
        {label}
      </AppText>
      <View style={styles.ledgerValue}>{children}</View>
    </View>
  );
}

function Skeleton({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: object;
}) {
  const { colors, isDark } = useColors();
  return (
    <View
      style={[
        { width, height, borderRadius: height / 2 },
        { backgroundColor: alpha(colors.text, isDark ? 0.1 : 0.08) },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  tiles: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  tile: { flex: 1, borderRadius: Radius.lg + 2 },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.sm - 1 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 6, height: 6, borderRadius: 3 },

  figure: {
    marginTop: Spacing.sm,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  skeletonFigure: { marginTop: Spacing.sm + 5, marginBottom: 5 },

  tag: {
    position: "absolute",
    top: -10,
    right: Spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm - 1,
    borderRadius: Radius.pill,
  },
  tagText: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.4 },

  perfClip: { height: 1, overflow: "hidden", marginTop: Spacing.lg, marginBottom: Spacing.md },
  perfBox: { height: 3, borderWidth: 1, borderStyle: "dashed", borderRadius: 1 },

  /* The value group pushes itself right, and stays right if a long localised
     pair of prices has to wrap under its label on a narrow phone. */
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: Spacing.md,
    marginBottom: Spacing.xs + 2,
  },
  ledgerValue: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm - 2,
    marginLeft: "auto",
  },
  num: { fontVariant: ["tabular-nums"] },
  struck: { textDecorationLine: "line-through" },
  footnote: { marginTop: 2 },

  freeTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.lg + 2,
    borderWidth: 1,
    padding: TILE_PAD,
  },
  freeFigure: { marginTop: 0 },
});
