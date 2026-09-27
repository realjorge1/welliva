/**
 * ExerciseCard — one movement in Explore's exercise browser.
 *
 * The left edge shows the exercise itself: the demo figure frozen at the frame
 * that identifies it (the bottom of the squat, the top of the push-up — see
 * stillFrame), scaled to fill the edge, in its movement family's hue. It replaces a generic arrow-on-a-gradient tile
 * that looked the same for every push exercise, and it is the same pictogram
 * the exercise's own page animates, so the card previews what opens.
 *
 * A still rather than the animated figure on purpose: a list mounts dozens of
 * rows while scrolling, and a Skia canvas per row is not something the 1 GB
 * test phone can carry. The still is one SVG, drawn once.
 */

import { AppText, useColors } from "@/components/ui";
import { alpha } from "@/constants/theme";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import type { Difficulty } from "@/models/exercise";
import type { MovementPattern } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { artAccent } from "./ArtTile";
import { LEVEL_LABEL, LEVEL_RANK, PATTERN_HUE, PATTERN_LABEL, equipmentLabel } from "./cardCopy";
import { FigureStill, primaryView, stillFrame } from "./ExerciseFigure";
import { LevelBars, MEDIA_RADIUS, MediaCard } from "./MediaCard";

/** Width of the figure edge, and the figure's height inside it. */
const FIGURE_EDGE = 76;
const FIGURE_SIZE = 70;

/** One row of the exercise browser, as the screen projects it. */
export interface ExerciseCardData {
  id: string;
  name: string;
  pattern: MovementPattern;
  muscles: string[];
  difficulty: Difficulty;
  equipment: string[];
  /** The authored demo movement (see resolveFigureMotion). */
  motion: FigureMotion;
  /** Personal suitability, 0–100 — null when there's no profile to judge by. */
  match: number | null;
  /** Why this movement may not suit the user, if it may not. */
  caution: string | null;
}

export const ExerciseCard = React.memo(function ExerciseCard({
  item,
  onPress,
}: {
  item: ExerciseCardData;
  onPress: (id: string) => void;
}) {
  const { colors, isDark } = useColors();
  const accent = artAccent(PATTERN_HUE[item.pattern] ?? "brand", isDark);
  const level = LEVEL_LABEL[item.difficulty];
  const gear = equipmentLabel(item.equipment);
  const needsGear = item.equipment.some((e) => e && e !== "none");
  const muscles = item.muscles.join(", ");
  // A caution outranks a match: never advertise "94% match" beside a warning.
  const showMatch = item.match != null && !item.caution;

  return (
    <MediaCard
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${item.name}. ${level}, ${gear}. Targets ${muscles}.${
        item.caution
          ? ` Caution: ${item.caution}.`
          : showMatch
            ? ` ${item.match}% match for you.`
            : ""
      }`}
      accessibilityHint="Opens the exercise"
      media={
        <View
          style={[
            styles.figureEdge,
            {
              backgroundColor: alpha(accent, isDark ? 0.14 : 0.1),
              borderTopLeftRadius: MEDIA_RADIUS,
              borderBottomLeftRadius: MEDIA_RADIUS,
            },
          ]}
        >
          <FigureStill
            motion={item.motion}
            view={primaryView(item.motion)}
            size={FIGURE_SIZE}
            fitWidth={FIGURE_EDGE}
            color={accent}
            at={stillFrame(item.motion)}
          />
        </View>
      }
    >
      <AppText variant="body" weight="700" numberOfLines={2} style={styles.title}>
        {item.name}
      </AppText>
      <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.muscles}>
        {muscles}
      </AppText>
      <View style={styles.meta}>
        <LevelBars rank={LEVEL_RANK[item.difficulty]} color={accent} />
        <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.flex}>
          <AppText variant="footnote" color={accent} weight="700">
            {PATTERN_LABEL[item.pattern] ?? item.pattern}
          </AppText>
          {` · ${level}`}
          {/* Equipment only when the move needs some — see WorkoutCard. */}
          {needsGear ? ` · ${gear}` : ""}
        </AppText>
        {showMatch && (
          <AppText variant="footnote" color="brand" weight="700">
            {item.match}% match
          </AppText>
        )}
      </View>
      {item.caution && (
        <View style={styles.caution}>
          <Ionicons name="warning" size={12} color={colors.warning} />
          <AppText variant="caption" color="warning" numberOfLines={1} style={styles.shrink}>
            {item.caution}
          </AppText>
        </View>
      )}
    </MediaCard>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  figureEdge: {
    width: FIGURE_EDGE,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  // Tighter leading than the variants' defaults, as on WorkoutCard.
  title: { lineHeight: 20 },
  muscles: { marginTop: 1 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  caution: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
});
