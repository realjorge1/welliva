/**
 * HABITS — the tracker home. A calm today-summary up top, then every habit as a
 * row (identity icon, streak, frequency, mini heatmap, one-tap check), and a
 * goal-aware "Suggested for you" shelf that adds a real habit in a single tap.
 * Auto-tracked habits (water / meals / workout) light up from app data.
 *
 * The last shelf is "No longer tracking" — the habits the user has deleted,
 * with what each of them amounted to. It is there because deleting a habit here
 * removes it from the LIST, not from the record, and a promise that abstract is
 * worth nothing unless you can see it being kept.
 */
import { HabitRow } from "@/components/habits/HabitRow";
import { ScreenTopBar } from "@/components/navigation";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBadge } from "@/components/ui/IconBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { ProLockCard } from "@/components/billing";
import { useProfile, useSystem } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { useHabits } from "@/contexts/HabitsContext";
import { EVERY_DAY, frequencyLabel, retiredSummaryLine } from "@/models/habit";
import { canCreateHabit, featureMinTier, habitLimit, TIER_NAME } from "@/services/billing";
import { isDueToday } from "@/services/HabitService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

/**
 * A curated, wellness-leaning shelf of habits to add in one tap.
 *
 * AgoalsA loosely biases ordering toward the user's primary goal (never
 * filters). AweeklyGoalA is the TARGET the habit arrives with: omit it for the
 * rituals that only work daily, and set a quota for the ones that need slack.
 * A one-tap habit that lands as "every day" when nobody stretches every day is
 * a broken streak waiting to happen, so the shelf ships its own answers rather
 * than making every added habit start at seven-out-of-seven.
 */
interface Suggestion {
  name: string;
  icon: string;
  color: string;
  goals?: string[];
  /** Times per week, 1–6. Omitted means every day. */
  weeklyGoal?: number;
}

const SUGGESTIONS: Suggestion[] = [
  { name: "Sleep 8 hours", icon: "bed", color: "#8B7CFF" },
  { name: "10k steps", icon: "footsteps", color: "#A8E05F", weeklyGoal: 5, goals: ["lose", "weight", "fat", "lean"] },
  { name: "Stretch", icon: "body", color: "#2DD0B0", weeklyGoal: 4 },
  { name: "Meditate", icon: "leaf", color: "#3FDD78" },
  { name: "Morning sunlight", icon: "sunny", color: "#F5C542" },
  { name: "Take vitamins", icon: "medical", color: "#FF5D55" },
  { name: "Read 10 min", icon: "book", color: "#38C6ED" },
  { name: "Strength session", icon: "barbell", color: "#3E9BFF", weeklyGoal: 4, goals: ["muscle", "gain", "strength", "build"] },
  { name: "No late-night snacks", icon: "moon", color: "#FF6FA5", goals: ["lose", "weight", "fat"] },
  { name: "Protein every meal", icon: "nutrition", color: "#FFA13B", goals: ["muscle", "gain", "strength", "build"] },
];

