/**
 * WeekPlanRail — the week, day by day: what each day trains, why, and who
 * planned it.
 *
 * Two ways the week gets made, like meals:
 *   • "Gozlin plans it" — every training day built by the engine from the
 *     user's data.
 *   • "Let me choose" — the user puts library workouts on their days (from
 *     Explore). A day left open is still planned and says so, so a chosen week
 *     is never half empty; a picked day shows its workout and can be cleared.
 *
 * This rail replaced the old "Regenerate" action on purpose. The plan is a
 * function of the user's data, so a reroll would rebuild the same week; what
 * the user can change is the data (Training preferences) or the days
 * themselves, by choosing. Card-less, on the canvas: today is the only filled
 * surface.
 */
import { AppText, Pill, SectionHeader, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { WorkoutPlanMode } from "@/fitness/types";
import type { GeneratedWorkoutPlan } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MODES: { mode: WorkoutPlanMode; label: string }[] = [
  { mode: "planned", label: "Gozlin plans it" },
  { mode: "chosen", label: "Let me choose" },
];

export function WeekPlanRail({
  plan,
  todayIndex,
  trainingDays,
  mode,
  onMode,
  onPick,
  onClearPick,
  onEditDays,
}: {
  plan: GeneratedWorkoutPlan;
  todayIndex: number;
  trainingDays: number[];
  mode: WorkoutPlanMode;
  onMode: (mode: WorkoutPlanMode) => void;
  /** Open Explore to choose a workout for this weekday. */
  onPick: (day: number) => void;
  onClearPick: (day: number) => void;
  /** Open the training preferences (days, length, styles). */
  onEditDays: () => void;
}) {
  const { colors } = useColors();
  const picks = plan.sessions.filter((s) => s.source === "chosen").length;

  return (
    <View>
      <SectionHeader
        title="Week plan"
        subtitle={plan.splitType}
        actionLabel="Days"
        onAction={onEditDays}
        weight="700"
      />

      <View
        style={[styles.segment, { backgroundColor: alpha(colors.surfaceSunken, 0.8), borderColor: colors.border }]}
        accessibilityRole="radiogroup"
      >
        {MODES.map((m) => {
          const on = m.mode === mode;
          return (
            <Pressable
              key={m.mode}
              onPress={() => !on && onMode(m.mode)}
              style={[
                styles.segmentCell,
                on && { backgroundColor: colors.surface, borderColor: alpha(colors.primary, 0.5) },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on, checked: on }}
            >
              <AppText variant="footnote" weight="600" color={on ? "brand" : "tertiary"}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {mode === "chosen" && (
        <AppText variant="footnote" color="tertiary" style={styles.caption}>
          {picks > 0
            ? "Your picks run with reps set for your level. Gozlin plans the days you leave open."
            : "Pick a workout for any training day. Gozlin plans the days you leave open."}
        </AppText>
      )}

      {WEEK.map((day, i) => {
        const session = plan.sessions.find((s) => s.dayOfWeek === i);
        const isToday = i === todayIndex;
        const training = trainingDays.includes(i);
        const chosen = session?.source === "chosen";
        return (
          <View
            key={day}
            style={[
              styles.row,
              i < WEEK.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.divider,
              },
              isToday && {
                backgroundColor: colors.primarySoft,
                borderRadius: Radius.lg,
                borderBottomWidth: 0,
              },
            ]}
          >
            <AppText variant="caption" uppercase color={isToday ? "brand" : "tertiary"} style={styles.day}>
              {day}
            </AppText>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: session ? colors.primary : "transparent",
                  borderColor: session ? colors.primary : colors.borderStrong,
                },
              ]}
            />
            <View style={styles.flex}>
              <AppText variant="body" color={session ? "primary" : "tertiary"} numberOfLines={1}>
                {session ? session.dayLabel : "Rest"}
              </AppText>
              {session?.reason ? (
                <AppText variant="footnote" color="tertiary" numberOfLines={2}>
                  {session.reason}
                </AppText>
              ) : null}
            </View>
            {chosen ? (
              <Pressable
                onPress={() => onClearPick(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Clear your pick for ${FULL[i]} — Gozlin plans it instead`}
              >
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </Pressable>
            ) : mode === "chosen" && training ? (
              <Pressable
                onPress={() => onPick(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Choose a workout for ${FULL[i]}`}
              >
                <AppText variant="callout" color="brand" weight="600">
                  Pick
                </AppText>
              </Pressable>
            ) : isToday ? (
              <Pill label="Today" tone={colors.primary} size="sm" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  segmentCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  caption: { marginBottom: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  day: { width: 34, letterSpacing: 0.6, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
});
