/**
 * EXERCISE DETAIL — rich single-exercise view. Rebuilt on the Welliva design
 * system; routing (start session / back) preserved.
 *
 * Resolves the exercise from the local EXERCISE_DATABASE first, then falls back
 * to the current workout plan — so AI-generated exercises (which carry their own
 * how-to) get a full guide even though they aren't in the local DB.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { AmbientCanvas, AppText, Button, Card, IconBadge, MuscleMap, Pill, useColors } from "@/components/ui";
import { useWorkout } from "@/contexts/AppContext";
import { EXERCISE_DATABASE, ExerciseDBEntry } from "@/constants/ExerciseDatabase";
import { Palette, Spacing, type ThemeColors } from "@/constants/theme";
import { ExerciseFigure } from "@/fitness/components/ExerciseFigure";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import type { PlannedExercise } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function difficultyColor(d: string): string {
  switch (d) {
    case "beginner":
      return Palette.positive;
    case "intermediate":
      return Palette.warning;
    case "advanced":
      return Palette.danger;
    default:
      return "#9E9E9E";
  }
}

function getPatternIcon(pattern: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    push: "arrow-up",
    pull: "arrow-down",
    squat: "body",
    hinge: "barbell",
    core: "fitness",
    cardio: "heart",
    flexibility: "leaf",
  };
  return map[pattern] || "barbell";
}

/**
 * Normalized view-model so the screen renders identically whether the exercise
 * came from the local DB or an AI-generated plan. DB-only sections (rating,
 * frequency, modifications, equipment) are optional and simply hidden for AI
 * exercises.
 */
interface ExView {
  name: string;
  difficulty: string;
  movementPattern: string;
  exerciseType: "timed" | "reps";
  sets: string;
  reps: string;
  restSeconds: number;
  durationMinutes: number;
  setupPosition?: string;
  instructions: string[];
  targetMuscles: string[];
  coachCues: string[];
  description?: string;
  effectiveness?: { rating: number; explanation: string };
  frequency?: string;
  modifications?: { easier?: string; harder?: string };
  equipment?: string[];
  isAi: boolean;
}

function fromDB(e: ExerciseDBEntry): ExView {
  return {
    name: e.name,
    difficulty: e.difficulty,
    movementPattern: e.movementPattern,
    exerciseType: e.exerciseType,
    sets: `${e.defaultSets}`,
    reps: e.defaultReps,
    restSeconds: e.restSeconds,
    durationMinutes: e.durationMinutes,
    setupPosition: e.setupPosition,
    instructions: e.instructions,
    targetMuscles: e.targetMuscles,
    coachCues: e.coachCues,
    description: e.description,
    effectiveness: e.effectiveness,
    frequency: e.frequency,
    modifications: e.modifications,
    equipment: e.equipment,
    isAi: false,
  };
}

