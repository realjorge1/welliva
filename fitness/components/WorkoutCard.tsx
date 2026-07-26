/**
 * WorkoutCard — the library's list card: art tile, name, tagline and the
 * metadata that answers "can I do this right now?" (duration, level, energy,
 * equipment). Memoized for smooth FlatList scrolling.
 */

import { AppText, Card, Pill, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ResolvedWorkout } from "../types";
import { ArtTile } from "./ArtTile";

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

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
  const { colors } = useColors();
  const difficultyTone =
    w.difficulty === "beginner"
      ? colors.success
      : w.difficulty === "intermediate"
        ? colors.warning
        : colors.error;

  return (
    <Card onPress={() => onPress(w.id)} padding="md" style={styles.card}>
      <View style={styles.row}>
        <ArtTile icon={w.art.icon} hue={w.art.hue} pattern={w.art.pattern} size={64} />
        <View style={styles.body}>
          <AppText variant="callout" numberOfLines={1}>
            {w.name}
          </AppText>
          <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.tagline}>
            {w.tagline}
          </AppText>
          <View style={styles.meta}>
            <Pill label={`${w.durationMinutes} min`} tone={colors.primary} size="sm" />
            <Pill label={DIFFICULTY_LABEL[w.difficulty]} tone={difficultyTone} size="sm" />
            {w.equipment.length === 0 && (
              <AppText variant="caption" color="tertiary">
                No equipment
              </AppText>
            )}
          </View>
        </View>
        {onToggleFavorite && (
          <Pressable
            onPress={() => onToggleFavorite(w.id)}
            hitSlop={10}
            style={styles.heart}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? colors.error : colors.textTertiary}
            />
          </Pressable>
        )}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  body: { flex: 1 },
  tagline: { marginTop: 2 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 6,
    flexWrap: "wrap",
  },
  heart: { alignSelf: "flex-start", paddingTop: 2 },
});
