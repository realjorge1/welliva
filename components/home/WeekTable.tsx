/**
 * WeekTable — "Your week": the streak and the last seven days, in one card.
 *
 * The streak strip and this table used to sit apart on Home and tell the same
 * story twice — a row of week discs, then a table of the same week (owner,
 * 2026-10-31: "they pretty much tell the same thing — can they be one?"). Now
 * the table carries the streak: the flame and the count at the top, and a row of
 * flames in the grid itself, one per day, lit where the day was kept. The days
 * are the table's — the last seven, today on the right — and which were kept is
 * read off the same dated ledger as everything else (services/commitment).
 *
 * THE FLAME MOVES WHEN IT IS LIT. Scroll down to the card on a kept day and the
 * flame catches — the grey shell shivers, the fire grows out of its foot — then
 * flickers for a few breaths and settles. Arriving from above it is already lit
 * and just flickers. It is a bounded animation on purpose: a flame that flickers
 * forever on Home is a cost the 1 GB phones pay on every frame (see
 * welliva-low-end-perf), so it plays when you look and then stays still. A day
 * that is not kept yet shows the grey flame, still.
 *
 * What each row counts, and why an empty day is a dash and never a zero, is in
 * ./weekGrid.ts. The grid is built row by row (not column by column) so a label
 * that wraps at a large system font grows its own row and every cell beside it
 * follows; today's column is a tint on each row's last cell, which joins into
 * one rounded strip because the rows touch.
 */
