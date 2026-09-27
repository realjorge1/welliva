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
 * Memoized for smooth FlatList scrolling.
 */

import { AppText, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ResolvedWorkout } from "../types";
import { ArtPanel } from "./ArtPanel";
import { artAccent } from "./ArtTile";
import { LEVEL_LABEL, LEVEL_RANK, STYLE_LABEL, equipmentLabel } from "./cardCopy";
import { LevelBars, MEDIA_RADIUS, MediaCard } from "./MediaCard";

/** Width of the art edge. Sized for a ~320dp phone, where every dp of text counts. */
const ART_WIDTH = 88;
/** Room the glyph leaves under itself so it never sits on the duration chip. */
const DURATION_CHIP_HEIGHT = 16;

export interface WorkoutCardProps {
  workout: ResolvedWorkout;
  onPress: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export const WorkoutCard = React.memo(function WorkoutCard({
  workout: w,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}: WorkoutCardProps) {
  const { colors, isDark } = useColors();
  const accent = artAccent(w.art.hue, isDark);
  const style = STYLE_LABEL[w.style] ?? w.style;
  const level = LEVEL_LABEL[w.difficulty];
  const gear = equipmentLabel(w.equipment);
  const needsGear = w.equipment.some((e) => e && e !== "none");

  return (
    <MediaCard
      onPress={() => onPress(w.id)}
      accessibilityLabel={`${w.name}. ${style}, ${w.durationMinutes} minutes, ${level}, ${gear}. ${w.tagline}`}
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
          <View style={styles.duration}>
            <AppText variant="caption" color="#FFFFFF" style={styles.durationText}>
              {w.durationMinutes} min
            </AppText>
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
              color={isFavorite ? colors.error : colors.textTertiary}
            />
          </Pressable>
        ) : undefined
      }
    >
      <AppText
        variant="bodyLg"
        weight="700"
        numberOfLines={1}
        // Shrink a long name a touch rather than cut it: "Chest & Arms Builder"
        // is the longest, and on a 320dp phone it is a few dp too wide.
        adjustsFontSizeToFit
        minimumFontScale={0.86}
        style={[styles.title, onToggleFavorite && styles.besideHeart]}
      >
        {w.name}
      </AppText>
      <AppText variant="subhead" color="secondary" numberOfLines={1} style={styles.tagline}>
        {w.tagline}
      </AppText>
      <View style={styles.meta}>
        <LevelBars rank={LEVEL_RANK[w.difficulty]} color={accent} />
        <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.metaText}>
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  durationText: { fontWeight: "700", letterSpacing: 0.2, fontVariant: ["tabular-nums"] },
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