function fromPlanned(pe: PlannedExercise): ExView {
  return {
    name: pe.name,
    difficulty: pe.difficulty,
    movementPattern: pe.movementPattern,
    exerciseType: /sec|min/i.test(pe.reps) ? "timed" : "reps",
    sets: `${pe.sets}`,
    reps: pe.reps,
    restSeconds: pe.restSeconds,
    durationMinutes: pe.durationMinutes,
    setupPosition: pe.setupPosition,
    instructions: pe.steps ?? [],
    targetMuscles: pe.targetMuscles ?? [],
    coachCues: pe.coachCues ?? [],
    description: pe.description,
    isAi: true,
  };
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useColors();
  const { workoutPlan } = useWorkout();

  const view: ExView | null = useMemo(() => {
    const dbEntry = EXERCISE_DATABASE.find((e) => e.id === id);
    if (dbEntry) return fromDB(dbEntry);
    // AI exercise → resolve it from the current plan (carries its own how-to).
    for (const s of workoutPlan?.sessions ?? []) {
      const pe = s.exercises.find((e) => e.exerciseId === id);
      if (pe) return fromPlanned(pe);
    }
    return null;
  }, [id, workoutPlan]);

  if (!view) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.centered]}>
          <IconBadge name="alert-circle" tone={colors.warning} size={64} />
          <AppText variant="body" color="secondary" style={styles.notFoundText}>
            Exercise not found
          </AppText>
          <Button label="Go back" onPress={() => router.back()} fullWidth={false} />
        </SafeAreaView>
      </View>
    );
  }

  const diff = difficultyColor(view.difficulty);
  const icon = getPatternIcon(view.movementPattern);
  const isTimed = view.exerciseType === "timed";

  const handleStartExercise = () => {
    router.push({
      pathname: "/guided-session",
      params: { exerciseIds: id, sessionLabel: view.name },
    });
  };

  const stats = [
    { icon: "layers", label: "Sets", value: view.sets },
    { icon: isTimed ? "timer" : "repeat", label: isTimed ? "Duration" : "Reps", value: view.reps },
    { icon: "hourglass", label: "Rest", value: `${view.restSeconds}s` },
    { icon: "time", label: "Est.", value: `${view.durationMinutes}m` },
  ];

  const showModsCard = Boolean(view.frequency || view.modifications);

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.topBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <View style={styles.hero}>
            <IconBadge name={icon} tone={colors.primary} size={88} />
            <AppText variant="title" align="center" style={styles.heroTitle}>
              {view.name}
            </AppText>
            <View style={styles.heroPills}>
              <Pill
                label={view.difficulty.charAt(0).toUpperCase() + view.difficulty.slice(1)}
                tone={diff}
              />
              {view.isAi && <Pill label="AI coach" tone={colors.primary} icon="sparkles" />}
            </View>
          </View>

          {/* Animated movement demonstration (Skia, native — no external
              media). A flat pictogram athlete, front + side of the same
              movement on one rep clock. Resolves from the movement pattern;
              the muscles it trains are the MuscleMap section below. */}
          <View style={styles.demo}>
            {/* The pattern is passed ONLY for AI exercises. It overrides id
                resolution, and a catalogued move resolves to its own authored
                movement — forcing the pattern here would put every cardio
                exercise back on one shared loop. */}
            <ExerciseFigure
              exerciseId={id}
              motion={view.isAi ? (view.movementPattern as FigureMotion) : undefined}
              size={172}
            />
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <Card key={s.label} style={styles.statCard} padding="md">
                <Ionicons name={s.icon as any} size={16} color={colors.primary} />
                <AppText variant="callout" style={styles.statValue}>
                  {s.value}
                </AppText>
                <AppText variant="caption" color="tertiary" uppercase>
                  {s.label}
                </AppText>
              </Card>
            ))}
          </View>

          {view.setupPosition ? (
            <Section title="Setup position" icon="body" colors={colors}>
              <AppText variant="body" color="secondary">
                {view.setupPosition}
              </AppText>
            </Section>
          ) : null}

          {view.instructions.length > 0 ? (
            <Section title="How to perform" icon="list" colors={colors}>
              {view.instructions.map((instr, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primarySoft }]}>
                    <AppText variant="footnote" color="brand" style={styles.bold}>
                      {i + 1}
                    </AppText>
                  </View>
                  <AppText variant="body" style={styles.flex}>
                    {instr}
                  </AppText>
                </View>
              ))}
            </Section>
          ) : null}

          {view.targetMuscles.length > 0 ? (
            <Section title="Target muscles" icon="body" colors={colors}>
              <MuscleMap muscles={view.targetMuscles} height={140} labels />
              <View style={styles.muscleGrid}>
                {view.targetMuscles.map((m) => (
                  <Pill key={m} label={m} tone={colors.primary} size="sm" icon="ellipse" />
                ))}
              </View>
            </Section>
          ) : null}

          {view.effectiveness ? (
            <Section title="Effectiveness" icon="star" colors={colors}>
              <View style={styles.stars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < view.effectiveness!.rating ? "star" : "star-outline"}
                    size={18}
                    color={colors.gold}
                  />
                ))}
              </View>
              <AppText variant="subhead" color="secondary" style={styles.effExplain}>
                {view.effectiveness.explanation}
              </AppText>
            </Section>
          ) : null}

          {/* Frequency & modifications (local-DB exercises only) */}
          {showModsCard ? (
            <View style={styles.twoCol}>
              <Card style={styles.miniCard} padding="lg">
                <IconBadge name="calendar" tone={colors.primary} size={34} />
                <AppText variant="caption" color="tertiary" uppercase style={styles.miniLabel}>
                  Frequency
                </AppText>
                <AppText variant="callout">{view.frequency ?? "—"}</AppText>
              </Card>
              <Card style={styles.miniCard} padding="lg">
                <IconBadge name="swap-horizontal" tone={colors.primary} size={34} />
                <AppText variant="caption" color="tertiary" uppercase style={styles.miniLabel}>
                  Modifications
                </AppText>
                {view.modifications?.easier && (
                  <View style={styles.modRow}>
                    <Ionicons name="arrow-down" size={12} color={colors.success} />
                    <AppText variant="footnote" color="success" numberOfLines={1} style={styles.flex}>
                      {view.modifications.easier}
                    </AppText>
                  </View>
                )}
                {view.modifications?.harder && (
                  <View style={styles.modRow}>
                    <Ionicons name="arrow-up" size={12} color={colors.calories} />
                    <AppText variant="footnote" color="calories" numberOfLines={1} style={styles.flex}>
                      {view.modifications.harder}
                    </AppText>
                  </View>
                )}
              </Card>
            </View>
          ) : null}

          {view.equipment ? (
            <Section title="Equipment" icon="barbell" colors={colors}>
              <AppText variant="body" color="secondary">
                {view.equipment.length > 0
                  ? view.equipment.join(", ")
                  : "No equipment needed — bodyweight only"}
              </AppText>
            </Section>
          ) : null}

          {view.coachCues.length > 0 ? (
            <Section title="Coach cues" icon="megaphone" colors={colors}>
              {view.coachCues.map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
                  <AppText variant="body" style={styles.flex}>
                    {cue}
                  </AppText>
                </View>
              ))}
            </Section>
          ) : null}

          {view.description ? (
            <AppText variant="subhead" color="tertiary" style={styles.description}>
              {view.description}
            </AppText>
          ) : null}

          <View style={{ height: 96 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.cta, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Button label="Start exercise" icon="play" onPress={handleStartExercise} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
  colors,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={17} color={colors.primary} />
        <AppText variant="headline">{title}</AppText>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "800" },
  centered: { justifyContent: "center", alignItems: "center", gap: Spacing.lg, padding: Spacing.huge },
  notFoundText: {},

  topBar: { flexDirection: "row", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing.lg },

  hero: { alignItems: "center", paddingBottom: Spacing.xl, gap: Spacing.md },
  heroTitle: { marginTop: Spacing.xs },
  heroPills: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },

  demo: { marginBottom: Spacing.lg, alignItems: "center" },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { marginTop: 2 },

  section: { marginBottom: Spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },

  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.md },
  stepBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },

  muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },

  stars: { flexDirection: "row", gap: 4 },
  effExplain: { marginTop: Spacing.sm },

  twoCol: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  miniCard: { flex: 1, gap: 4 },
  miniLabel: { marginTop: Spacing.sm },
  modRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },

  cueRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },

  description: { fontStyle: "italic", marginTop: Spacing.sm, marginBottom: Spacing.lg },

  cta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
  },
});

/**
 * Route-level boundary — a throw while rendering an exercise (a malformed plan
 * entry, a missing catalog field) shows a recoverable error screen naming the
 * failure instead of taking the app down.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="exercise-detail" />;
}
