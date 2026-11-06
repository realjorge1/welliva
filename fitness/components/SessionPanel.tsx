/**
 * SessionPanel — the player's instrument card, under the stage.
 *
 * Three lines of reading, the same shape in every phase so nothing on the
 * screen moves when the phase changes — only what the lines say:
 *
 *   ■ SET 2 OF 3                                   WORK      ← where, and what now
 *   0:24 LEFT                                   10–15 REPS   ← the clock; the target
 *   ───────────────────────────────────────────────────────
 *   ▪▪ ▪▪ ▪▪ ░░ ░░ …  ▼  ━━━ ━━━ ░░░                       ← the session strip
 *
 * This is where every number in the player lives — the stage above it carries
 * only the body and light — so the launch's 3-2-1 counts here too, in the
 * clock's own place, and lands on GO where the set's clock then starts.
 *
 * The clock is plain tabular figures, deliberately not an odometer: on a 1 Hz
 * clock a rolling number stutters once a second (the owner's "number flip is
 * not smooth"). Only a countdown beat gets an entrance, once per beat; the
 * running clock stays still and exact.
 *
 * The card is the instrument surface every Home and Diet card wears — black, a
 * thin white edge, a coloured square naming the reading — so the player reads
 * as the same app the moment a session opens.
 */
import { AppText, Mono, useColors } from "@/components/ui";
import { INSTRUMENT_CARD } from "@/components/home/surface";
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, { Easing, withTiming } from "react-native-reanimated";

export interface SessionPanelProps {
  /** Header, left — what the reading is about ("SET 2 OF 3"). */
  label: string;
  /** Header, right — the phase word ("WORK", "REST", "OVERTIME"). */
  status: string;
  /** The phase colour: the header square and the status word. */
  tone: string;
  /** The big figure — the set's clock, or the launch's 3-2-1. */
  value: string;
  /** Mono unit set beside it ("LEFT", "OVER", "REST"). */
  unit: string;
  /**
   * Set for a countdown: each new key plays the figure's entrance once. Leave
   * it out for a running clock, which must never animate.
   */
  valueKey?: string | number;
  /** Colour of the figure and its unit. Defaults to the text colour. */
  valueTone?: string;
  /** Spoken form of the figure ("24 seconds left"). */
  valueLabel?: string;
  /** Right of the figure — the rep target, or the rest screen's stepper. */
  aside?: React.ReactNode;
  /** The session strip. */
  children?: React.ReactNode;
  /** A short phone: the clock steps down a size so the stage keeps its room. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A countdown beat lands: in from a little larger, settling as it fades up. */
function beatIn() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 1.35 }] },
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [{ scale: withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }) }],
    },
  };
}

export function SessionPanel({
  label,
  status,
  tone,
  value,
  unit,
  valueKey,
  valueTone,
  valueLabel,
  aside,
  children,
  compact = false,
  style,
}: SessionPanelProps) {
  const { colors } = useColors();
  const ink = valueTone ?? colors.text;
  const figure = (
    <Text
      style={[styles.value, compact && styles.valueCompact, { color: ink }]}
      maxFontSizeMultiplier={1.15}
      numberOfLines={1}
    >
      {value}
    </Text>
  );

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={[styles.square, { backgroundColor: tone }]} />
          <Mono size={11} tracking={0.6} color={colors.textSecondary} numberOfLines={1}>
            {label}
          </Mono>
        </View>
        <Mono size={11} tracking={0.6} color={tone} numberOfLines={1}>
          {status}
        </Mono>
      </View>

      <View style={styles.figureRow}>
        <View
          style={styles.figure}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={valueLabel ?? `${value} ${unit}`}
        >
          {valueKey == null ? (
            figure
          ) : (
            <Reanimated.View key={String(valueKey)} entering={beatIn}>
              {figure}
            </Reanimated.View>
          )}
          {unit ? (
            <Mono size={11} tracking={0.6} color={valueTone ?? colors.textTertiary}>
              {unit}
            </Mono>
          ) : null}
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>

      {children ? (
        <>
          <View style={[styles.rule, { backgroundColor: colors.divider }]} />
          {children}
        </>
      ) : null}
    </View>
  );
}

/** The figure row's right side when it is a target: a value over its name. */
export function PanelTarget({ value, label }: { value: string; label: string }) {
  const { colors } = useColors();
  return (
    <View style={styles.target} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="headline" weight="600" numberOfLines={1} style={styles.targetValue}>
        {value}
      </AppText>
      <Mono size={10} tracking={0.6} color={colors.textTertiary} numberOfLines={1}>
        {label}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...INSTRUMENT_CARD,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  // A short phone gives the stage these few points back.
  cardCompact: { paddingTop: Spacing.sm + 2, paddingBottom: Spacing.sm + 2 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  square: { width: 8, height: 8, borderRadius: 2 },
  figureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.xs,
    minHeight: 48,
  },
  figure: { flexDirection: "row", alignItems: "baseline", gap: 6, flexShrink: 1 },
  // The reading leads: big, light, tight, and tabular so the digits never shuffle.
  value: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "500",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  valueCompact: { fontSize: 38, lineHeight: 44, letterSpacing: -1.2 },
  aside: { flexShrink: 0, alignItems: "flex-end" },
  target: { alignItems: "flex-end" },
  targetValue: { fontVariant: ["tabular-nums"] },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.sm, marginBottom: Spacing.md },
});
