/**
 * HabitWeekStrip — the current Mon–Sun week as seven cells, plus the line that
 * says where you stand in it.
 *
 * This is the surface the weekly GOAL needs. A quota habit ("4× a week") can't
 * be read off a streak number or a 20-week heatmap: the only question its owner
 * has on a Wednesday is "how many left, and how many days to get them", and
 * nothing on the screen answered that before. The strip answers it in one row.
 *
 * It works for weekday habits too — there the cells that aren't scheduled are
 * drawn hollow, so the same component reads as "Mon, Wed, Fri" without needing
 * a second layout.
 */
import { Radius, Spacing, alpha } from "@/constants/theme";
import { DAY_LETTER, type Habit, type HabitStats } from "@/models/habit";
import { isScheduled, weekStartOf } from "@/services/HabitService";
import { parseLocalDate, toLocalDateString } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "../ui/Text";
import { useColors } from "../ui/useColors";

export interface HabitWeekStripProps {
  habit: Habit;
  stats: HabitStats;
  done: Set<string>;
  today: string;
  /** Hide the "n of m this week" line and show only the seven cells. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function HabitWeekStrip({
  habit,
  stats,
  done,
  today,
  compact = false,
  style,
}: HabitWeekStripProps) {
  const { colors } = useColors();
  const quota = habit.weeklyGoal != null;

  const cells = useMemo(() => {
    const monday = parseLocalDate(weekStartOf(today));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const date = toLocalDateString(d);
      return {
        date,
        letter: DAY_LETTER[i],
        done: done.has(date),
        isToday: date === today,
        future: date > today,
        // A quota habit has no "wrong" day, so every cell is live.
        onPlan: quota || isScheduled(habit, date),
      };
    });
  }, [habit, done, today, quota]);

  const left = Math.max(0, stats.weekTarget - stats.weekDone);
  const met = stats.weekTarget > 0 && stats.weekDone >= stats.weekTarget;

  return (
    <View style={style}>
      {!compact && (
        <View style={styles.head}>
          <AppText variant="footnote" color="secondary">
            <AppText variant="footnote" weight="700" color={met ? colors.success : "primary"}>
              {stats.weekDone}
            </AppText>
            {` of ${stats.weekTarget} this week`}
          </AppText>
          <AppText variant="footnote" color={met ? colors.success : "tertiary"}>
            {met
              ? quota
                ? "Goal met"
                : "All done"
              : `${left} to go`}
          </AppText>
        </View>
      )}

      <View style={styles.row}>
        {cells.map((c) => {
          const fill = c.done
            ? habit.color
            : c.onPlan && !c.future
              ? alpha(colors.text, 0.07)
              : "transparent";
          const border = c.done
            ? habit.color
            : c.isToday
              ? alpha(habit.color, 0.75)
              : c.onPlan
                ? alpha(colors.text, 0.13)
                : alpha(colors.text, 0.06);

          return (
            <View
              key={c.date}
              style={[
                styles.cell,
                {
                  backgroundColor: fill,
                  borderColor: border,
                  borderWidth: c.isToday ? 1.5 : 1,
                },
              ]}
            >
              {c.done ? (
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              ) : (
                <AppText
                  variant="caption"
                  weight={c.isToday ? "700" : "600"}
                  color={c.onPlan && !c.future ? "secondary" : "tertiary"}
                >
                  {c.letter}
                </AppText>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.xs + 2,
  },
  cell: {
    flex: 1,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
