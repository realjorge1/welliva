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
 * IT READS THE FIVE LEDGERS AND OWNS THE TWO HAND-ENTERED ONES. Meals,
 * workouts, water and habits are all logged where they happen, so this screen
 * only reports them; editing stays with Diet → History, which is one tap from
 * any meal row. But the check-in and the weigh-in have no home feature — they
 * were reachable only from the coach's overflow menu, which meant two ordinary
 * logging actions lived inside a chat screen while the screen named for the
 * record couldn't add to it. They're here now, behind the header's + button.
 *
 * TODAY IS LIVE. `dietHistory` only gains a row when a day closes, so today's
 * meals are read from the live schedule instead — otherwise the day you're
 * standing in would be the one day missing from your log.
 *
 * FREE-TIER WINDOW. History depth is a Pro line (services/billing/tiers), and
 * this screen is history. It clamps to the same cutoff every other history
 * surface uses and says so with the standard lock card, rather than quietly
 * showing less than it has.
 *
 * IT IS ALSO THE COACH'S RECORD. Gozlin's header opens this screen, so it's
 * what someone lands on after asking "what have I actually been doing" — which
 * is why the page opens with the last seven days as a shape rather than with
 * row one of a list. The spark answers that question before you scroll; the
 * ledger below answers the follow-up.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { ProLockCard } from "@/components/billing";