export default function HabitsScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { views, retired, toggleToday, createHabit, loading } = useHabits();
  const { currentDate } = useSystem();
  const { userBio } = useProfile();
  const { tier, openUpgrade } = useBilling();

  const [adding, setAdding] = useState<Set<string>>(new Set());

  // Only user-created habits count against the free cap — the three seeded
  // auto-tracked ones derive from logging, which is never gated.
  const manualCount = useMemo(
    () => views.filter((v) => v.habit.source === "manual").length,
    [views],
  );
  const canAddHabit = canCreateHabit(manualCount, tier);
  const freeSlots = habitLimit(tier);

  // Today's readout. "Due" rather than "scheduled": a 4×-a-week habit that
  // already banked its four drops out of today's count instead of sitting there
  // asking for a fifth, so the number at the top of the screen is a thing that
  // can actually be finished.
  const dueToday = useMemo(
    () => views.filter((v) => isDueToday(v.habit, v.done, currentDate)),
    [views, currentDate],
  );
  const doneToday = dueToday.filter((v) => v.stats.doneToday).length;
  const totalToday = dueToday.length;
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
    if (!canAddHabit) {
      openUpgrade("habits");
      return;
    }
    setAdding((prev) => new Set(prev).add(s.name));
    try {
      await createHabit({
        name: s.name,
        icon: s.icon,
        color: s.color,
        // A quota habit is any-day-you-like, so it keeps the full weekday set;
        // AweeklyGoalA is what everything downstream actually measures against.
        days: EVERY_DAY,
        weeklyGoal: s.weeklyGoal ?? null,
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
    <ScreenTopBar
      title="Habits"
      style={styles.headerRow}
      right={
        <Pressable
          hitSlop={12}
          onPress={() =>
            canAddHabit ? router.push("/habit/new" as any) : openUpgrade("habits")
          }
          accessibilityLabel={
            canAddHabit ? "New habit" : `New habit — requires ${TIER_NAME[featureMinTier("habits")]}`
          }
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons
            name={canAddHabit ? "add" : "lock-closed"}
            size={canAddHabit ? 22 : 18}
            color={colors.text}
          />
        </Pressable>
      }
    />
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

      {/* Day one. Names what the screen holds, says why it is worth filling,
          and hands over the tap that fills it — see components/ui/EmptyState. */}
      {!loading && views.length === 0 && (
        <EmptyState
          icon="repeat"
          title="Your daily habits"
          body="Water, meals and workouts can track themselves from what you already log — so a streak starts without any extra tapping."
          action={{
            label: "Create a habit",
            onPress: () => router.push("/habit/new" as never),
          }}
          style={styles.emptyCard}
        />
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
                  accessibilityRole="button"
                  accessibilityLabel={
                    canAddHabit
                      ? `Add ${s.name}, ${frequencyLabel(EVERY_DAY, s.weeklyGoal ?? null).toLowerCase()}`
                      : `Add ${s.name} — requires ${TIER_NAME[featureMinTier("habits")]}`
                  }
                  style={({ pressed }) => [
                    styles.suggestRow,
                    (pressed || adding.has(s.name)) && { opacity: 0.55 },
                  ]}
                >
                  <IconBadge name={s.icon as any} tone={s.color} size={38} />
                  <View style={styles.flex}>
                    <AppText variant="bodyLg" weight="600" numberOfLines={1}>
                      {s.name}
                    </AppText>
                    {/* State the target before it's added, not after — the
                        goal is half of what you're agreeing to. */}
                    <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                      {frequencyLabel(EVERY_DAY, s.weeklyGoal ?? null)}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.addBtn,
                      {
                        backgroundColor: alpha(
                          canAddHabit ? colors.primary : colors.gold,
                          0.12,
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name={canAddHabit ? "add" : "lock-closed"}
                      size={canAddHabit ? 18 : 14}
                      color={canAddHabit ? colors.primary : colors.gold}
                    />
                  </View>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* No longer tracking. Deliberately the quietest block on the screen:
          a finished habit is history, not a to-do, so it gets no icon plate, no
          chevron and nothing to tap. It states what the habit was worth and
          then stops talking — which is also the answer to "where did my streak
          go?" for anyone who deleted something and got nervous. */}
      {retired.length > 0 && (
        <>
          <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
            No longer tracking
          </AppText>
          <Card padding="lg">
            {retired.slice(0, 6).map((r, i) => (
              <View key={r.habit.id}>
                {i > 0 && <Divider spacing={0} />}
                <View style={styles.retiredRow}>
                  <View
                    style={[
                      styles.retiredDot,
                      { backgroundColor: alpha(r.habit.color, 0.5) },
                    ]}
                  />
                  <View style={styles.flex}>
                    <AppText variant="body" color="secondary" numberOfLines={1}>
                      {r.habit.name}
                    </AppText>
                    <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                      {r.record.totalDone > 0
                        ? `${r.record.totalDone} day${r.record.totalDone === 1 ? "" : "s"} · ${retiredSummaryLine(r.record)}`
                        : "Never got going"}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </Card>
          <AppText variant="caption" color="tertiary" style={styles.retiredNote}>
            Kept for as long as Gozlin&apos;s memory is — clearing that clears these too.
          </AppText>
        </>
      )}

      {/* The cap, stated plainly. Shown only once it's actually reached — a
          counter on an empty tracker is noise, and a limit you haven't met yet
          isn't information the user needs. */}
      {/* The lock, stated as what it is.
          Two ways this used to go wrong and now can't. The title interpolated
          the free slot count — which is 0 on Free, so it read "You're using all
          0 free habits", an allowance nobody was ever given. And the blurb sold
          "Plus", a tier that was merged into Pro and no longer exists anywhere
          but in this sentence. Both branches below name the boundary honestly
          and both lead with what the user keeps: the three auto-tracked habits
          are theirs, free, and are most of what this screen shows. */}
      {!canAddHabit && freeSlots !== null && (
        <ProLockCard
          lock="habits"
          compact
          title={freeSlots === 0 ? undefined : `You're using all ${freeSlots} of your habits`}
          blurb={
            freeSlots === 0
              ? "Food, water and workouts tick themselves off your logs, free, and always will. Pro adds habits you pick yourself — the suggested ones and your own — with no limit and full streak history."
              : "Pro removes the limit, so you can track as many as you want. Your auto-tracked water, meal and workout habits never count toward it."
          }
          style={styles.lockCard}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerRow: { paddingTop: Spacing.xs, paddingBottom: Spacing.md },
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
  retiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  retiredDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  retiredNote: { marginTop: Spacing.sm, marginLeft: Spacing.xs },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  lockCard: { marginTop: Spacing.xxl },
});
