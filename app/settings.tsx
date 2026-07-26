/**
 * SETTINGS — appearance, goals, nutrition, account and data controls.
 *
 * Reached from the gear button in the Profile header (`/settings`, or
 * `/settings?edit=1` to open the bio editor directly). Lives outside the tab
 * navigator so it reads as a focused, full-screen settings page. Every control
 * here is wired to real app state — no cosmetic toggles.
 */

import {
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  Reveal,
  Screen,
  SectionHeader,
  ThemedIcon,
  useColors,
} from "@/components/ui";
import { useTheme } from "@/components/ThemeContext";
import { useAuth } from "@/components/SupabaseAuthProvider";
import {
  useReminderPermission,
  type ReminderPermission,
} from "@/components/notifications/useReminderPermission";
import { sendTestNotification } from "@/services/notifications/send";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { BioChangeSummary, useProfile } from "@/contexts/AppContext";
import {
  CuisinePreference,
  MedicalCondition,
  MedicationCategory,
  PregnancyTrimester,
} from "@/models/user";
import { Equipment } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { purgeAppData } from "@/services/sync/UserScope";
import * as Haptics from "@/utils/haptics";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { TRACKING_MODE_OPTIONS } from "@/models/trackingMode";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Generic {value,label} option lists for the editor's chip groups. */
type Opt<T extends string> = { value: T; label: string };

const ACTIVITY_LEVELS: Opt<string>[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "very_active", label: "Very active" },
];
const GOALS: Opt<string>[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "improve_fitness", label: "Improve fitness" },
  { value: "increase_energy", label: "More energy" },
  { value: "better_health", label: "Better health" },
  { value: "athletic_performance", label: "Performance" },
];
const SEXES: Opt<string>[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];
const EXERCISE_LEVELS: Opt<string>[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const DIETARY_RESTRICTIONS: Opt<string>[] = [
  { value: "none", label: "None" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];
const ALLERGIES: Opt<string>[] = [
  { value: "peanuts", label: "Peanuts" },
  { value: "tree_nuts", label: "Tree nuts" },
  { value: "dairy", label: "Dairy" },
  { value: "eggs", label: "Eggs" },
  { value: "shellfish", label: "Shellfish" },
  { value: "fish", label: "Fish" },
  { value: "wheat", label: "Wheat" },
  { value: "soy", label: "Soy" },
  { value: "gluten", label: "Gluten" },
];
const CONDITIONS: Opt<MedicalCondition>[] = [
  // Heart & metabolic
  { value: "hypertension", label: "High blood pressure" },
  { value: "high_cholesterol", label: "High cholesterol" },
  { value: "diabetes_type2", label: "Type 2 diabetes" },
  { value: "diabetes_type1", label: "Type 1 diabetes" },
  { value: "prediabetes", label: "Prediabetes" },
  { value: "metabolic_syndrome", label: "Metabolic syndrome" },
  // Digestive
  { value: "gerd", label: "Acid reflux / GERD" },
  { value: "ibs", label: "IBS" },
  { value: "ibd", label: "IBD (Crohn's / colitis)" },
  { value: "celiac", label: "Celiac / gluten" },
  { value: "diverticulitis", label: "Diverticulitis" },
  { value: "constipation", label: "Constipation" },
  { value: "lactose_intolerance", label: "Lactose intolerance" },
  // Liver, kidney & endocrine
  { value: "renal_issues", label: "Kidney issues" },
  { value: "fatty_liver", label: "Fatty liver" },
  { value: "gallbladder", label: "Gallbladder issues" },
  { value: "pancreatitis", label: "Pancreatitis" },
  { value: "hypothyroidism", label: "Hypothyroidism" },
  { value: "hyperthyroidism", label: "Hyperthyroidism" },
  { value: "gout", label: "Gout" },
  // Hormonal & life-stage
  { value: "pcos", label: "PCOS" },
  { value: "endometriosis", label: "Endometriosis" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "postpartum", label: "Postpartum" },
  { value: "menopause", label: "Menopause" },
  // Immune, blood & musculoskeletal
  { value: "anemia", label: "Anemia (iron)" },
  { value: "arthritis", label: "Arthritis" },
  { value: "osteoporosis", label: "Osteoporosis" },
  // Neurological
  { value: "migraine", label: "Migraine" },
];
const BODY_AREAS: Opt<string>[] = [
  { value: "neck", label: "Neck" },
  { value: "shoulder", label: "Shoulder" },
  { value: "arm", label: "Arm / elbow" },
  { value: "wrist", label: "Wrist / hand" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "core", label: "Core / abs" },
  { value: "hip", label: "Hip" },
  { value: "leg", label: "Leg" },
  { value: "knee", label: "Knee" },
  { value: "ankle", label: "Ankle / foot" },
];
const MED_KINDS: Opt<MedicationCategory>[] = [
  { value: "antibiotics", label: "Antibiotics" },
  { value: "antidepressants", label: "Antidepressants" },
  { value: "blood_thinners", label: "Blood thinners" },
  { value: "blood_pressure", label: "Blood pressure" },
  { value: "corticosteroids", label: "Steroids" },
  { value: "diabetes", label: "Diabetes" },
  { value: "diuretics", label: "Diuretics" },
  { value: "thyroid", label: "Thyroid" },
  { value: "nsaids", label: "Pain / anti-inflam." },
  { value: "other", label: "Other" },
];
const EQUIPMENT: Opt<Equipment>[] = [
  { value: "none", label: "Bodyweight" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "resistance_bands", label: "Bands" },
  { value: "pull_up_bar", label: "Pull-up bar" },
  { value: "bench", label: "Bench" },
  { value: "kettlebell", label: "Kettlebell" },
];
const TRIMESTERS: Opt<string>[] = [
  { value: "1", label: "1st" },
  { value: "2", label: "2nd" },
  { value: "3", label: "3rd" },
];
const TRAINING_DAYS: Opt<string>[] = [2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `${n} days`,
}));
const MEALS_PER_DAY: Opt<string>[] = [
  { value: "3", label: "3 meals" },
  { value: "4", label: "4 meals" },
];