import { ActionBar, ScreenTopBar } from "@/components/navigation";
import {
  AppText,
  Card,
  EmptyState,
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
  toLocalDateString,
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
  const { tier } = useBilling();
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
    () => historyCutoffDate(tier, parseLocalDate(currentDate)),
    [tier, currentDate],
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

  /** Everything inside the tier window, before the filter narrows it. */
  const inRange = useMemo(
    () => (cutoff ? entries.filter((e) => e.date >= cutoff) : entries),
    [entries, cutoff],
  );

  /** Per-kind totals — the filter chips carry their own weight this way, and a
   *  chip that would lead to an empty screen says so before it's tapped. */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inRange.length };
    for (const e of inRange) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [inRange]);

  const visible = useMemo(
    () => (filter === "all" ? inRange : inRange.filter((e) => e.kind === filter)),
    [inRange, filter],
  );

  const days = useMemo(() => {
    // Group into days, newest first. `entries` is already sorted, so this
    // preserves order without a second sort.
    const out: { date: string; rows: LogEntry[] }[] = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.rows.push(e);
      else out.push({ date: e.date, rows: [e] });
    }
    return out.slice(0, MAX_DAYS);
  }, [visible]);

  /** The last seven days as a shape — the screen's opening answer. */
  const week = useMemo(() => buildWeek(visible, currentDate), [visible, currentDate]);
  const weekTotal = week.reduce((n, d) => n + d.count, 0);
  const weekDays = week.filter((d) => d.count > 0).length;
  const weekPeak = week.reduce((m, d) => Math.max(m, d.count), 0);

  /*
   * WHERE THE "ADD" BUTTON WENT.
   *
   * This screen used to carry its own `+` in the top bar, opening a two-row
   * sheet for the two logs nothing else owns (check-in and weigh-in). The
   * Action Bar's quick-log half now offers both, plus meals, water and
   * training — a superset — from the bottom of this very screen.
   *
   * Two `+` buttons on one page, opening overlapping sheets, is precisely the
   * clutter the bar was added to remove. The entry points are unchanged in
   * kind, only in place: check-in and weigh-in are still entered from Logs.
   */

  const header = (
    <>
      <ScreenTopBar
        title="Logs"
        style={styles.topBar}
        titleRight={
          <AppText variant="footnote" color="tertiary">
            {counts.all} {counts.all === 1 ? "entry" : "entries"}
          </AppText>
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const n = counts[f.key] ?? 0;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${f.label.toLowerCase()}, ${n} ${n === 1 ? "entry" : "entries"}`}
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.primary : colors.surfaceMuted,
                  borderColor: on ? colors.primary : colors.border,
                  opacity: !on && n === 0 ? 0.45 : 1,
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
              {n > 0 && (
                <AppText
                  variant="caption"
                  weight="700"
                  color={on ? colors.onPrimary : "tertiary"}
                >
                  {n}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <Screen header={header} footer={<ActionBar />}>
      {/* Last seven days, at a glance. It sits above the ledger because the
          question people bring to a log screen is "how has my week gone", and
          a list of rows makes you do that arithmetic yourself. */}
      {visible.length > 0 && (
        <Reveal index={0}>
          <Card padding="lg" style={styles.weekCard}>
            <View style={styles.weekHead}>
              <View style={styles.flex}>
                <AppText variant="footnote" color="tertiary" uppercase>
                  Last 7 days
                </AppText>
                {/* Days, not entries — the count is already the hero on the
                    right, and consistency is the figure this screen is for. */}
                <AppText variant="subhead" color="secondary" style={styles.weekSub}>
                  {weekTotal === 0
                    ? "Nothing logged this week"
                    : `Active on ${weekDays} of 7 days`}
                </AppText>
              </View>
              <View style={styles.weekMetric}>
                <AppText variant="metric">{weekTotal}</AppText>
                <AppText variant="caption" color="tertiary">
                  {weekTotal === 1 ? "entry" : "entries"}
                </AppText>
              </View>
            </View>

            <View style={styles.spark}>
              {week.map((d) => (
                <View key={d.date} style={styles.sparkCol}>
                  <View style={styles.sparkTrack}>
                    <View
                      style={[
                        styles.sparkBar,
                        {
                          // A logged day is never a zero-height sliver — the
                          // floor is what separates "quiet" from "nothing".
                          height: weekPeak > 0 && d.count > 0
                            ? Math.max(6, (d.count / weekPeak) * SPARK_H)
                            : 3,
                          backgroundColor:
                            d.count === 0
                              ? alpha(colors.text, 0.08)
                              : d.isToday
                                ? colors.primary
                                : alpha(colors.primary, 0.45),
                        },
                      ]}
                    />
                  </View>
                  <AppText
                    variant="caption"
                    color={d.isToday ? "secondary" : "tertiary"}
                    weight={d.isToday ? "700" : "400"}
                  >
                    {d.letter}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        </Reveal>
      )}

      {days.length === 0 ? (
        <Reveal index={0}>
          <EmptyState
            icon="reader"
            tone="quiet"
            title={filter === "all" ? "Everything you log" : "This part of your log"}
            body={
              filter === "all"
                ? "Meals, workouts, weigh-ins and habits all land here in one timeline — it is what Gozlin reads when you ask why something changed."
                : "Nothing in this area yet. Switch the filter to see the rest of your log."
            }
            hint={
              filter === "all"
                ? "Tick a meal or finish a workout to start it"
                : undefined
            }
            style={styles.empty}
          />
        </Reveal>
      ) : (
        days.map((day, i) => (
          <Reveal key={day.date} index={Math.min(i + 1, 4)}>
            <View style={styles.day}>
              <View style={styles.dayHead}>
                <AppText variant="callout" weight="700">
                  {dayLabel(day.date, currentDate)}
                </AppText>
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
        <View style={[styles.value, { backgroundColor: alpha(tone, 0.12) }]}>
          <AppText variant="footnote" weight="700" color={tone} numberOfLines={1}>
            {entry.value}
          </AppText>
        </View>
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

/* ──────────────────────────────── The week ─────────────────────────────── */

interface WeekDay {
  date: string;
  letter: string;
  count: number;
  isToday: boolean;
}

/**
 * The last seven days ending today, each with how many entries landed on it.
 *
 * Built from the CURRENTLY FILTERED entries, so switching to "Workouts" redraws
 * the spark as a training week rather than leaving a total that no longer
 * matches the list under it. Days are emitted even when empty — a gap is the
 * most informative bar on the chart.
 */
function buildWeek(entries: LogEntry[], today: string): WeekDay[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.date, (counts.get(e.date) ?? 0) + 1);

  const anchor = parseLocalDate(today);
  const out: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    const date = toLocalDateString(d);
    out.push({
      date,
      // Monday-based letters, matching the rest of the app's week.
      letter: DAY_LETTERS[(d.getDay() + 6) % 7],
      count: counts.get(date) ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

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

/** Tallest a spark bar is allowed to get, in points. */
const SPARK_H = 42;

const styles = StyleSheet.create({
  flex: { flex: 1 },

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

  weekCard: { marginBottom: Spacing.xl },
  weekHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  weekSub: { marginTop: 2 },
  weekMetric: { alignItems: "flex-end" },
  spark: {
    flexDirection: "row",
    gap: Spacing.xs + 2,
    marginTop: Spacing.lg,
  },
  sparkCol: { flex: 1, alignItems: "center", gap: 6 },
  /** Fixed-height track so every bar grows from the same baseline. */
  sparkTrack: {
    height: SPARK_H,
    width: "100%",
    justifyContent: "flex-end",
  },
  sparkBar: { width: "100%", borderRadius: Radius.xs },

  day: { marginBottom: Spacing.xl },
  dayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },

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
  /** The right-hand figure gets a tinted plate so it reads as data, not prose. */
  value: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },

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
