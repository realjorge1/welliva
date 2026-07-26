/**
 * FITNESS SETUP — the welcoming first-run flow for the fitness module.
 *
 * Five light steps, every one skippable, everything editable later in
 * Fitness Settings. Asks ONLY for preference data the recommendation engine
 * actually uses — body data (weight, injuries, equipment, level) already
 * lives in the main onboarding's UserBio and is not re-asked here.
 */

import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import {
  requestNotificationPermission,
  syncFitnessReminders,
} from "@/fitness/services/FitnessNotifications";
import { loadFitnessProfile } from "@/fitness/services/FitnessProfileStore";
import type {
  FitnessGoal,
  FitnessProfile,
  WorkoutLocation,
  WorkoutStyle,
} from "@/fitness/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

const GOAL_OPTIONS: { id: FitnessGoal; label: string; icon: string }[] = [
  { id: "get_stronger", label: "Get stronger", icon: "barbell-outline" },
  { id: "lose_fat", label: "Lose fat", icon: "flame-outline" },
  { id: "build_muscle", label: "Build muscle", icon: "fitness-outline" },
  { id: "boost_endurance", label: "Boost endurance", icon: "pulse-outline" },
  { id: "move_more", label: "Move more", icon: "walk-outline" },
  { id: "reduce_stress", label: "Reduce stress", icon: "leaf-outline" },
];

const LOCATION_OPTIONS: { id: WorkoutLocation; label: string; icon: string }[] = [
  { id: "home", label: "At home", icon: "home-outline" },
  { id: "gym", label: "At the gym", icon: "barbell-outline" },
  { id: "outdoors", label: "Outdoors", icon: "sunny-outline" },
  { id: "anywhere", label: "Anywhere", icon: "compass-outline" },
];

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 75, 90];

