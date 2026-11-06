/**
 * SessionPlan — what a session is going to ask of you, before the clock runs.
 *
 * Grouped the way a coach writes it: WARM-UP, MAIN, COOL-DOWN, each with how
 * many moves and roughly how long. A nine-move session listed flat reads as
 * nine things to get through; the same session in three parts reads as a
 * warm-up, the work, and a stretch — which is what it is.
 *
 * Everything is already filled in by the plan; any row opens to adjust it.
 * Same instrument surface as the player and Home: black cards, thin white
 * edges, mono readings.
 */
import { AppText, Mono, useColors } from "@/components/ui";
import { EDGE_WHITE, HOME_ORANGE, INSTRUMENT_BLACK } from "@/components/home/surface";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { resolveWorkSeconds, type SessionExerciseInfo } from "@/models/session";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PrimaryPill } from "./SessionControls";
import { BLOCK_LABEL, blockRuns, hasBlocks, sessionSeconds } from "./sessionBlocks";

export interface SessionPlanProps {
  label: string;
  exercises: SessionExerciseInfo[];
  lapWord: string;
  bottomInset: number;
  onStart: () => void;
  onBack: () => void;
  onAdjust: (index: number) => void;
}

/** "3 × 10–15" for reps, "3 × 45s" for a hold — the live prescription. */
export function prescriptionText(ex: SessionExerciseInfo): string {
  return ex.exerciseType === "timed"
    ? `${ex.sets} × ${resolveWorkSeconds(ex)}s`
    : `${ex.sets} × ${ex.reps}`;
}

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

export function SessionPlan({
  label,
  exercises,
  lapWord,
  bottomInset,
  onStart,
  onBack,
  onAdjust,
}: SessionPlanProps) {
  const { colors } = useColors();
  const runs = useMemo(() => blockRuns(exercises), [exercises]);
  const blocked = hasBlocks(exercises);
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const lap = lapWord.toUpperCase();
  const summary = [
    `~${minutes(sessionSeconds(exercises))} MIN`,
    `${exercises.length} ${exercises.length === 1 ? "MOVE" : "MOVES"}`,
    `${totalSets} ${lap}${totalSets === 1 ? "" : "S"}`,
  ].join(" · ");

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.back,
            { backgroundColor: colors.surfaceElevated },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Mono size={11} tracking={0.6} color={colors.textTertiary}>
          YOUR SESSION
        </Mono>
        <AppText variant="display" style={styles.title}>
          {label}
        </AppText>
        <Mono size={11} tracking={0.6} color={colors.textSecondary}>
          {summary}
        </Mono>

        {runs.map((run) => (
          <View key={`${run.block}-${run.start}`} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={styles.square} />
              <Mono size={11} tracking={0.6} color={colors.textSecondary} numberOfLines={1}>
                {[
                  blocked ? BLOCK_LABEL[run.block].toUpperCase() : null,
                  `${run.moves} ${run.moves === 1 ? "MOVE" : "MOVES"}`,
                  `~${minutes(run.seconds)} MIN`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Mono>
            </View>
            <View style={styles.card}>
              {exercises.slice(run.start, run.start + run.moves).map((ex, k) => {
                const i = run.start + k;
                return (
                  <Pressable
                    key={`${ex.exerciseId}-${i}`}
                    onPress={() => onAdjust(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Adjust ${ex.name}, ${prescriptionText(ex)}`}
                    style={({ pressed }) => [
                      styles.row,
                      k > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
                      pressed && { backgroundColor: alpha(colors.text, 0.05) },
                    ]}
                  >
                    <Mono size={11} color={colors.textTertiary} style={styles.index}>
                      {String(i + 1).padStart(2, "0")}
                    </Mono>
                    <View style={styles.flex}>
                      <AppText variant="body" numberOfLines={1}>
                        {ex.name}
                      </AppText>
                      <Mono size={10} tracking={0.4} color={colors.textTertiary} numberOfLines={1}>
                        {`${resolveWorkSeconds(ex)}S WORK · ${ex.restSeconds}S REST`}
                      </Mono>
                    </View>
                    <AppText variant="callout" color="secondary" style={styles.dose}>
                      {prescriptionText(ex)}
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.hint}>
          <Ionicons name="options-outline" size={13} color={colors.textTertiary} />
          <Mono size={10} tracking={0.6} color={colors.textTertiary}>
            TAP A MOVE TO ADJUST IT
          </Mono>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, Spacing.lg) }]}>
        <PrimaryPill label="Begin" icon="play" tone="brand" onPress={onStart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  topBar: { height: 48, justifyContent: "center", paddingHorizontal: Spacing.screen },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.96 }] },
  scroll: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  title: { marginTop: 2, marginBottom: 2 },
  group: { marginTop: Spacing.xl, gap: Spacing.sm },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  square: { width: 8, height: 8, borderRadius: 2, backgroundColor: HOME_ORANGE },
  card: {
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  index: { width: 20 },
  dose: { fontVariant: ["tabular-nums"] },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.lg,
  },
  footer: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.md },
});
