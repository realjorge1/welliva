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
  Chip,
  Divider,
  IconBadge,
  ListGroup,
  ListRow,
  Pill,
  Reveal,
  Screen,
  SectionHeader,
  SegmentedControl,
  Stepper,
  useColors,
} from "@/components/ui";
import { ScreenTopBar } from "@/components/navigation";
import { useTheme } from "@/components/ThemeContext";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { useLegalGate } from "@/components/legal";
import { LEGAL_CONTACT_EMAIL, LEGAL_VERSION } from "@/constants/legal";
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
import { TRACKING_MODE_OPTIONS, tracksDiet } from "@/models/trackingMode";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  value: "system" | "light" | "dark";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

/**
 * Cuisines, laid out as a 2×2 grid rather than a wrapping pill row. Four labels
 * of very different lengths ("African" vs "No preference") flow into a ragged
 * right edge that reads as a mistake — an even grid says these are four equal
 * choices. Icons come along because a half-width tile has the room for them.
 */
const CUISINES: {
  value: CuisinePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "mixed", label: "No preference", icon: "globe-outline" },
  { value: "african", label: "African", icon: "leaf-outline" },
  { value: "western", label: "Western", icon: "restaurant-outline" },
  { value: "mediterranean", label: "Mediterranean", icon: "fish-outline" },
];

const WATER_MIN = 1000;
const WATER_MAX = 5000;
const WATER_STEP = 250;
const WORKOUT_MIN = 1;
const WORKOUT_MAX = 7;
/**
 * Target-weight bounds. Wide on purpose — this is a destination, not a health
 * assessment, and clamping someone's stated goal is not our call. The floor and
 * ceiling exist only so a stuck finger can't drive it to an absurd number.
 */
const TARGET_WEIGHT_MIN = 35;
const TARGET_WEIGHT_MAX = 250;
const TARGET_WEIGHT_STEP = 0.5;

