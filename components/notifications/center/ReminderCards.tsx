/**
 * The three kinds of reminder that can be finished from the lock screen.
 *
 *   · HABITS — a directory, not a second editor. A habit's reminder belongs on
 *     the habit (create/edit), and duplicating that editor here would give one
 *     setting two homes and eventually two answers.
 *   · MEALS — the tap-to-log window: per-slot switches and times. The button
 *     only appears on days with a planned meal to tick (mealReminders).
 *   · WATER — daily times and the glass the button adds.
 *
 * THE APP NEVER PICKS A TIME. Everything starts off; the offered times are
 * suggestions inside the windows the rest of the app already uses.
 */
import { AppText, Divider, SegmentedControl, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { HabitView } from "@/contexts/HabitsContext";
import { frequencyLabel } from "@/models/habit";
import { DEFAULT_GLASS_ML, waterButtonTitle } from "@/services/notifications/categories";
import type { MealSlotKey } from "@/services/notifications/copy";
import {
  HORIZON_DAYS,
  MEAL_SLOTS,
  SLOT_LABEL,
  anyEnabled,
  formatTime,
  type MealReminderSettings,
} from "@/services/notifications/mealReminders";
import {
  GLASS_SIZES,
  MAX_WATER_TIMES,
  WATER_TIMES,
  toMinutes,
  waterRemindersOn,
  type WaterReminderSettings,
} from "@/services/notifications/waterReminders";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { CategoryCard } from "./CategoryCard";
import { plural } from "./format";

// ════════════════════════════════════════════════════════════════════
// HABITS
// ════════════════════════════════════════════════════════════════════

export function HabitRemindersCard({
  views,
  blocked,
}: {
  views: HabitView[];
  blocked: boolean;
}) {
  const { colors } = useColors();
  const manual = views.filter((v) => v.habit.source === "manual");
  const withReminder = manual.filter((v) => v.habit.reminder);

  return (
    <CategoryCard
      icon="repeat"
      tone={colors.warning}
      title="Habits"
      status={
        manual.length === 0
          ? "Habits you create can each carry a reminder"
          : withReminder.length === 0
            ? "No habit has a reminder yet — tap one to add it"
            : `${plural(withReminder.length, "habit")} with a reminder`
      }
      buttonLabel="Mark as Done"
      tryKind="habit"
      disabled={blocked}
    >
      {manual.length === 0 ? (
        <LinkRow label="Go to Habits" onPress={() => router.push("/(tabs)/habits" as never)} />
      ) : (
        manual.map((v, i) => (
          <View key={v.habit.id}>
            {i > 0 && <Divider spacing={0} />}
            <Pressable
              onPress={() => router.push(`/habit/new?id=${v.habit.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`${v.habit.name} reminder`}
              accessibilityHint="Opens the habit to set its reminder"
              style={({ pressed }) => [styles.habitRow, pressed && styles.pressed]}
            >
              <View style={[styles.habitDot, { backgroundColor: alpha(v.habit.color, 0.16) }]}>
                <Ionicons name={v.habit.icon as never} size={15} color={v.habit.color} />
              </View>
              <View style={styles.flex}>
                <AppText variant="body" weight="600" numberOfLines={1}>
                  {v.habit.name}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {frequencyLabel(v.habit.days, v.habit.weeklyGoal)}
                </AppText>
              </View>
              <AppText
                variant="footnote"
                weight="600"
                color={v.habit.reminder ? colors.text : colors.textTertiary}
              >
                {v.habit.reminder
                  ? formatTime(v.habit.reminder.hour, v.habit.reminder.minute)
                  : "Add"}
              </AppText>
              <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))
      )}
    </CategoryCard>
  );
}

// ════════════════════════════════════════════════════════════════════
// MEALS
// ════════════════════════════════════════════════════════════════════

/**
 * The times a slot can be set to. A coarse list, not a clock: a meal reminder
 * needs to land in the right part of the day, and a chip is one gesture where a
 * wheel is three. Each window matches when that meal is actually eaten.
 */
const SLOT_TIMES: Record<MealSlotKey, readonly { hour: number; minute: number }[]> = {
  breakfast: [
    { hour: 6, minute: 30 },
    { hour: 7, minute: 30 },
    { hour: 8, minute: 30 },
    { hour: 9, minute: 30 },
  ],
  lunch: [
    { hour: 12, minute: 0 },
    { hour: 12, minute: 30 },
    { hour: 13, minute: 0 },
    { hour: 14, minute: 0 },
  ],
  dinner: [
    { hour: 18, minute: 0 },
    { hour: 19, minute: 0 },
    { hour: 19, minute: 30 },
    { hour: 20, minute: 30 },
  ],
  snack: [
    { hour: 10, minute: 30 },
    { hour: 15, minute: 30 },
    { hour: 16, minute: 30 },
    { hour: 21, minute: 0 },
  ],
};

const SLOT_ICON: Record<MealSlotKey, keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

export function MealRemindersCard({
  settings,
  pending,
  blocked,
  loaded,
  ensurePermission,
  apply,
}: {
  settings: MealReminderSettings;
  /** Meal reminders actually pending in the OS queue. */
  pending: number;
  blocked: boolean;
  loaded: boolean;
  ensurePermission: () => Promise<boolean>;
  apply: (next: MealReminderSettings) => Promise<void>;
}) {
  const { colors } = useColors();
  const on = anyEnabled(settings);

  const toggleMaster = async (v: boolean) => {
    if (v && !(await ensurePermission())) return;
    await apply({ ...settings, enabled: v });
  };

  const toggleSlot = async (slot: MealSlotKey, v: boolean) => {
    if (v && !(await ensurePermission())) return;
    await apply({
      // Turning on a first slot turns the feature on with it. Two switches for
      // one reminder is a puzzle, not a setting.
      enabled: v ? true : settings.enabled,
      slots: { ...settings.slots, [slot]: { ...settings.slots[slot], enabled: v } },
    });
  };

  const setTime = (slot: MealSlotKey, hour: number, minute: number) =>
    apply({
      ...settings,
      slots: { ...settings.slots, [slot]: { ...settings.slots[slot], hour, minute } },
    });

  return (
    <CategoryCard
      icon="restaurant"
      tone={colors.success}
      title="Meals"
      status={
        on
          ? pending > 0
            ? `${plural(pending, "reminder")} lined up for the next ${HORIZON_DAYS} days`
            : "On — waiting for notifications to be allowed"
          : "Off — asks about a planned meal at times you pick"
      }
      buttonLabel="Ate it"
      enabled={settings.enabled}
      onToggle={(v) => void toggleMaster(v)}
      disabled={!loaded || blocked}
      tryKind="meal"
    >
      {MEAL_SLOTS.map((slot, i) => {
        const r = settings.slots[slot];
        const times = SLOT_TIMES[slot];
        const selected = times.findIndex((t) => t.hour === r.hour && t.minute === r.minute);
        return (
          <View key={slot}>
            {i > 0 && <Divider spacing={0} />}
            <View style={styles.slotRow}>
              <Ionicons
                name={SLOT_ICON[slot]}
                size={18}
                color={r.enabled ? colors.success : colors.textTertiary}
              />
              <View style={styles.flex}>
                <AppText variant="body" weight="600">
                  {SLOT_LABEL[slot]}
                </AppText>
                <AppText variant="caption" color="tertiary">
                  {r.enabled ? `Every day at ${formatTime(r.hour, r.minute)}` : "Not set"}
                </AppText>
              </View>
              <Switch
                value={r.enabled}
                onValueChange={(v) => void toggleSlot(slot, v)}
                disabled={!loaded || blocked}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={`${SLOT_LABEL[slot]} reminder`}
              />
            </View>
            {r.enabled && (
              <SegmentedControl
                options={times.map((t, idx) => ({
                  value: String(idx),
                  label: formatTime(t.hour, t.minute),
                }))}
                value={String(Math.max(0, selected))}
                onChange={(v) => {
                  const t = times[Number(v)];
                  if (t) void setTime(slot, t.hour, t.minute);
                }}
                style={styles.segment}
              />
            )}
          </View>
        );
      })}
      <AppText variant="caption" color="tertiary" style={styles.note}>
        On a day with nothing planned for that meal, the reminder has no button —
        tapping it opens the food log instead, so you can record what you had.
      </AppText>
    </CategoryCard>
  );
}

// ════════════════════════════════════════════════════════════════════
// WATER
// ════════════════════════════════════════════════════════════════════

export function WaterRemindersCard({
  settings,
  blocked,
  loaded,
  ensurePermission,
  apply,
}: {
  settings: WaterReminderSettings;
  blocked: boolean;
  loaded: boolean;
  ensurePermission: () => Promise<boolean>;
  apply: (next: WaterReminderSettings) => Promise<void>;
}) {
  const { colors } = useColors();
  const on = waterRemindersOn(settings);

  const toggleMaster = async (v: boolean) => {
    if (v && !(await ensurePermission())) return;
    // Switching on with no times picked would schedule nothing — seed the
    // middle of the day so "on" means something, and let them adjust.
    const times =
      v && settings.times.length === 0
        ? [toMinutes(10, 0), toMinutes(14, 0), toMinutes(18, 0)]
        : settings.times;
    await apply({ ...settings, enabled: v, times });
  };

  const toggleTime = async (m: number) => {
    const showing = settings.enabled && settings.times.includes(m);
    if (showing) {
      // Removing the last time is switching water reminders off — say so by
      // turning the master off with it, rather than "on" with nothing to send.
      const times = settings.times.filter((t) => t !== m);
      await apply({ ...settings, times, enabled: times.length > 0 });
      return;
    }
    // Picking a time (even while the master is off) means "remind me then".
    const times = settings.times.includes(m) ? settings.times : [...settings.times, m];
    if (times.length > MAX_WATER_TIMES) return;
    if (!(await ensurePermission())) return;
    await apply({ ...settings, enabled: true, times });
  };

  return (
    <CategoryCard
      icon="water"
      tone={colors.water}
      title="Water"
      status={
        on
          ? `${plural(settings.times.length, "reminder")} a day · ${settings.glassMl} ml a tap`
          : "Off — a quick ask a few times a day"
      }
      buttonLabel={waterButtonTitle(settings.glassMl || DEFAULT_GLASS_ML)}
      enabled={settings.enabled}
      onToggle={(v) => void toggleMaster(v)}
      disabled={!loaded || blocked}
      tryKind="water"
    >
      <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
        When
      </AppText>
      <View style={styles.times}>
        {WATER_TIMES.map(({ hour, minute }) => {
          const m = toMinutes(hour, minute);
          const selected = settings.enabled && settings.times.includes(m);
          const full =
            !settings.times.includes(m) && settings.times.length >= MAX_WATER_TIMES;
          return (
            <Pressable
              key={m}
              onPress={() => void toggleTime(m)}
              disabled={!loaded || blocked || full}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: full }}
              accessibilityLabel={`Water reminder at ${formatTime(hour, minute)}`}
              style={[
                styles.timeChip,
                {
                  backgroundColor: selected ? alpha(colors.water, 0.16) : colors.surfaceMuted,
                  borderColor: selected ? alpha(colors.water, 0.5) : "transparent",
                  opacity: full ? 0.4 : 1,
                },
              ]}
            >
              <AppText
                variant="footnote"
                weight={selected ? "700" : "500"}
                color={selected ? colors.water : colors.textSecondary}
              >
                {formatTime(hour, minute).replace(":00", "")}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" color="tertiary" uppercase style={styles.fieldLabel}>
        One tap adds
      </AppText>
      <SegmentedControl
        options={GLASS_SIZES.map((ml) => ({ value: ml, label: `${ml} ml` }))}
        value={settings.glassMl}
        onChange={(ml) => void apply({ ...settings, glassMl: ml })}
      />
    </CategoryCard>
  );
}

// ════════════════════════════════════════════════════════════════════

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.linkRow}
    >
      <AppText variant="footnote" color="brand" weight="600">
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  habitDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  segment: { marginBottom: Spacing.md },
  note: { marginTop: Spacing.sm, lineHeight: 17 },
  fieldLabel: { marginBottom: Spacing.sm, marginTop: Spacing.xs, letterSpacing: 0.5 },
  times: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timeChip: {
    minWidth: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});
