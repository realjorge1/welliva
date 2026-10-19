/**
 * CycleCalendar — a month of her cycle.
 *
 * Logged period days are solid rose; forecasts are the same rose, lighter, and
 * reach three cycles ahead; the fertile window (lilac) shows only when she has
 * chosen to see it. A small dot under a day means she noted something about it.
 * Past days and today open the day sheet; the future can't be logged, so its
 * days aren't buttons.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { formatDay, monthGrid, monthLabel, type DayPaint } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useCyclePalette } from "./cycleTheme";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export interface CycleCalendarProps {
  cursor: { year: number; month: number };
  onPrev: () => void;
  onNext: () => void;
  today: string;
  paint: (date: string) => DayPaint;
  showFertile: boolean;
  onSelect: (date: string) => void;
}

function describe(date: string, paint: DayPaint, today: string): string {
  const parts = [formatDay(date, { weekday: true })];
  if (date === today) parts.push("today");
  if (paint.period === "logged") parts.push("period day");
  else if (paint.period === "assumed") parts.push("period day, end not logged");
  else if (paint.period === "predicted") parts.push("predicted period");
  if (paint.ovulation) parts.push("estimated ovulation");
  else if (paint.fertile) parts.push("fertile window, an estimate");
  if (paint.hasLog) parts.push("has notes");
  return parts.join(", ");
}

export function CycleCalendar({
  cursor,
  onPrev,
  onNext,
  today,
  paint,
  showFertile,
  onSelect,
}: CycleCalendarProps) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth - Spacing.screen * 2);
  const cell = width / 7;
  const disc = Math.max(28, Math.min(40, Math.floor(cell - 6)));
  const weeks = monthGrid(cursor.year, cursor.month);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.pager}>
        <Pressable
          onPress={onPrev}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={[styles.pagerBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <AppText variant="headline">{monthLabel(cursor.year, cursor.month)}</AppText>
        <Pressable
          onPress={onNext}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[styles.pagerBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <View key={`${d}-${i}`} style={[styles.cell, { width: cell }]}>
            <AppText variant="caption" color="tertiary">
              {d}
            </AppText>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map(({ date, inMonth }) => {
            if (!inMonth) return <View key={date} style={[styles.cell, { width: cell, height: disc + 12 }]} />;
            const p = paint(date);
            const isToday = date === today;
            const future = date > today;
            let fill = "transparent";
            let ink: string = future ? colors.textTertiary : colors.text;
            let weight: "500" | "700" | "800" = "500";
            if (p.period === "logged") {
              fill = palette.period;
              ink = palette.onPeriod;
              weight = "800";
            } else if (p.period === "assumed") {
              fill = palette.periodAhead;
              ink = colors.text;
              weight = "700";
            } else if (p.period === "predicted") {
              fill = palette.predicted;
              ink = palette.predictedInk;
              weight = "700";
            } else if (showFertile && p.fertile) {
              fill = palette.fertileSoft;
              ink = palette.fertile;
              weight = "700";
            }
            const day = Number(date.slice(8, 10));
            return (
              <Pressable
                key={date}
                disabled={future}
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityState={{ disabled: future }}
                accessibilityLabel={describe(date, p, today)}
                style={({ pressed }) => [
                  styles.cell,
                  { width: cell, height: disc + 12, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.disc,
                    {
                      width: disc,
                      height: disc,
                      borderRadius: disc / 2,
                      backgroundColor: fill,
                      borderWidth: isToday ? 2 : 0,
                      borderColor: isToday ? colors.text : "transparent",
                    },
                  ]}
                >
                  <AppText
                    variant="subhead"
                    style={{ color: ink, fontWeight: weight }}
                    maxFontSizeMultiplier={1.2}
                  >
                    {day}
                  </AppText>
                  {showFertile && p.ovulation ? (
                    <View style={[styles.ovulation, { backgroundColor: palette.ovulation }]} />
                  ) : null}
                </View>
                <View
                  style={[
                    styles.logDot,
                    { backgroundColor: p.hasLog ? alpha(colors.text, 0.55) : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <Legend color={palette.period} label="Period" />
        <Legend color={palette.predicted} label="Predicted" />
        {showFertile ? <Legend color={palette.fertileSoft} ink={palette.fertile} label="Fertile (estimate)" /> : null}
        <View style={styles.legendItem}>
          <View style={[styles.legendLogDot, { backgroundColor: alpha(colors.text, 0.55) }]} />
          <AppText variant="caption" color="tertiary">
            Notes
          </AppText>
        </View>
      </View>
    </View>
  );
}

function Legend({ color, ink, label }: { color: string; ink?: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color, borderColor: ink ?? color }]} />
      <AppText variant="caption" color="tertiary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  pagerBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row" },
  cell: { alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  disc: { alignItems: "center", justifyContent: "center" },
  ovulation: { position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2 },
  logDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 0 },
  legendLogDot: { width: 5, height: 5, borderRadius: 2.5 },
});