import { Flame, FlameGlyph, FLAME_COLORS } from "@/components/celebration/Flame";
import { AppText, Mono, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useSystem, useWorkout } from "@/contexts/AppContext";
import { getWaterHistory, type WaterHistoryEntry } from "@/services/OfflineStorage";
import {
  commitmentStatus,
  keptOn,
  pausedOn,
  readCommitment,
  shiftDay,
  type StreakLike,
} from "@/services/commitment";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { runOnJS, useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { HOME_ORANGE, INSTRUMENT_CARD } from "./surface";
import { TileHeader } from "./TileHeader";
import { buildWeekTable } from "./weekGrid";

/**
 * Width of the row-label column; the seven days share what is left. On the
 * narrowest phone that is ~29pt a day, which a four-digit reading just fits —
 * and past that the readings shrink (see the cell) rather than wrap mid-number.
 */
const LABEL_WIDTH = 64;
const CORNER = Radius.md;
/** The streak's flame, top left. */
const FLAME = 34;
/** A day's flame in the grid. */
const DAY_FLAME = 14;
/** Flicker loops after the flame is lit, then it settles still. */
const FLICKER_CYCLES = 3;

type Play = { n: number; mode: "light" | "still" };

/** Day 1–7 of a fresh start that began on `start`, or null outside that week. */
function freshDayOf(start: string | null | undefined, today: string): number | null {
  if (!start || start > today) return null;
  let n = 1;
  for (let d = start; d < today && n <= 7; d = shiftDay(d, 1)) n++;
  return n <= 7 ? n : null;
}

export const WeekTable = React.memo(function WeekTable({
  streak,
  entrance,
  freshStart,
  footer,
  style,
}: {
  streak: StreakLike;
  /** 0 wait · 1 play · 2 show finished — when the flame plays (Home's scroll). */
  entrance?: SharedValue<number>;
  /**
   * The first day of a "start fresh" week (services/smart/welcomeBack). For
   * the seven days from it, the card leads with "Fresh start · day N" and
   * shows only the days since — not a row of empty ones from the time away.
   * History stays whole everywhere else (All logs, charts, Memory).
   */
  freshStart?: string | null;
  /** Under the status line — the rough-day entry lives here. */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const router = useRouter();
  const { currentDate } = useSystem();
  const { dietHistory, consumedNutrition } = useNutrition();
  const { workoutLog } = useWorkout();

  // Hydration is archived to storage at day-end rather than held in a context,
  // so it is the one ledger this card has to go and fetch.
  const [water, setWater] = useState<WaterHistoryEntry[]>([]);
  useEffect(() => {
    let alive = true;
    void getWaterHistory().then((h) => {
      if (alive) setWater(h);
    });
    return () => {
      alive = false;
    };
  }, [currentDate]);

  const calories = consumedNutrition.calories;
  const waterMl = consumedNutrition.waterMl ?? 0;
  const table = useMemo(
    () =>
      buildWeekTable({
        today: currentDate,
        dietHistory,
        workoutLog,
        waterHistory: water,
        live: { calories, waterMl },
      }),
    [currentDate, dietHistory, workoutLog, water, calories, waterMl],
  );

  const state = useMemo(() => readCommitment(streak, currentDate), [streak, currentDate]);
  const kept = useMemo(
    () => keptOn(streak, table.columns.map((c) => c.date)),
    [streak, table.columns],
  );
  // Protected rough days: the streak's quiet mark, neither lit nor missed.
  const paused = useMemo(
    () => pausedOn(streak, table.columns.map((c) => c.date)),
    [streak, table.columns],
  );
  // A fresh start shows the days since it began — not the empty ones before.
  const freshDay = freshDayOf(freshStart, currentDate);
  const from =
    freshDay != null && freshStart
      ? Math.max(0, table.columns.findIndex((c) => c.date >= freshStart))
      : 0;
  const columns = table.columns.slice(from);
  const keptShown = kept.slice(from);
  const pausedShown = paused.slice(from);
  const caption =
    state.totalDays > 0
      ? `Best ${state.best} · ${state.totalDays} ${state.totalDays === 1 ? "day" : "days"} kept`
      : "Your first flame is one log away";

  /* ── When the flame plays ─────────────────────────────────────────────── */
  const [play, setPlay] = useState<Play | null>(entrance ? null : { n: 1, mode: "still" });
  const onSignal = useCallback((signal: number) => {
    if (signal === 0) setPlay(null);
    else setPlay((p) => ({ n: (p?.n ?? 0) + 1, mode: signal === 1 ? "light" : "still" }));
  }, []);
  useAnimatedReaction(
    () => (entrance ? entrance.value : -1),
    (signal, prev) => {
      if (signal >= 0 && signal !== prev) runOnJS(onSignal)(signal);
    },
    [entrance, onSignal],
  );
  // Today turning kept while the card is on screen lights it there and then.
  const wasKept = useRef(state.keptToday);
  useEffect(() => {
    if (state.keptToday && !wasKept.current) {
      setPlay((p) => (p ? { n: p.n + 1, mode: "light" } : p));
    }
    wasKept.current = state.keptToday;
  }, [state.keptToday]);

  const tint = alpha(HOME_ORANGE, 0.1);
  const rows = table.hasData ? table.rows : [];
  const lastRow = rows.length; // the flame row is row 0

  const link = (
    <Pressable
      onPress={() => router.navigate("/logs" as never)}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityLabel="Open all logs"
    >
      <AppText variant="footnote" weight="600" color="secondary" style={styles.link}>
        All logs
      </AppText>
    </Pressable>
  );

  return (
    <View style={[INSTRUMENT_CARD, style]}>
      <TileHeader label="Your week" right={link} />
      {freshDay != null ? (
        <AppText variant="footnote" weight="700" style={[styles.fresh, { color: HOME_ORANGE }]}>
          Fresh start · day {freshDay}
        </AppText>
      ) : null}

      {/* ── The streak ── */}
      <View
        style={styles.streak}
        accessible
        accessibilityLabel={`${state.streak} day streak. ${caption}. ${
          state.keptToday ? "Today is kept." : "Today is not kept yet."
        }`}
      >
        <View style={styles.flameBox}>
          {state.keptToday && play ? (
            <Flame
              key={play.n}
              size={FLAME}
              entrance={play.mode}
              flickerCycles={FLICKER_CYCLES}
            />
          ) : (
            <FlameGlyph size={FLAME} unlit={!state.keptToday} dark />
          )}
        </View>
        <AppText
          variant="display"
          weight="800"
          style={[
            styles.count,
            { color: state.keptToday ? FLAME_COLORS.outer : colors.text },
          ]}
        >
          {state.streak}
        </AppText>
        <View style={styles.streakText}>
          <AppText variant="callout" weight="700" numberOfLines={1}>
            day streak
          </AppText>
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {caption}
          </AppText>
        </View>
      </View>

      {/* ── The grid ── */}
      <View style={styles.grid}>
        {/* Day headers. */}
        <View style={[styles.row, styles.headRow]}>
          <View style={styles.labelCell} />
          {columns.map((c) => (
            <View
              key={c.date}
              style={[
                styles.cell,
                c.isToday && { backgroundColor: tint },
                c.isToday && styles.todayTop,
              ]}
            >
              <Mono size={11} tracking={0.4} color={c.isToday ? HOME_ORANGE : colors.textTertiary}>
                {c.label}
              </Mono>
              <Mono size={11} color={c.isToday ? HOME_ORANGE : colors.textTertiary}>
                {c.dayOfMonth}
              </Mono>
            </View>
          ))}
        </View>

        {/* Kept days — a flame each, lit or grey. */}
        <View
          style={[
            styles.row,
            { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={styles.labelCell}>
            <AppText variant="footnote" color="secondary" numberOfLines={1}>
              Streak
            </AppText>
            <Mono size={11} color={colors.textTertiary}>
              kept
            </Mono>
          </View>
          {columns.map((c, ci) => (
            <View
              key={c.date}
              style={[
                styles.cell,
                c.isToday && { backgroundColor: tint },
                c.isToday && lastRow === 0 && styles.todayBottom,
              ]}
              accessible
              accessibilityLabel={`${c.label}: ${
                keptShown[ci]
                  ? "kept"
                  : pausedShown[ci]
                    ? "rough day, streak paused"
                    : c.isToday
                      ? "not kept yet"
                      : "missed"
              }`}
            >
              {pausedShown[ci] ? (
                // A rough day that paused the streak: its own quiet mark —
                // neither a lit flame nor a missed one.
                <Ionicons name="pause" size={DAY_FLAME - 2} color={colors.textTertiary} />
              ) : (
                <FlameGlyph size={DAY_FLAME} unlit={!keptShown[ci]} dark />
              )}
            </View>
          ))}
        </View>

        {rows.map((r, ri) => (
          <View
            key={r.key}
            style={[
              styles.row,
              { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.labelCell}>
              <AppText
                variant="footnote"
                color="secondary"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {r.label}
              </AppText>
              <Mono size={11} color={colors.textTertiary}>
                {r.unit}
              </Mono>
            </View>
            {r.cells.slice(from).map((value, ci) => {
              const today = columns[ci].isToday;
              return (
                <View
                  key={columns[ci].date}
                  style={[
                    styles.cell,
                    today && { backgroundColor: tint },
                    today && ri + 1 === lastRow && styles.todayBottom,
                  ]}
                >
                  <Mono
                    size={11}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    color={value == null ? colors.textTertiary : colors.text}
                    accessibilityLabel={
                      value == null
                        ? `${r.label}, ${columns[ci].label}: nothing logged`
                        : `${r.label}, ${columns[ci].label}: ${value} ${r.unit}`
                    }
                  >
                    {value ?? "–"}
                  </Mono>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {!table.hasData ? (
        <AppText variant="subhead" color="tertiary" style={styles.empty}>
          Log a meal, a drink or a workout and your week fills in here.
        </AppText>
      ) : null}

      <View style={[styles.rule, { backgroundColor: colors.divider }]} />
      <AppText variant="footnote" color="tertiary" align="center">
        {commitmentStatus(state)}
      </AppText>
      {footer}
    </View>
  );
});

const styles = StyleSheet.create({
  link: { textDecorationLine: "underline" },
  fresh: { marginTop: Spacing.xs },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  // Holds the flame's place whichever version is drawn, so lighting it never
  // shifts the count beside it.
  flameBox: { width: FLAME, height: FLAME * 1.25 },
  count: { fontVariant: ["tabular-nums"] },
  streakText: { flex: 1, gap: 1 },
  grid: { marginTop: Spacing.lg },
  row: { flexDirection: "row", alignItems: "stretch" },
  headRow: { minHeight: 40 },
  labelCell: { width: LABEL_WIDTH, justifyContent: "center", paddingVertical: 8 },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  todayTop: { borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER },
  todayBottom: { borderBottomLeftRadius: CORNER, borderBottomRightRadius: CORNER },
  empty: { marginTop: Spacing.md },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.lg, marginBottom: Spacing.md },
});
