/**
 * HABIT DETAIL — hero identity, the three stat tiles (current streak, best
 * streak, last-30-days), full history heatmap with month + weekday labels,
 * and the Mark done / Undo today action. Matches the tracker's detail view
 * from the reference design, in Welliva's twilight skin.
 */
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
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
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

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

  const header = (
    <View style={styles.headerRow}>
      <Pressable hitSlop={12} onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }} />
      {isManual && (
        <Pressable
          hitSlop={12}
          onPress={() => router.push(`/habit/new?id=${habit.id}` as any)}
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="pencil" size={17} color={colors.text} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen header={header}>
      {/* Hero identity */}
      <View style={styles.hero}>
        <IconBadge name={habit.icon as any} tone={habit.color} size={72} />
        <AppText variant="display" align="center" style={{ marginTop: Spacing.lg }}>
          {habit.name}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center" style={{ marginTop: 2 }}>
          {frequencyLabel(habit.days)}
        </AppText>
      </View>

      {/* Stat tiles */}
      <View style={styles.tiles}>
        <StatTile icon="flame" tone="#FF9F45" value={`${stats.currentStreak}`} label="day streak" />
        <StatTile icon="trophy" tone="#E9C16B" value={`${stats.bestStreak}`} label="best streak" />
        <StatTile icon="stats-chart" tone={habit.color} value={`${stats.last30Pct}%`} label="last 30 days" />
      </View>

      {/* History */}
      <Card padding="xl" style={{ marginTop: Spacing.md }}>
        <AppText variant="headline">History</AppText>
        <View style={{ marginTop: Spacing.lg, alignItems: "flex-start" }}>
          <HabitHeatmap
            weeks={weeks}
            color={habit.color}
            cellSize={12}
            gap={3.5}
            months={months}
            dayLabels
          />
        </View>
      </Card>

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
      <AppText variant="footnote" color="secondary">
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
    marginBottom: Spacing.xxl,
  },
  tiles: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: "center",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
