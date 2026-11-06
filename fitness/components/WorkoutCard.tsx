/**
 * WorkoutCard — one session on Explore.
 *
 * The art runs down the card's left edge with the duration set on it, the way
 * a class thumbnail carries its length. Three lines, kept slim on purpose:
 * which session (name), what it feels like (tagline), and what kind and how
 * hard (style in the art's own hue, then level — plus equipment only when it
 * needs some). One accent per card, taken from its art, instead of the old
 * row of differently-coloured pills competing for the eye.
 *
 * 2026-11-01, the upgrade sweep: the card is the black instrument surface (see
 * MediaCard), the duration on the art is a mono readout like every other
 * reading in the app, and a workout you have FINISHED — every move done —
 * carries a check on its art, so the catalogue knows which ones are yours.
 * Same height as before: the owner asked for these slim.
 *
 * Memoized for smooth FlatList scrolling.
 */

import { AppText, Mono, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ResolvedWorkout } from "../types";
import { ArtPanel } from "./ArtPanel";
import { artAccent } from "./ArtTile";
import { LEVEL_LABEL, LEVEL_RANK, STYLE_LABEL, equipmentLabel } from "./cardCopy";
import { LevelBars, MEDIA_RADIUS, MediaCard, ON_CARD } from "./MediaCard";

/** Width of the art edge. Sized for a ~320dp phone, where every dp of text counts. */
const ART_WIDTH = 88;
/** Room the glyph leaves under itself so it never sits on the duration readout. */
const DURATION_CHIP_HEIGHT = 16;
/** The overlays on the art share one dark glass, so they read as one set. */
const ART_GLASS = "rgba(0,0,0,0.42)";

export interface WorkoutCardProps {
  workout: ResolvedWorkout;
  onPress: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  /** Times this workout has been finished, every move done (see finishedCounts). */
  timesFinished?: number;
}

export const WorkoutCard = React.memo(function WorkoutCard({
  workout: w,
  onPress,
  isFavorite = false,
  onToggleFavorite,
  timesFinished = 0,
}: WorkoutCardProps) {
  const { colors } = useColors();
  // The light end of the art's ramp: the card is black in both themes.
  const accent = artAccent(w.art.hue, true);
  const style = STYLE_LABEL[w.style] ?? w.style;
  const level = LEVEL_LABEL[w.difficulty];
  const gear = equipmentLabel(w.equipment);
  const needsGear = w.equipment.some((e) => e && e !== "none");
  const finished =
    timesFinished > 0
      ? ` Finished ${timesFinished === 1 ? "once" : `${timesFinished} times`}.`
      : "";

  return (
    <MediaCard
      onPress={() => onPress(w.id)}
      accessibilityLabel={`${w.name}. ${style}, ${w.durationMinutes} minutes, ${level}, ${gear}. ${w.tagline}.${finished}`}
      accessibilityHint="Opens the workout"
      media={
        <ArtPanel
          icon={w.art.icon}
          hue={w.art.hue}
          pattern={w.art.pattern}
          width={ART_WIDTH}
          radius={MEDIA_RADIUS}
          glyphInsetBottom={DURATION_CHIP_HEIGHT}
        >
          {timesFinished > 0 ? (
            <View style={styles.done}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          ) : null}
          <View style={styles.duration}>
            <Mono size={10} weight="700" tracking={0.6} color="#FFFFFF">
              {`${w.durationMinutes} MIN`}
            </Mono>
          </View>
        </ArtPanel>
      }
      accessory={
        onToggleFavorite ? (
          <Pressable
            onPress={() => onToggleFavorite(w.id)}
            hitSlop={12}
            style={styles.heart}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? `Remove ${w.name} from favorites` : `Add ${w.name} to favorites`
            }
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? colors.error : ON_CARD.idle}
            />
          </Pressable>
        ) : undefined
      }
    >
      <AppText
        variant="bodyLg"
        weight="700"
        color={ON_CARD.title}
        numberOfLines={1}
        // Shrink a long name a touch rather than cut it: "Chest & Arms Builder"
        // is the longest, and on a 320dp phone it is a few dp too wide.
        adjustsFontSizeToFit
        minimumFontScale={0.86}
        style={[styles.title, onToggleFavorite && styles.besideHeart]}
      >
        {w.name}
      </AppText>
      <AppText variant="subhead" color={ON_CARD.body} numberOfLines={1} style={styles.tagline}>
        {w.tagline}
      </AppText>
      <View style={styles.meta}>
        <LevelBars rank={LEVEL_RANK[w.difficulty]} color={accent} />
        <AppText variant="footnote" color={ON_CARD.meta} numberOfLines={1} style={styles.metaText}>
          <AppText variant="footnote" color={accent} weight="700">
            {style}
          </AppText>
          {` · ${level}`}
          {/* Equipment only when a session needs some: 103 of the 112 need
              none, and "Bodyweight" on nearly every card is a word nobody reads
              that pushes the level off the end of the line. */}
          {needsGear ? ` · ${gear}` : ""}
        </AppText>
      </View>
    </MediaCard>
  );
});

const styles = StyleSheet.create({
  duration: {
    position: "absolute",
    left: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: ART_GLASS,
  },
  /** Finished: a check in the art's top-left corner, clear of the glyph. */
  done: {
    position: "absolute",
    left: 6,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ART_GLASS,
  },
  heart: { padding: 4 },
  // Keeps a long name from running under the heart.
  besideHeart: { paddingRight: 24 },
  // Tighter leading than the variants' defaults: three lines, one slim card.
  title: { lineHeight: 22 },
  tagline: { lineHeight: 18, marginTop: 1 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  metaText: { flexShrink: 1 },
});