const THEME_OPTIONS: {
  mode: "system" | "light" | "dark";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { mode: "system", label: "System", icon: "phone-portrait-outline" },
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
];

const CUISINES: { value: CuisinePreference; label: string }[] = [
  { value: "mixed", label: "No preference" },
  { value: "african", label: "African" },
  { value: "western", label: "Western" },
  { value: "mediterranean", label: "Mediterranean" },
];

const WATER_MIN = 1000;
const WATER_MAX = 5000;
const WATER_STEP = 250;
const WORKOUT_MIN = 1;
const WORKOUT_MAX = 7;

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** How each OS permission state reads in the Reminders section. */
const REMINDER_STATUS: Record<
  ReminderPermission,
  { label: string; subtitle: string }
> = {
  granted: { label: "Allowed", subtitle: "Welliva can send you reminders" },
  denied: {
    label: "Blocked",
    subtitle: "Turned off in device settings — tap to open them",
  },
  undetermined: { label: "Not set", subtitle: "Tap to turn reminders on" },
  unavailable: {
    label: "Unavailable",
    subtitle: "Needs the full app build (not Expo Go or web)",
  },
};

export default function SettingsScreen() {
  const { colors } = useColors();
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut } = useAuth();
  const { trackingMode, setTrackingMode } = useMealPlan();
  const {
    userBio,
    updateUserBio,
    userGoals,
    updateGoals,
    nutritionTargets,
    setCuisinePreference,
  } = useProfile();
  const params = useLocalSearchParams<{ edit?: string }>();

  const [showEditModal, setShowEditModal] = useState(params.edit === "1");
  const [editingBio, setEditingBio] = useState(userBio);
  const [isSaving, setIsSaving] = useState(false);
  const reminders = useReminderPermission();
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  // The "here's what I changed for you" recap shown after a save completes.
  const [changeSummary, setChangeSummary] = useState<BioChangeSummary | null>(
    null,
  );

  useEffect(() => {
    setEditingBio(userBio);
  }, [userBio]);

  const waterGoal =
    userGoals.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;
  const workoutTarget = userGoals.weeklyWorkoutsTarget ?? 3;
  const cuisine = userBio?.cuisinePreference ?? "mixed";

  /** Toggle a value in an array field, keeping it tidy (no dupes). */
  const toggleIn = <T,>(list: T[] | undefined, value: T): T[] => {
    const arr = list ?? [];
    return arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
  };

  const handleSaveBio = async () => {
    if (!editingBio) return;
    setIsSaving(true);
    try {
      const summary = await updateUserBio(editingBio);
      setShowEditModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      // Tell the user exactly what was re-fit — never a silent change.
      setChangeSummary(summary);
    } catch (error) {
      console.error("Error saving bio:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWaterGoal = (delta: number) => {
    const next = Math.min(WATER_MAX, Math.max(WATER_MIN, waterGoal + delta));
    if (next !== waterGoal) updateGoals({ dailyWaterMl: next });
  };

  const handleWorkoutTarget = (delta: number) => {
    const next = Math.min(
      WORKOUT_MAX,
      Math.max(WORKOUT_MIN, workoutTarget + delta),
    );
    if (next !== workoutTarget) updateGoals({ weeklyWorkoutsTarget: next });
  };

  /**
   * Fire the demo reminder. It arrives a few seconds later carrying the real
   * category, so the user sees the actual banner — action button included — and
   * has time to lock the phone and watch it land there.
   */
  const handleTestNotification = async () => {
    if (testState === "sending") return;
    setTestState("sending");
    const result = await sendTestNotification();
    await reminders.refresh();

    if (!result.ok) {
      setTestState("idle");
      Alert.alert(
        result.reason === "denied" ? "Reminders are off" : "Not available here",
        result.reason === "denied"
          ? "Turn on notifications for Welliva in your device settings to receive reminders."
          : "Notifications need the full app build — they don't run in Expo Go or on web.",
        result.reason === "denied"
          ? [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: reminders.openSystemSettings },
            ]
          : undefined,
      );
      return;
    }

    setTestState("sent");
    setTimeout(() => setTestState("idle"), result.delaySeconds * 1000 + 2000);
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Sign out of your account? Your profile is safely synced to the cloud.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              // AuthWrapper redirects to /sign-in once the session clears.
            } catch (error) {
              console.error("Error signing out:", error);
              Alert.alert("Error", "Failed to sign out.");
            }
          },
        },
      ],
    );
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset All Data",
      "This will erase all your data and return to onboarding. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              // Prefix-scan purge across BOTH namespaces. The old @welliva-only
              // filter left every @gozlin_* memory key behind on a "reset".
              await purgeAppData();
              router.replace("/");
            } catch (error) {
              console.error("Error resetting data:", error);
              Alert.alert("Error", "Failed to reset data.");
            }
          },
        },
      ],
    );
  };

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.iconBtn}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        Settings
      </AppText>
      <View style={styles.iconBtn} />
    </View>
  );

  return (
    <>
      <Screen header={header}>
        {/* What the app is for — gates which domains are planned, scored and
            kept in history. The untracked side isn't hidden, it's untracked:
            you can still work out or look up a meal, you just don't get graded
            on it. See models/trackingMode.ts. */}
        <Reveal index={0}>
          <View style={styles.section}>
            <SectionHeader
              title="What are you using Welliva for?"
              subtitle="Changes what gets planned and tracked"
            />
            <Card padding="lg">
              {TRACKING_MODE_OPTIONS.map((opt, i) => {
                const active = trackingMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      void setTrackingMode(opt.mode);
                    }}
                    style={[
                      styles.modeRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <IconBadge
                      name={opt.icon as never}
                      tone={active ? colors.primary : colors.textTertiary}
                      size={40}
                    />
                    <View style={styles.flex}>
                      <AppText variant="callout" color={active ? "brand" : "primary"}>
                        {opt.title}
                      </AppText>
                      <AppText variant="footnote" color="tertiary" style={styles.subtle}>
                        {opt.subtitle}
                      </AppText>
                      {active && opt.mode !== "both" ? (
                        <AppText variant="caption" color="secondary" style={styles.modeNote}>
                          {opt.note}
                        </AppText>
                      ) : null}
                    </View>
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={active ? colors.primary : colors.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        </Reveal>

        {/* Appearance */}
        <Reveal index={0}>
          <View style={styles.section}>
            <SectionHeader title="Appearance" />
            <Card padding="lg">
              <View style={styles.cardRowHead}>
                <IconBadge name="color-palette" tone={colors.fat} size={40} />
                <View style={styles.flex}>
                  <AppText variant="callout">Theme</AppText>
                  <AppText variant="footnote" color="tertiary" style={styles.subtle}>
                    Match your device, or pick a look
                  </AppText>
                </View>
              </View>
              <View style={styles.segment}>
                {THEME_OPTIONS.map((opt) => {
                  const active = themeMode === opt.mode;
                  return (
                    <Pressable
                      key={opt.mode}
                      onPress={() => setThemeMode(opt.mode)}
                      style={[
                        styles.segmentItem,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceSunken,
                        },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={17}
                        color={active ? colors.onPrimary : colors.textSecondary}
                      />
                      <AppText
                        variant="footnote"
                        color={active ? colors.onPrimary : "secondary"}
                        style={styles.segmentLabel}
                      >
                        {opt.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        </Reveal>

        {/* Goals */}
        <Reveal index={1}>
          <View style={styles.section}>
            <SectionHeader title="Goals" subtitle="Daily & weekly targets" />
            <Card padding="none">
              <StepperRow
                icon="water"
                tone={colors.water}
                title="Daily water goal"
                value={`${(waterGoal / 1000).toFixed(2)} L`}
                onDecrement={() => handleWaterGoal(-WATER_STEP)}
                onIncrement={() => handleWaterGoal(WATER_STEP)}
                canDecrement={waterGoal > WATER_MIN}
                canIncrement={waterGoal < WATER_MAX}
                colors={colors}
                divider
              />
              <StepperRow
                icon="barbell"
                tone={colors.fat}
                title="Weekly workouts"
                value={`${workoutTarget} / week`}
                onDecrement={() => handleWorkoutTarget(-1)}
                onIncrement={() => handleWorkoutTarget(1)}
                canDecrement={workoutTarget > WORKOUT_MIN}
                canIncrement={workoutTarget < WORKOUT_MAX}
                colors={colors}
              />
            </Card>
          </View>
        </Reveal>

        {/* Nutrition */}
        {userBio && (
          <Reveal index={2}>
            <View style={styles.section}>
              <SectionHeader
                title="Nutrition"
                subtitle="Flavor your meal plan"
              />
              <Card padding="lg">
                <View style={styles.cardRowHead}>
                  <IconBadge name="restaurant" tone={colors.protein} size={40} />
                  <View style={styles.flex}>
                    <AppText variant="callout">Cuisine preference</AppText>
                    <AppText variant="footnote" color="tertiary" style={styles.subtle}>
                      Today&apos;s meals update to match
                    </AppText>
                  </View>
                </View>
                <View style={styles.chips}>
                  {CUISINES.map((c) => (
                    <Chip
                      key={c.value}
                      label={c.label}
                      active={cuisine === c.value}
                      onPress={() => {
                        if (cuisine !== c.value) setCuisinePreference(c.value);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>
              </Card>
            </View>
          </Reveal>
        )}

        {/* Reminders */}
        <Reveal index={3}>
          <View style={styles.section}>
            <SectionHeader
              title="Reminders"
              subtitle="Nudges you can finish from the lock screen"
            />
            <Card padding="none">
              <SettingsRow
                icon="notifications"
                tone={colors.primary}
                title="Permission"
                subtitle={REMINDER_STATUS[reminders.status].subtitle}
                colors={colors}
                onPress={
                  reminders.status === "granted"
                    ? undefined
                    : reminders.status === "denied"
                      ? reminders.openSystemSettings
                      : () => router.push("/notifications-setup" as never)
                }
                right={
                  reminders.loading ? undefined : (
                    <Pill
                      label={REMINDER_STATUS[reminders.status].label}
                      tone={
                        reminders.status === "granted"
                          ? colors.success
                          : reminders.status === "denied"
                            ? colors.error
                            : colors.textTertiary
                      }
                      icon={reminders.status === "granted" ? "checkmark-circle" : undefined}
                      size="sm"
                    />
                  )
                }
                divider
              />
              <SettingsRow
                icon="paper-plane"
                tone={colors.water}
                title="Send test notification"
                subtitle={
                  testState === "sent"
                    ? "On its way — lock your phone to see it land"
                    : "Preview the real banner, buttons and all"
                }
                colors={colors}
                onPress={handleTestNotification}
                right={
                  testState === "sent" ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : undefined
                }
                divider
              />
              <SettingsRow
                icon="repeat"
                tone={colors.warning}
                title="Habit reminders"
                subtitle="Set the time each habit nudges you"
                colors={colors}
                onPress={() => router.push("/habits" as never)}
              />
            </Card>
          </View>
        </Reveal>

        {/* Account */}
        <Reveal index={4}>
          <View style={styles.section}>
            <SectionHeader title="Account" />
            <Card padding="none">
              <SettingsRow
                icon="person-circle"
                tone={colors.primary}
                title="Edit profile"
                subtitle="Age, body metrics, goal & activity"
                colors={colors}
                onPress={() => setShowEditModal(true)}
                divider
              />
              <SettingsRow
                icon="log-out"
                tone={colors.error}
                title="Sign out"
                subtitle={user?.email ? `Signed in as ${user.email}` : undefined}
                colors={colors}
                onPress={handleSignOut}
              />
            </Card>
          </View>
        </Reveal>

        {/* About */}
        <Reveal index={5}>
          <View style={styles.section}>
            <SectionHeader title="About" />
            <Card padding="none">
              <SettingsRow
                icon="information-circle"
                tone={colors.water}
                title="Version"
                colors={colors}
                right={
                  <AppText variant="callout" color="tertiary">
                    {APP_VERSION}
                  </AppText>
                }
              />
            </Card>
          </View>
        </Reveal>

        {/* Data */}
        <Reveal index={6}>
          <View style={styles.section}>
            <SectionHeader title="Data" />
            <Card padding="none">
              <SettingsRow
                icon="trash"
                tone={colors.error}
                title="Reset data"
                subtitle="Erase all data and start over"
                colors={colors}
                onPress={handleResetData}
              />
            </Card>
          </View>
        </Reveal>
      </Screen>

      {/* Edit modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <Pressable onPress={() => setShowEditModal(false)} hitSlop={8}>
              <AppText variant="body" color="secondary">
                Cancel
              </AppText>
            </Pressable>
            <AppText variant="headline">Edit profile</AppText>
            <Pressable onPress={handleSaveBio} disabled={isSaving} hitSlop={8}>
              <AppText variant="body" color="brand" style={styles.bold}>
                {isSaving ? "Saving…" : "Save"}
              </AppText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {editingBio && (
              <>
                <AppText variant="footnote" color="tertiary" style={styles.modalIntro}>
                  Tell me what&apos;s changed and I&apos;ll re-fit your meals and
                  workouts to match — right away.
                </AppText>

                {/* Basics */}
                <ChipGroup
                  label="Sex"
                  options={SEXES}
                  selected={(v) => editingBio.sex === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, sex: v as any })}
                  colors={colors}
                />
                <Field
                  label="Age"
                  value={String(editingBio.age)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, age: parseInt(v) || 0 })}
                  placeholder="Enter your age"
                  colors={colors}
                />
                <Field
                  label="Height (cm)"
                  value={String(editingBio.heightCm)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, heightCm: parseInt(v) || 0 })}
                  placeholder="Enter your height"
                  colors={colors}
                />
                <Field
                  label="Weight (kg)"
                  value={String(editingBio.weightKg)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, weightKg: parseInt(v) || 0 })}
                  placeholder="Enter your weight"
                  colors={colors}
                />

                <ChipGroup
                  label="Activity level"
                  options={ACTIVITY_LEVELS}
                  selected={(v) => editingBio.activityLevel === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, activityLevel: v as any })}
                  colors={colors}
                />
                <ChipGroup
                  label="Primary goal"
                  options={GOALS}
                  selected={(v) => editingBio.primaryGoal === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, primaryGoal: v as any })}
                  colors={colors}
                />
                <ChipGroup
                  label="Experience"
                  options={EXERCISE_LEVELS}
                  selected={(v) => editingBio.exerciseLevel === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, exerciseLevel: v as any })}
                  colors={colors}
                />

                {/* Nutrition needs */}
                <ChipGroup
                  label="Dietary restriction"
                  options={DIETARY_RESTRICTIONS}
                  selected={(v) => editingBio.dietaryRestriction === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, dietaryRestriction: v as any })}
                  colors={colors}
                />
                <ChipGroup
                  label="Allergies"
                  hint="Meals with these are filtered out."
                  options={ALLERGIES}
                  selected={(v) => (editingBio.allergies ?? []).includes(v)}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, allergies: toggleIn(editingBio.allergies, v) })
                  }
                  colors={colors}
                />

                {/* Health & safety */}
                <ChipGroup
                  label="Medical conditions"
                  hint="Used to pick safe diets and adjust your targets."
                  options={CONDITIONS}
                  selected={(v) => (editingBio.medicalConditions ?? []).includes(v as MedicalCondition)}
                  onToggle={(v) => {
                    const cond = v as MedicalCondition;
                    const next = toggleIn(editingBio.medicalConditions, cond);
                    setEditingBio({
                      ...editingBio,
                      medicalConditions: next,
                      // Drop the trimester if pregnancy was unselected.
                      pregnancyTrimester: next.includes("pregnancy")
                        ? editingBio.pregnancyTrimester
                        : undefined,
                    });
                  }}
                  colors={colors}
                />
                {(editingBio.medicalConditions ?? []).includes("pregnancy") && (
                  <ChipGroup
                    label="Which trimester?"
                    hint="Tunes your energy, hydration and movement safety."
                    options={TRIMESTERS}
                    selected={(v) => String(editingBio.pregnancyTrimester) === v}
                    onToggle={(v) =>
                      setEditingBio({
                        ...editingBio,
                        pregnancyTrimester: Number(v) as PregnancyTrimester,
                      })
                    }
                    colors={colors}
                  />
                )}
                <ChipGroup
                  label="Injuries / pain areas"
                  hint="I'll protect these — risky moves are kept out of your plan."
                  options={BODY_AREAS}
                  selected={(v) => (editingBio.injuries ?? []).includes(v)}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, injuries: toggleIn(editingBio.injuries, v) })
                  }
                  colors={colors}
                />
                <ChipGroup
                  label="Medication kinds"
                  hint="Kinds only — never names. Helps flag food interactions."
                  options={MED_KINDS}
                  selected={(v) =>
                    (editingBio.medicationCategories ?? []).includes(v as MedicationCategory)
                  }
                  onToggle={(v) =>
                    setEditingBio({
                      ...editingBio,
                      medicationCategories: toggleIn(
                        editingBio.medicationCategories,
                        v as MedicationCategory,
                      ),
                    })
                  }
                  colors={colors}
                />

                {/* Training setup */}
                <ChipGroup
                  label="Equipment"
                  options={EQUIPMENT}
                  selected={(v) => (editingBio.equipment ?? ["none"]).includes(v as Equipment)}
                  onToggle={(v) => {
                    const eq = v as Equipment;
                    const cur = editingBio.equipment ?? ["none"];
                    let next: Equipment[];
                    if (eq === "none") {
                      next = ["none"];
                    } else if (cur.includes(eq)) {
                      next = cur.filter((e) => e !== eq);
                    } else {
                      next = [...cur.filter((e) => e !== "none"), eq];
                    }
                    if (next.length === 0) next = ["none"];
                    setEditingBio({ ...editingBio, equipment: next });
                  }}
                  colors={colors}
                />
                <ChipGroup
                  label="Training days / week"
                  options={TRAINING_DAYS}
                  selected={(v) => String(editingBio.workoutDaysPerWeek) === v}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, workoutDaysPerWeek: Number(v) })
                  }
                  colors={colors}
                />
                <ChipGroup
                  label="Meals per day"
                  options={MEALS_PER_DAY}
                  selected={(v) => String(editingBio.mealsPerDay) === v}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, mealsPerDay: Number(v) as 3 | 4 })
                  }
                  colors={colors}
                />

                <Button label="Save changes" icon="checkmark" onPress={handleSaveBio} loading={isSaving} style={styles.saveBtn} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* "Here's what I changed for you" recap */}
      <Modal
        visible={!!changeSummary}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeSummary(null)}
      >
        <Pressable
          style={[styles.summaryScrim, { backgroundColor: colors.scrim }]}
          onPress={() => setChangeSummary(null)}
        >
          <Pressable
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: alpha(colors.primary, 0.35) },
            ]}
          >
            <IconBadge name="sparkles" tone={colors.primary} size={56} solid />
            <AppText variant="title" align="center" style={styles.summaryTitle}>
              {changeSummary?.headline}
            </AppText>
            <View style={styles.summaryLines}>
              {changeSummary?.lines.map((line, i) => (
                <View key={i} style={styles.summaryLine}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <AppText variant="subhead" color="secondary" style={styles.flex}>
                    {line}
                  </AppText>
                </View>
              ))}
            </View>
            <Button
              label="Got it"
              onPress={() => setChangeSummary(null)}
              style={styles.summaryBtn}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

