/**
 * MacroTile — one macro (protein, carbs or fat) as its own small black card.
 *
 * Top to bottom: the macro's colour and name, how much has been eaten as a DOT
 * MATRIX figure, the target beneath it in the regular face, and a bar of eight
 * square dots that light up in the macro's own colour as the target is reached.
 *
 * THE FIGURE AND THE TARGET ARE STACKED, NOT SIDE BY SIDE. Three tiles share a
 * phone's width, so each has roughly 90pt inside its padding; a three-digit dot
 * figure takes nearly all of it, and "/ 500 g" cannot sit beside it. Stacked,
 * "350" over "/ 500 g" also reads as the fraction it is.
 *
 * THE FIGURE FITS ITS TILE, whatever the phone. It is measured, then its dots
 * shrink until it fits (DotNumeral `maxWidth`), so a small phone gets smaller
 * dots rather than a figure running out of its card. Nothing is drawn until the
 * width is known, so there is no frame of an overflowing figure.
 */
import { AppText, DotBar, DotNumeral } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { EDGE_ORANGE, INSTRUMENT_BLACK, INSTRUMENT_WHITE } from "./surface";

/** Full-size dot pitch: three digits come to ~85pt, a seven-dot-tall 35pt. */
const PITCH = 5;
/**
 * The figure is full white, and the cells behind it barely there. Brighter lit
 * dots and a much fainter grid (owner, 2026-10-31) is what makes the NUMBER read
 * first and the matrix second — the other way round it is a block of dots with a
 * number hidden in it.
 */
const GHOST = alpha(INSTRUMENT_WHITE, 0.05);

export interface MacroTileProps {
  label: string;
  /** The macro's own colour — its dot and its lit bar dots. */
  tone: string;
  /** Eaten so far, in grams. */
  current: number;
  /** Today's target, in grams. */
  target: number;
  style?: StyleProp<ViewStyle>;
}

export function MacroTile({ label, tone, current, target, style }: MacroTileProps) {
  const [inner, setInner] = useState(0);

  const grams = Math.round(current);
  const goal = Math.round(target);
  const progress = target > 0 ? current / target : 0;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${grams} of ${goal} grams`}
      style={[styles.tile, style]}
    >
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
      </View>

      <View
        style={styles.figure}
        onLayout={(e) => setInner(Math.floor(e.nativeEvent.layout.width))}
      >
        {inner > 0 ? (
          <DotNumeral
            value={current}
            pitch={PITCH}
            maxWidth={inner}
            color={INSTRUMENT_WHITE}
            ghostColor={GHOST}
          />
        ) : null}
      </View>

      <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.target}>
        / {goal} g
      </AppText>

      <DotBar progress={progress} tone={tone} style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: EDGE_ORANGE,
    padding: Spacing.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flexShrink: 1 },
  // Reserves the figure's full height up front, and centres a smaller one in it.
  figure: { height: PITCH * 7, justifyContent: "center", marginTop: 10 },
  target: { marginTop: 6 },
  bar: { marginTop: Spacing.md },
});
