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
 *
 * ── TWO KINDS OF "CUSTOM" ───────────────────────────────────────────────────
 * `customKind="range"` (the default, used when starting a DIET) means "pick an
 * end date": the plan then runs every day from here to there, because a diet
 * generates days for you and a diet with holes in it isn't a diet.
 *
 * `customKind="dates"` (used by "plan your own menu") means "pick the days" —
 * any number of them, in any month, contiguous or not. Hand-planning is exactly
 * the case where someone wants the 5th, the 9th and next Saturday and nothing in
 * between, so tapping a day toggles it rather than closing a range.
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
  /** What "Custom" means here. See the two-kinds note at the top of the file. */
  customKind?: "range" | "dates";
  /** The days picked so far, when customKind is "dates". */
  selectedDates?: string[];
  onDatesChange?: (dates: string[]) => void;
}

const OPTIONS: { key: PlanDuration; label: string; icon: string }[] = [
  { key: "day", label: "Just today", icon: "today-outline" },
  { key: "week", label: "This week", icon: "calendar-outline" },
  { key: "custom", label: "Custom", icon: "calendar-number-outline" },
];

export function PlanDurationPicker({
  startDate,
  value,
  customEndDate,
  onChange,
  monthsAhead = 18,
  customKind = "range",
  selectedDates,
  onDatesChange,
}: PlanDurationPickerProps) {
  const { colors } = useColors();

  const picksDates = customKind === "dates";
  const picked = useMemo(
    () => [...new Set(selectedDates ?? [])].sort(),
    [selectedDates],
  );
  const endDate = resolveEndDate(startDate, value, customEndDate ?? undefined);
  const totalDays = daysBetween(startDate, endDate) + 1;

  const hint = (key: PlanDuration): string => {
    if (key === "day") return "One day";
    if (key === "week") return "7 days";
    return picksDates ? "Pick the days" : "Pick an end date";
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.options}>
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label}, ${hint(opt.key)}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                // In dates mode there is no end date to seed — the days the user
                // taps ARE the schedule. Otherwise seed custom with a sensible
                // month so the summary is never blank.
                onChange(
                  opt.key,
                  opt.key === "custom" && !picksDates
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
              <AppText variant="caption" color="secondary" align="center">
                {hint(opt.key)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* What was chosen, resolved — shown for every option, not just custom.
          Picked days get counted rather than bracketed: "Fri 5 → Sat 20" would
          claim a fortnight the user never asked for. */}
      <View style={[styles.summary, { borderColor: colors.border }]}>
        <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
        {value === "custom" && picksDates ? (
          <AppText variant="caption" color="secondary" style={styles.flex}>
            {picked.length === 0
              ? "Tap the days you want to plan — as many as you like."
              : picked.length === 1
                ? formatLong(picked[0] as string)
                : `${picked.length} days picked · ${formatLong(picked[0] as string)} → ${formatLong(
                    picked[picked.length - 1] as string,
                  )}`}
          </AppText>
        ) : (
          <AppText variant="caption" color="secondary" style={styles.flex}>
            {formatLong(startDate)} → {formatLong(endDate)} ·{" "}
            <AppText variant="caption" weight="700">
              {formatDuration(totalDays)}
            </AppText>
          </AppText>
        )}
      </View>

      {value === "custom" ? (
        picksDates ? (
          <MonthCalendar
            startDate={startDate}
            multi={picked}
            monthsAhead={monthsAhead}
            onSelect={(date) => {
              Haptics.selectionAsync().catch(() => {});
              const next = picked.includes(date)
                ? picked.filter((d) => d !== date)
                : [...picked, date].sort();
              onDatesChange?.(next);
            }}
            onClear={
              picked.length > 0 ? () => onDatesChange?.([]) : undefined
            }
          />
        ) : (
          <MonthCalendar
            startDate={startDate}
            selected={customEndDate}
            monthsAhead={monthsAhead}
            onSelect={(date) => {
              Haptics.selectionAsync().catch(() => {});
              onChange("custom", date);
            }}
          />
        )
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
  selected = null,
  multi,
  monthsAhead,
  onSelect,
  onClear,
}: {
  startDate: string;
  /** End-date mode: the one day that closes the range. */
  selected?: string | null;
  /** Days mode: every day picked so far. Its presence switches the mode. */
  multi?: string[];
  monthsAhead: number;
  onSelect: (date: string) => void;
  onClear?: () => void;
}) {
  const { colors } = useColors();
  const [offset, setOffset] = useState(0);
  const multiMode = multi !== undefined;
  const pickedSet = useMemo(() => new Set(multi ?? []), [multi]);

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
          accessibilityRole="button"
          accessibilityLabel="Previous month"
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
          accessibilityRole="button"
          accessibilityLabel="Next month"
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
            color="secondary"
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

          // A plan can't be made for a day that's already gone; earlier days
          // are inert. In days mode the start date is an ordinary day — the user
          // may well not want to plan today — so it is only filled if picked.
          const isBefore = date < startDate;
          const isStart = !multiMode && date === startDate;
          const isSelected = multiMode
            ? pickedSet.has(date)
            : date === selected;
          const inRange =
            !multiMode && selected !== null && date > startDate && date < selected;
          const filled = isSelected || isStart;
          // The two ends of a range carry the band too, or the circles now
          // sitting on them would punch a hole in each end of it.
          const banded =
            inRange ||
            (!multiMode && selected !== null && selected !== startDate && filled);

          // The day the schedule is anchored to — today, for every caller. Read
          // off startDate rather than the clock: this component has no business
          // owning a second one.
          const isAnchor = date === startDate;

          /*
           * THE MARK GOES ON A CIRCLE INSIDE THE CELL, NOT ON THE CELL.
           * Filling the whole 1/7-wide square made the selection a slab that
           * ran edge to edge and fused with its neighbours — two picked days in
           * a row read as one block, and nothing looked like it was marking a
           * date. The cell stays the touch target; a circle sits inside it.
           * Only the range tint spans the full cell, because a range is
           * supposed to read as one continuous band.
           */
          return (
            <Pressable
              key={date}
              disabled={isBefore}
              onPress={() => onSelect(date)}
              accessibilityRole={multiMode ? "checkbox" : "button"}
              accessibilityState={multiMode ? { checked: isSelected } : undefined}
              accessibilityLabel={formatLong(date)}
              style={[
                styles.cell,
                styles.dayCell,
                banded ? { backgroundColor: `${colors.primary}14` } : null,
              ]}
            >
              <View
                style={[
                  styles.dayPill,
                  filled ? { backgroundColor: colors.primary } : null,
                  // Today keeps a ring when it isn't picked — in days mode it is
                  // an ordinary day, so without one the grid has no anchor.
                  !filled && isAnchor
                    ? { borderWidth: 1.5, borderColor: colors.primary }
                    : null,
                ]}
              >
                <AppText
                  variant="caption"
                  weight={filled ? "800" : "500"}
                  style={{
                    color: filled
                      ? colors.background
                      : isBefore
                        ? colors.border
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

      <View style={styles.quickRow}>
        {multiMode ? (
          onClear ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear all picked days"
              style={[styles.quickChip, { borderColor: colors.border }]}
            >
              <AppText variant="caption" weight="600">
                Clear picked days
              </AppText>
            </Pressable>
          ) : null
        ) : (
          [
            { label: "2 weeks", days: 13 },
            { label: "1 month", days: 29 },
            { label: "3 months", days: 89 },
            { label: "6 months", days: 179 },
          ].map((q) => (
            <Pressable
              key={q.label}
              onPress={() => onSelect(addDays(startDate, q.days))}
              accessibilityRole="button"
              accessibilityLabel={`End after ${q.label}`}
              style={[styles.quickChip, { borderColor: colors.border }]}
            >
              <AppText variant="caption" weight="600">
                {q.label}
              </AppText>
            </Pressable>
          ))
        )}
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
  flex: { flex: 1 },
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
  /*
   * Sized as a share of the cell rather than in points, so the circle keeps its
   * proportion (and its gap from the next day) on a 320pt phone and a tablet
   * alike. aspectRatio holds it round; the large radius rounds whatever that
   * resolves to.
   */
  dayPill: {
    width: "76%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
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
