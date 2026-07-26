/**
 * WORKOUT DETAIL — the pre-session overview for a library workout.
 *
 * Hero art, coach persona, personal fit %, block-by-block breakdown
 * (warm-up / workout / cool-down) and one big Start button that launches the
 * EXISTING guided-session player with the catalog's param bundle.
 */

import { AppText, Button, Card, Pill, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import { ArtTile } from "@/fitness/components/ArtTile";
import { CoachBadge } from "@/fitness/components/CoachBadge";
import { getCoach } from "@/fitness/data/coaches";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import {
  flattenWorkout,
  getWorkout,
  workoutSuitability,
  workoutToPlayerParams,
  type FlatWorkoutItem,
} from "@/fitness/services/WorkoutCatalog";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const BLOCK_TITLES: Record<FlatWorkoutItem["block"], string> = {
  warmup: "Warm-up",
  main: "Workout",
  cooldown: "Cool-down",
};

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useColors();
  const { userBio } = useProfile();
  const { toggleFavorite, isFavorite } = useFitnessProfile();

  const workout = useMemo(() => (id ? getWorkout(id) : null), [id]);
  const items = useMemo(() => (workout ? flattenWorkout(workout) : []), [workout]);
  const fit = useMemo(
    () => (workout && userBio ? workoutSuitability(workout, userBio) : null),
    [workout, userBio],
  );

  const handleStart = useCallback(() => {
    if (!workout) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const params = workoutToPlayerParams(workout);
    router.push({ pathname: "/guided-session", params });
  }, [workout]);

  if (!workout) {
    return (
      <Screen
        header={
          <HeaderBar title="Workout" onBack={() => router.back()} colors={colors} />
        }
      >
        <Card padding="xxl">
          <AppText variant="body" color="secondary" align="center">
            This workout could not be found.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const coach = getCoach(workout.coachId);
  const fav = isFavorite(workout.id);
  const difficultyTone =
    workout.difficulty === "beginner"
      ? colors.success
      : workout.difficulty === "intermediate"
        ? colors.warning
        : colors.error;

  // Group flattened items back into their blocks for display.
  const blocks: { key: FlatWorkoutItem["block"]; items: FlatWorkoutItem[] }[] = (
    ["warmup", "main", "cooldown"] as const
  )
    .map((key) => ({ key, items: items.filter((i) => i.block === key) }))
    .filter((b) => b.items.length > 0);

  return (
    <Screen
      header={
        <HeaderBar
          title=""
          onBack={() => router.back()}
          colors={colors}
          right={
            <Pressable
              onPress={() => toggleFavorite(workout.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={fav ? "Remove from favorites" : "Add to favorites"}
            >
              <Ionicons
                name={fav ? "heart" : "heart-outline"}
                size={24}
                color={fav ? colors.error : colors.text}
              />
            </Pressable>
          }
        />
      }
    >
      {/* Hero */}
      <View style={styles.hero}>
        <ArtTile
          icon={workout.art.icon}
          hue={workout.art.hue}
          pattern={workout.art.pattern}
          size={104}
          radius={Radius.xxl}
        />
        <AppText variant="display" align="center" style={styles.name}>
          {workout.name}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center">
          {workout.tagline}
        </AppText>
        <View style={styles.metaRow}>
          <Pill label={`${workout.durationMinutes} min`} tone={colors.primary} icon="time-outline" />
          <Pill
            label={workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)}
            tone={difficultyTone}
          />
          <Pill label={`~${workout.estimatedCalories} kcal`} tone={colors.calories} icon="flame-outline" />
        </View>
      </View>

      <Button label="Start workout" icon="play" onPress={handleStart} style={styles.startBtn} />

      {/* Coach */}
      <Card style={styles.block} padding="lg">
        <View style={styles.coachRow}>
          <CoachBadge coachId={workout.coachId} size={44} />
          <View style={styles.flex}>
            <AppText variant="callout">Led by {coach.name}</AppText>
            <AppText variant="footnote" color="tertiary">
              {coach.specialty}
            </AppText>
          </View>
        </View>
        <AppText variant="subhead" color="secondary" style={styles.coachMotto}>
          “{coach.motto}”
        </AppText>
      </Card>

      {/* Personal fit */}
      {fit && (
        <Card style={styles.block} padding="lg">
          <View style={styles.fitRow}>
            <View style={[styles.fitPct, { backgroundColor: alpha(colors.primary, 0.14) }]}>
              <AppText variant="headline" color="brand" weight="800">
                {fit.percent}%
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="callout">Fit for you</AppText>
              <AppText variant="footnote" color="tertiary">
                Based on your level and equipment
              </AppText>
            </View>
          </View>
          {fit.cautions.map((c) => (
            <View key={c} style={styles.cautionRow}>
              <Ionicons name="warning" size={13} color={colors.warning} />
              <AppText variant="footnote" color="warning" style={styles.flex}>
                {c}
              </AppText>
            </View>
          ))}
        </Card>
      )}

      {/* About */}
      <Card style={styles.block}>
        <AppText variant="headline" style={styles.sectionTitle}>
          About this session
        </AppText>
        <AppText variant="body" color="secondary">
          {workout.description}
        </AppText>
        <View style={styles.aboutMeta}>
          <AboutRow icon="body-outline" label={workout.targetMuscles.slice(0, 5).join(" · ")} colors={colors} />
          <AboutRow
            icon="cube-outline"
            label={workout.equipment.length > 0 ? workout.equipment.join(", ").replace(/_/g, " ") : "No equipment needed"}
            colors={colors}
          />
        </View>
      </Card>

      {/* Blocks */}
      {blocks.map((b) => (
        <Card key={b.key} style={styles.block}>
          <View style={styles.blockHead}>
            <AppText variant="headline">{BLOCK_TITLES[b.key]}</AppText>
            <AppText variant="footnote" color="tertiary">
              {b.items.length} {b.items.length === 1 ? "exercise" : "exercises"}
            </AppText>
          </View>
          {b.items.map((item, i) => (
            <Pressable
              key={`${item.exercise.id}-${i}`}
              onPress={() => router.push(`/exercise/${item.exercise.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`${item.exercise.name} details`}
              style={[
                styles.itemRow,
                i < b.items.length - 1 && {
                  borderBottomColor: colors.divider,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.itemNum, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                <AppText variant="footnote" color="brand" weight="700">
                  {i + 1}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="body" numberOfLines={1}>
                  {item.exercise.name}
                </AppText>
                <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                  {item.exercise.targetMuscles.join(", ")}
                </AppText>
              </View>
              <AppText variant="callout" color="secondary">
                {item.sets}×{item.reps}
              </AppText>
              <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            </Pressable>
          ))}
        </Card>
      ))}

      <Button label="Start workout" icon="play" onPress={handleStart} style={styles.block} />
    </Screen>
  );
}

function HeaderBar({
  title,
  onBack,
  right,
  colors,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  colors: { text: string };
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <AppText variant="headline" style={styles.flex}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

function AboutRow({
  icon,
  label,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: { textTertiary: string };
}) {
  return (
    <View style={styles.aboutRow}>
      <Ionicons name={icon} size={15} color={colors.textTertiary} />
      <AppText variant="footnote" color="secondary" style={styles.flex}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  hero: { alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.md },
  name: { marginTop: Spacing.md },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  startBtn: { marginVertical: Spacing.xl },

  coachRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  coachMotto: { marginTop: Spacing.md, fontStyle: "italic" },

  fitRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  fitPct: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cautionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },

  sectionTitle: { marginBottom: Spacing.sm },
  aboutMeta: { marginTop: Spacing.lg, gap: Spacing.sm },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },

  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  itemNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
