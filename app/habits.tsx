/**
 * HABITS — the tracker home. A calm today-summary up top, then every habit as a
 * row (identity icon, streak, frequency, mini heatmap, one-tap check), and a
 * goal-aware "Suggested for you" shelf that adds a real habit in a single tap.
 * Auto-tracked habits (water / meals / workout) light up from app data.
 */
import { HabitRow } from "@/components/habits/HabitRow";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { IconBadge } from "@/components/ui/IconBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile, useSystem } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import { EVERY_DAY } from "@/models/habit";
import { isScheduled } from "@/services/HabitService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

/** A curated, wellness-leaning shelf of habits to add in one tap. `goals`
 *  loosely biases ordering toward the user's primary goal (never filters). */
interface Suggestion {
  name: string;
  icon: string;
  color: string;
  goals?: string[];
}

const SUGGESTIONS: Suggestion[] = [
  { name: "Sleep 8 hours", icon: "bed", color: "#8B7CFF" },
  { name: "10k steps", icon: "footsteps", color: "#A8E05F", goals: ["lose", "weight", "fat", "lean"] },
  { name: "Stretch", icon: "body", color: "#2DD0B0" },
  { name: "Meditate", icon: "leaf", color: "#3FDD78" },
  { name: "Morning sunlight", icon: "sunny", color: "#F5C542" },
  { name: "Take vitamins", icon: "medical", color: "#FF5D55" },
  { name: "Read 10 min", icon: "book", color: "#38C6ED" },
  { name: "No late-night snacks", icon: "moon", color: "#FF6FA5", goals: ["lose", "weight", "fat"] },
  { name: "Protein every meal", icon: "nutrition", color: "#FFA13B", goals: ["muscle", "gain", "strength", "build"] },
];

export default function HabitsScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { views, toggleToday, createHabit, loading } = useHabits();
  const { currentDate } = useSystem();
  const { userBio } = useProfile();

  const [adding, setAdding] = useState<Set<string>>(new Set());

  // Today's scheduled habits → the summary readout.
  const scheduledToday = useMemo(
    () => views.filter((v) => isScheduled(v.habit, currentDate)),
    [views, currentDate],
  );
  const doneToday = scheduledToday.filter((v) => v.stats.doneToday).length;
  const totalToday = scheduledToday.length;
  const pct = totalToday > 0 ? doneToday / totalToday : 0;
  const allDone = totalToday > 0 && doneToday === totalToday;

  // Suggestions the user doesn't already have, goal-biased, capped at six.
  const suggestions = useMemo(() => {
    const have = new Set(views.map((v) => v.habit.name.trim().toLowerCase()));
    const goal = (userBio?.primaryGoal ?? "").toLowerCase();
    const score = (s: Suggestion) => (s.goals?.some((g) => goal.includes(g)) ? 1 : 0);
    return SUGGESTIONS.filter((s) => !have.has(s.name.toLowerCase()))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 6);
  }, [views, userBio?.primaryGoal]);

  const addSuggestion = async (s: Suggestion) => {
    if (adding.has(s.name)) return;
    setAdding((prev) => new Set(prev).add(s.name));
    try {
      await createHabit({
        name: s.name,
        icon: s.icon,
        color: s.color,
        days: EVERY_DAY,
        source: "manual",
        reminder: null,
      });
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(s.name);
        return next;
      });
    }
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="displayLg" style={styles.headerTitle}>
        Habits
      </AppText>
      <Pressable
        hitSlop={12}
        onPress={() => router.push("/habit/new" as any)}
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  return (
    <Screen header={header}>
      {/* Today summary */}
      {totalToday > 0 && (
        <Card padding="lg" style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.flex}>
              <View style={styles.summaryCountRow}>
                <AppText variant="metric">{doneToday}</AppText>
                <AppText variant="headline" color="secondary" style={styles.summaryUnit}>
                  / {totalToday} today
                </AppText>
              </View>
              <AppText variant="footnote" color="tertiary">
                {allDone
                  ? "All done for today — nicely held."
                  : `${totalToday - doneToday} habit${totalToday - doneToday === 1 ? "" : "s"} left`}
              </AppText>
            </View>
            <IconBadge
              name={allDone ? "checkmark-circle" : "flame"}
              tone={allDone ? colors.success : colors.primary}
              size={44}
            />
          </View>
          <ProgressBar
            progress={pct}
            gradient={colors.brandGradient}
            height={8}
            style={styles.summaryBar}
          />
        </Card>
      )}

      {/* Empty state (only when the user has cleared every habit) */}
      {!loading && views.length === 0 && (
        <Card padding="xxl" style={styles.emptyCard}>
          <AppText variant="headline">No habits yet</AppText>
          <AppText variant="subhead" color="secondary" style={styles.emptySub}>
            Add one below, or tap + to create your own. Water, meals and workouts
            can track themselves from what you already log.
          </AppText>
        </Card>
      )}

      {/* Your habits */}
      {views.length > 0 && (
        <>
          <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
            Your habits
          </AppText>
          <Card padding="lg">
            {views.map((view, i) => (
              <View key={view.habit.id}>
                {i > 0 && <Divider spacing={0} />}
                <HabitRow
                  view={view}
                  today={currentDate}
                  onPress={() => router.push(`/habit/${view.habit.id}` as any)}
                  onToggle={() => toggleToday(view.habit.id)}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Suggested for you */}
      {suggestions.length > 0 && (
        <>
          <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
            Suggested for you
          </AppText>
          <Card padding="lg">
            {suggestions.map((s, i) => (
              <View key={s.name}>
                {i > 0 && <Divider spacing={0} />}
                <Pressable
                  onPress={() => addSuggestion(s)}
                  disabled={adding.has(s.name)}
                  style={({ pressed }) => [
                    styles.suggestRow,
                    (pressed || adding.has(s.name)) && { opacity: 0.55 },
                  ]}
                >
                  <IconBadge name={s.icon as any} tone={s.color} size={38} />
                  <AppText variant="bodyLg" weight="600" style={styles.flex} numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <View style={[styles.addBtn, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </View>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerTitle: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCard: { marginTop: Spacing.sm },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  summaryCountRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  summaryUnit: { fontWeight: "600" },
  summaryBar: { marginTop: Spacing.md },

  emptyCard: { marginTop: Spacing.xl },
  emptySub: { marginTop: Spacing.xs },

  sectionLabel: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