/** A labeled row of selectable chips — works for single- or multi-select. */
function ChipGroup<T extends string>({
  label,
  hint,
  options,
  selected,
  onToggle,
  colors,
}: {
  label: string;
  hint?: string;
  options: Opt<T>[];
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.group}>
      <AppText variant="footnote" color="secondary" style={styles.fieldLabel}>
        {label}
      </AppText>
      {hint && (
        <AppText variant="caption" color="tertiary" style={styles.groupHint}>
          {hint}
        </AppText>
      )}
      <View style={styles.options}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={selected(o.value)}
            onPress={() => onToggle(o.value)}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  tone,
  title,
  subtitle,
  onPress,
  right,
  divider,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  divider?: boolean;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.settingsRow,
        divider && { borderBottomWidth: 1, borderBottomColor: colors.divider },
      ]}
    >
      <IconBadge name={icon} tone={tone} size={40} />
      <View style={styles.flex}>
        <AppText variant="callout">{title}</AppText>
        {subtitle && (
          <AppText variant="footnote" color="tertiary" style={styles.subtle}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress && <ThemedIcon name="chevron-forward" size={18} role="textTertiary" />)}
    </Pressable>
  );
}

function StepperRow({
  icon,
  tone,
  title,
  value,
  onDecrement,
  onIncrement,
  canDecrement,
  canIncrement,
  divider,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;
  divider?: boolean;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View
      style={[
        styles.settingsRow,
        divider && { borderBottomWidth: 1, borderBottomColor: colors.divider },
      ]}
    >
      <IconBadge name={icon} tone={tone} size={40} />
      <View style={styles.flex}>
        <AppText variant="callout">{title}</AppText>
        <AppText variant="footnote" color="secondary" style={styles.subtle}>
          {value}
        </AppText>
      </View>
      <View style={styles.stepper}>
        <StepBtn
          icon="remove"
          onPress={onDecrement}
          disabled={!canDecrement}
          colors={colors}
        />
        <StepBtn
          icon="add"
          onPress={onIncrement}
          disabled={!canIncrement}
          colors={colors}
        />
      </View>
    </View>
  );
}

