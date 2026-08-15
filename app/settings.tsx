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
import { useLegalGate } from "@/components/legal";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCS,
  LEGAL_DOC_ORDER,
  LEGAL_VERSION,
} from "@/constants/legal";
import {
  useReminderPermission,
  type ReminderPermission,
} from "@/components/notifications/useReminderPermission";
import { sendTestNotification } from "@/services/notifications/send";
import {
  accountHasPassword,
  ReauthenticationError,
} from "@/services/account/AccountDeletion";
import { useBilling } from "@/contexts/BillingContext";
import {
  getDevProOverride,
  MANAGE_SUBSCRIPTION_URL,
  resetUsage,
  setDevProOverride,
} from "@/services/billing";
import { fullPushSweep } from "@/services/sync/SyncEngine";
import { getActiveUserId, purgeAppData } from "@/services/sync/UserScope";
import { describeSyncStatus, useSyncStatus } from "@/services/sync/useSyncStatus";
import { LIGHT_MODE_ENABLED, Radius, Spacing, alpha } from "@/constants/theme";
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
import * as Haptics from "@/utils/haptics";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { TRACKING_MODE_OPTIONS } from "@/models/trackingMode";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
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
  { value: "active", label: "Very active" },
  { value: "very_active", label: "Extra active" },
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

/** "2 minutes ago" / "yesterday" — relative reads better than a raw timestamp. */
function formatLastSync(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Not synced yet";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Synced yesterday" : `Synced ${days} days ago`;
}

