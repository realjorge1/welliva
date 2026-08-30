/**
 * Plan my own menu — hand-pick meals per day and slot, following no diet.
 *
 * "Monday morning: moi-moi. Thursday evening: mac and cheese."
 *
 * The defining behaviour of custom mode is that IT NEVER FILLS A GAP. A slot
 * the user didn't pick stays empty, and the end-of-period report excludes empty
 * days from adherence rather than scoring them as failures. Auto-filling would
 * defeat the whole reason someone chooses this mode over a diet.
 *
 * Because planning a month by hand is otherwise unbearable, "copy this day" and
 * "repeat this week" are first-class buttons rather than a power-user feature.
 *
 * ── THE WHOLE SLOT IS THE BUTTON ────────────────────────────────────────────
 * A "+" used to be the only way into the picker, which put the entire feature
 * behind a 24pt target in the corner of a card whose other 300pt did nothing.
 * The card opens the picker now and the "+" is a plain glyph: it says a meal can
 * go here, it isn't the only place you may say so. A filled slot opens the
 * picker too — changing your mind is the same gesture as making up your mind.
 *
 * ── WHERE A PICK GOES ───────────────────────────────────────────────────────
 * Straight onto the calendar. contexts/MealPlanContext projects each write into
 * the schedule store, so a meal planned here is the meal the Diet screen serves
 * on the day, tickable and counted. See services/CustomMenuSchedule for why that
 * projection exists rather than a second reader.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { MealPickerSheet, type MealPickResult } from "@/components/diet/MealPickerSheet";
import { PlanDurationPicker } from "@/components/diet/PlanDurationPicker";
import { alpha, Radius, Spacing } from "@/constants/theme";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { useProfile, useSystem } from "@/contexts/AppContext";
import type { MealType } from "@/models/diet";
import {
  addDays,
  dateRange,
  parseLocalDate,
  resolveEndDate,
  toLocalDate,
  type CustomMenuEntry,
  type PlanDuration,
} from "@/models/mealPlan";
import * as Haptics from "@/utils/haptics";

const SLOTS: { key: MealType; label: string; icon: string; when: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline", when: "Morning" },
  { key: "lunch", label: "Lunch", icon: "partly-sunny-outline", when: "Midday" },
  { key: "dinner", label: "Dinner", icon: "moon-outline", when: "Evening" },
  { key: "snack", label: "Snacks", icon: "cafe-outline", when: "Any time" },
];

export default function PlanMenuScreen() {
  const { colors } = useColors();
  const { currentDate } = useSystem();
  const { userBio } = useProfile();
  const {
    activePeriod,
    startPeriod,
    getCustomEntries,
    setCustomMeal,
    removeCustomMeal,
    copyDayTo,
    repeatWeekPattern,
    plannedDates,
    savedMeals,
    saveMealForReuse,
  } = useMealPlan();

  const isCustom = activePeriod?.mode === "custom";

  // --- Setup state (only used before a custom period exists) ---------------
  const [duration, setDuration] = useState<PlanDuration>("week");
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // --- Planning state ------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [entries, setEntries] = useState<CustomMenuEntry[]>([]);
  const [picking, setPicking] = useState<MealType | null>(null);

  const loadDay = useCallback(
    async (date: string) => setEntries(await getCustomEntries(date)),
    [getCustomEntries],
  );

  useEffect(() => {
    if (isCustom) void loadDay(selectedDate);
  }, [isCustom, selectedDate, loadDay, plannedDates.length]);

  // Keep the selected day inside the period window.
  useEffect(() => {
    if (!activePeriod) return;
    if (selectedDate < activePeriod.startDate) setSelectedDate(activePeriod.startDate);
    else if (selectedDate > activePeriod.endDate) setSelectedDate(activePeriod.endDate);
  }, [activePeriod, selectedDate]);

  // ========================================================================
  // SETUP — no custom period running yet
  // ========================================================================
  if (!isCustom) {
    const start = currentDate;
    const end = resolveEndDate(start, duration, customEnd ?? undefined);

    return (
      <Screen scroll contentStyle={styles.body}>
        <ScreenHeader title="Plan your own menu" />

        <Card padding="lg">
          <AppText variant="body" weight="700">
            No diet, just your food
          </AppText>
          <AppText variant="caption" color="secondary" style={styles.para}>
            {`Pick exactly what you want to eat on each day. Days you don't fill in stay empty — nothing gets chosen for you, and empty days aren't counted against you at the end.`}
          </AppText>
        </Card>

        <AppText variant="body" weight="700">
          How long?
        </AppText>
        <PlanDurationPicker
          startDate={start}
          value={duration}
          customEndDate={customEnd}
          onChange={(d, ce) => {
            setDuration(d);
            setCustomEnd(ce);
          }}
        />

        <Button
          label={starting ? "Setting up…" : "Start planning"}
          icon="create-outline"
          fullWidth
          loading={starting}
          onPress={async () => {
            setStarting(true);
            try {
              await startPeriod({
                mode: "custom",
                label: "My menu",
                durationKind: duration,
                startDate: start,
                customEndDate: end,
              });
              setSelectedDate(start);
            } finally {
              setStarting(false);
            }
          }}
        />
        {activePeriod ? (
          <AppText variant="caption" color="secondary" align="center">
            This will end your current {activePeriod.label} plan.
          </AppText>
        ) : null}
      </Screen>
    );
  }

  // ========================================================================
  // PLANNING
  // ========================================================================
  const days = dateRange(activePeriod.startDate, activePeriod.endDate);
  const plannedSet = new Set(plannedDates);
  const bySlot = (slot: MealType) => entries.filter((e) => e.slot === slot);

  /** Midpoint calories across everything planned for the selected day. */
  const dayCalories = entries.reduce(
    (sum, e) => sum + Math.round((e.meal.calories.min + e.meal.calories.max) / 2),
    0,
  );

  const handlePick = async (result: MealPickResult) => {
    if (!picking) return;
    await setCustomMeal({
      date: selectedDate,
      slot: picking,
      meal: {
        ...result.meal,
        id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        isConsumed: false,
      },
      ...(result.nutrients ? { nutrients: result.nutrients } : {}),
    });
    if (result.saveForReuse) {
      await saveMealForReuse({
        name: result.meal.name,
        defaultSlot: picking,
        meal: result.meal,
        ...(result.nutrients ? { nutrients: result.nutrients } : {}),
      });
    }
    setPicking(null);
    await loadDay(selectedDate);
  };

  return (
    <Screen scroll contentStyle={styles.body}>
      <ScreenHeader title={activePeriod.label} />

      <AppText variant="caption" color="secondary">
        {fmt(activePeriod.startDate)} – {fmt(activePeriod.endDate)} · {days.length} days ·{" "}
        {plannedDates.length} planned
      </AppText>

      {/* --- Day strip ----------------------------------------------------- */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.strip}>
          {days.map((date) => {
            const active = date === selectedDate;
            const hasPlan = plannedSet.has(date);
            const isToday = date === currentDate;
            return (
              <Pressable
                key={date}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedDate(date);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${longDay(date)}${hasPlan ? ", planned" : ", nothing planned"}`}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: active ? colors.primary : "transparent",
                    borderColor: active
                      ? colors.primary
                      : isToday
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: active ? colors.background : colors.textSecondary }}
                >
                  {parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short" })}
                </AppText>
                <AppText
                  variant="body"
                  weight="800"
                  style={{ color: active ? colors.background : colors.text }}
                >
                  {Number(date.slice(8, 10))}
                </AppText>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: hasPlan
                        ? active
                          ? colors.background
                          : colors.primary
                        : "transparent",
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* --- The selected day ---------------------------------------------- */}
      <View style={styles.dayHeader}>
        <View style={styles.flex}>
          <AppText variant="headline" weight="700">
            {longDay(selectedDate)}
          </AppText>
          <AppText variant="footnote" color="tertiary">
            {entries.length === 0
              ? "Nothing planned yet"
              : `${entries.length} meal${entries.length === 1 ? "" : "s"} · about ${dayCalories} kcal`}
          </AppText>
        </View>
        {selectedDate === currentDate ? (
          <View style={[styles.todayPill, { backgroundColor: alpha(colors.primary, 0.14) }]}>
            <AppText variant="caption" weight="700" style={{ color: colors.primary }}>
              TODAY
            </AppText>
          </View>
        ) : null}
      </View>

      {/* --- Slots --------------------------------------------------------- */}
      {SLOTS.map((slot) => {
        const picked = bySlot(slot.key);
        const filled = picked.length > 0;
        return (
          <Card
            key={slot.key}
            padding="lg"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setPicking(slot.key);
            }}
            accessibilityLabel={
              filled
                ? `${slot.label}: ${picked.map((e) => e.meal.name).join(", ")}. Change it.`
                : `${slot.label}, nothing planned. Choose a meal.`
            }
            accessibilityHint="Opens the meal picker"
          >
            <View style={styles.slotHeader}>
              <View
                style={[
                  styles.slotIcon,
                  {
                    backgroundColor: filled
                      ? alpha(colors.primary, 0.14)
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <Ionicons
                  name={slot.icon as never}
                  size={16}
                  color={filled ? colors.primary : colors.textTertiary}
                />
              </View>
              <View style={styles.flex}>
                <AppText variant="body" weight="700">
                  {slot.label}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {slot.when}
                </AppText>
              </View>
              {/*
                A GLYPH, NOT A BUTTON. It marks the slot as fillable; the card is
                what opens the picker. Kept out of the accessibility tree so a
                screen reader announces one action for one card rather than two
                controls that do the same thing.
              */}
              <Ionicons
                name={filled ? "swap-horizontal" : "add-circle-outline"}
                size={22}
                color={filled ? colors.textTertiary : colors.primary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>

            {!filled ? (
              <AppText variant="footnote" color="tertiary" style={styles.slotEmpty}>
                Tap to choose — or leave it empty, and it won&apos;t count against you.
              </AppText>
            ) : (
              picked.map((entry) => (
                <View key={entry.id} style={[styles.pickedRow, { borderColor: colors.border }]}>
                  <View style={styles.flex}>
                    <AppText variant="body" weight="600">
                      {entry.meal.name}
                    </AppText>
                    <AppText variant="caption" color="secondary">
                      {entry.meal.calories.max === 0
                        ? "No nutrition data"
                        : entry.meal.calories.min === entry.meal.calories.max
                          ? `${entry.meal.calories.min} kcal · ${entry.meal.proteinG.max}g protein`
                          : `${entry.meal.calories.min}–${entry.meal.calories.max} kcal · ${entry.meal.proteinG.max}g protein`}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={async () => {
                      Haptics.selectionAsync().catch(() => {});
                      await removeCustomMeal(entry.id);
                      await loadDay(selectedDate);
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.meal.name} from ${slot.label}`}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        );
      })}

      {/* --- Bulk actions --------------------------------------------------- */}
      {entries.length > 0 ? (
        <Card padding="lg">
          <AppText variant="body" weight="700">
            Reuse this day
          </AppText>
          <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>
            {`Planning a long stretch one meal at a time isn't realistic.`}
          </AppText>
          <View style={styles.bulkRow}>
            <Button
              label="Copy to rest of week"
              variant="tonal"
              size="sm"
              onPress={async () => {
                const targets = dateRange(
                  addDays(selectedDate, 1),
                  minDate(addDays(selectedDate, 6), activePeriod.endDate),
                );
                const n = await copyDayTo(selectedDate, targets);
                Alert.alert("Copied", `Applied to ${n} day${n === 1 ? "" : "s"}.`);
              }}
            />
            <Button
              label="Repeat this week onward"
              variant="tonal"
              size="sm"
              onPress={async () => {
                const weekStart = mondayOf(selectedDate, activePeriod.startDate);
                const n = await repeatWeekPattern(weekStart, activePeriod.endDate);
                Alert.alert(
                  "Repeated",
                  n > 0
                    ? `This week's pattern now fills ${n} more day${n === 1 ? "" : "s"}.`
                    : "Nothing to repeat yet — plan a few days in this week first.",
                );
              }}
            />
          </View>
        </Card>
      ) : null}

      {/* The promise, stated once. A planner that doesn't say where the plan
          goes is asking for trust it hasn't earned. */}
      <View style={styles.footnote}>
        <Ionicons name="calendar-outline" size={15} color={colors.textTertiary} />
        <AppText variant="footnote" color="tertiary" style={styles.flex}>
          Each day you plan shows up on your Diet screen that morning, ready to tick
          off as you eat it.
        </AppText>
      </View>

      <MealPickerSheet
        visible={picking !== null}
        slot={picking}
        date={selectedDate}
        savedMeals={savedMeals}
        {...(userBio?.region ? { region: userBio.region } : {})}
        onClose={() => setPicking(null)}
        onPick={handlePick}
      />
    </Screen>
  );
}

// ============================================================================

function ScreenHeader({ title }: { title: string }) {
  const { colors } = useColors();
  return (
    <View style={styles.modalHeader}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="headline" weight="700" style={styles.flex}>
        {title}
      </AppText>
    </View>
  );
}

const fmt = (d: string) =>
  parseLocalDate(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const longDay = (d: string) =>
  parseLocalDate(d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const minDate = (a: string, b: string) => (a < b ? a : b);

/** Monday of the week containing `date`, clamped to the period start. */
function mondayOf(date: string, notBefore: string): string {
  const d = parseLocalDate(date);
  const shift = (d.getDay() + 6) % 7;
  const monday = toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift));
  return monday < notBefore ? notBefore : monday;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: Spacing.lg, paddingBottom: 140 },
  para: { marginTop: Spacing.sm, lineHeight: 18 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  strip: { flexDirection: "row", gap: Spacing.sm, paddingVertical: 2 },
  dayChip: {
    alignItems: "center",
    gap: 2,
    minWidth: 52,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: -Spacing.sm,
  },
  todayPill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  slotEmpty: { marginTop: Spacing.sm, lineHeight: 17 },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bulkRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  footnote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
});
