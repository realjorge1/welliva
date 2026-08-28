/**
 * NEW / EDIT HABIT — name, GOAL, colour, icon and an optional daily reminder.
 * Editing an existing habit (?id=…) preloads everything and adds Delete.
 *
 * THE GOAL IS THE POINT OF THIS FORM. A habit used to be defined only by which
 * weekdays it sat on, which quietly forced every habit into the same shape: gym
 * four times a week had to be pinned to four named days, and moving Thursday's
 * session to Friday read as a miss followed by an unscheduled bonus. The Goal
 * section adds the target people actually hold themselves to — "4× a week", any
 * days — and streaks measure weeks against it (services/HabitService).
 *
 * THE GRIDS ARE MEASURED, NOT WRAPPED. Colour and icon used to be `flexWrap`
 * rows of fixed-size cells, so the number per row depended on the device and
 * the last row ended wherever it ended — a ragged edge against every other
 * element on the page. Both now measure their container and solve for a cell
 * width, so the columns line up with each other and the final row lands flush.
 * The icon set is a multiple of the column count for the same reason.
 */
import { HABIT_COLORS, HABIT_ICONS } from "@/components/habits/habitTheme";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconBadge } from "@/components/ui/IconBadge";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useBilling } from "@/contexts/BillingContext";
import { useHabits } from "@/contexts/HabitsContext";
import { canCreateHabit } from "@/services/billing";
import { ensureReminderPermission } from "@/services/HabitService";
import {
  DAY_LETTER,
  DAY_SHORT,
  EVERY_DAY,
  WEEKLY_GOAL_OPTIONS,
  goalModeOf,
  suggestWeeklyGoal,
  type GoalMode,
  type HabitReminder,
} from "@/models/habit";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

const REMINDER_PRESETS: { label: string; reminder: HabitReminder }[] = [
  { label: "8:00", reminder: { hour: 8, minute: 0 } },
  { label: "12:00", reminder: { hour: 12, minute: 0 } },
  { label: "18:00", reminder: { hour: 18, minute: 0 } },
  { label: "21:00", reminder: { hour: 21, minute: 0 } },
];

/** Columns per grid. HABIT_ICONS is sized to a whole multiple of ICON_COLS. */
const ICON_COLS = 6;
const COLOR_COLS = 5;
const GOAL_COLS = WEEKLY_GOAL_OPTIONS.length;

/** No icons here on purpose — three segments of a 12pt-guttered screen leave
 *  about 100pt of text each, and "Times a week" needs all of it. */
const GOAL_MODES: { value: GoalMode; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Times a week" },
  { value: "days", label: "Set days" },
];