const STYLE_OPTIONS: { id: WorkoutStyle; label: string }[] = [
  { id: "strength", label: "Strength" },
  { id: "hiit", label: "HIIT" },
  { id: "cardio", label: "Cardio" },
  { id: "core", label: "Core" },
  { id: "endurance", label: "Endurance" },
  { id: "power", label: "Power" },
  { id: "mobility", label: "Mobility" },
  { id: "recovery", label: "Recovery" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TOTAL_STEPS = 5;

export default function FitnessSetupScreen() {
  const { colors } = useColors();
  const { update } = useFitnessProfile();

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [location, setLocation] = useState<WorkoutLocation>("anywhere");
  const [duration, setDuration] = useState(20);
  const [stylesSel, setStylesSel] = useState<WorkoutStyle[]>([]);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [milestone, setMilestone] = useState("");
  const [voice, setVoice] = useState(false);
  const [workoutReminders, setWorkoutReminders] = useState(false);

  const toggleIn = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const finish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const patch: Partial<FitnessProfile> = {
      setupComplete: true,
      goals,
      location,
      typicalDurationMin: duration,
      preferredStyles: stylesSel,
      daysAvailable: [...days].sort((a, b) => a - b),
      milestone: milestone.trim() || undefined,
      voiceGuidance: voice,
      reminders: {
        workouts: workoutReminders,
        hydration: false,
        stretch: false,
        weeklySummary: workoutReminders,
        hour: 17,
      },
    };
    await update(patch);
    if (workoutReminders) {
      const granted = await requestNotificationPermission();
      if (granted) await syncFitnessReminders(await loadFitnessProfile());
    }
    router.back();
  }, [goals, location, duration, stylesSel, days, milestone, voice, workoutReminders, update]);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step >= TOTAL_STEPS - 1) void finish();
    else setStep((s) => s + 1);
  }, [step, finish]);

  const OptionChip = ({
    active,
    label,
    icon,
    onPress,
  }: {
    active: boolean;
    label: string;
    icon?: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.option,
        {
          backgroundColor: active ? alpha(colors.primary, 0.14) : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={17}
          color={active ? colors.primary : colors.textTertiary}
        />
      ) : null}
      <AppText variant="callout" color={active ? "brand" : "secondary"}>
        {label}
      </AppText>
      {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
    </Pressable>
  );

  // A squarer, roomier tile laid out two-per-row — the goal / location /
  // duration pickers use this grid instead of the pill chips.
  const GridOption = ({
    active,
    label,
    icon,
    onPress,
  }: {
    active: boolean;
    label: string;
    icon?: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.gridOption,
        {
          backgroundColor: active ? alpha(colors.primary, 0.12) : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.gridIcon,
            { backgroundColor: active ? alpha(colors.primary, 0.16) : colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={active ? colors.primary : colors.textTertiary}
          />
        </View>
      ) : null}
      <AppText variant="callout" color={active ? "brand" : "secondary"} numberOfLines={1}>
        {label}
      </AppText>
      {active && (
        <View style={styles.gridCheck}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        </View>
      )}
    </Pressable>
  );

  const steps: { title: string; sub: string; body: React.ReactNode }[] = [
    {
      title: "What's your goal?",
      sub: "Pick as many as you like — your recommendations start here.",
      body: (
        <View style={styles.optionGrid}>
          {GOAL_OPTIONS.map((g) => (
            <GridOption
              key={g.id}
              active={goals.includes(g.id)}
              label={g.label}
              icon={g.icon}
              onPress={() => setGoals((v) => toggleIn(v, g.id))}
            />
          ))}
        </View>
      ),
    },
    {
      title: "What's your preferred location and duration per day?",
      sub: "We'll favor sessions that fit your real life.",
      body: (
        <View>
          <AppText variant="caption" color="tertiary" uppercase style={styles.groupLabelTop}>
            Usual spot
          </AppText>
          <View style={styles.optionGrid}>
            {LOCATION_OPTIONS.map((l) => (
              <GridOption
                key={l.id}
                active={location === l.id}
                label={l.label}
                icon={l.icon}
                onPress={() => setLocation(l.id)}
              />
            ))}
          </View>
          <AppText variant="caption" color="tertiary" uppercase style={styles.groupLabel}>
            Time per day
          </AppText>
          <View style={styles.optionGrid}>
            {DURATION_OPTIONS.map((d) => (
              <GridOption
                key={d}
                active={duration === d}
                label={`${d} min`}
                icon="time-outline"
                onPress={() => setDuration(d)}
              />
            ))}
          </View>
        </View>
      ),
    },
    {
      title: "What do you enjoy?",
      sub: "Workouts you like are workouts you repeat.",
      body: (
        <View style={styles.optionWrap}>
          {STYLE_OPTIONS.map((s) => (
            <OptionChip
              key={s.id}
              active={stylesSel.includes(s.id)}
              label={s.label}
              onPress={() => setStylesSel((v) => toggleIn(v, s.id))}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Which days work for you?",
      sub: "Your calendar and reminders build around these.",
      body: (
        <View style={styles.optionWrap}>
          {DAY_LABELS.map((d, i) => (
            <OptionChip
              key={d}
              active={days.includes(i)}
              label={d}
              onPress={() => setDays((v) => toggleIn(v, i))}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Make it yours",
      sub: "All of this can change any time in Fitness Settings.",
      body: (
        <View style={styles.toggleList}>
          <ToggleRow
            icon="mic-outline"
            label="Voice guidance"
            sub="Spoken cues for sets, rests and next moves"
            value={voice}
            onToggle={() => setVoice((v) => !v)}
            colors={colors}
          />
          <ToggleRow
            icon="notifications-outline"
            label="Training-day reminders"
            sub="A nudge on the days you chose"
            value={workoutReminders}
            onToggle={() => setWorkoutReminders((v) => !v)}
            colors={colors}
          />
          <AppText variant="caption" color="tertiary" uppercase style={styles.groupLabel}>
            {"A milestone you're chasing (optional)"}
          </AppText>
          <TextInput
            value={milestone}
            onChangeText={setMilestone}
            placeholder={'e.g. "first full push-up"'}
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel="Milestone"
          />
        </View>
      ),
    },
  ];

  const current = steps[step];

  return (
    <Screen
      header={
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Close setup"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= step ? colors.primary : colors.border,
                    width: i === step ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={next} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip step">
            <AppText variant="callout" color="tertiary">
              Skip
            </AppText>
          </Pressable>
        </View>
      }
    >
      <AppText variant="display" style={styles.title}>
        {current.title}
      </AppText>
      <AppText variant="body" color="secondary" style={styles.sub}>
        {current.sub}
      </AppText>

      <Card padding="xl" style={styles.body}>
        {current.body}
      </Card>

      <View style={styles.footer}>
        {step > 0 && (
          <Button
            label="Back"
            variant="ghost"
            fullWidth={false}
            onPress={() => setStep((s) => Math.max(0, s - 1))}
          />
        )}
        <Button
          label={step === TOTAL_STEPS - 1 ? "Finish" : "Continue"}
          icon={step === TOTAL_STEPS - 1 ? "checkmark" : "arrow-forward"}
          iconRight
          onPress={next}
          style={styles.flex}
        />
      </View>
    </Screen>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onToggle,
  colors,
}: {
  icon: string;
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
  colors: { primary: string; textTertiary: string; border: string };
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={value ? colors.primary : colors.textTertiary}
      />
      <View style={styles.flex}>
        <AppText variant="callout">{label}</AppText>
        <AppText variant="footnote" color="tertiary">
          {sub}
        </AppText>
      </View>
      <Ionicons
        name={value ? "checkmark-circle" : "ellipse-outline"}
        size={24}
        color={value ? colors.primary : colors.border}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 8, borderRadius: 4 },

  title: { marginTop: Spacing.md },
  sub: { marginTop: Spacing.xs, marginBottom: Spacing.xl },
  body: { marginBottom: Spacing.xl },

  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  // Squarer 2-per-row grid tiles (goals / location / duration)
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.sm,
  },
  gridOption: {
    width: "48.5%",
    minHeight: 84,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    justifyContent: "center",
  },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCheck: { position: "absolute", top: Spacing.sm, right: Spacing.sm },

  groupLabel: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  groupLabelTop: { marginBottom: Spacing.sm },

  toggleList: { gap: Spacing.md },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },

  footer: { flexDirection: "row", gap: Spacing.md, alignItems: "center" },
});