function StepBtn({
  icon,
  onPress,
  disabled,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[
        styles.stepBtn,
        {
          backgroundColor: colors.surfaceSunken,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.field}>
      <AppText variant="footnote" color="secondary" style={styles.fieldLabel}>
        {label}
      </AppText>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        maxFontSizeMultiplier={1.3}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="subhead" color={active ? colors.onPrimary : "secondary"} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  subtle: { marginTop: 2 },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  modeNote: { marginTop: 6, lineHeight: 17 },
  section: { marginTop: Spacing.xxl },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // Card head (icon + title above a control)
  cardRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },

  // Theme segmented control
  segment: { flexDirection: "row", gap: Spacing.sm },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  segmentLabel: { fontWeight: "600" },

  // Rows
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },

  // Stepper
  stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontWeight: "600" },

  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalBody: { padding: Spacing.screen, paddingBottom: Spacing.huge },
  modalIntro: { marginBottom: Spacing.lg, lineHeight: 18 },
  field: { marginBottom: Spacing.lg },
  fieldLabel: { marginBottom: Spacing.sm, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  saveBtn: { marginTop: Spacing.xl },

  // Chip group (edit form)
  group: { marginBottom: Spacing.md },
  groupHint: { marginBottom: Spacing.sm },

  // Change-summary recap modal
  summaryScrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  summaryCard: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  summaryTitle: { marginTop: Spacing.md },
  summaryLines: {
    alignSelf: "stretch",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  summaryLine: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  summaryBtn: { alignSelf: "stretch", marginTop: Spacing.xl },
});
