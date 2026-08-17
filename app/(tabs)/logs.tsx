/**
 * LOGS — one record of everything you actually did.
 *
 * Welliva has always kept five separate ledgers: meals in `dietHistory`,
 * sessions in `workoutLog`, hydration in the archived water history, weight in
 * `bodyLogs`, and habit ticks in the habits store. Each was only ever readable
 * from inside its own feature — you could see your meal history from Diet and
 * your workouts from Fitness, but never your WEEK. This screen is that view:
 * every ledger, merged, newest first, grouped by day.
 *
 * IT ONLY READS. Nothing here writes, edits or deletes; the rules about what can
 * still be changed (today open, yesterday a backlog, older days closed) live in
 * Diet → History, which owns editing and is one tap away from any meal row. A
 * read-only surface can show every domain at once precisely because it doesn't
 * have to reconcile five different mutation policies.
 *
 * TODAY IS LIVE. `dietHistory` only gains a row when a day closes, so today's
 * meals are read from the live schedule instead — otherwise the day you're
 * standing in would be the one day missing from your log.
 *
 * FREE-TIER WINDOW. History depth is a Pro line (services/billing/tiers), and
 * this screen is history. It clamps to the same cutoff every other history
 * surface uses and says so with the standard lock card, rather than quietly
 * showing less than it has.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { ProLockCard } from "@/components/billing";
import { ScreenTopBar } from "@/components/navigation";
import {
  AppText,
  Card,
  IconBadge,
  Reveal,
  Screen,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { useHabits } from "@/contexts/HabitsContext";
import type { IconName } from "@/components/navigation/menu";
import { historyCutoffDate } from "@/services/billing";
import {
  getWaterHistory,
  parseLocalDate,
  type WaterHistoryEntry,
} from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

/* ───────────────────────────────── Model ───────────────────────────────── */

type Kind = "meal" | "workout" | "water" | "body" | "habit";

interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  kind: Kind;
  icon: IconName;
  title: string;
  detail: string;
  /** Right-hand figure — the number this entry is actually about. */
  value?: string;
  /** Where tapping the row goes, if anywhere. */
  href?: string;
}

interface Filter {
  key: Kind | "all";
  label: string;
  icon: IconName;
}

const FILTERS: Filter[] = [
  { key: "all", label: "All", icon: "layers-outline" },
  { key: "meal", label: "Meals", icon: "restaurant-outline" },
  { key: "workout", label: "Workouts", icon: "barbell-outline" },
  { key: "habit", label: "Habits", icon: "grid-outline" },
  { key: "water", label: "Water", icon: "water-outline" },
  { key: "body", label: "Body", icon: "body-outline" },
];

/** How far back the timeline reaches for a Pro account. */
const MAX_DAYS = 120;

/* ───────────────────────────────── Screen ──────────────────────────────── */

