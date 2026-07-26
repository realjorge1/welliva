/**
 * PlanDurationPicker — "for how long?"
 *
 * Day / Week / Custom. Custom opens a calendar that scrolls forward
 * indefinitely, because the requirement is explicitly that a plan can run for
 * more than a month or several months — so the calendar is a paged month list
 * rather than a fixed range, and the end date is chosen by tapping a day.
 *
 * The picker deliberately shows the resolved window ("Mon 21 Jul → Sun 14 Sep ·
 * 8 weeks") for every option including the presets. A user committing to a
 * stretch of eating should see the actual dates before they commit, not after.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import {
  addDays,
  daysBetween,
  formatDuration,
  parseLocalDate,
  resolveEndDate,
  toLocalDate,
  type PlanDuration,
} from "@/models/mealPlan";
import * as Haptics from "@/utils/haptics";

export interface PlanDurationPickerProps {
  startDate: string;
  value: PlanDuration;
  customEndDate: string | null;
  onChange: (duration: PlanDuration, customEndDate: string | null) => void;
  /** How many months the calendar can scroll forward. */
  monthsAhead?: number;
}

const OPTIONS: { key: PlanDuration; label: string; hint: string; icon: string }[] = [
  { key: "day", label: "Just today", hint: "One day", icon: "today-outline" },
  { key: "week", label: "This week", hint: "7 days", icon: "calendar-outline" },
  { key: "custom", label: "Custom", hint: "Pick an end date", icon: "calendar-number-outline" },
];

export function PlanDurationPicker({
  startDate,
  value,
  customEndDate,
  onChange,
  monthsAhead = 18,
}: PlanDurationPickerProps) {
  const { colors } = useColors();

  const endDate = resolveEndDate(startDate, value, customEndDate ?? undefined);
  const totalDays = daysBetween(startDate, endDate) + 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.options}>
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                // Seed custom with a sensible month so the summary is never blank.
                onChange(
                  opt.key,
                  opt.key === "custom"
                    ? (customEndDate ?? addDays(startDate, 29))
                    : null,
                );
              }}
              style={[
                styles.option,
                {
                  backgroundColor: active ? `${colors.primary}14` : "transparent",
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={opt.icon as never}
                size={20}
                color={active ? colors.primary : colors.textSecondary}
              />
              <AppText variant="caption" weight="700" align="center">
                {opt.label}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                {opt.hint}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* The resolved window — shown for every option, not just custom. */}
      <View style={[styles.summary, { borderColor: colors.border }]}>
        <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
        <AppText variant="caption" color="textSecondary">
          {formatLong(startDate)} → {formatLong(endDate)} ·{" "}
          <AppText variant="caption" weight="700">
            {formatDuration(totalDays)}
          </AppText>
        </AppText>
      </View>

      {value === "custom" ? (
        <MonthCalendar
          startDate={startDate}
          selected={customEndDate}
          monthsAhead={monthsAhead}
          onSelect={(date) => {
            Haptics.selectionAsync().catch(() => {});
            onChange("custom", date);
          }}
        />
      ) : null}
    </View>
  );
}

// ============================================================================
// CALENDAR
// ============================================================================

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function MonthCalendar({
  startDate,
  selected,
  monthsAhead,
  onSelect,
}: {
  startDate: string;
  selected: string | null;
  monthsAhead: number;
  onSelect: (date: string) => void;
}) {
  const { colors } = useColors();
  const [offset, setOffset] = useState(0);

  const start = parseLocalDate(startDate);
  const month = useMemo(() => {
    const d = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    return d;
  }, [start, offset]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);

  return (
    <Card padding="lg">
      <View style={styles.calHeader}>
        <Pressable
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          hitSlop={10}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={offset === 0 ? colors.border : colors.text}
          />
        </Pressable>
        <AppText variant="body" weight="700">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </AppText>
        <Pressable
          onPress={() => setOffset((o) => Math.min(monthsAhead, o + 1))}
          disabled={offset >= monthsAhead}
          hitSlop={10}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={offset >= monthsAhead ? colors.border : colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <AppText
            key={i}
            variant="caption"
            color="textSecondary"
            weight="700"
            align="center"
            style={styles.cell}
          >
            {d}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;

          // The end date can't precede the start; earlier days are inert.
          const isBefore = date < startDate;
          const isStart = date === startDate;
          const isSelected = date === selected;
          const inRange =
            selected !== null && date > startDate && date < selected;

          return (
            <Pressable
              key={date}
              disabled={isBefore}
              onPress={() => onSelect(date)}
              style={[
                styles.cell,
                styles.dayCell,
                inRange ? { backgroundColor: `${colors.primary}14` } : null,
                isSelected || isStart
                  ? { backgroundColor: colors.primary, borderRadius: Radius.md }
                  : null,
              ]}
            >
              <AppText
                variant="caption"
                weight={isSelected || isStart ? "800" : "500"}
                style={{
                  color: isSelected || isStart
                    ? colors.background
                    : isBefore
                      ? colors.border
                      : colors.text,
                }}
              >
                {Number(date.slice(8, 10))}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.quickRow}>
        {[
          { label: "2 weeks", days: 13 },
          { label: "1 month", days: 29 },
          { label: "3 months", days: 89 },
          { label: "6 months", days: 179 },
        ].map((q) => (
          <Pressable
            key={q.label}
            onPress={() => onSelect(addDays(startDate, q.days))}
            style={[styles.quickChip, { borderColor: colors.border }]}
          >
            <AppText variant="caption" weight="600">
              {q.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/**
 * Month grid padded to a Monday-first week. Returns null for leading blanks so
 * the calling grid keeps a stable 7-column rhythm.
 */
function buildMonthGrid(month: Date): (string | null)[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  // getDay(): 0=Sun. Shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;

  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toLocalDate(new Date(year, m, d)));
  }
  return cells;
}

function formatLong(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  options: { flexDirection: "row", gap: Spacing.sm },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  weekRow: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1 },
  dayCell: { alignItems: "center", justifyContent: "center" },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
