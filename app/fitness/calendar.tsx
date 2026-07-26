/**
 * FITNESS CALENDAR — month view of the training rhythm.
 *
 * Completed / planned / missed / rest days painted from the pure
 * CalendarService model, with a tappable day detail card and month paging.
 */

import { AppText, Card, Pill, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem, useWorkout } from "@/contexts/AppContext";
import {
  buildCalendarMonth,
  shiftMonth,
} from "@/fitness/services/CalendarService";
import type { CalendarDay } from "@/fitness/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function FitnessCalendarScreen() {
  const { colors } = useColors();
  const { workoutPlan, workoutLog } = useWorkout();
  const { currentDate } = useSystem();

  const [cursor, setCursor] = useState(() => ({
    year: Number(currentDate.slice(0, 4)),
    month: Number(currentDate.slice(5, 7)),
  }));
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const month = useMemo(
    () =>
      buildCalendarMonth({
        year: cursor.year,
        month: cursor.month,
        today: currentDate,
        plan: workoutPlan,
        workoutLog,
      }),
    [cursor, currentDate, workoutPlan, workoutLog],
  );

  const statusColor = (day: CalendarDay): string => {
    switch (day.status) {
      case "completed":
        return colors.success;
      case "planned":
        return colors.primary;
      case "missed":
        return colors.error;
      default:
        return "transparent";
    }
  };

  const legend = [
    { label: `${month.completedCount} done`, tone: colors.success },
    { label: `${month.plannedCount} planned`, tone: colors.primary },
    { label: `${month.missedCount} missed`, tone: colors.error },
  ];

  return (
    <Screen
      header={
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <AppText variant="display">Calendar</AppText>
        </View>
      }
    >
      <Card style={styles.block}>
        {/* Month pager */}
        <View style={styles.pager}>
          <Pressable
            onPress={() => {
              setCursor((c) => shiftMonth(c.year, c.month, -1));
              setSelected(null);
            }}
            hitSlop={10}
            style={styles.pagerBtn}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <AppText variant="headline">{month.label}</AppText>
          <Pressable
            onPress={() => {
              setCursor((c) => shiftMonth(c.year, c.month, 1));
              setSelected(null);
            }}
            hitSlop={10}
            style={styles.pagerBtn}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, i) => (
            <View key={`${d}-${i}`} style={styles.cell}>
              <AppText variant="caption" color="tertiary">
                {d}
              </AppText>
            </View>
          ))}
        </View>

        {/* Grid */}
        {month.weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (!day.inMonth) {
                return <View key={di} style={styles.cell} />;
              }
              const tone = statusColor(day);
              const isSelected = selected?.date === day.date;
              return (
                <Pressable
                  key={day.date}
                  style={styles.cell}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.date}, ${day.status}`}
                >
                  <View
                    style={[
                      styles.dayDot,
                      day.isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                      isSelected && { backgroundColor: alpha(colors.primary, 0.16) },
                    ]}
                  >
                    <AppText
                      variant="footnote"
                      color={day.status === "future" ? "tertiary" : "primary"}
                      weight={day.isToday ? "800" : undefined}
                    >
                      {day.dayOfMonth}
                    </AppText>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: tone },
                        day.status === "rest" && styles.hidden,
                        day.status === "future" && styles.hidden,
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.tone }]} />
              <AppText variant="caption" color="tertiary">
                {l.label}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      {/* Day detail */}
      {selected && (
        <Card style={styles.block} padding="lg">
          <View style={styles.detailHead}>
            <AppText variant="callout">{selected.date}</AppText>
            <Pill
              label={
                selected.status === "completed"
                  ? "Completed"
                  : selected.status === "planned"
                    ? "Planned"
                    : selected.status === "missed"
                      ? "Missed"
                      : selected.status === "rest"
                        ? "Rest day"
                        : "Upcoming"
              }
              tone={
                selected.status === "completed"
                  ? colors.success
                  : selected.status === "missed"
                    ? colors.error
                    : colors.primary
              }
              size="sm"
            />
          </View>
          {selected.completedLabels.map((label, i) => (
            <View key={`${label}-${i}`} style={styles.detailRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="body" style={styles.flex} numberOfLines={1}>
                {label}
              </AppText>
            </View>
          ))}
          {selected.plannedLabel && selected.completedLabels.length === 0 && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <AppText variant="body" color="secondary" style={styles.flex} numberOfLines={1}>
                {selected.plannedLabel}
              </AppText>
            </View>
          )}
          {selected.completedLabels.length === 0 && !selected.plannedLabel && (
            <AppText variant="footnote" color="tertiary">
              Nothing scheduled — rest is part of the program.
            </AppText>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  hidden: { opacity: 0 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  pagerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  weekRow: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  dayDot: {
    width: 38,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },

  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  detailHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
