/**
 * Diet history — the calendar of what you actually ate, and the one chance to
 * fix yesterday.
 *
 * THE RULE THIS SCREEN EXISTS TO EXPRESS:
 *   today      → log freely
 *   yesterday  → "did you have these and forget to log?" — still editable
 *   older      → read-only, permanently
 *
 * The lock is deliberately visible rather than hidden: tapping a closed day
 * explains why it can't be changed. A user who discovers the limit by finding a
 * greyed-out row learns the system is trustworthy; one who discovers it when a
 * tap silently does nothing learns it's broken.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useNutrition, useSystem } from "@/contexts/AppContext";
import { useMealPlan } from "@/contexts/MealPlanContext";
import type { DietHistoryEntry, MealType, ScheduledMeal } from "@/models/diet";
import { addDays, parseLocalDate, toLocalDate } from "@/models/mealPlan";
import { getScheduledDietForDate } from "@/services/ScheduleService";
import * as Haptics from "@/utils/haptics";

export default function DietHistoryScreen() {
  const { colors } = useColors();
  const { currentDate } = useSystem();
  const { dietHistory } = useNutrition();
  const { backlogPrompt, backlogMeal, permissionFor } = useMealPlan();

  const [selected, setSelected] = useState<string>(addDays(currentDate, -1));
  const [daySchedule, setDaySchedule] = useState<{
    meals: { slot: MealType; name: string; snackIndex?: number; consumed: boolean }[];
  } | null>(null);

  const historyByDate = useMemo(
    () => new Map(dietHistory.map((h) => [h.date, h])),
    [dietHistory],
  );

  const loadDay = useCallback(async (date: string) => {
    const scheduled = await getScheduledDietForDate(date);
    if (!scheduled) {
      setDaySchedule(null);
      return;
    }
    const s = scheduled.schedule;
    const meals: { slot: MealType; name: string; snackIndex?: number; consumed: boolean }[] = [];
    const push = (slot: MealType, meal: ScheduledMeal | null) => {
      if (meal) meals.push({ slot, name: meal.name, consumed: meal.isConsumed });
    };
    push("breakfast", s.breakfast);
    push("lunch", s.lunch);
    push("dinner", s.dinner);
    s.snacks.forEach((snack, i) =>
      meals.push({ slot: "snack", name: snack.name, snackIndex: i, consumed: snack.isConsumed }),
    );
    setDaySchedule({ meals });
  }, []);

  useEffect(() => {
    void loadDay(selected);
  }, [selected, loadDay, backlogPrompt]);

  const permission = permissionFor(selected);
  const editable = permission === "open" || permission === "backlog";

  // Last 8 weeks, most recent first.
  const weeks = useMemo(() => buildWeeks(currentDate, 8), [currentDate]);

  return (
    <Screen scroll contentStyle={styles.body}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="headline" weight="700">
          History
        </AppText>
      </View>

      {/* --- The one-day-back prompt ---------------------------------------- */}
      {backlogPrompt ? (
        <Card padding="lg" style={{ borderColor: colors.warning, borderWidth: 1 }}>
          <View style={styles.promptHead}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <AppText variant="body" weight="700" style={styles.flex}>
              Did you have these and forget to log?
            </AppText>
          </View>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
            {longDate(backlogPrompt.date)} — you can still tick these today.
            After that the day closes.
          </AppText>
          <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
            {backlogPrompt.unloggedMeals.map((m) => (
              <Pressable
                key={`${m.mealType}-${m.snackIndex ?? 0}-${m.name}`}
                onPress={async () => {
                  Haptics.selectionAsync().catch(() => {});
                  await backlogMeal(backlogPrompt.date, m.mealType, m.snackIndex);
                  await loadDay(selected);
                }}
                style={[styles.promptRow, { borderColor: colors.border }]}
              >
                <Ionicons name="ellipse-outline" size={20} color={colors.textSecondary} />
                <View style={styles.flex}>
                  <AppText variant="body" weight="600">
                    {m.name}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {cap(m.mealType)}
                  </AppText>
                </View>
                <AppText variant="caption" weight="700" color="primary">
                  I had this
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {/* --- Calendar ------------------------------------------------------- */}
      <Card padding="lg">
        <View style={styles.weekHead}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <AppText key={i} variant="caption" color="textSecondary" weight="700" align="center" style={styles.cell}>
              {d}
            </AppText>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.weekRow}>
            {week.map((date) => {
              const entry = historyByDate.get(date);
              const isFuture = date > currentDate;
              const isSelected = date === selected;
              const ratio =
                entry && entry.totalMeals > 0 ? entry.mealsConsumed / entry.totalMeals : null;

              const bg =
                ratio === null
                  ? "transparent"
                  : ratio === 1
                    ? colors.success
                    : ratio > 0
                      ? `${colors.warning}CC`
                      : `${colors.error}55`;

              return (
                <Pressable
                  key={date}
                  disabled={isFuture}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelected(date);
                  }}
                  style={[styles.cell, styles.dayCell]}
                >
                  <View
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: bg,
                        borderColor: isSelected ? colors.primary : "transparent",
                        borderWidth: isSelected ? 2 : 0,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      weight={date === currentDate ? "800" : "500"}
                      style={{
                        color: isFuture
                          ? colors.border
                          : ratio !== null && ratio === 1
                            ? colors.background
                            : colors.text,
                      }}
                    >
                      {Number(date.slice(8, 10))}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          <Legend color={colors.success} label="All logged" />
          <Legend color={`${colors.warning}CC`} label="Partial" />
          <Legend color={`${colors.error}55`} label="None" />
        </View>
      </Card>

      {/* --- Selected day ---------------------------------------------------- */}
      <DayDetail
        date={selected}
        entry={historyByDate.get(selected)}
        meals={daySchedule?.meals ?? []}
        editable={editable}
        permission={permission}
        onToggle={async (slot, snackIndex) => {
          const ok = await backlogMeal(selected, slot, snackIndex);
          if (ok) await loadDay(selected);
        }}
      />
    </Screen>
  );
}

function DayDetail({
  date,
  entry,
  meals,
  editable,
  permission,
  onToggle,
}: {
  date: string;
  entry: DietHistoryEntry | undefined;
  meals: { slot: MealType; name: string; snackIndex?: number; consumed: boolean }[];
  editable: boolean;
  permission: string;
  onToggle: (slot: MealType, snackIndex?: number) => Promise<void>;
}) {
  const { colors } = useColors();

  return (
    <Card padding="lg">
      <AppText variant="body" weight="700">
        {longDate(date)}
      </AppText>

      {permission === "backlog" ? (
        <Badge color={colors.warning} icon="time-outline" label="Still editable today" />
      ) : permission === "locked" ? (
        <Badge color={colors.textSecondary} icon="lock-closed" label="Closed — kept as recorded" />
      ) : permission === "open" ? (
        <Badge color={colors.success} icon="ellipse" label="Today" />
      ) : null}

      {entry ? (
        <AppText variant="caption" color="textSecondary" style={{ marginTop: Spacing.sm }}>
          {entry.mealsConsumed} of {entry.totalMeals} meals ·{" "}
          {entry.consumedCalories !== undefined ? `${entry.consumedCalories} kcal` : "no macro data"}
          {entry.dietName ? ` · ${entry.dietName}` : ""}
        </AppText>
      ) : null}

      {meals.length === 0 ? (
        <AppText variant="caption" color="textSecondary" style={{ marginTop: Spacing.md }}>
          {entry
            ? "This day's plan has been archived — its result is kept above."
            : "No plan was scheduled for this day."}
        </AppText>
      ) : (
        <View style={{ marginTop: Spacing.md }}>
          {meals.map((m) => (
            <Pressable
              key={`${m.slot}-${m.snackIndex ?? 0}-${m.name}`}
              disabled={!editable}
              onPress={() => onToggle(m.slot, m.snackIndex)}
              style={[styles.mealRow, { borderColor: colors.border }]}
            >
              <Ionicons
                name={m.consumed ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={
                  m.consumed ? colors.success : editable ? colors.textSecondary : colors.border
                }
              />
              <View style={styles.flex}>
                <AppText
                  variant="body"
                  weight="600"
                  style={{ color: editable ? colors.text : colors.textSecondary }}
                >
                  {m.name}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {cap(m.slot)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {permission === "locked" ? (
        <AppText variant="caption" color="textSecondary" style={styles.lockNote}>
          {`You can log today and yesterday. Older days stay as they were recorded — that's what keeps your history, and your end-of-plan report, honest.`}
        </AppText>
      ) : null}
    </Card>
  );
}

function Badge({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={icon as never} size={12} color={color} />
      <AppText variant="caption" weight="700" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

/** `count` weeks ending with the week containing `today`, newest week first. */
function buildWeeks(today: string, count: number): string[][] {
  const d = parseLocalDate(today);
  const shift = (d.getDay() + 6) % 7; // Monday-first
  const thisMonday = toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift));

  const weeks: string[][] = [];
  for (let w = 0; w < count; w++) {
    const start = addDays(thisMonday, -7 * w);
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

const longDate = (d: string) =>
  parseLocalDate(d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: Spacing.lg, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  promptHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekHead: { flexDirection: "row", marginBottom: 4 },
  weekRow: { flexDirection: "row" },
  cell: { width: `${100 / 7}%` },
  dayCell: { aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lockNote: { marginTop: Spacing.md, lineHeight: 17 },
});
