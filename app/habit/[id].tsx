/**
 * HABIT DETAIL — hero identity, this week at a glance, the three stat tiles
 * (streak, best, last-30-days), the full history grid, and the Mark done / Undo
 * today action.
 *
 * THE HISTORY GRID IS NOT IN A CARD, deliberately. It used to be, and the cells
 * were sized in fixed points — twenty weeks at 12pt is 328pt of grid, which a
 * card on a 360pt phone gives about 280pt to. The last two months of someone's
 * history were being drawn off the right edge of the screen. Nesting a grid
 * that must span the full content width inside a card that takes 40pt of
 * padding was the whole problem, so the card is gone: the grid measures the
 * page and sizes its own cells to land flush with everything else on it.
 */
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { HabitWeekStrip } from "@/components/habits/HabitWeekStrip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconBadge } from "@/components/ui/IconBadge";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useSystem } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { frequencyLabel } from "@/models/habit";
import { buildHeatWeeks, monthLabels } from "@/services/HabitService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

const HISTORY_WEEKS = 20;

const SOURCE_HINT: Record<string, string> = {
  water: "Tracked automatically — completes when you hit your daily water goal.",
  meals: "Tracked automatically — completes when you log a meal for the day.",
  workout: "Tracked automatically — completes when you finish a workout.",
};

export default function HabitDetailScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getView, toggleToday } = useHabits();
  const { currentDate } = useSystem();

  // The width the page actually gives its content, measured once on layout.
  // The grid can't be sized from a constant — screen gutters, safe areas and
  // font scale all move it — so it's measured rather than assumed.
  const [contentWidth, setContentWidth] = useState(0);
  const onMeasure = (e: LayoutChangeEvent) =>
    setContentWidth(e.nativeEvent.layout.width);

  const view = getView(String(id));
  if (!view) {
    return (
      <Screen>
        <AppText variant="headline" style={{ marginTop: Spacing.huge }}>
          Habit not found
        </AppText>
        <Button label="Back" variant="tonal" onPress={() => router.back()} style={{ marginTop: Spacing.xl }} />
      </Screen>
    );
  }

  const { habit, stats, done } = view;
  const weeks = buildHeatWeeks(habit, done, currentDate, HISTORY_WEEKS);
  const months = monthLabels(weeks);
  const isManual = habit.source === "manual";
  const quota = habit.weeklyGoal != null;

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }} />
      {isManual && (
        <Pressable
          hitSlop={12}
          onPress={() => router.push(`/habit/new?id=${habit.id}` as any)}
          accessibilityRole="button"
          accessibilityLabel="Edit habit"
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="pencil" size={17} color={colors.text} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen header={header}>
      {/* Hero identity. It also doubles as the ruler: it's a full-width block
          with no gutter of its own, so its measured width IS the width the
          history grid below has to fit into. */}
      <View style={styles.hero} onLayout={onMeasure}>
        <IconBadge name={habit.icon as any} tone={habit.color} size={72} />
        <AppText variant="display" align="center" style={{ marginTop: Spacing.lg }}>
          {habit.name}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center" style={{ marginTop: 2 }}>
          {frequencyLabel(habit.days, habit.weeklyGoal)}
        </AppText>
      </View>

      {/* This week — the goal's home. Sits above the stat tiles because it is
          the only figure on this page that is still in play. */}
      <Card padding="lg" style={styles.weekCard}>
        <HabitWeekStrip habit={habit} stats={stats} done={done} today={currentDate} />
      </Card>

      {/* Stat tiles */}
      <View style={styles.tiles}>
        <StatTile
          icon="flame"
          tone="#FF9F45"
          value={`${stats.currentStreak}`}
          label={quota ? "week streak" : "day streak"}
        />
        <StatTile icon="trophy" tone="#E9C16B" value={`${stats.bestStreak}`} label="best" />
        <StatTile icon="stats-chart" tone={habit.color} value={`${stats.last30Pct}%`} label="last 30 days" />
      </View>

      {/* History — no card; the grid sizes itself to the page. */}
      <View style={styles.historyHead}>
        <AppText variant="headline">History</AppText>
        <AppText variant="footnote" color="tertiary">
          {HISTORY_WEEKS} weeks
        </AppText>
      </View>
      {contentWidth > 0 && (
        <HabitHeatmap
          weeks={weeks}
          color={habit.color}
          fitWidth={contentWidth}
          gap={3}
          months={months}
          dayLabels
        />
      )}

      {/* Action */}
      {isManual ? (
        <Button
          label={stats.doneToday ? "Undo today" : "Mark today done"}
          icon={stats.doneToday ? "arrow-undo" : "checkmark"}
          variant={stats.doneToday ? "tonal" : "primary"}
          size="lg"
          onPress={() => toggleToday(habit.id)}
          style={{ marginTop: Spacing.xxl }}
        />
      ) : (
        <Card padding="xl" style={{ marginTop: Spacing.xxl }}>
          <View style={styles.hintRow}>
            <Ionicons name="flash" size={16} color={habit.color} />
            <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
              {SOURCE_HINT[habit.source]}
            </AppText>
          </View>
        </Card>
      )}
    </Screen>
  );
}

function StatTile({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <Card padding="lg" style={styles.tile}>
      <Ionicons name={icon as any} size={18} color={tone} />
      <AppText variant="title" style={{ marginTop: Spacing.xs }}>
        {value}
      </AppText>
      <AppText variant="footnote" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  weekCard: { marginBottom: Spacing.sm },
  tiles: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: "center",
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