export default function LogsScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const { currentDate } = useSystem();
  const { dietHistory, todayDiet } = useNutrition();
  const { workoutLog } = useWorkout();
  const { bodyLogs } = useProfile();
  const { views } = useHabits();
  const { hasProAccess } = useBilling();

  const [filter, setFilter] = useState<Kind | "all">("all");

  // Hydration is archived to storage at day-end rather than held in a context,
  // so it's the one ledger this screen has to go and fetch.
  const [water, setWater] = useState<WaterHistoryEntry[]>([]);
  useEffect(() => {
    let alive = true;
    getWaterHistory().then((h) => {
      if (alive) setWater(h);
    });
    return () => {
      alive = false;
    };
  }, [currentDate]);

  const tone: Record<Kind, string> = useMemo(
    () => ({
      meal: colors.primary,
      workout: colors.protein,
      water: colors.water,
      body: colors.fat,
      habit: colors.success,
    }),
    [colors],
  );

  // The free tier's floor. `null` means no limit (Pro).
  const cutoff = useMemo(
    () => historyCutoffDate(hasProAccess, parseLocalDate(currentDate)),
    [hasProAccess, currentDate],
  );

  const entries = useMemo(
    () =>
      buildEntries({
        currentDate,
        dietHistory,
        todaySchedule: todayDiet?.schedule,
        workoutLog,
        bodyLogs,
        water,
        habits: views,
      }),
    [currentDate, dietHistory, todayDiet, workoutLog, bodyLogs, water, views],
  );

  /** Anything older than the free-tier cutoff exists but isn't shown. */
  const hiddenByTier = useMemo(
    () => (cutoff ? entries.filter((e) => e.date < cutoff).length : 0),
    [cutoff, entries],
  );

  const days = useMemo(() => {
    const floor = cutoff ?? "";
    const visible = entries.filter(
      (e) => e.date >= floor && (filter === "all" || e.kind === filter),
    );

    // Group into days, newest first. `entries` is already sorted, so this
    // preserves order without a second sort.
    const out: { date: string; rows: LogEntry[] }[] = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.rows.push(e);
      else out.push({ date: e.date, rows: [e] });
    }
    return out.slice(0, MAX_DAYS);
  }, [entries, cutoff, filter]);

  const header = (
    <>
      <ScreenTopBar title="Logs" style={styles.topBar} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${f.label.toLowerCase()}`}
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.primary : colors.surfaceMuted,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={on ? colors.onPrimary : colors.textSecondary}
              />
              <AppText
                variant="footnote"
                weight="600"
                color={on ? colors.onPrimary : "secondary"}
              >
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <Screen header={header}>
      {days.length === 0 ? (
        <Reveal index={0}>
          <Card padding="xxl" style={styles.empty}>
            <IconBadge name="reader" tone={colors.textTertiary} size={52} />
            <AppText variant="headline" align="center" style={styles.emptyTitle}>
              {filter === "all" ? "Nothing logged yet" : "Nothing here yet"}
            </AppText>
            <AppText variant="subhead" color="secondary" align="center">
              {filter === "all"
                ? "Tick a meal, finish a workout or check off a habit — it lands here."
                : "Switch the filter, or log something in this area to see it."}
            </AppText>
          </Card>
        </Reveal>
      ) : (
        days.map((day, i) => (
          <Reveal key={day.date} index={Math.min(i, 4)}>
            <View style={styles.day}>
              <View style={styles.dayHead}>
                <AppText variant="callout" color="secondary">
                  {dayLabel(day.date, currentDate)}
                </AppText>
                <View style={[styles.dayRule, { backgroundColor: colors.divider }]} />
                <AppText variant="caption" color="tertiary">
                  {day.rows.length} {day.rows.length === 1 ? "entry" : "entries"}
                </AppText>
              </View>

              <Card padding="none">
                {day.rows.map((row, j) => (
                  <Row
                    key={row.id}
                    entry={row}
                    tone={tone[row.kind]}
                    divider={j < day.rows.length - 1}
                    onPress={row.href ? () => router.push(row.href as never) : undefined}
                  />
                ))}
              </Card>
            </View>
          </Reveal>
        ))
      )}

      {/* The honest edge of the free tier: say what's being withheld. */}
      {hiddenByTier > 0 && (
        <Reveal index={5}>
          <ProLockCard
            lock="history"
            title="Your older logs are still here"
            blurb={`${hiddenByTier} earlier ${
              hiddenByTier === 1 ? "entry is" : "entries are"
            } saved but out of range on the free plan. Pro opens the full record.`}
            style={styles.lock}
          />
        </Reveal>
      )}
    </Screen>
  );
}

/* ────────────────────────────────── Row ────────────────────────────────── */

function Row({
  entry,
  tone,
  divider,
  onPress,
}: {
  entry: LogEntry;
  tone: string;
  divider: boolean;
  onPress?: () => void;
}) {
  const { colors } = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        onPress
          ? `${entry.title}. ${entry.detail}${entry.value ? `. ${entry.value}` : ""}`
          : undefined
      }
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
        pressed && onPress ? { backgroundColor: alpha(colors.text, 0.04) } : null,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: alpha(tone, 0.14) }]}>
        <Ionicons name={entry.icon} size={17} color={tone} />
      </View>

      <View style={styles.rowText}>
        <AppText variant="body" weight="600" numberOfLines={1}>
          {entry.title}
        </AppText>
        <AppText variant="footnote" color="tertiary" numberOfLines={1}>
          {entry.detail}
        </AppText>
      </View>

      {entry.value ? (
        <AppText variant="callout" color={tone} numberOfLines={1}>
          {entry.value}
        </AppText>
      ) : null}

      {onPress ? (
        <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

/* ─────────────────────────────── Assembly ──────────────────────────────── */

/**
 * Merge the five ledgers into one descending timeline.
 *
 * Pure and parameterised so the ordering rule is one thing in one place: sort by
 * date descending, then by a fixed kind order within a day, so a day always
 * reads meals → workout → habits → water → body no matter which store happened
 * to be written first.
 */
function buildEntries(input: {
  currentDate: string;
  dietHistory: { date: string; dietName: string; mealsConsumed: number; totalMeals: number; consumedCalories?: number }[];
  todaySchedule?: { breakfast?: unknown; lunch?: unknown; dinner?: unknown; snacks: unknown[] } | null;
  workoutLog: { id: string; date: string; sessionLabel: string; exercisesCompleted: number; totalExercises: number; durationMinutes: number }[];
  bodyLogs: { date: string; weightKg: number; waistCm?: number }[];
  water: WaterHistoryEntry[];
  habits: { habit: { id: string; name: string; icon: string }; done: Set<string> }[];
}): LogEntry[] {
  const out: LogEntry[] = [];

  // ── Meals ──
  for (const d of input.dietHistory) {
    out.push({
      id: `meal-${d.date}`,
      date: d.date,
      kind: "meal",
      icon: "restaurant",
      title: d.dietName || "Meals",
      detail: `${d.mealsConsumed} of ${d.totalMeals} logged`,
      value: d.consumedCalories ? `${Math.round(d.consumedCalories)} kcal` : undefined,
      href: "/diet/history",
    });
  }

  // Today isn't in `dietHistory` until the day closes — read it live, so the
  // day you're standing in isn't the one day missing from your own log.
  const s = input.todaySchedule;
  if (s && !input.dietHistory.some((d) => d.date === input.currentDate)) {
    const meals = [s.breakfast, s.lunch, s.dinner, ...(s.snacks ?? [])].filter(
      Boolean,
    ) as { isConsumed?: boolean }[];
    const eaten = meals.filter((m) => m.isConsumed).length;
    if (meals.length > 0) {
      out.push({
        id: `meal-${input.currentDate}`,
        date: input.currentDate,
        kind: "meal",
        icon: "restaurant",
        title: "Today's meals",
        detail: `${eaten} of ${meals.length} logged`,
        href: "/diet",
      });
    }
  }

  // ── Workouts ──
  for (const w of input.workoutLog) {
    out.push({
      id: `workout-${w.id}`,
      date: w.date,
      kind: "workout",
      icon: "barbell",
      title: w.sessionLabel || "Workout",
      detail: `${w.exercisesCompleted} of ${w.totalExercises} exercises`,
      value: w.durationMinutes ? `${w.durationMinutes} min` : undefined,
      href: "/fitness/progress",
    });
  }

  // ── Habits — one row per day, not per habit, or a 12-habit user's log is
  //    nothing but habits. The names go in the detail line. ──
  const habitDays = new Map<string, string[]>();
  for (const v of input.habits) {
    for (const date of v.done) {
      const list = habitDays.get(date);
      if (list) list.push(v.habit.name);
      else habitDays.set(date, [v.habit.name]);
    }
  }
  for (const [date, names] of habitDays) {
    out.push({
      id: `habit-${date}`,
      date,
      kind: "habit",
      icon: "checkmark-done",
      title: names.length === 1 ? names[0] : `${names.length} habits held`,
      detail: names.length === 1 ? "Habit completed" : names.join(" · "),
      href: "/habits",
    });
  }

  // ── Water ──
  for (const w of input.water) {
    out.push({
      id: `water-${w.date}`,
      date: w.date,
      kind: "water",
      icon: "water",
      title: "Hydration",
      detail: w.goalMl
        ? `${Math.round((w.ml / w.goalMl) * 100)}% of goal`
        : "Logged",
      value: `${(w.ml / 1000).toFixed(1)} L`,
    });
  }

  // ── Body ──
  for (const b of input.bodyLogs) {
    out.push({
      id: `body-${b.date}`,
      date: b.date,
      kind: "body",
      icon: "body",
      title: "Weigh-in",
      detail: b.waistCm ? `Waist ${b.waistCm} cm` : "Weight recorded",
      value: `${b.weightKg} kg`,
      href: "/fitness/progress",
    });
  }

  const ORDER: Record<Kind, number> = {
    meal: 0,
    workout: 1,
    habit: 2,
    water: 3,
    body: 4,
  };

  return out.sort((a, b) =>
    a.date === b.date
      ? ORDER[a.kind] - ORDER[b.kind]
      : a.date < b.date
        ? 1
        : -1,
  );
}

/* ──────────────────────────────── Labels ───────────────────────────────── */

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";

  const d = parseLocalDate(date);
  const t = parseLocalDate(today);
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (days === 1) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    // Only name the year once it stops being obvious.
    ...(d.getFullYear() !== t.getFullYear() ? { year: "numeric" } : {}),
  });
}

const styles = StyleSheet.create({
  topBar: { paddingTop: Spacing.sm },

  filters: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  day: { marginBottom: Spacing.xl },
  dayHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },

  empty: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.xxl },
  emptyTitle: { marginTop: Spacing.sm },

  lock: { marginTop: Spacing.sm },
});

/**
 * LEVEL 3 — route-level boundary. A throw inside this screen is contained here:
 * the menu stays live and every other destination stays usable.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:logs" />;
}