export default function NewHabitScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getView, views, createHabit, updateHabit, deleteHabit } = useHabits();
  const { tier, openUpgrade } = useBilling();

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
    canCreateHabit(views.filter((v) => v.habit.source === "manual").length, tier);

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<string>(editing?.icon ?? HABIT_ICONS[0]);
  const [color, setColor] = useState<string>(editing?.color ?? HABIT_COLORS[0]);
  const [mode, setMode] = useState<GoalMode>(
    editing ? goalModeOf(editing) : "daily",
  );
  const [weeklyGoal, setWeeklyGoal] = useState<number>(editing?.weeklyGoal ?? 4);
  // Only meaningful in "days" mode; seeded so switching to it isn't a blank slate.
  const [days, setDays] = useState<number[]>(
    editing && goalModeOf(editing) === "days" ? editing.days : [0, 2, 4],
  );
  const [reminder, setReminder] = useState<HabitReminder | null>(
    editing?.reminder ?? null,
  );
  const [reminderBlocked, setReminderBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  // Once the goal has been set by hand, stop offering to set it.
  const [goalTouched, setGoalTouched] = useState(Boolean(editing));

  /**
   * A goal guessed from the name. Offered, never imposed: gym habits get rest
   * days, daily rituals get the whole week, and anything unrecognised gets
   * nothing rather than a confident wrong answer.
   */
  const suggestion = useMemo(() => suggestWeeklyGoal(name), [name]);
  const suggestionApplies =
    !goalTouched &&
    suggestion != null &&
    !(suggestion >= 7 ? mode === "daily" : mode === "weekly" && weeklyGoal === suggestion);

  const applySuggestion = () => {
    if (suggestion == null) return;
    Haptics.selectionAsync().catch(() => {});
    setGoalTouched(true);
    if (suggestion >= 7) {
      setMode("daily");
    } else {
      setMode("weekly");
      setWeeklyGoal(suggestion);
    }
  };

  const pickMode = (next: GoalMode) => {
    setGoalTouched(true);
    setMode(next);
  };

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
    setGoalTouched(true);
    setDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length === 0 ? [d] : next.sort((a, b) => a - b);
    });
  };

  /**
   * The three modes collapse into the two fields the model stores. A quota
   * habit keeps `days: EVERY_DAY` so that reminders, the widget snapshot and
   * every other weekday-reading caller still see "any day is fair game" —
   * only the code that measures progress looks at `weeklyGoal`.
   */
  const goalFields = () => {
    if (mode === "weekly") return { days: EVERY_DAY, weeklyGoal };
    if (mode === "days") return { days, weeklyGoal: null };
    return { days: EVERY_DAY, weeklyGoal: null };
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (!canSave) {
      openUpgrade("habits");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateHabit({ ...editing, name: trimmed, icon, color, reminder, ...goalFields() });
      } else {
        await createHabit({
          name: trimmed,
          icon,
          color,
          reminder,
          source: "manual",
          ...goalFields(),
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
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close without saving"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={{ flex: 1 }}>
        {editing ? "Edit habit" : "New habit"}
      </AppText>
    </View>
  );

  return (
    <Screen header={header}>
      {/* Name — with the identity being built shown beside it, so the colour
          and icon chosen further down have somewhere to land. */}
      <Card padding="lg">
        <View style={styles.nameRow}>
          <IconBadge name={icon as any} tone={color} size={44} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Habit name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text }]}
            maxLength={40}
            autoFocus={!editing}
          />
        </View>
      </Card>

      {/* ── Goal ── */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Goal
      </AppText>
      <Card padding="lg">
        <SegmentedControl
          options={GOAL_MODES}
          value={mode}
          onChange={pickMode}
          label="Goal type"
        />

        {mode === "weekly" && (
          <PickerGrid
            cols={GOAL_COLS}
            gap={Spacing.sm}
            count={WEEKLY_GOAL_OPTIONS.length}
            height={44}
            style={styles.goalGrid}
            renderCell={(i) => {
              const n = WEEKLY_GOAL_OPTIONS[i];
              const on = weeklyGoal === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setGoalTouched(true);
                    setWeeklyGoal(n);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${n} times a week`}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: on ? color : alpha(colors.text, 0.06),
                      borderColor: on ? color : "transparent",
                    },
                  ]}
                >
                  <AppText variant="callout" weight="700" color={on ? "#FFFFFF" : "secondary"}>
                    {n}×
                  </AppText>
                </Pressable>
              );
            }}
          />
        )}

        {mode === "days" && (
          <PickerGrid
            cols={7}
            gap={Spacing.sm}
            count={7}
            height={44}
            style={styles.goalGrid}
            renderCell={(d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={DAY_SHORT[d]}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: on ? color : alpha(colors.text, 0.06),
                      borderColor: on ? color : "transparent",
                    },
                  ]}
                >
                  <AppText variant="callout" weight="700" color={on ? "#FFFFFF" : "secondary"}>
                    {DAY_LETTER[d]}
                  </AppText>
                </Pressable>
              );
            }}
          />
        )}

        {/* What the chosen goal actually means, in a sentence. A target you
            can't restate is a target you won't keep. */}
        <AppText variant="footnote" color="tertiary" style={styles.goalBlurb}>
          {goalBlurb(mode, weeklyGoal, days)}
        </AppText>

        {suggestionApplies && (
          <Pressable
            onPress={applySuggestion}
            accessibilityRole="button"
            accessibilityLabel={`Use the suggested goal: ${suggestionText(suggestion!)}`}
            style={({ pressed }) => [
              styles.suggestBar,
              {
                backgroundColor: alpha(colors.primary, 0.1),
                borderColor: alpha(colors.primary, 0.3),
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <AppText variant="footnote" color="secondary" style={styles.flex} numberOfLines={2}>
              {`Most people set this one to `}
              <AppText variant="footnote" weight="700" color={colors.primary}>
                {suggestionText(suggestion!)}
              </AppText>
            </AppText>
            <AppText variant="footnote" weight="700" color={colors.primary}>
              Use
            </AppText>
          </Pressable>
        )}
      </Card>

      {/* ── Colour ── */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Colour
      </AppText>
      <Card padding="lg">
        <PickerGrid
          cols={COLOR_COLS}
          gap={Spacing.sm}
          count={HABIT_COLORS.length}
          height={40}
          renderCell={(i) => {
            const c = HABIT_COLORS[i];
            const on = color === c;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setColor(c);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Colour ${i + 1}`}
                style={[
                  styles.cell,
                  styles.swatch,
                  { backgroundColor: c, borderColor: on ? colors.text : "transparent" },
                ]}
              >
                {on && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </Pressable>
            );
          }}
        />
      </Card>

      {/* ── Icon ── */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Icon
      </AppText>
      <Card padding="lg">
        <PickerGrid
          cols={ICON_COLS}
          gap={Spacing.sm}
          count={HABIT_ICONS.length}
          square
          renderCell={(i, size) => {
            const ic = HABIT_ICONS[i];
            const on = icon === ic;
            return (
              <Pressable
                key={ic}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIcon(ic);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={ic.replace(/-/g, " ")}
                style={[
                  styles.cell,
                  {
                    backgroundColor: on ? alpha(color, 0.25) : alpha(colors.text, 0.06),
                    borderColor: on ? color : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={ic as any}
                  size={Math.min(24, Math.round(size * 0.46))}
                  color={on ? color : colors.textSecondary}
                />
              </Pressable>
            );
          }}
        />
      </Card>

      {/* ── Reminder ── */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Reminder
      </AppText>
      <Card padding="lg">
        <PickerGrid
          cols={REMINDER_PRESETS.length + 1}
          gap={Spacing.sm}
          count={REMINDER_PRESETS.length + 1}
          height={40}
          renderCell={(i) => {
            if (i === 0) {
              const on = !reminder;
              return (
                <Pressable
                  key="off"
                  onPress={clearReminder}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel="No reminder"
                  style={[
                    styles.cell,
                    {
                      backgroundColor: on ? colors.primary : alpha(colors.text, 0.06),
                      borderColor: "transparent",
                    },
                  ]}
                >
                  <AppText variant="footnote" weight="700" color={on ? "inverse" : "secondary"}>
                    Off
                  </AppText>
                </Pressable>
              );
            }
            const { label, reminder: r } = REMINDER_PRESETS[i - 1];
            const on = reminder?.hour === r.hour && reminder?.minute === r.minute;
            return (
              <Pressable
                key={label}
                onPress={() => chooseReminder(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Remind me at ${label}`}
                style={[
                  styles.cell,
                  {
                    backgroundColor: on ? colors.primary : alpha(colors.text, 0.06),
                    borderColor: "transparent",
                  },
                ]}
              >
                <AppText variant="footnote" weight="700" color={on ? "inverse" : "secondary"}>
                  {label}
                </AppText>
              </Pressable>
            );
          }}
        />
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

/* ─────────────────────────────── PickerGrid ─────────────────────────────── */

interface PickerGridProps {
  count: number;
  cols: number;
  gap: number;
  /** Fixed cell height. Ignored when `square`. */
  height?: number;
  /** Make cells as tall as they are wide. */
  square?: boolean;
  renderCell: (index: number, size: number) => React.ReactNode;
  style?: object;
}

/**
 * A grid whose columns are SOLVED, not wrapped.
 *
 * `flexWrap` with fixed-width children fits as many per row as happen to go,
 * which changes with screen width and leaves the last row ragged — two grids on
 * the same page end up with different column counts and neither lines up with
 * anything. This measures its own width once and divides it, so a row always
 * holds exactly `cols` cells and always ends flush with the card it sits in.
 *
 * ROWS ARE EXPLICIT, not wrapped, for the last half-pixel of that promise: a
 * solved width plus its gaps sums to exactly the container, and floating-point
 * layout only has to land a hair over for `flexWrap` to drop the final cell of
 * every row onto a line of its own. Chunking makes the column count structural
 * instead of emergent. The width is also floored to a tenth of a point for the
 * same reason — a rounding crumb is cheaper than a broken row.
 *
 * It renders nothing on the first pass (width is unknown until layout); that's
 * one frame, and it is the price of never guessing at a size.
 */
function PickerGrid({ count, cols, gap, height, square, renderCell, style }: PickerGridProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const size =
    width > 0 ? Math.floor(((width - gap * (cols - 1)) / cols) * 10) / 10 : 0;

  const rows: number[][] = [];
  for (let i = 0; i < count; i += cols) {
    rows.push(Array.from({ length: Math.min(cols, count - i) }, (_, k) => i + k));
  }

  return (
    <View onLayout={onLayout} style={[{ gap }, style]}>
      {size > 0 &&
        rows.map((row, r) => (
          <View key={r} style={[styles.gridRow, { gap }]}>
            {row.map((i) => (
              <View
                key={i}
                style={{ width: size, height: square ? size : (height ?? size) }}
              >
                {renderCell(i, size)}
              </View>
            ))}
          </View>
        ))}
    </View>
  );
}

/* ──────────────────────────────── Copy ──────────────────────────────────── */

function suggestionText(n: number): string {
  return n >= 7 ? "every day" : `${n}× a week`;
}

/** One sentence restating the chosen goal, including how a streak is earned. */
function goalBlurb(mode: GoalMode, weeklyGoal: number, days: number[]): string {
  if (mode === "weekly") {
    return weeklyGoal === 1
      ? "Once a week, on any day. Your streak counts the weeks you hit it."
      : `Any ${weeklyGoal} days out of 7 — you choose which. Your streak counts the weeks you hit it.`;
  }
  if (mode === "days") {
    return `${
      days.length === 1 ? "One set day" : `${days.length} set days`
    } a week: ${days.map((d) => DAY_SHORT[d]).join(", ")}. Other days don't count either way.`;
  }
  return "Every day of the week. Your streak counts the days in a row.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

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

  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: Spacing.sm,
  },

  sectionLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },

  gridRow: { flexDirection: "row" },
  /** Every grid cell fills the slot the grid solved for it. */
  cell: {
    width: "100%",
    height: "100%",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { borderRadius: Radius.pill, borderWidth: 2 },

  goalGrid: { marginTop: Spacing.lg },
  goalBlurb: { marginTop: Spacing.lg, lineHeight: 18 },
  suggestBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  reminderHint: {
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
