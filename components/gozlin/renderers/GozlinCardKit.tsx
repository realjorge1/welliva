/**
 * GOZLIN — shared renderer atoms.
 *
 * Small, on-brand building blocks used by every structured coach card so the
 * Gozlin outputs feel like one designed system (mirrors the AIActionsBar/shared
 * pattern from features/, rebuilt on Welliva's design tokens).
 */

import { AppText, Mono, useColors } from "@/components/ui";
import { alpha, Radius, Spacing, type ThemeColors } from "@/constants/theme";
import type { GozlinTone } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A technical eyebrow — the small tracked label that sits above a value.
 *
 * Set in the instrument face on purpose (see components/ui/Mono). A coach card
 * is two different kinds of statement stacked on top of each other: readings,
 * and what the coach makes of them. Giving the readings' labels their own face
 * separates the two before a single word has been read, and it is what makes
 * these cards look like an instrument panel rather than a styled paragraph.
 */
export function MonoLabel({
  text,
  color,
  size = 10,
}: {
  text: string;
  color: string;
  size?: number;
}) {
  return (
    <Mono size={size} weight="700" color={color} tracking={1.1}>
      {text.toUpperCase()}
    </Mono>
  );
}

/**
 * A value read off something, with an optional unit set smaller beside it.
 *
 * Fixed-width by construction, so a figure that changes cannot shove whatever
 * sits next to it — which is the practical reason readouts get their own face
 * and not merely an aesthetic one.
 */
export function Readout({
  value,
  unit,
  color,
  size = 20,
}: {
  value: string;
  unit?: string;
  color: string;
  size?: number;
}) {
  return (
    <View style={styles.readout}>
      <Mono size={size} weight="700" color={color} tracking={-0.2}>
        {value}
      </Mono>
      {unit ? (
        <Mono size={Math.max(9, Math.round(size * 0.5))} weight="700" color={alpha(color, 0.75)} tracking={0.8}>
          {unit.toUpperCase()}
        </Mono>
      ) : null}
    </View>
  );
}

/** Map a Gozlin tone to a design-system color. */
export function toneColor(colors: ThemeColors, tone?: GozlinTone): string {
  switch (tone) {
    case "proud":
      return colors.success;
    case "honest":
      return colors.warning;
    case "alert":
      return colors.error;
    case "gentle":
    case "curious":
      return colors.water;
    case "steady":
    case "warm":
    default:
      return colors.primary;
  }
}

/** Section eyebrow: tinted icon chip + uppercase label. */
export function CardHeader({
  icon,
  iconNode,
  label,
  color,
}: {
  icon?: string;
  iconNode?: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={[styles.headerIcon, { backgroundColor: alpha(color, 0.14) }]}>
        {iconNode ?? <Ionicons name={icon as IconName} size={13} color={color} />}
      </View>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

/** A titled row with a leading tinted icon and supporting detail. */
export function Bullet({
  icon,
  title,
  detail,
  color,
}: {
  icon: string;
  title: string;
  detail?: string;
  color: string;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletIcon, { backgroundColor: alpha(color, 0.14) }]}>
        <Ionicons name={icon as IconName} size={15} color={color} />
      </View>
      <View style={styles.bulletBody}>
        <AppText variant="callout">{title}</AppText>
        {detail ? (
          <AppText variant="subhead" color="secondary" style={styles.bulletDetail}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Small evidence/delta pill. When `color` is omitted it resolves a neutral tone
 * from the current surface (so it stays readable on the page and inside a
 * deep-cyan card alike).
 */
export function Chip({ text, color }: { text: string; color?: string }) {
  const { colors } = useColors();
  const hue = color ?? colors.textSecondary;
  return (
    <View style={[styles.chip, { backgroundColor: alpha(hue, 0.12) }]}>
      <AppText variant="caption" style={{ color: hue }}>
        {text}
      </AppText>
    </View>
  );
}

/** The highlighted single next-action — the heart of every card. */
export function LeverBox({
  label,
  text,
  color,
}: {
  label: string;
  text: string;
  color: string;
}) {
  return (
    <View style={[styles.lever, { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.25) }]}>
      <View style={styles.leverHead}>
        <Ionicons name="arrow-forward-circle" size={15} color={color} />
        <MonoLabel text={label} color={color} />
      </View>
      <AppText variant="callout" style={styles.leverText}>
        {text}
      </AppText>
    </View>
  );
}

export const kitStyles = StyleSheet.create({
  stack: { gap: Spacing.md, marginTop: Spacing.sm },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs },
});

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  headerIcon: {
    width: 22,
    height: 22,
    borderRadius: Radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  bulletIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bulletBody: { flex: 1, gap: 1 },
  bulletDetail: { marginTop: 2 },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  lever: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  leverHead: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  leverText: { lineHeight: 20 },
});
