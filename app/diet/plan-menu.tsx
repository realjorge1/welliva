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
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { PlanDurationPicker } from "@/components/diet/PlanDurationPicker";
import { Radius, Spacing } from "@/constants/theme";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { useSystem } from "@/contexts/AppContext";
import type { MealType, ScheduledMeal } from "@/models/diet";
import {
  addDays,
  dateRange,
  parseLocalDate,
  resolveEndDate,
  toLocalDate,
  type CustomMenuEntry,
  type PlanDuration,
} from "@/models/mealPlan";
import type { NutrientPanel } from "@/models/nutrients";
import { resolveKnownFood, searchCanonical } from "@/services/nutrition/NutrientResolver";
import * as Haptics from "@/utils/haptics";

const SLOTS: { key: MealType; label: string; icon: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "partly-sunny-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
  { key: "snack", label: "Snacks", icon: "cafe-outline" },
];

export default function PlanMenuScreen() {
  const { colors } = useColors();
  const { currentDate } = useSystem();
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
          <AppText variant="caption" color="textSecondary" style={styles.para}>
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
          <AppText variant="caption" color="textSecondary" align="center">
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

  const handlePick = async (meal: ScheduledMeal, nutrients?: NutrientPanel) => {
    if (!picking) return;
    await setCustomMeal({
      date: selectedDate,
      slot: picking,
      meal,
      ...(nutrients ? { nutrients } : {}),
    });
    setPicking(null);
    await loadDay(selectedDate);
  };

  return (
    <Screen scroll contentStyle={styles.body}>
      <ScreenHeader title={activePeriod.label} />

      <AppText variant="caption" color="textSecondary">
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

      {/* --- Slots for the selected day ------------------------------------ */}
      {SLOTS.map((slot) => {
        const picked = bySlot(slot.key);
        return (
          <Card key={slot.key} padding="lg">
            <View style={styles.slotHeader}>
              <Ionicons name={slot.icon as never} size={17} color={colors.textSecondary} />
              <AppText variant="body" weight="700" style={styles.flex}>
                {slot.label}
              </AppText>
              <Pressable onPress={() => setPicking(slot.key)} hitSlop={10}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </Pressable>
            </View>

            {picked.length === 0 ? (
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 6 }}>
                Nothing planned — tap + to choose, or leave it empty.
              </AppText>
            ) : (
              picked.map((entry) => (
                <View key={entry.id} style={[styles.pickedRow, { borderColor: colors.border }]}>
                  <View style={styles.flex}>
                    <AppText variant="body" weight="600">
                      {entry.meal.name}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {entry.meal.calories.min === entry.meal.calories.max
                        ? `${entry.meal.calories.min} kcal`
                        : `${entry.meal.calories.min}–${entry.meal.calories.max} kcal`}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={async () => {
                      await removeCustomMeal(entry.id);
                      await loadDay(selectedDate);
                    }}
                    hitSlop={10}
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
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
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

      <MealPickerModal
        visible={picking !== null}
        slot={picking}
        savedMeals={savedMeals}
        onClose={() => setPicking(null)}
        onPick={handlePick}
      />
    </Screen>
  );
}

// ============================================================================
// MEAL PICKER
// ============================================================================

function MealPickerModal({
  visible,
  slot,
  savedMeals,
  onClose,
  onPick,
}: {
  visible: boolean;
  slot: MealType | null;
  savedMeals: { id: string; name: string; meal: Omit<ScheduledMeal, "id" | "isConsumed" | "consumedAt">; nutrients?: NutrientPanel }[];
  onClose: () => void;
  onPick: (meal: ScheduledMeal, nutrients?: NutrientPanel) => void;
}) {
  const { colors } = useColors();
  const [query, setQuery] = useState("");

  const results = useMemo(() => (query.trim() ? searchCanonical(query, 12) : []), [query]);

  const make = (name: string, kcal: number, p = 0, c = 0, f = 0): ScheduledMeal => ({
    id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    mealType: slot ?? "snack",
    name,
    calories: { min: kcal, max: kcal },
    proteinG: { min: p, max: p },
    carbsG: { min: c, max: c },
    fatG: { min: f, max: f },
    isConsumed: false,
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen scroll contentStyle={styles.body} edges={["top"]}>
        <View style={styles.modalHeader}>
          <AppText variant="headline" weight="700">
            Choose a meal
          </AppText>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <Card padding="lg">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods, or type any meal name"
            placeholderTextColor={colors.textSecondary}
            style={[styles.search, { color: colors.text }]}
            autoCorrect={false}
          />
        </Card>

        {/* Anything the user types is allowed — a hand-planned menu shouldn't be
            limited to what's in our database. Unmatched names simply carry no
            nutrition, which the report handles honestly. */}
        {query.trim().length > 1 ? (
          <Pressable
            onPress={() => onPick(make(query.trim(), 0))}
            style={[styles.freeRow, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <AppText variant="body" weight="600">
              {`Use "${query.trim()}"`}
            </AppText>
          </Pressable>
        ) : null}

        {results.length > 0 ? (
          <>
            <AppText variant="caption" color="textSecondary" weight="700" uppercase>
              From the food reference
            </AppText>
            {results.map((food) => {
              const resolved = resolveKnownFood(
                food.id,
                1,
                food.portions.find((p) => p.isDefault)?.unit ?? food.portions[0]?.unit ?? "serving",
              );
              const kcal = Math.round(resolved?.nutrients.calories ?? 0);
              return (
                <Pressable
                  key={food.id}
                  onPress={() =>
                    onPick(
                      make(
                        food.name,
                        kcal,
                        Math.round(resolved?.nutrients.protein ?? 0),
                        Math.round(resolved?.nutrients.carbs ?? 0),
                        Math.round(resolved?.nutrients.fat ?? 0),
                      ),
                      resolved?.nutrients,
                    )
                  }
                  style={[styles.resultRow, { borderColor: colors.border }]}
                >
                  <View style={styles.flex}>
                    <AppText variant="body" weight="600">
                      {food.name}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {food.group}
                    </AppText>
                  </View>
                  <AppText variant="body" weight="700">
                    {kcal}
                  </AppText>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {savedMeals.length > 0 && !query.trim() ? (
          <>
            <AppText variant="caption" color="textSecondary" weight="700" uppercase>
              Your saved meals
            </AppText>
            {savedMeals.map((sm) => (
              <Pressable
                key={sm.id}
                onPress={() =>
                  onPick(
                    { ...sm.meal, id: `cm_${Date.now()}`, isConsumed: false },
                    sm.nutrients,
                  )
                }
                style={[styles.resultRow, { borderColor: colors.border }]}
              >
                <AppText variant="body" weight="600" style={styles.flex}>
                  {sm.name}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            ))}
          </>
        ) : null}
      </Screen>
    </Modal>
  );
}

// ============================================================================

function ScreenHeader({ title }: { title: string }) {
  const { colors } = useColors();
  return (
    <View style={styles.modalHeader}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
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
  slotHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bulkRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  search: { fontSize: 16, minHeight: 24 },
  freeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
