/**
 * ExerciseGuideSheet — the on-demand "How to" reference for the exercise being
 * performed. Everything instructional lives HERE (demo GIF, setup position,
 * steps, muscle map, form cues) so the live set screen can stay a single-focus
 * counter. Opened from the player's "How to" pill; sections rise in one at a
 * time with the standard stagger.
 */
import { enterRise } from "@/components/motion";
import { AppText, MuscleMap, Pill, useColors } from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Palette, Radius, Spacing, alpha } from "@/constants/theme";
import type { SessionExerciseInfo } from "@/models/session";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close guide" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.head}>
            <View style={styles.flex}>
              <AppText variant="headline" numberOfLines={2}>
                {exercise.name}
              </AppText>
            </View>
            <Pill
              label={exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
              tone={difficultyColor(exercise.difficulty)}
              size="sm"
            />
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Animated.View entering={enterRise(section++)} style={styles.demo}>
              <ExerciseFigure
                exerciseId={exercise.exerciseId}
                category={exercise.category}
                muscles={muscles}
                size={150}
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
                <SectionLabel icon="list" text="How to perform" tint={colors.primary} />
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
        </View>
      </View>
    </Modal>
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
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.screen,
  },
  handleRow: { alignItems: "center", paddingTop: Spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  body: { flexGrow: 0 },
  demo: { marginBottom: Spacing.sm, alignItems: "center" },
  section: { marginTop: Spacing.lg },
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
