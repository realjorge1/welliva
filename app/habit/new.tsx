/**
 * NEW / EDIT HABIT — modal sheet: name, icon grid, color swatches, frequency
 * (every day or custom weekdays) and an optional daily reminder. Editing an
 * existing habit (?id=…) preloads everything and adds Delete.
 */
import { HABIT_COLORS, HABIT_ICONS } from "@/components/habits/habitTheme";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useBilling } from "@/contexts/BillingContext";
import { useHabits } from "@/contexts/HabitsContext";
import { canCreateHabit } from "@/services/billing";
import { ensureReminderPermission } from "@/services/HabitService";
import { DAY_LETTER, EVERY_DAY, type HabitReminder } from "@/models/habit";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

const REMINDER_PRESETS: { label: string; reminder: HabitReminder }[] = [
  { label: "8:00", reminder: { hour: 8, minute: 0 } },
  { label: "12:00", reminder: { hour: 12, minute: 0 } },
  { label: "18:00", reminder: { hour: 18, minute: 0 } },
  { label: "21:00", reminder: { hour: 21, minute: 0 } },
];

export default function NewHabitScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getView, views, createHabit, updateHabit, deleteHabit } = useHabits();
  const { hasProAccess, openPaywall } = useBilling();

  const editing = useMemo(
    () => (id ? getView(String(id))?.habit : undefined),
    // Snapshot on mount — the form owns the state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Creation is capped on the free tier; EDITING an existing habit never is —
  // a user who subscribed, made five habits and then lapsed must still be able
  // to rename and manage what they already have.
  const canSave =
    Boolean(editing) ||
    canCreateHabit(
      views.filter((v) => v.habit.source === "manual").length,
      hasProAccess,
    );

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<string>(editing?.icon ?? HABIT_ICONS[0]);
  const [color, setColor] = useState<string>(editing?.color ?? HABIT_COLORS[0]);
  const [days, setDays] = useState<number[]>(editing?.days ?? EVERY_DAY);
  const [reminder, setReminder] = useState<HabitReminder | null>(
    editing?.reminder ?? null,
  );
  const [reminderBlocked, setReminderBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const everyDay = days.length >= 7;

  // Picking a time prompts for notification permission in-context; if it's
  // denied we keep the reminder set (it re-tries on save) but surface a hint
  // rather than letting it silently never fire.
  const chooseReminder = (r: HabitReminder) => {
    setReminder(r);
    ensureReminderPermission()
      .then((granted) => setReminderBlocked(!granted))
      .catch(() => setReminderBlocked(false));
  };

  const clearReminder = () => {
    setReminder(null);
    setReminderBlocked(false);
  };

  const toggleDay = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    setDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length === 0 ? [d] : next.sort((a, b) => a - b);
    });
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (!canSave) {
      openPaywall("habits");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateHabit({ ...editing, name: trimmed, icon, color, days, reminder });
      } else {
        await createHabit({
          name: trimmed,
          icon,
          color,
          days,
          reminder,
          source: "manual",
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert("Delete habit", `Delete “${editing.name}” and its history?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(editing.id);
          // Leave both the edit sheet and the now-gone detail screen.
          router.back();
          router.back();
        },
      },
    ]);
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable hitSlop={12} onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}>
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={{ flex: 1 }}>
        {editing ? "Edit habit" : "New habit"}
      </AppText>
    </View>
  );

  return (
    <Screen header={header}>
      {/* Name */}
      <Card padding="lg">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Habit name"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text }]}
          maxLength={40}
          autoFocus={!editing}
        />
      </Card>

      {/* Color */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Color
      </AppText>
      <Card padding="lg">
        <View style={styles.swatchGrid}>
          {HABIT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setColor(c);
              }}
              style={[
                styles.swatch,
                { backgroundColor: c },
                color === c && [styles.swatchSelected, { borderColor: colors.text }],
              ]}
            >
              {color === c && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Icon */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Icon
      </AppText>
      <Card padding="lg">
        <View style={styles.swatchGrid}>
          {HABIT_ICONS.map((ic) => {
            const selected = icon === ic;
            return (
              <Pressable
                key={ic}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIcon(ic);
                }}
                style={[
                  styles.iconCell,
                  {
                    backgroundColor: selected ? alpha(color, 0.25) : alpha(colors.text, 0.06),
                    borderColor: selected ? color : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={ic as any}
                  size={20}
                  color={selected ? color : colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Frequency */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Frequency
      </AppText>
      <Card padding="lg">
        <View style={styles.freqRow}>
          <Pressable
            onPress={() => setDays(EVERY_DAY)}
            style={[
              styles.freqChip,
              {
                backgroundColor: everyDay ? colors.primary : alpha(colors.text, 0.06),
              },
            ]}
          >
            <AppText variant="callout" color={everyDay ? "inverse" : "secondary"}>
              Every day
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setDays([0, 2, 4])}
            style={[
              styles.freqChip,
              {
                backgroundColor: !everyDay ? colors.primary : alpha(colors.text, 0.06),
              },
            ]}
          >
            <AppText variant="callout" color={!everyDay ? "inverse" : "secondary"}>
              Custom days
            </AppText>
          </Pressable>
        </View>
        {!everyDay && (
          <View style={styles.dayRow}>
            {DAY_LETTER.map((letter, d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: on ? color : alpha(colors.text, 0.06),
                    },
                  ]}
                >
                  <AppText variant="callout" color={on ? "#FFFFFF" : "secondary"}>
                    {letter}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* Reminder */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Reminder
      </AppText>
      <Card padding="lg">
        <View style={styles.freqRow}>
          <Pressable
            onPress={clearReminder}
            style={[
              styles.freqChip,
              { backgroundColor: !reminder ? colors.primary : alpha(colors.text, 0.06) },
            ]}
          >
            <AppText variant="callout" color={!reminder ? "inverse" : "secondary"}>
              Off
            </AppText>
          </Pressable>
          {REMINDER_PRESETS.map(({ label, reminder: r }) => {
            const on = reminder?.hour === r.hour && reminder?.minute === r.minute;
            return (
              <Pressable
                key={label}
                onPress={() => chooseReminder(r)}
                style={[
                  styles.freqChip,
                  { backgroundColor: on ? colors.primary : alpha(colors.text, 0.06) },
                ]}
              >
                <AppText variant="callout" color={on ? "inverse" : "secondary"}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {reminderBlocked && reminder && (
          <AppText variant="caption" color="tertiary" style={styles.reminderHint}>
            Enable notifications for Welliva in your device settings to get this
            reminder.
          </AppText>
        )}
      </Card>

      <Button
        label={editing ? "Save changes" : "Create habit"}
        size="lg"
        onPress={save}
        disabled={!name.trim()}
        loading={saving}
        style={{ marginTop: Spacing.xxl }}
      />
      {editing && (
        <Button
          label="Delete habit"
          variant="danger"
          onPress={confirmDelete}
          style={{ marginTop: Spacing.md }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: Spacing.sm,
  },
  sectionLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderWidth: 2,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  freqRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  freqChip: {
    paddingHorizontal: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  dayChip: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderHint: {
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