export default function SettingsScreen() {
  const { colors } = useColors();
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut, deleteAccount } = useAuth();
  const syncStatus = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const { acceptance } = useLegalGate();
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
  // Account deletion. Its own modal rather than an Alert: this is the one
  // irreversible action in the app, and Alert.prompt (the only native way to
  // ask for typed input) is iOS-only — an Android user would get a two-tap
  // "Delete" on a permanent action. See handleDeleteAccount.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Shown inline under the password field rather than as an Alert: a wrong
  // password is a correction, not an incident, and an Alert would dismiss the
  // sheet the user is mid-way through filling in.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Subscription. `billing` also drives which row the section shows.
  const billing = useBilling();
  const [restoring, setRestoring] = useState(false);
  const [devTier, setDevTier] = useState<boolean | null>(() => getDevProOverride());

  useEffect(() => {
    setEditingBio(userBio);
  }, [userBio]);

  // The dev override is restored from disk during billing hydration, which
  // finishes after this screen's first render — so re-read it once that lands.
  useEffect(() => {
    if (__DEV__ && !billing.isHydrating) setDevTier(getDevProOverride());
  }, [billing.isHydrating]);

  /**
   * Restore purchases. Store-required, and it must give an answer either way —
   * silence after tapping "Restore" reads as a broken app to someone who has
   * genuinely paid and is trying to get their subscription back.
   */
  const handleRestorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await billing.restore();
      if (result.isPro) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
        Alert.alert("Welcome back", "Your Welliva Pro subscription is active again.");
      } else if (!result.ok) {
        Alert.alert(
          "Couldn't restore",
          result.message ??
            "We couldn't reach the store. Check your connection and try again.",
        );
      } else {
        Alert.alert(
          "Nothing to restore",
          "No active subscription was found for the store account signed in on this device.",
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  /** Dev tier switch: real → free → pro → real. Also clears the day's meters. */
  const handleCycleDevTier = async () => {
    const next = devTier === null ? false : devTier === false ? true : null;
    setDevTier(next);
    await setDevProOverride(next);
    // Reset the coach/photo counters too, so flipping to Free hands you a clean
    // 3 messages rather than whatever you'd already spent as Pro.
    await resetUsage();
    Haptics.selectionAsync().catch(() => {});
  };

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

  /** Drain the outbox on demand. The one manual lever over a silent system. */
  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const userId = await getActiveUserId();
      if (!userId) return;
      await fullPushSweep(userId);
    } catch (error) {
      console.warn("Manual sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    // Sign-out already REFUSES to purge while writes are pending (see
    // SupabaseAuthProvider) — the data survives either way. What was missing is
    // telling the user, so "sign out on the train and lose today's logs" stops
    // being a thing they only discover afterwards.
    const pending = syncStatus.pendingCount;
    const body =
      pending > 0
        ? `${pending} change${pending === 1 ? "" : "s"} ${pending === 1 ? "hasn't" : "haven't"} reached the cloud yet. ` +
          `They'll stay on this device and sync next time you're signed in with a connection — ` +
          `or you can wait for signal and sign out after.`
        : "Sign out of your account? Your profile is safely synced to the cloud.";

    Alert.alert("Sign out", body, [
      { text: "Cancel", style: "cancel" },
      ...(pending > 0 && syncStatus.online
        ? [{ text: "Sync first", onPress: () => void handleSyncNow() }]
        : []),
      {
        text: pending > 0 ? "Sign out anyway" : "Sign out",
        style: "destructive" as const,
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
    ]);
  };

  /** The word the user must type. Uppercase so it cannot be muscle-memory. */
  const DELETE_PHRASE = "DELETE";
  /**
   * Google accounts have no password to re-enter. Asking for one would lock
   * them out of deleting their own account — the exact failure this flow exists
   * to prevent — so for them the live OAuth session IS the identity proof.
   */
  const needsPassword = accountHasPassword(user);
  const canConfirmDelete =
    deleteConfirmText.trim().toUpperCase() === DELETE_PHRASE &&
    (!needsPassword || deletePassword.length > 0) &&
    !deleting;

  const closeDeleteModal = () => {
    if (deleting) return; // never yank the sheet out mid-teardown
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    setDeletePassword("");
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      // The account is gone and the session with it. Don't route manually —
      // clearing the session makes AuthWrapper redirect to /sign-in, and racing
      // it here would push a route onto a tree that is being torn down.
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      setDeletePassword("");
    } catch (error) {
      setDeleting(false);

      // A failed password check is not a failed deletion — nothing was touched.
      // Keep the user in the sheet with the field cleared so they can retype,
      // and say nothing about the account, because there is nothing to say.
      if (error instanceof ReauthenticationError) {
        setDeletePassword("");
        setDeleteError(error.message);
        return;
      }

      console.error("Error deleting account:", error);
      // deleteAccount only throws while the account still EXISTS, so it is
      // honest — and important — to say nothing was deleted. Telling someone
      // their data might be half-gone when it is fully intact would be worse
      // than the failure itself.
      Alert.alert(
        "Couldn't delete your account",
        "Something went wrong and your account has NOT been deleted. " +
          "Check your connection and try again — if it keeps failing, email " +
          `${LEGAL_CONTACT_EMAIL} and we'll do it for you.`,
      );
    }
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
        accessibilityRole="button"
        accessibilityLabel="Go back"
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
                    accessible
                    accessibilityRole="radio"
                    accessibilityLabel={opt.title}
                    accessibilityState={{ selected: active, checked: active }}
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

        {/* Appearance — hidden while light mode is disabled (LIGHT_MODE_ENABLED
            in constants/theme.ts). Flip that flag and the picker returns. */}
        {LIGHT_MODE_ENABLED ? (
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
                      accessible
                      accessibilityRole="radio"
                      accessibilityLabel={opt.label}
                      accessibilityState={{ selected: active, checked: active }}
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
        ) : null}

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

        {/* Subscription — "Manage subscription" and "Restore purchases" are
            both REQUIRED by Google Play and the App Store, and an app without
            them is rejected. They also have to work for a user who is already
            subscribed, which is why the restore row is always shown and never
            hidden behind the free-tier branch. */}
        <Reveal index={4}>
          <View style={styles.section}>
            <SectionHeader
              title="Subscription"
              subtitle={billing.isPro ? "Welliva Pro" : "Free plan"}
            />
            <Card padding="none">
              {billing.isPro ? (
                <SettingsRow
                  icon="star"
                  tone={colors.gold}
                  title="Manage subscription"
                  subtitle={
                    billing.entitlement.expiresAt
                      ? `Renews ${new Date(billing.entitlement.expiresAt).toLocaleDateString()}`
                      : "Change or cancel your plan"
                  }
                  colors={colors}
                  onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
                  divider
                />
              ) : (
                <SettingsRow
                  icon="sparkles"
                  tone={colors.gold}
                  title="Upgrade to Welliva Pro"
                  subtitle="Unlimited coaching, plans built for you, full history"
                  colors={colors}
                  onPress={() => billing.openPaywall("settings")}
                  divider
                />
              )}
              <SettingsRow
                icon="refresh"
                tone={colors.water}
                title="Restore purchases"
                subtitle={
                  restoring
                    ? "Checking with the store…"
                    : "Already subscribed? Bring it back on this device"
                }
                colors={colors}
                onPress={handleRestorePurchases}
                divider={__DEV__}
              />
              {/* Dev-only tier switch. Every lock has to be walkable before the
                  RevenueCat account exists — otherwise the free-tier experience
                  first gets tested during store review. Stripped in release. */}
              {__DEV__ ? (
                <SettingsRow
                  icon="construct"
                  tone={colors.warning}
                  title="Dev: force tier"
                  subtitle={
                    devTier === null
                      ? "Off — using the real entitlement"
                      : devTier
                        ? "Forced to PRO"
                        : "Forced to FREE"
                  }
                  colors={colors}
                  onPress={handleCycleDevTier}
                  right={
                    <Pill
                      label={devTier === null ? "REAL" : devTier ? "PRO" : "FREE"}
                      tone={devTier === null ? colors.textTertiary : colors.warning}
                    />
                  }
                />
              ) : null}
            </Card>
          </View>
        </Reveal>

        {/* Account */}
        <Reveal index={5}>
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
        <Reveal index={6}>
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

        {/* Legal — the policies the user accepted, always re-readable. The
            subtitle records WHICH version they agreed to and when. */}
        <Reveal index={7}>
          <View style={styles.section}>
            <SectionHeader
              title="Legal"
              subtitle={
                acceptance
                  ? `Accepted version ${acceptance.version} on ${new Date(
                      acceptance.acceptedAt,
                    ).toLocaleDateString()}`
                  : `Version ${LEGAL_VERSION}`
              }
            />
            <Card padding="none">
              {LEGAL_DOC_ORDER.map((id, i) => {
                const doc = LEGAL_DOCS[id];
                return (
                  <SettingsRow
                    key={id}
                    icon={doc.icon as keyof typeof Ionicons.glyphMap}
                    tone={id === "disclaimer" ? colors.warning : colors.primary}
                    title={doc.title}
                    subtitle={doc.summary}
                    colors={colors}
                    onPress={() => router.push(`/legal/${id}` as never)}
                    divider={i < LEGAL_DOC_ORDER.length - 1}
                  />
                );
              })}
            </Card>
          </View>
        </Reveal>

        {/* Data */}
        <Reveal index={8}>
          <View style={styles.section}>
            <SectionHeader title="Data" />
            <Card padding="none">
              {/* "Is my data actually in the cloud?" — previously unanswerable
                  from inside the app. Now it's a row with a timestamp and a
                  button, so a user with a flaky connection can check and act
                  instead of guessing. */}
              {/* On the free tier this row stops being "sync now" and becomes
                  the honest statement of where the data lives, plus the way to
                  change that. Offering a Sync button that silently does nothing
                  would be the worst of both. */}
              {syncStatus.cloudDisabled ? (
                <SettingsRow
                  icon="cloud-offline-outline"
                  tone={colors.gold}
                  title="Cloud backup is off"
                  subtitle="Your data is saved on this device. Pro backs it up and syncs every device you sign in on."
                  colors={colors}
                  onPress={() => billing.openPaywall("sync")}
                />
              ) : (
                <SettingsRow
                  icon={syncStatus.online ? "cloud-done-outline" : "cloud-offline-outline"}
                  tone={syncStatus.state === "synced" ? colors.success : colors.warning}
                  title={syncing ? "Syncing…" : "Sync now"}
                  subtitle={`${describeSyncStatus(syncStatus)} · ${formatLastSync(syncStatus.lastSyncAt)}`}
                  colors={colors}
                  onPress={handleSyncNow}
                />
              )}
              <SettingsRow
                icon="trash"
                tone={colors.error}
                title="Reset data"
                subtitle="Erase all data and start over"
                colors={colors}
                divider
                onPress={handleResetData}
              />
              {/* Deliberately the LAST row in the last section, and the only
                  one that leaves the app. "Reset data" above is the recoverable
                  neighbour (device only, account intact) — keeping them adjacent
                  is what makes the difference legible: one starts you over, one
                  ends you. Required in-app by App Store 5.1.1(v) and promised in
                  the privacy policy under "How long we keep it". */}
              <SettingsRow
                icon="person-remove-outline"
                tone={colors.error}
                title="Delete account"
                subtitle="Permanently erase your account and all data"
                colors={colors}
                onPress={() => setShowDeleteModal(true)}
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
            <Pressable
              onPress={() => setShowEditModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <AppText variant="body" color="secondary">
                Cancel
              </AppText>
            </Pressable>
            <AppText variant="headline">Edit profile</AppText>
            <Pressable
              onPress={handleSaveBio}
              disabled={isSaving}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
            >
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
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
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

      {/* Delete account — the confirmation.
          Three deliberate frictions, because this is the only action in the app
          with no undo and no support path back:
            1. it names what goes, rather than saying "all your data" — people
               under-estimate that, then discover the loss later;
            2. it requires typing DELETE, so it cannot be reached by tapping
               through muscle memory in the same spot as "Reset data" above;
            3. it can't be dismissed while running, so a tap on the scrim
               mid-teardown can't leave the user staring at a working app whose
               account is already gone. */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <Pressable
          style={[styles.summaryScrim, { backgroundColor: colors.scrim }]}
          onPress={closeDeleteModal}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          {/* Swallows taps so pressing inside the card doesn't hit the scrim. */}
          <Pressable
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: alpha(colors.error, 0.35) },
            ]}
          >
            <IconBadge name="warning" tone={colors.error} size={56} solid />
            <AppText variant="title" align="center" style={styles.summaryTitle}>
              Delete your account?
            </AppText>
            <AppText variant="subhead" color="secondary" align="center">
              This cannot be undone. We&apos;ll permanently erase:
            </AppText>

            <View style={styles.summaryLines}>
              {[
                "Your profile, goals and health details",
                "Every meal, workout, weight and water log",
                "Your streaks, achievements and habits",
                "Progress photos and anything Gozlin remembers",
              ].map((line) => (
                <View key={line} style={styles.summaryLine}>
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                  <AppText variant="subhead" color="secondary" style={styles.flex}>
                    {line}
                  </AppText>
                </View>
              ))}
            </View>

            {/* IDENTITY. The typed word below proves the user meant it; this
                proves it's their account. Without it an unlocked phone is
                enough to erase someone's whole health history. Hidden entirely
                for Google accounts, which have no password to give. */}
            {needsPassword && (
              <>
                <AppText variant="caption" color="secondary" align="center">
                  Confirm it&apos;s you
                </AppText>
                <TextInput
                  value={deletePassword}
                  onChangeText={(text) => {
                    setDeletePassword(text);
                    setDeleteError(null); // clear the error as they retype
                  }}
                  editable={!deleting}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  placeholder="Your password"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Your password, to confirm account deletion"
                  style={[
                    styles.input,
                    styles.deleteField,
                    {
                      color: colors.text,
                      borderColor: deleteError ? colors.error : colors.divider,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
                {!!deleteError && (
                  // `alert` so a screen reader announces the correction without
                  // the user having to go looking for why nothing happened.
                  <AppText
                    variant="caption"
                    align="center"
                    accessibilityRole="alert"
                    style={{ color: colors.error }}
                  >
                    {deleteError}
                  </AppText>
                )}
              </>
            )}

            <AppText variant="caption" color="secondary" align="center">
              Type {DELETE_PHRASE} to confirm.
            </AppText>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              editable={!deleting}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={DELETE_PHRASE}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={`Type ${DELETE_PHRASE} to confirm account deletion`}
              style={[
                styles.input,
                styles.deleteField,
                styles.deletePhrase,
                {
                  color: colors.text,
                  borderColor: canConfirmDelete ? colors.error : colors.divider,
                  backgroundColor: colors.background,
                },
              ]}
            />

            <Button
              label={deleting ? "Deleting…" : "Delete my account"}
              variant="danger"
              fullWidth
              loading={deleting}
              disabled={!canConfirmDelete}
              onPress={() => void handleDeleteAccount()}
              accessibilityHint="Permanently erases your account and all data"
              style={styles.summaryBtn}
            />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              disabled={deleting}
              onPress={closeDeleteModal}
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
      // Reads as one row rather than three fragments (badge, title, subtitle).
      // Non-tappable rows stay plain text so they aren't announced as buttons.
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
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
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  colors: ReturnType<typeof useColors>["colors"];
  /** Spoken name — the glyph alone ("+"/"−") says nothing about what changes. */
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label ?? (icon.includes("add") ? "Increase" : "Decrease")}
      accessibilityState={{ disabled: !!disabled }}
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
      accessibilityRole="button"
      accessibilityLabel={label}
      // `selected` is what tells a screen-reader user which option is currently
      // chosen — without it every chip in the group sounds identical.
      accessibilityState={{ selected: active }}
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

  // Delete-account inputs. Shared layout…
  deleteField: {
    alignSelf: "stretch",
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  // …but only the typed word gets the letter-spaced treatment, so it reads as a
  // deliberate act rather than an ordinary form field. Applying this to the
  // password too would space out the secure-entry dots into nonsense.
  deletePhrase: {
    letterSpacing: 2,
    fontWeight: "700",
  },
});