/** Meals-per-day is a closed pair, so it reads as a switch, not a chip list. */
const MEALS_PER_DAY_OPTIONS = [
  { value: 3, label: "3 meals" },
  { value: 4, label: "4 meals" },
];

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
  // Meals-per-day writes through updateUserBio, which regenerates the day's
  // meals before it resolves. Hold the tapped value locally so the control moves
  // under the finger instead of sitting on the old number until the plan lands.
  const [pendingMeals, setPendingMeals] = useState<3 | 4 | null>(null);

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
  const mealsPerDay = pendingMeals ?? userBio?.mealsPerDay ?? 3;
  // Target weight is genuinely optional: unset means "no destination", and the
  // forecast says so rather than inventing one. Hence null, not a default.
  const targetWeight = userGoals.targetWeightKg ?? null;
  const currentWeight = userBio?.weightKg ?? null;
  /** Signed distance left, in kg. Positive = to lose, negative = to gain. */
  const weightGap =
    targetWeight != null && currentWeight != null
      ? Math.round((currentWeight - targetWeight) * 10) / 10
      : null;
  /** Nutrition only earns a targets panel when nutrition is actually tracked. */
  const dietTracked = tracksDiet(trackingMode);

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
   * Start a weight goal at today's weight rather than at some invented target —
   * the app has no business guessing where someone should be heading. From
   * there the stepper is the whole conversation.
   */
  const handleStartTargetWeight = () => {
    const seed = currentWeight ? Math.round(currentWeight) : 70;
    Haptics.selectionAsync().catch(() => {});
    void updateGoals({ targetWeightKg: seed });
  };

  const handleTargetWeight = (delta: number) => {
    if (targetWeight == null) return;
    // Round to the step so a value seeded from a decimal bodyweight can't drift
    // into 72.3 → 72.8 → 73.3.
    const raw = Math.min(
      TARGET_WEIGHT_MAX,
      Math.max(TARGET_WEIGHT_MIN, targetWeight + delta),
    );
    const next = Math.round(raw * 2) / 2;
    if (next !== targetWeight) void updateGoals({ targetWeightKg: next });
  };

  /**
   * Splitting the day differently rebuilds the plan, so this goes through the
   * same re-fit path as any other bio change — and reports back with the same
   * "here's what changed" recap.
   */
  const handleMealsPerDay = async (next: number) => {
    if (!userBio || next === userBio.mealsPerDay || pendingMeals !== null) return;
    const value = next as 3 | 4;
    setPendingMeals(value);
    try {
      const summary = await updateUserBio({ mealsPerDay: value });
      setChangeSummary(summary);
    } catch (error) {
      console.error("Error changing meals per day:", error);
      Alert.alert("Couldn't update", "Your meal plan didn't change. Please try again.");
    } finally {
      setPendingMeals(null);
    }
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

  const header = <ScreenTopBar title="Settings" style={styles.headerRow} />;

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
              title="Your focus"
              subtitle="What Welliva plans and tracks for you"
            />
            <ListGroup>
              {TRACKING_MODE_OPTIONS.map((opt) => {
                const active = trackingMode === opt.mode;
                return (
                  <ListRow
                    key={opt.mode}
                    icon={opt.icon as keyof typeof Ionicons.glyphMap}
                    tone={active ? colors.primary : colors.textTertiary}
                    title={opt.title}
                    subtitle={opt.subtitle}
                    // What you give up only matters once an option is the one in
                    // force — on the other two rows it's noise.
                    footer={
                      active && opt.mode !== "both" ? (
                        <AppText
                          variant="caption"
                          color="secondary"
                          style={styles.modeNote}
                        >
                          {opt.note}
                        </AppText>
                      ) : undefined
                    }
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      void setTrackingMode(opt.mode);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, checked: active }}
                    chevron={false}
                    right={
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={active ? colors.primary : colors.textTertiary}
                      />
                    }
                  />
                );
              })}
            </ListGroup>
          </View>
        </Reveal>

        {/* Appearance — hidden while light mode is disabled (LIGHT_MODE_ENABLED
            in constants/theme.ts). Flip that flag and the picker returns. */}
        {LIGHT_MODE_ENABLED ? (
        <Reveal index={0}>
          <View style={styles.section}>
            <SectionHeader title="Appearance" />
            <Card padding="lg">
              <ControlBlock
                icon="color-palette"
                tone={colors.fat}
                title="Theme"
                subtitle="Match your device, or pick a look"
              >
                <SegmentedControl
                  options={THEME_OPTIONS}
                  value={themeMode}
                  onChange={setThemeMode}
                  label="Theme"
                />
              </ControlBlock>
            </Card>
          </View>
        </Reveal>
        ) : null}

        {/* Goals — the numbers you're aiming at. Every one of these is read by
            something real: water and workouts drive the daily rings, streaks and
            Gozlin's habit report; target weight is what gives the Transformation
            Forecast a destination (without it there's no goal date to compute). */}
        <Reveal index={1}>
          <View style={styles.section}>
            <SectionHeader title="Goals" subtitle="What you're aiming at" />
            <ListGroup>
              <ListRow
                icon="water"
                tone={colors.water}
                title="Daily water"
                chevron={false}
                right={
                  <Stepper
                    label="daily water goal"
                    value={`${(waterGoal / 1000).toFixed(1)} L`}
                    onDecrement={() => handleWaterGoal(-WATER_STEP)}
                    onIncrement={() => handleWaterGoal(WATER_STEP)}
                    canDecrement={waterGoal > WATER_MIN}
                    canIncrement={waterGoal < WATER_MAX}
                  />
                }
              />
              <ListRow
                icon="barbell"
                tone={colors.fat}
                title="Weekly workouts"
                chevron={false}
                right={
                  <Stepper
                    label="weekly workout target"
                    value={`${workoutTarget} / wk`}
                    onDecrement={() => handleWorkoutTarget(-1)}
                    onIncrement={() => handleWorkoutTarget(1)}
                    canDecrement={workoutTarget > WORKOUT_MIN}
                    canIncrement={workoutTarget < WORKOUT_MAX}
                  />
                }
              />
              {/* Two states, deliberately: an unset target is a real answer
                  ("I'm not chasing a number"), so it gets an invitation rather
                  than a stepper pre-loaded with a weight nobody chose. */}
              {targetWeight == null ? (
                <ListRow
                  icon="flag"
                  tone={colors.gold}
                  title="Target weight"
                  subtitle="Not set — unlocks your goal date and forecast"
                  onPress={handleStartTargetWeight}
                  chevron={false}
                  right={<Pill label="Set" tone={colors.gold} size="sm" />}
                />
              ) : (
                <ListRow
                  icon="flag"
                  tone={colors.gold}
                  title="Target weight"
                  subtitle={
                    weightGap == null
                      ? "Where you're heading"
                      : weightGap > 0
                        ? `${weightGap} kg to go`
                        : weightGap < 0
                          ? `${Math.abs(weightGap)} kg to gain`
                          : "You're at your target"
                  }
                  chevron={false}
                  right={
                    <Stepper
                      label="target weight"
                      value={`${targetWeight} kg`}
                      onDecrement={() => handleTargetWeight(-TARGET_WEIGHT_STEP)}
                      onIncrement={() => handleTargetWeight(TARGET_WEIGHT_STEP)}
                      canDecrement={targetWeight > TARGET_WEIGHT_MIN}
                      canIncrement={targetWeight < TARGET_WEIGHT_MAX}
                    />
                  }
                />
              )}
            </ListGroup>
          </View>
        </Reveal>

        {/* Nutrition */}
        {userBio && (
          <Reveal index={2}>
            <View style={styles.section}>
              <SectionHeader
                title="Nutrition"
                subtitle={
                  dietTracked
                    ? "Your daily targets and how meals are built"
                    : "How meal lookups are flavoured"
                }
              />

              {/* THE TARGETS, SHOWN — they used to exist only inside the diet
                  tab, so the one screen called "settings" never said what your
                  numbers were. Read-only by design: NutritionService derives
                  these from body, activity, goal and health profile, and clamps
                  them to medically-sensible floors (and to a surplus, never a
                  deficit, in pregnancy). A hand-typed calorie box would walk
                  straight through all of that, so the way to move these numbers
                  is to correct the facts under them — the row below. */}
              {dietTracked && nutritionTargets ? (
                <Card padding="lg">
                  <View style={styles.calorieRow}>
                    <IconBadge name="flame" tone={colors.calories} size={44} />
                    <View style={styles.flex}>
                      <AppText variant="metric">
                        {nutritionTargets.calories.toLocaleString()}
                      </AppText>
                      <AppText variant="footnote" color="tertiary">
                        calories a day
                      </AppText>
                    </View>
                    {/* `guidance` is only ever present when a condition or a
                        medication actually moved these numbers — so the badge
                        appears exactly when there's something behind it. */}
                    {nutritionTargets.guidance ? (
                      <Pill
                        label="Health-adjusted"
                        tone={colors.success}
                        icon="shield-checkmark"
                        size="sm"
                      />
                    ) : null}
                  </View>
                  <View
                    style={[styles.macroRow, { borderTopColor: colors.divider }]}
                  >
                    <MacroStat
                      label="Protein"
                      grams={nutritionTargets.proteinG}
                      tone={colors.protein}
                    />
                    <MacroStat
                      label="Carbs"
                      grams={nutritionTargets.carbsG}
                      tone={colors.carbs}
                    />
                    <MacroStat
                      label="Fat"
                      grams={nutritionTargets.fatG}
                      tone={colors.fat}
                    />
                  </View>
                </Card>
              ) : null}

              {/* Only the SECOND card onward carries the stack gap — without
                  the conditional the controls card would float away from the
                  section header whenever the targets panel is hidden. */}
              <Card
                padding="lg"
                style={dietTracked && nutritionTargets ? styles.stacked : undefined}
              >
                {/* Meals per day was buried in the profile modal even though it
                    changes the shape of every day. It belongs with nutrition. */}
                {dietTracked ? (
                  <>
                    <ControlBlock
                      icon="restaurant"
                      tone={colors.protein}
                      title="Meals per day"
                      subtitle="How your plan splits the day"
                      busy={pendingMeals !== null}
                    >
                      <SegmentedControl
                        options={MEALS_PER_DAY_OPTIONS}
                        value={mealsPerDay}
                        onChange={(n) => void handleMealsPerDay(n)}
                        label="Meals per day"
                      />
                    </ControlBlock>
                    <Divider spacing={Spacing.lg} />
                  </>
                ) : null}
                <ControlBlock
                  icon="globe"
                  tone={colors.carbs}
                  title="Cuisine"
                  subtitle={
                    dietTracked
                      ? "Today's meals update to match"
                      : "Flavours the meals you look up"
                  }
                >
                  <View style={styles.cuisineGrid}>
                    {CUISINES.map((c) => (
                      <Chip
                        key={c.value}
                        label={c.label}
                        icon={c.icon}
                        active={cuisine === c.value}
                        onPress={() => {
                          if (cuisine !== c.value) setCuisinePreference(c.value);
                        }}
                        style={styles.cuisineChip}
                      />
                    ))}
                  </View>
                </ControlBlock>
              </Card>

              <ListGroup style={styles.stacked}>
                <ListRow
                  icon="body"
                  tone={colors.primary}
                  title="Body & health details"
                  subtitle="Weight, activity, conditions — what your targets are built from"
                  onPress={() => setShowEditModal(true)}
                />
              </ListGroup>
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
            <ListGroup>
              <ListRow
                icon="notifications"
                tone={colors.primary}
                title="Permission"
                subtitle={REMINDER_STATUS[reminders.status].subtitle}
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
              />
              <ListRow
                icon="paper-plane"
                tone={colors.water}
                title="Send test notification"
                subtitle={
                  testState === "sent"
                    ? "On its way — lock your phone to see it land"
                    : "Preview the real banner, buttons and all"
                }
                onPress={handleTestNotification}
                right={
                  testState === "sent" ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : undefined
                }
              />
              <ListRow
                icon="repeat"
                tone={colors.warning}
                title="Habit reminders"
                subtitle="Set the time each habit nudges you"
                onPress={() => router.push("/habits" as never)}
              />
            </ListGroup>
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
            <ListGroup>
              {billing.isPro ? (
                <ListRow
                  icon="star"
                  tone={colors.gold}
                  title="Manage subscription"
                  subtitle={
                    billing.entitlement.expiresAt
                      ? `Renews ${new Date(billing.entitlement.expiresAt).toLocaleDateString()}`
                      : "Change or cancel your plan"
                  }
                  onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
                />
              ) : (
                <ListRow
                  icon="sparkles"
                  tone={colors.gold}
                  title="Upgrade to Welliva Pro"
                  subtitle="Unlimited coaching, plans built for you, full history"
                  onPress={() => billing.openPaywall("settings")}
                />
              )}
              {/* Store-required, and it must answer either way: silence after
                  tapping reads as a broken app to someone who has genuinely paid
                  and is trying to get their subscription back on a new phone. */}
              <ListRow
                icon="refresh"
                tone={colors.water}
                title="Restore purchases"
                subtitle={
                  restoring
                    ? "Checking with the store…"
                    : "Already paid? Bring your subscription back on this device"
                }
                onPress={handleRestorePurchases}
                right={
                  restoring ? <ActivityIndicator size="small" color={colors.water} /> : undefined
                }
              />
              {/* Dev-only tier switch. Every lock has to be walkable before the
                  RevenueCat account exists — otherwise the free-tier experience
                  first gets tested during store review. Stripped in release. */}
              {__DEV__ ? (
                <ListRow
                  icon="construct"
                  tone={colors.warning}
                  title="Force plan tier (dev only)"
                  subtitle={
                    devTier === null
                      ? "Using your real entitlement — tap to test as Free, then Pro"
                      : devTier
                        ? "Pretending you're Pro — every lock is open"
                        : "Pretending you're Free — every lock is on"
                  }
                  onPress={handleCycleDevTier}
                  right={
                    <Pill
                      label={devTier === null ? "REAL" : devTier ? "PRO" : "FREE"}
                      tone={devTier === null ? colors.textTertiary : colors.warning}
                    />
                  }
                />
              ) : null}
              {/* TEMP dev entry — replays the onboarding flow in preview mode,
                  which does NOT overwrite the real profile, so the onboarding
                  screens can be edited and tested like a brand-new user. Remove
                  before ship, with the `?preview=1` handling in onboarding. */}
              {__DEV__ ? (
                <ListRow
                  icon="albums"
                  tone={colors.warning}
                  title="Replay onboarding (dev only)"
                  subtitle="Walk the sign-up flow as a new user — your real profile is untouched"
                  onPress={() => router.push("/onboarding?preview=1" as never)}
                />
              ) : null}
            </ListGroup>
          </View>
        </Reveal>

        {/* Account */}
        <Reveal index={5}>
          <View style={styles.section}>
            <SectionHeader title="Account" />
            <ListGroup>
              <ListRow
                icon="person-circle"
                tone={colors.primary}
                title="Edit profile"
                subtitle="Age, body metrics, goal & activity"
                onPress={() => setShowEditModal(true)}
              />
              <ListRow
                icon="log-out"
                tone={colors.error}
                title="Sign out"
                subtitle={user?.email ? `Signed in as ${user.email}` : undefined}
                onPress={handleSignOut}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* About */}
        <Reveal index={6}>
          <View style={styles.section}>
            <SectionHeader title="About" />
            <ListGroup>
              <ListRow
                icon="information-circle"
                tone={colors.water}
                title="Version"
                value={APP_VERSION}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* Privacy & legal — a SIGNPOST, not a second copy. The three documents
            used to be listed here AND on /privacy, byte for byte, which made
            both copies read as filler and left the policies sitting a screen
            away from the switches that enforce them. They live on Trust now;
            this row keeps them one tap from Settings (where users and store
            reviewers look for them) and carries the one fact that isn't over
            there in the same form: which version you actually accepted. */}
        <Reveal index={7}>
          <View style={styles.section}>
            <SectionHeader title="Privacy & legal" />
            <ListGroup>
              <ListRow
                icon="shield-checkmark"
                tone={colors.primary}
                title="Trust"
                subtitle={
                  acceptance
                    ? `Policy, terms and what Welliva can see · accepted v${
                        acceptance.version
                      } on ${new Date(acceptance.acceptedAt).toLocaleDateString()}`
                    : `Policy, terms and what Welliva can see · version ${LEGAL_VERSION}`
                }
                onPress={() => router.push("/privacy" as never)}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* Data */}
        <Reveal index={8}>
          <View style={styles.section}>
            <SectionHeader title="Data" />
            <ListGroup>
              {/* "Is my data actually in the cloud?" — previously unanswerable
                  from inside the app. Now it's a row with a timestamp and a
                  button, so a user with a flaky connection can check and act
                  instead of guessing. */}
              {/* On the free tier this row stops being "sync now" and becomes
                  the honest statement of where the data lives, plus the way to
                  change that. Offering a Sync button that silently does nothing
                  would be the worst of both. */}
              {syncStatus.cloudDisabled ? (
                <ListRow
                  icon="cloud-offline-outline"
                  tone={colors.gold}
                  title="Cloud backup is off"
                  subtitle="Your data is saved on this device. Pro backs it up and syncs every device you sign in on."
                  onPress={() => billing.openPaywall("sync")}
                />
              ) : (
                <ListRow
                  icon={syncStatus.online ? "cloud-done-outline" : "cloud-offline-outline"}
                  tone={syncStatus.state === "synced" ? colors.success : colors.warning}
                  title={syncing ? "Syncing…" : "Sync now"}
                  subtitle={`${describeSyncStatus(syncStatus)} · ${formatLastSync(syncStatus.lastSyncAt)}`}
                  onPress={handleSyncNow}
                  right={
                    syncing ? <ActivityIndicator size="small" color={colors.warning} /> : undefined
                  }
                />
              )}
              <ListRow
                icon="trash"
                tone={colors.error}
                title="Reset data"
                subtitle="Erase all data and start over"
                destructive
                onPress={handleResetData}
              />
              {/* Deliberately the LAST row in the last section, and the only
                  one that leaves the app. "Reset data" above is the recoverable
                  neighbour (device only, account intact) — keeping them adjacent
                  is what makes the difference legible: one starts you over, one
                  ends you. Required in-app by App Store 5.1.1(v) and promised in
                  the privacy policy under "How long we keep it". */}
              <ListRow
                icon="person-remove-outline"
                title="Delete account"
                subtitle="Permanently erase your account and all data"
                destructive
                onPress={() => setShowDeleteModal(true)}
              />
            </ListGroup>
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
                />
                <Field
                  label="Age"
                  value={String(editingBio.age)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, age: parseInt(v) || 0 })}
                  placeholder="Enter your age"
                />
                <Field
                  label="Height (cm)"
                  value={String(editingBio.heightCm)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, heightCm: parseInt(v) || 0 })}
                  placeholder="Enter your height"
                />
                <Field
                  label="Weight (kg)"
                  value={String(editingBio.weightKg)}
                  onChangeText={(v) => setEditingBio({ ...editingBio, weightKg: parseInt(v) || 0 })}
                  placeholder="Enter your weight"
                />

                <ChipGroup
                  label="Activity level"
                  options={ACTIVITY_LEVELS}
                  selected={(v) => editingBio.activityLevel === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, activityLevel: v as any })}
                />
                <ChipGroup
                  label="Primary goal"
                  options={GOALS}
                  selected={(v) => editingBio.primaryGoal === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, primaryGoal: v as any })}
                />
                <ChipGroup
                  label="Experience"
                  options={EXERCISE_LEVELS}
                  selected={(v) => editingBio.exerciseLevel === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, exerciseLevel: v as any })}
                />

                {/* Nutrition needs */}
                <ChipGroup
                  label="Dietary restriction"
                  options={DIETARY_RESTRICTIONS}
                  selected={(v) => editingBio.dietaryRestriction === v}
                  onToggle={(v) => setEditingBio({ ...editingBio, dietaryRestriction: v as any })}
                />
                <ChipGroup
                  label="Allergies"
                  hint="Meals with these are filtered out."
                  options={ALLERGIES}
                  selected={(v) => (editingBio.allergies ?? []).includes(v)}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, allergies: toggleIn(editingBio.allergies, v) })
                  }
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
                />
                <ChipGroup
                  label="Training days / week"
                  options={TRAINING_DAYS}
                  selected={(v) => String(editingBio.workoutDaysPerWeek) === v}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, workoutDaysPerWeek: Number(v) })
                  }
                />
                <ChipGroup
                  label="Meals per day"
                  options={MEALS_PER_DAY}
                  selected={(v) => String(editingBio.mealsPerDay) === v}
                  onToggle={(v) =>
                    setEditingBio({ ...editingBio, mealsPerDay: Number(v) as 3 | 4 })
                  }
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

