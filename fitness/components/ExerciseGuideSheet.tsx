/**
 * ExerciseGuideSheet — the on-demand "How to" reference for the exercise being
 * performed. Everything instructional lives HERE (the animated demonstration,
 * setup position, steps, muscle map, form cues) so the live set screen can stay
 * a single-focus counter.
 *
 * It rides the shared `Sheet`, which UNMOUNTS while closed. That matters more
 * than it sounds: the previous version kept a bare `Modal` in the tree for the
 * whole workout, so two animated Skia demonstration panels stayed mounted and
 * running behind every set of every session. Closing the sheet now genuinely
 * stops the work, and `playing` freezes the rep clock the instant it starts to
 * dismiss.
 */
import { enterRise } from "@/components/motion";
import { AppText, MuscleMap, Pill, Sheet, useColors } from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Palette, Spacing, alpha } from "@/constants/theme";
import type { SessionExerciseInfo } from "@/models/session";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { ExerciseFigure } from "./ExerciseFigure";

function difficultyColor(d: string): string {
  switch (d) {
    case "beginner":
      return Palette.positive;
    case "intermediate":
      return Palette.warning;
    case "advanced":
      return Palette.danger;
    default:
      return Palette.brand;
  }
}

export interface ExerciseGuideSheetProps {
  visible: boolean;
  onClose: () => void;
  exercise: SessionExerciseInfo | undefined;
}

export function ExerciseGuideSheet({ visible, onClose, exercise }: ExerciseGuideSheetProps) {
  const { colors } = useColors();

  // AI-generated exercises aren't in the local DB → no muscle data, and the
  // map section simply doesn't render for them.
  const muscles = useMemo(
    () => EXERCISE_DATABASE.find((e) => e.id === exercise?.exerciseId)?.targetMuscles ?? [],
    [exercise?.exerciseId],
  );

  if (!exercise) return null;

  let section = 0;

  const header = (
    <View style={styles.head}>
      <View style={styles.flex}>
        <AppText variant="caption" color="tertiary" uppercase>
          How to perform
        </AppText>
        <AppText variant="headline" numberOfLines={2}>
          {exercise.name}
        </AppText>
      </View>
      <Pill
        label={exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
        tone={difficultyColor(exercise.difficulty)}
        size="sm"
      />
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
      >
        <Ionicons name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} header={header} maxHeightRatio={0.86}>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enterRise(section++)}>
          <ExerciseFigure
            exerciseId={exercise.exerciseId}
            category={exercise.category}
            size={176}
            playing={visible}
          />
        </Animated.View>

        {!!exercise.setupPosition && (
          <Animated.View entering={enterRise(section++)} style={styles.section}>
            <SectionLabel icon="body" text="Setup" tint={colors.primary} />
            <AppText variant="body" color="secondary">
              {exercise.setupPosition}
            </AppText>
          </Animated.View>
        )}

        {exercise.instructions.length > 0 && (
          <Animated.View entering={enterRise(section++)} style={styles.section}>
            <SectionLabel icon="list" text="Step by step" tint={colors.primary} />
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: alpha(colors.primary, 0.14) }]}>
                  <AppText variant="caption" color="brand">
                    {i + 1}
                  </AppText>
                </View>
                <AppText variant="body" color="secondary" style={styles.flex}>
                  {step}
                </AppText>
              </View>
            ))}
          </Animated.View>
        )}

        {muscles.length > 0 && (
          <Animated.View entering={enterRise(section++)} style={styles.section}>
            <SectionLabel icon="body-outline" text="Muscles worked" tint={colors.primary} />
            <MuscleMap muscles={muscles} height={132} labels />
          </Animated.View>
        )}

        {exercise.coachCues.length > 0 && (
          <Animated.View entering={enterRise(section++)} style={styles.section}>
            <SectionLabel icon="megaphone" text="Form focus" tint={colors.primary} />
            {exercise.coachCues.map((cue, i) => (
              <View key={i} style={styles.cueRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <AppText variant="body" color="secondary" style={styles.flex}>
                  {cue}
                </AppText>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={styles.footerPad} />
      </ScrollView>
    </Sheet>
  );
}

function SectionLabel({
  icon,
  text,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tint: string;
}) {
  return (
    <View style={styles.sectionLabel}>
      <Ionicons name={icon} size={14} color={tint} />
      <AppText variant="caption" color="brand" uppercase>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flexGrow: 0, paddingHorizontal: Spacing.sm },
  section: { marginTop: Spacing.xl },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  cueRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  footerPad: { height: 40 },
});