/**
 * A titled control block inside a card: the icon/title/subtitle head, with the
 * control itself underneath. Used wherever the control is too wide to sit on a
 * row's trailing edge (segmented pickers, chip groups).
 */
function ControlBlock({
  icon,
  tone,
  title,
  subtitle,
  busy,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  subtitle?: string;
  /** Shows a spinner in the head while the change is being applied. */
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.cardRowHead}>
        <IconBadge name={icon} tone={tone} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">{title}</AppText>
          {subtitle ? (
            <AppText variant="footnote" color="tertiary" style={styles.subtle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {busy ? <ActivityIndicator size="small" color={tone} /> : null}
      </View>
      {children}
    </View>
  );
}

/** One macro of the daily target — a colored dot, the grams, the name. */
function MacroStat({
  label,
  grams,
  tone,
}: {
  label: string;
  grams: number;
  tone: string;
}) {
  return (
    <View style={styles.macro} accessible accessibilityLabel={`${label}: ${grams} grams`}>
      <View style={styles.macroHead}>
        <View style={[styles.macroDot, { backgroundColor: tone }]} />
        <AppText variant="callout" style={styles.macroValue}>
          {grams}g
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

/** A labeled row of selectable chips — works for single- or multi-select. */
function ChipGroup<T extends string>({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  options: Opt<T>[];
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
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
          />
        ))}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const { colors } = useColors();
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  subtle: { marginTop: 2 },
  modeNote: { marginTop: 6, lineHeight: 17 },
  section: { marginTop: Spacing.xxl },
  /** Second and later cards within one section — a tighter gap than between
   *  sections, so a stack of cards still reads as ONE subject. */
  stacked: { marginTop: Spacing.md },

  // Header
  headerRow: { paddingTop: Spacing.md, marginBottom: Spacing.sm },

  // Card head (icon + title above a control)
  cardRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },

  // Nutrition targets
  calorieRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  macroRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  macro: { flex: 1, alignItems: "center", gap: 2 },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  macroDot: { width: 7, height: 7, borderRadius: Radius.pill },
  macroValue: { fontWeight: "700" },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  /**
   * Two per row, both stretching to fill it. `flexBasis: "45%"` is what forces
   * the wrap at two (two 45% items + the gap exceed 100%, three can't fit), and
   * `flexGrow` then spends the remainder equally — so the row always ends flush
   * on the right instead of trailing off wherever the last label happened to
   * end. An odd count just gives the final tile the full width, which still
   * reads as deliberate.
   */
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  cuisineChip: { flexGrow: 1, flexBasis: "45%", justifyContent: "center" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm },

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
