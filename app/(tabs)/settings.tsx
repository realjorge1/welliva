/**
 * SETTINGS — focus, goals, nutrition, reminders, account and data controls.
 *
 * A menu destination inside the `(tabs)` shell (the group never appears in a
 * path, so this file is still `/settings`; `/settings?edit=1` opens the bio
 * editor straight away). Every control here is wired to real app state — no
 * cosmetic toggles.
 *
 * ── HOW THE PAGE IS BUILT, AND WHY ──────────────────────────────────────────
 *
 * It used to be nine identically-weighted sections — headline, card, headline,
 * card — several of which held a single row. Everything shouted at the same
 * volume, so nothing led, and the page opened on a radio list rather than on
 * anything about *you*. Three changes fixed that, and they're worth keeping:
 *
 *  1. A SUMMARY STRIP AT THE TOP. Settings really answers three questions —
 *     what am I tracking, what am I paying, is my data safe — and all three
 *     used to live in different sections, one of them last on the page. They're
 *     the masthead now: read-only, because a row that's a status *and* a
 *     shortcut teaches people to tap things to find out what they mean.
 *  2. GROUP LABELS, NOT SECTION HEADLINES. A quiet uppercase kicker lets the
 *     controls carry the page. Nine 18pt headlines made the eye stop nine times
 *     on the way to a switch.
 *  3. THE ONE-ROW SECTIONS ARE GONE. Plan, About, Privacy and Data were four
 *     groups holding five rows between them; they're two groups now, and the
 *     two irreversible actions were pulled out into a `Danger zone` framed in
 *     the error colour — visibly a different kind of place, which is the point.
 */

import {
  AppText,
  Button,
  Card,
  Chip,
  ChipGrid,
  Divider,
  IconBadge,
  ListGroup,
  ListRow,
  Pill,
  Reveal,
  Screen,
  SegmentedControl,
  Stepper,
  useColors,
  useKeyboardInset,
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
import { TIER_NAME } from "@/services/billing";
import { bumpDataEpoch } from "@/services/sync/dataEpoch";
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
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as Haptics from "@/utils/haptics";
import { useMealPlan } from "@/contexts/MealPlanContext";
import { TRACKING_MODE_OPTIONS, tracksDiet } from "@/models/trackingMode";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

/** Generic {value,label} option lists for the editor's chip groups. */
type Opt<T extends string> = { value: T; label: string };

type DangerId = "reset" | "delete";

/**
 * An irreversible action, together with the confirmation it cannot be run
 * without.
 *
 * `confirm` is REQUIRED by the type and `run` is only ever called by
 * `DangerConfirmDialog` — so "a Danger zone action always confirms first" is a
 * property of the code, not a convention someone has to remember when they add
 * the third one. A row rendered from this shape can do exactly one thing when
 * tapped: open the dialog.
 */
interface DangerAction {
  id: DangerId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  confirm: {
    heading: string;
    lead: string;
    /** Named consequences. "All your data" is the phrasing people discount. */
    bullets: string[];
    /** A caveat under the bullets — not another consequence. */
    footnote?: string;
    /** Typed verbatim to arm the button. Uppercase, so it can't be muscle memory. */
    phrase: string;
    cta: string;
    /** Ask for the account password too: intent AND identity. */
    needsPassword: boolean;
  };
  /** Runs only from inside the confirmation. Receives the typed password. */
  run: (password: string) => Promise<void>;
  /** Turn a thrown error into an inline correction; null → the generic alert. */
  inlineError?: (error: unknown) => string | null;
  /** What to say when it failed and nothing happened. */
  failure: { title: string; body: string };
}

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

/**
 * THE THREE NUMBERS THE WHOLE ENGINE IS BUILT ON, and the range each has to be
 * inside for the answer to mean anything.
 *
 * These used to be `parseInt(v) || 0` straight into the bio, which had two
 * consequences that both ended up in the user's calorie target: clearing the
 * field wrote a literal 0 (and `calculateNutritionTargets` was then computing a
 * BMR for a zero-kilogram person), and `parseInt` quietly truncated 72.5 kg to
 * 72 even though every other weight in the app carries a decimal. Save is
 * blocked while any of them is outside its range, so a half-typed field can no
 * longer be committed by tapping "Save" a beat too early.
 */
const BIO_LIMITS = {
  age: { label: "Age", unit: "years", min: 13, max: 100, decimals: false },
  heightCm: { label: "Height", unit: "cm", min: 100, max: 250, decimals: false },
  weightKg: { label: "Weight", unit: "kg", min: 30, max: 300, decimals: true },
} as const;

type BioNumberKey = keyof typeof BIO_LIMITS;
const BIO_NUMBER_KEYS = Object.keys(BIO_LIMITS) as BioNumberKey[];

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
/**
 * The build, alongside the version. Two TestFlight builds of 1.0.0 are
 * indistinguishable without it, which is exactly when someone is asking a
 * tester "which build are you on?".
 */
const APP_BUILD = (() => {
  if (Platform.OS === "ios") return Constants.expoConfig?.ios?.buildNumber;
  const code = Constants.expoConfig?.android?.versionCode;
  return code == null ? undefined : String(code);
})();

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

/** Text → number, or null when the field can't be read as one yet. */
function parseNum(text: string, decimals: boolean): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = decimals ? Number(trimmed) : parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBio, setEditingBio] = useState(userBio);
  /**
   * Age / height / weight are held as TEXT while the editor is open, and only
   * become numbers on save. A number can't represent "the user has cleared this
   * field and is about to retype it", which is why the old version wrote a 0.
   */
  const [numText, setNumText] = useState<Record<BioNumberKey, string>>({
    age: "",
    heightCm: "",
    weightKg: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const reminders = useReminderPermission();
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  // Cleared on unmount: the reset is scheduled several seconds out (the test
  // notification is deliberately delayed so the phone can be locked), which is
  // long enough for the user to have left the screen.
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The "here's what I changed for you" recap shown after a save completes.
  const [changeSummary, setChangeSummary] = useState<BioChangeSummary | null>(
    null,
  );
  // THE DANGER ZONE'S ONLY STATE: which declared action is being confirmed, and
  // the answers so far. A row cannot do anything but put its id in here — see
  // DANGER_ACTIONS below for why the confirmation can't be skipped.
  const [pendingDanger, setPendingDanger] = useState<DangerId | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [running, setRunning] = useState(false);
  // Shown inline under the field rather than as an Alert: a wrong password is a
  // correction, not an incident, and an Alert would dismiss the dialog the user
  // is mid-way through filling in.
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Billing is read, never managed, from here: the plan, its renewal date,
  // "restore purchases" and the tier switch all live on /upgrade now. What
  // Settings still needs it for is the cloud-backup row below, which has to say
  // whether backup is on and, when it isn't, point at the one screen that can
  // change that.
  const billing = useBilling();
  // Meals-per-day writes through updateUserBio, which regenerates the day's
  // meals before it resolves. Hold the tapped value locally so the control moves
  // under the finger instead of sitting on the old number until the plan lands.
  const [pendingMeals, setPendingMeals] = useState<3 | 4 | null>(null);

  useEffect(() => {
    setEditingBio(userBio);
  }, [userBio]);

  useEffect(
    () => () => {
      if (testTimer.current) clearTimeout(testTimer.current);
    },
    [],
  );

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
  const focus =
    TRACKING_MODE_OPTIONS.find((o) => o.mode === trackingMode) ??
    TRACKING_MODE_OPTIONS[TRACKING_MODE_OPTIONS.length - 1];

  /** The three numeric bio fields, parsed, plus whether each is usable. */
  const numValues = useMemo(() => {
    const out = {} as Record<BioNumberKey, number | null>;
    for (const key of BIO_NUMBER_KEYS) {
      const limits = BIO_LIMITS[key];
      const n = parseNum(numText[key], limits.decimals);
      out[key] = n != null && n >= limits.min && n <= limits.max ? n : null;
    }
    return out;
  }, [numText]);
  const bioValid = BIO_NUMBER_KEYS.every((key) => numValues[key] != null);

  /** Toggle a value in an array field, keeping it tidy (no dupes). */
  const toggleIn = <T,>(list: T[] | undefined, value: T): T[] => {
    const arr = list ?? [];
    return arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
  };

  /**
   * Open the bio editor with a fresh copy of the profile. Seeding the text
   * fields here (rather than in an effect on `userBio`) is what stops a cloud
   * profile arriving mid-edit from yanking the digits out from under the
   * cursor.
   */
  const openEditor = () => {
    setEditingBio(userBio);
    setNumText({
      age: userBio?.age ? String(userBio.age) : "",
      heightCm: userBio?.heightCm ? String(userBio.heightCm) : "",
      weightKg: userBio?.weightKg ? String(userBio.weightKg) : "",
    });
    setShowEditModal(true);
  };

  // `/settings?edit=1` — documented, and now actually honoured. Reading the
  // param only in a `useState` initialiser meant it worked on a cold start and
  // silently did nothing every other time, because this screen is a `(tabs)`
  // destination that stays mounted once visited.
  //
  // THE PARAM IS CONSUMED, not just read. Profile's pencil pushes `edit=1`
  // every time, so on the second tap the param's VALUE hasn't changed — the
  // effect wouldn't re-run and the pencil would look broken from the second
  // press onward. Clearing it here is what makes the next `edit=1` a change
  // again. Setting it to "" rather than opening a loop: the effect re-runs
  // once on the cleared value and falls straight out.
  useEffect(() => {
    if (params.edit !== "1") return;
    openEditor();
    router.setParams({ edit: "" });
    // openEditor is recreated each render; depending on it would reopen the
    // modal the user just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.edit]);

  const handleSaveBio = async () => {
    if (!editingBio || !bioValid || isSaving) return;
    setIsSaving(true);
    try {
      const summary = await updateUserBio({
        ...editingBio,
        age: numValues.age as number,
        heightCm: numValues.heightCm as number,
        weightKg: numValues.weightKg as number,
      });
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
    if (next !== waterGoal) void updateGoals({ dailyWaterMl: next });
  };

  const handleWorkoutTarget = (delta: number) => {
    const next = Math.min(
      WORKOUT_MAX,
      Math.max(WORKOUT_MIN, workoutTarget + delta),
    );
    if (next !== workoutTarget) void updateGoals({ weeklyWorkoutsTarget: next });
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
    if (testTimer.current) clearTimeout(testTimer.current);
    testTimer.current = setTimeout(
      () => setTestState("idle"),
      result.delaySeconds * 1000 + 2000,
    );
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

  /**
   * THE DANGER ZONE, DECLARED.
   *
   * Every irreversible action lives in this list, and the list is the only
   * thing the Danger zone renders. That is the point: a row is built from a
   * `DangerAction`, whose `run` is reachable ONLY through
   * `DangerConfirmDialog`, and the type makes `confirm` required. There is no
   * shape a future danger row can take that fires straight from `onPress` —
   * the confirmation isn't a habit anyone has to remember, it's the only wiring
   * that exists.
   *
   * WHY THIS ISN'T `Alert.alert`. Reset used to confirm through a native Alert,
   * which is the weakest confirmation available to us and not one we can rely
   * on: `Alert` is unimplemented on React Native Web, and `Alert.prompt` — the
   * only native way to ask for typed input — is iOS-only, so an Android user
   * got a two-tap destroy on a permanent action. A dialog we own gives both
   * actions the same friction on every platform, and lets the confirmation
   * NAME what goes rather than saying "all your data", which people
   * under-estimate and then discover the loss later.
   */
  const dangerActions = useMemo<DangerAction[]>(
    () => [
      {
        id: "reset",
        icon: "refresh-circle",
        title: "Reset this device",
        subtitle: syncStatus.cloudDisabled
          ? "Erase everything here and start over at onboarding"
          : "Erase this phone's copy — your cloud backup stays",
        confirm: {
          heading: "Reset this device?",
          // THE COPY IS TIER-AWARE because this has never been able to touch
          // the cloud, and the login reconcile adopts the remote profile
          // whenever there is no local one — which, right after a wipe, is
          // always. On Pro the profile comes back at the next sign-in.
          lead: syncStatus.cloudDisabled
            ? "Nothing here is backed up, so this cannot be undone. Erased from this phone:"
            : "You'll start again at onboarding. Erased from this phone:",
          bullets: [
            "Your profile, goals and health details",
            "Every meal, workout, weight and water log",
            "Your streaks, achievements and habits",
            "Anything Gozlin remembers about you",
          ],
          footnote: syncStatus.cloudDisabled
            ? undefined
            : "Your cloud backup is NOT touched — signing back in restores your profile. To erase the account itself, use Delete account.",
          phrase: "RESET",
          cta: "Erase and start over",
          needsPassword: false,
        },
        // `bumpDataEpoch` re-keys the provider subtree, which is what makes the
        // wipe real: purging storage alone left every provider holding the data
        // in memory. Purge first — the remount re-reads storage immediately, so
        // bumping first would just reload what we were about to delete. With
        // storage empty AuthWrapper routes to onboarding on its own, so there is
        // nothing to navigate to by hand.
        run: async () => {
          // Prefix-scan purge across BOTH namespaces. The old @welliva-only
          // filter left every @gozlin_* memory key behind on a "reset".
          await purgeAppData();
          bumpDataEpoch();
        },
        failure: {
          title: "Couldn't reset this device",
          body: "Something went wrong and nothing was erased. Please try again.",
        },
      },
      {
        id: "delete",
        icon: "person-remove-outline",
        title: "Delete account",
        subtitle: "Permanently erase your account and all data, everywhere",
        confirm: {
          heading: "Delete your account?",
          lead: "This cannot be undone. We'll permanently erase:",
          bullets: [
            "Your profile, goals and health details",
            "Every meal, workout, weight and water log",
            "Your streaks, achievements and habits",
            "Progress photos and anything Gozlin remembers",
          ],
          phrase: "DELETE",
          cta: "Delete my account",
          // IDENTITY, on top of intent. The typed word proves the user meant
          // it; the password proves it's their account — without it an unlocked
          // phone left on a desk is enough to erase someone's whole health
          // history. Google accounts have no password to re-enter, and asking
          // for one would lock them out of deleting their own account, so for
          // them the live OAuth session IS the identity proof.
          needsPassword: accountHasPassword(user),
        },
        // The account is gone and the session with it. Don't route manually —
        // clearing the session makes AuthWrapper redirect to /sign-in, and
        // racing it here would push a route onto a tree being torn down.
        run: (password) => deleteAccount(password),
        // A failed password check is not a failed deletion — nothing was
        // touched. Keep the user in the dialog with the field cleared so they
        // can retype, and say nothing about the account, because there is
        // nothing to say.
        inlineError: (error) =>
          error instanceof ReauthenticationError ? error.message : null,
        // `deleteAccount` only throws while the account still EXISTS, so it is
        // honest — and important — to say nothing was deleted. Telling someone
        // their data might be half-gone when it is fully intact would be worse
        // than the failure itself.
        failure: {
          title: "Couldn't delete your account",
          body:
            "Something went wrong and your account has NOT been deleted. " +
            "Check your connection and try again — if it keeps failing, email " +
            `${LEGAL_CONTACT_EMAIL} and we'll do it for you.`,
        },
      },
    ],
    [syncStatus.cloudDisabled, user, deleteAccount],
  );

  const danger = dangerActions.find((a) => a.id === pendingDanger) ?? null;
  const canConfirmDanger =
    !!danger &&
    !running &&
    confirmText.trim().toUpperCase() === danger.confirm.phrase &&
    (!danger.confirm.needsPassword || confirmPassword.length > 0);

  /** Open a confirmation. The ONLY thing a danger row's onPress may do. */
  const askDanger = (id: DangerId) => {
    setPendingDanger(id);
    setConfirmText("");
    setConfirmPassword("");
    setConfirmError(null);
  };

  const closeDanger = () => {
    if (running) return; // never yank the dialog out mid-teardown
    setPendingDanger(null);
    setConfirmText("");
    setConfirmPassword("");
    setConfirmError(null);
  };

  const runDanger = async () => {
    // Re-checked here and not just on the button's `disabled`: this is the last
    // line before something irreversible, and a disabled prop is a rendering
    // detail, not a guarantee.
    if (!danger || !canConfirmDanger) return;
    setRunning(true);
    setConfirmError(null);
    try {
      await danger.run(confirmPassword);
      setPendingDanger(null);
      setConfirmText("");
      setConfirmPassword("");
    } catch (error) {
      setRunning(false);
      const inline = danger.inlineError?.(error) ?? null;
      if (inline) {
        setConfirmPassword("");
        setConfirmError(inline);
        return;
      }
      console.error(`Danger action "${danger.id}" failed:`, error);
      Alert.alert(danger.failure.title, danger.failure.body);
      return;
    }
    setRunning(false);
  };

  /* ── Masthead facts ────────────────────────────────────────────────────── */
  const planLabel = billing.isSubscriber
    ? TIER_NAME[billing.entitlement.tier]
    : "Free";
  const backup: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    tone: string;
  } = syncStatus.cloudDisabled
    ? { icon: "phone-portrait", label: "This device", tone: colors.textTertiary }
    : syncStatus.state === "synced"
      ? { icon: "cloud-done", label: "Backed up", tone: colors.success }
      : syncStatus.state === "offline"
        ? { icon: "cloud-offline", label: "Offline", tone: colors.warning }
        : syncStatus.state === "error"
          ? { icon: "alert-circle", label: "Needs a hand", tone: colors.error }
          : { icon: "cloud-upload", label: "Saving…", tone: colors.warning };

  const header = <ScreenTopBar title="Settings" style={styles.headerRow} />;

  return (
    <>
      <Screen header={header}>
        {/* ── Masthead. The three questions this page exists to answer, read
            off the same state the sections below let you change. */}
        <Reveal index={0} stagger={45}>
          <Card padding="lg" style={styles.masthead}>
            <MastStat
              icon={focus.icon as keyof typeof Ionicons.glyphMap}
              label="Focus"
              value={focus.title}
              tone={colors.primary}
            />
            <View style={[styles.mastRule, { backgroundColor: colors.divider }]} />
            <MastStat
              icon={billing.isSubscriber ? "diamond" : "diamond-outline"}
              label="Plan"
              value={planLabel}
              tone={colors.gold}
            />
            <View style={[styles.mastRule, { backgroundColor: colors.divider }]} />
            <MastStat
              icon={backup.icon}
              label="Backup"
              value={backup.label}
              tone={backup.tone}
            />
          </Card>
        </Reveal>

        {/* What the app is for — gates which domains are planned, scored and
            kept in history. The untracked side isn't hidden, it's untracked:
            you can still work out or look up a meal, you just don't get graded
            on it. See models/trackingMode.ts.

            Three tiles rather than three radio rows: the modes are peers, and
            the explainer below carries the consequence of whichever one is on,
            which is the only place that copy was ever readable. */}
        <Reveal index={1} stagger={45}>
          <View style={styles.section}>
            <GroupLabel label="Your focus" />
            <Card padding="lg">
              <View
                style={styles.focusRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="What Welliva plans and tracks for you"
              >
                {TRACKING_MODE_OPTIONS.map((opt) => (
                  <FocusTile
                    key={opt.mode}
                    icon={opt.icon as keyof typeof Ionicons.glyphMap}
                    label={opt.title}
                    active={trackingMode === opt.mode}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      void setTrackingMode(opt.mode);
                    }}
                  />
                ))}
              </View>
              <View style={[styles.focusNote, { borderTopColor: colors.divider }]}>
                <AppText variant="footnote">{focus.subtitle}</AppText>
                <AppText variant="caption" color="tertiary" style={styles.focusNoteLine}>
                  {focus.note}
                </AppText>
              </View>
            </Card>
          </View>
        </Reveal>

        {/* Appearance — hidden while light mode is disabled (LIGHT_MODE_ENABLED
            in constants/theme.ts). Flip that flag and the picker returns. */}
        {LIGHT_MODE_ENABLED ? (
          <Reveal index={2} stagger={45}>
            <View style={styles.section}>
              <GroupLabel label="Appearance" />
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
            Forecast a destination (without it there's no goal date to compute).

            Tiles, not rows: the number IS the setting here, so it gets to be the
            headline with the controls under it, rather than a 14pt value wedged
            onto a row's trailing edge. */}
        <Reveal index={3} stagger={45}>
          <View style={styles.section}>
            <GroupLabel label="Goals" hint="What you're aiming at" />
            <View style={styles.tileRow}>
              <GoalTile icon="water" tone={colors.water} label="Water" hint="per day">
                <Stepper
                  size="lg"
                  label="daily water goal"
                  value={`${(waterGoal / 1000).toFixed(1)} L`}
                  onDecrement={() => handleWaterGoal(-WATER_STEP)}
                  onIncrement={() => handleWaterGoal(WATER_STEP)}
                  canDecrement={waterGoal > WATER_MIN}
                  canIncrement={waterGoal < WATER_MAX}
                />
              </GoalTile>
              <GoalTile icon="barbell" tone={colors.fat} label="Workouts" hint="per week">
                <Stepper
                  size="lg"
                  label="weekly workout target"
                  value={String(workoutTarget)}
                  onDecrement={() => handleWorkoutTarget(-1)}
                  onIncrement={() => handleWorkoutTarget(1)}
                  canDecrement={workoutTarget > WORKOUT_MIN}
                  canIncrement={workoutTarget < WORKOUT_MAX}
                />
              </GoalTile>
            </View>

            {/* Two states, deliberately: an unset target is a real answer
                ("I'm not chasing a number"), so it gets an invitation rather
                than a stepper pre-loaded with a weight nobody chose. */}
            <Card padding="lg" style={styles.stacked}>
              <View style={styles.tileHead}>
                <IconBadge name="flag" tone={colors.gold} size={32} />
                <View style={styles.flex}>
                  <AppText variant="callout">Target weight</AppText>
                  <AppText variant="caption" color="tertiary" style={styles.subtle}>
                    {targetWeight == null
                      ? "Not set — unlocks your goal date and forecast"
                      : weightGap == null
                        ? "Where you're heading"
                        : weightGap > 0
                          ? `${weightGap} kg to go`
                          : weightGap < 0
                            ? `${Math.abs(weightGap)} kg to gain`
                            : "You're at your target"}
                  </AppText>
                </View>
              </View>
              {targetWeight == null ? (
                <Button
                  label="Set a target"
                  icon="flag"
                  variant="tonal"
                  size="sm"
                  onPress={handleStartTargetWeight}
                  style={styles.tileControl}
                />
              ) : (
                <Stepper
                  size="lg"
                  label="target weight"
                  value={`${targetWeight} kg`}
                  onDecrement={() => handleTargetWeight(-TARGET_WEIGHT_STEP)}
                  onIncrement={() => handleTargetWeight(TARGET_WEIGHT_STEP)}
                  canDecrement={targetWeight > TARGET_WEIGHT_MIN}
                  canIncrement={targetWeight < TARGET_WEIGHT_MAX}
                  style={styles.tileControl}
                />
              )}
            </Card>
          </View>
        </Reveal>

        {/* Nutrition */}
        {userBio && (
          <Reveal index={4} stagger={45}>
            <View style={styles.section}>
              <GroupLabel
                label="Nutrition"
                hint={
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
                  <MacroSplit
                    proteinG={nutritionTargets.proteinG}
                    carbsG={nutritionTargets.carbsG}
                    fatG={nutritionTargets.fatG}
                  />
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
            </View>
          </Reveal>
        )}

        {/* Reminders */}
        <Reveal index={5} stagger={45}>
          <View style={styles.section}>
            <GroupLabel
              label="Reminders"
              hint="Nudges you can finish from the lock screen"
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
                  testState === "sending" ? (
                    <ActivityIndicator size="small" color={colors.water} />
                  ) : testState === "sent" ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : undefined
                }
              />
              {/* The one row that actually SCHEDULES something, so it says
                  what it does rather than what it is. Meal reminders arrive at
                  times the user sets and carry an "Ate it" button that records
                  the meal without the app ever opening. */}
              <ListRow
                icon="restaurant"
                tone={colors.success}
                title="Tap to log meals"
                subtitle="Set your meal times and finish them from the lock screen"
                onPress={() => router.push("/reminders" as never)}
              />
              {/* The times themselves live on each habit (create/edit), which is
                  where a per-habit schedule belongs — so this points at the list
                  and says so, rather than promising a picker that isn't here. */}
              <ListRow
                icon="repeat"
                tone={colors.warning}
                title="Habit reminders"
                subtitle="Open a habit to set the time it nudges you"
                onPress={() => router.push("/habits" as never)}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* Account — the plan signpost, the backup state, your body details and
            the way out. The Plan row is a SIGNPOST, not a second storefront:
            everything transactional (prices, restore, manage, cancel, the dev
            tier switch) lives on /upgrade, which is a menu destination of its
            own. Two places that can both sell you something is how prices and
            copy drift apart. */}
        <Reveal index={6} stagger={45}>
          <View style={styles.section}>
            <GroupLabel label="Account" hint={user?.email ?? undefined} />
            <ListGroup>
              <ListRow
                icon={billing.isSubscriber ? "diamond" : "diamond-outline"}
                tone={colors.gold}
                title={billing.isSubscriber ? TIER_NAME[billing.entitlement.tier] : "Welliva Free"}
                subtitle={
                  billing.isSubscriber
                    ? billing.entitlement.expiresAt
                      ? `${billing.entitlement.willRenew ? "Renews" : "Ends"} ${new Date(
                          billing.entitlement.expiresAt,
                        ).toLocaleDateString()} · manage, change or restore`
                      : "Manage, change or restore your subscription"
                    : `See ${TIER_NAME.pro}, restore a purchase, or stay on free`
                }
                onPress={() => router.push("/upgrade" as never)}
              />
              {/* "Is my data actually in the cloud?" — previously unanswerable
                  from inside the app. Now it's a row with a timestamp and a
                  button, so a user with a flaky connection can check and act
                  instead of guessing.

                  On the free tier this row stops being "sync now" and becomes
                  the honest statement of where the data lives, plus the way to
                  change that. Offering a Sync button that silently does nothing
                  would be the worst of both. */}
              {syncStatus.cloudDisabled ? (
                <ListRow
                  icon="cloud-offline-outline"
                  tone={colors.gold}
                  title="Cloud backup is off"
                  subtitle="Your data is saved on this device. Plus backs it up and syncs every device you sign in on."
                  onPress={() => billing.openUpgrade("sync")}
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
              {/* One entry point to the bio editor, not two. It used to appear
                  here as "Edit profile" AND under Nutrition as "Body & health
                  details" — same modal, two names, which reads as two different
                  screens until you've opened both. */}
              <ListRow
                icon="body"
                tone={colors.primary}
                title="Body & health details"
                subtitle="Weight, activity, conditions — what your targets are built from"
                onPress={openEditor}
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

        {/* Privacy & about. The three legal documents used to be listed here AND
            on /privacy, byte for byte, which made both copies read as filler and
            left the policies sitting a screen away from the switches that
            enforce them. They live on Trust now; this row keeps them one tap
            from Settings (where users and store reviewers look for them) and
            carries the one fact that isn't over there in the same form: which
            version you actually accepted. */}
        <Reveal index={7} stagger={45}>
          <View style={styles.section}>
            <GroupLabel label="Privacy & about" />
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
              <ListRow
                icon="information-circle"
                tone={colors.water}
                title="Version"
                value={APP_BUILD ? `${APP_VERSION} (${APP_BUILD})` : APP_VERSION}
              />
            </ListGroup>
          </View>
        </Reveal>

        {/* Developer — dev builds only, and stripped from release entirely. */}
        {__DEV__ ? (
          <Reveal index={8} stagger={45}>
            <View style={styles.section}>
              <GroupLabel label="Developer" />
              <ListGroup>
                {/* TEMP dev entry — replays the onboarding flow in preview mode,
                    which does NOT overwrite the real profile, so the onboarding
                    screens can be edited and tested like a brand-new user. Remove
                    before ship, with the `?preview=1` handling in onboarding.
                    The tier switch that used to sit beside it now lives on
                    /upgrade, under the cards that say what each tier gets. */}
                <ListRow
                  icon="albums"
                  tone={colors.warning}
                  title="Replay onboarding"
                  subtitle="Walk the sign-up flow as a new user — your real profile is untouched"
                  onPress={() => router.push("/onboarding?preview=1" as never)}
                />
              </ListGroup>
            </View>
          </Reveal>
        ) : null}

        {/* Danger zone. Framed in the error colour and pulled out of "Data" for
            one reason: these are the only two rows on the page you can't undo by
            tapping again. Keeping them adjacent is what makes the difference
            between them legible — one starts you over on this phone, one ends
            the account everywhere. Deleting in-app is required by App Store
            5.1.1(v) and promised in the privacy policy under "How long we keep
            it". */}
        <Reveal index={9} stagger={45}>
          <View style={styles.section}>
            <GroupLabel label="Danger zone" tone={colors.error} />
            {/* Rendered FROM the declaration, never hand-wired. `askDanger` is
                the only thing these rows can call — the action itself is
                reachable only through the confirmation below. */}
            <ListGroup style={[styles.danger, { borderColor: alpha(colors.error, 0.32) }]}>
              {dangerActions.map((action) => (
                <ListRow
                  key={action.id}
                  icon={action.icon}
                  title={action.title}
                  subtitle={action.subtitle}
                  destructive
                  onPress={() => askDanger(action.id)}
                  accessibilityHint={`Asks you to type ${action.confirm.phrase} to confirm`}
                />
              ))}
            </ListGroup>
          </View>
        </Reveal>
      </Screen>

      {/* ── Bio editor ───────────────────────────────────────────────────── */}
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
              disabled={isSaving || !bioValid}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              accessibilityState={{ disabled: isSaving || !bioValid, busy: isSaving }}
              style={!bioValid && styles.headerActionOff}
            >
              <AppText variant="body" color="brand" style={styles.bold}>
                {isSaving ? "Saving…" : "Save"}
              </AppText>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {editingBio && (
              <>
                <AppText variant="footnote" color="tertiary" style={styles.modalIntro}>
                  Tell me what&apos;s changed and I&apos;ll re-fit your meals and
                  workouts to match — right away.
                </AppText>

                {/* Basics */}
                <FormCard title="Basics">
                  <ChipGroup
                    label="Sex"
                    options={SEXES}
                    selected={(v) => editingBio.sex === v}
                    onToggle={(v) => setEditingBio({ ...editingBio, sex: v as any })}
                  />
                  <View style={styles.numberRow}>
                    {BIO_NUMBER_KEYS.map((key) => (
                      <NumberField
                        key={key}
                        limits={BIO_LIMITS[key]}
                        value={numText[key]}
                        invalid={numValues[key] == null}
                        onChangeText={(t) =>
                          setNumText((prev) => ({ ...prev, [key]: t }))
                        }
                      />
                    ))}
                  </View>
                  {!bioValid ? (
                    <AppText
                      variant="caption"
                      style={{ color: colors.error }}
                      accessibilityRole="alert"
                    >
                      Age, height and weight all need a realistic value before this
                      can be saved — your targets are calculated from them.
                    </AppText>
                  ) : null}
                </FormCard>

                <FormCard title="How you move">
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
                </FormCard>

                {/* Nutrition needs */}
                <FormCard title="What you eat">
                  <ChipGroup
                    label="Dietary restriction"
                    options={DIETARY_RESTRICTIONS}
                    selected={(v) => editingBio.dietaryRestriction === v}
                    onToggle={(v) =>
                      setEditingBio({ ...editingBio, dietaryRestriction: v as any })
                    }
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
                </FormCard>

                {/* Health & safety */}
                <FormCard title="Health & safety">
                  <ChipGroup
                    label="Medical conditions"
                    hint="Used to pick safe diets and adjust your targets."
                    options={CONDITIONS}
                    selected={(v) =>
                      (editingBio.medicalConditions ?? []).includes(v as MedicalCondition)
                    }
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
                </FormCard>

                {/* Training setup */}
                <FormCard title="Training setup">
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
                </FormCard>

                <Button
                  label="Save changes"
                  icon="checkmark"
                  onPress={handleSaveBio}
                  loading={isSaving}
                  disabled={!bioValid}
                  style={styles.saveBtn}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── "Here's what I changed for you" recap ─────────────────────────── */}
      <Dialog visible={!!changeSummary} onClose={() => setChangeSummary(null)}>
        {/* Opaque, not the page's frosted `surface`: this paints over live
            content and over the scrim's own blur, and a translucent panel
            would show both straight through the text. */}
        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: alpha(colors.primary, 0.35),
            },
          ]}
        >
          <IconBadge name="sparkles" tone={colors.primary} size={56} solid />
          <AppText variant="title" align="center" style={styles.dialogTitle}>
            {changeSummary?.headline}
          </AppText>
          <View style={styles.dialogLines}>
            {changeSummary?.lines.map((line, i) => (
              <View key={i} style={styles.dialogLine}>
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
            style={styles.dialogBtn}
          />
        </View>
      </Dialog>

      {/* ── The Danger zone's confirmation ───────────────────────────────
          ONE dialog for every irreversible action, driven by the declaration
          above. Three deliberate frictions, because these are the actions with
          no undo and no support path back:
            1. they NAME what goes, rather than saying "all your data" — people
               under-estimate that, then discover the loss later;
            2. they require typing a word, so neither can be reached by tapping
               through muscle memory in the spot the other one occupies;
            3. they can't be dismissed while running, so a tap on the scrim
               mid-teardown can't leave the user staring at a working app whose
               account is already gone. */}
      <DangerConfirmDialog
        action={danger}
        phraseText={confirmText}
        onPhraseText={setConfirmText}
        password={confirmPassword}
        onPassword={(text) => {
          setConfirmPassword(text);
          setConfirmError(null); // clear the correction as they retype
        }}
        error={confirmError}
        armed={canConfirmDanger}
        running={running}
        onCancel={closeDanger}
        onConfirm={() => void runDanger()}
      />
    </>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

/**
 * The page's section label — a quiet uppercase kicker with an optional line of
 * context under it.
 *
 * Deliberately lighter than `SectionHeader` (18pt headline), which this page
 * used nine times. On a screen that is nothing BUT sections, headline-weight
 * labels compete with the controls instead of organising them.
 */
function GroupLabel({
  label,
  hint,
  tone,
}: {
  label: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <View style={styles.groupLabel}>
      <AppText variant="caption" color={tone ?? "tertiary"} uppercase>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="footnote" color="tertiary" style={styles.groupHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** One third of the masthead: a tinted glyph, the fact, and what it's a fact about. */
function MastStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={styles.mastStat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={18} color={tone} />
      <AppText variant="callout" align="center" numberOfLines={1} style={styles.mastValue}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" uppercase align="center">
        {label}
      </AppText>
    </View>
  );
}

/** One of the three tracking modes, as an equal-weight tile. */
function FocusTile({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, checked: active }}
      style={({ pressed }) => [
        styles.focusTile,
        {
          backgroundColor: active
            ? alpha(colors.primary, 0.16)
            : colors.surfaceSunken,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed && !active ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? colors.primary : colors.textTertiary}
      />
      <AppText
        variant="footnote"
        color={active ? colors.primary : "secondary"}
        style={styles.focusLabel}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** A goal tile: what it is on top, the number and its controls underneath. */
function GoalTile({
  icon,
  tone,
  label,
  hint,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="lg" style={styles.goalTile}>
      <View style={styles.tileHead}>
        <IconBadge name={icon} tone={tone} size={32} />
        <View style={styles.flex}>
          <AppText variant="callout" numberOfLines={1}>
            {label}
          </AppText>
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {hint}
          </AppText>
        </View>
      </View>
      <View style={styles.tileControl}>{children}</View>
    </Card>
  );
}

/**
 * The macro target, as a proportion bar plus a legend.
 *
 * The split is by CALORIES (4/4/9 per gram), not by grams — a gram of fat
 * carries more than twice the energy of a gram of protein, so a grams-width bar
 * would draw a low-fat day as a fat-heavy one. The grams stay in the legend,
 * because grams are what you actually eat against.
 */
function MacroSplit({
  proteinG,
  carbsG,
  fatG,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const { colors } = useColors();
  const kcal = { protein: proteinG * 4, carbs: carbsG * 4, fat: fatG * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat || 1;
  const parts = [
    { label: "Protein", grams: proteinG, share: kcal.protein / total, tone: colors.protein },
    { label: "Carbs", grams: carbsG, share: kcal.carbs / total, tone: colors.carbs },
    { label: "Fat", grams: fatG, share: kcal.fat / total, tone: colors.fat },
  ];

  return (
    <View style={styles.macroBlock}>
      <View
        style={[styles.splitBar, { backgroundColor: colors.surfaceSunken }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {parts.map((p) => (
          <View key={p.label} style={{ flex: p.share, backgroundColor: p.tone }} />
        ))}
      </View>
      <View style={styles.splitLegend}>
        {parts.map((p) => (
          <View
            key={p.label}
            style={styles.legendItem}
            accessible
            accessibilityLabel={`${p.label}: ${p.grams} grams`}
          >
            <View style={styles.legendHead}>
              <View style={[styles.legendDot, { backgroundColor: p.tone }]} />
              <AppText variant="callout" style={styles.legendValue}>
                {p.grams}g
              </AppText>
            </View>
            <AppText variant="caption" color="tertiary" uppercase>
              {p.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

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

/**
 * A centred dialog: blurred scrim, spring entrance, and it rides the keyboard.
 *
 * Not `Sheet`, deliberately — a bottom sheet's drag-to-dismiss is exactly the
 * gesture the delete flow must be able to refuse mid-teardown, and refusing it
 * leaves the panel stranded off its seat. A confirmation that can't be dragged
 * away is the right shape for both dialogs here. What it takes from Sheet is
 * the part that matters: one `progress` value driving the scrim and the panel
 * together, so the dialog ARRIVES rather than merely appearing.
 *
 * `pointerEvents="box-none"` on the centring layer is what keeps the scrim
 * tappable around the card while the card itself still scrolls.
 */
function Dialog({
  visible,
  onClose,
  dismissable = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** False while an irreversible action is running — see the delete flow. */
  dismissable?: boolean;
  children: React.ReactNode;
}) {
  const { isDark } = useColors();
  const keyboard = useKeyboardInset();
  const progress = useSharedValue(0);
  // Tracked apart from `visible` so the exit animation plays before teardown.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, { damping: 20, stiffness: 260, mass: 0.9 });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 150 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.93, 1]) }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView
          intensity={isDark ? 26 : 18}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={dismissable ? onClose : undefined}
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", 0.45) }]}
        />
      </Animated.View>

      {/* The scroll region fills the window and centres the card in it, so a
          dialog taller than the screen (the delete flow, on a small phone with
          the keyboard up) scrolls instead of being clipped. `flexGrow` rather
          than `flex` on the filler is what allows that: it fills a short
          viewport but is free to exceed a cramped one. */}
      <Animated.View style={[StyleSheet.absoluteFill, keyboard.containerStyle]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.dialogScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.dialogFill}
            onPress={dismissable ? onClose : undefined}
            // Hidden from assistive tech, but only this node — a full-screen
            // button wrapping the card would swallow the card's own contents
            // into one announcement. Screen-reader users get the dialog's
            // explicit Cancel / Got it buttons and the hardware back gesture,
            // both of which do the same thing this tap does.
            accessible={false}
            importantForAccessibility="no"
          >
            <Animated.View style={[styles.dialogPanel, panelStyle]}>
              {/* Swallows taps so pressing inside the card doesn't dismiss it.
                  A responder rather than a Pressable: it adds no button
                  semantics to a view that isn't one. */}
              <View onStartShouldSetResponder={() => true}>{children}</View>
            </Animated.View>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * The confirmation every Danger zone action must pass through.
 *
 * It renders from the action itself, so there is one place where the friction
 * lives and one place to change it — and, more to the point, no way to run a
 * declared action without it. `action == null` closes the dialog, which is also
 * how "nothing is pending" is expressed: there is no separate visible flag that
 * could be true while the action is missing.
 *
 * The confirm button stays disabled until the phrase matches exactly (and the
 * password is non-empty, where one is asked for), and the whole dialog refuses
 * to dismiss while the action is running.
 */
function DangerConfirmDialog({
  action,
  phraseText,
  onPhraseText,
  password,
  onPassword,
  error,
  armed,
  running,
  onCancel,
  onConfirm,
}: {
  action: DangerAction | null;
  phraseText: string;
  onPhraseText: (text: string) => void;
  password: string;
  onPassword: (text: string) => void;
  error: string | null;
  /** The phrase (and password) are satisfied — the button may fire. */
  armed: boolean;
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useColors();
  // Held so the copy doesn't blank out during the dialog's exit animation,
  // which plays after `action` has already gone back to null.
  const last = useRef<DangerAction | null>(action);
  if (action) last.current = action;
  const shown = action ?? last.current;
  if (!shown) return null;
  const { confirm } = shown;

  return (
    <Dialog visible={!!action} onClose={onCancel} dismissable={!running}>
      <View
        style={[
          styles.dialogCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: alpha(colors.error, 0.35),
          },
        ]}
      >
        <IconBadge name="warning" tone={colors.error} size={56} solid />
        <AppText variant="title" align="center" style={styles.dialogTitle}>
          {confirm.heading}
        </AppText>
        <AppText variant="subhead" color="secondary" align="center">
          {confirm.lead}
        </AppText>

        <View style={styles.dialogLines}>
          {confirm.bullets.map((line) => (
            <View key={line} style={styles.dialogLine}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <AppText variant="subhead" color="secondary" style={styles.flex}>
                {line}
              </AppText>
            </View>
          ))}
        </View>

        {confirm.footnote ? (
          <AppText
            variant="caption"
            color="tertiary"
            align="center"
            style={styles.dialogFootnote}
          >
            {confirm.footnote}
          </AppText>
        ) : null}

        {/* IDENTITY, where the action needs it. The typed word below proves the
            user meant it; this proves it's their account. */}
        {confirm.needsPassword ? (
          <>
            <AppText variant="caption" color="secondary" align="center">
              Confirm it&apos;s you
            </AppText>
            <TextInput
              value={password}
              onChangeText={onPassword}
              editable={!running}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder="Your password"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={`Your password, to confirm: ${shown.title}`}
              style={[
                styles.input,
                styles.confirmField,
                {
                  color: colors.text,
                  borderColor: error ? colors.error : colors.divider,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
            />
            {error ? (
              // `alert` so a screen reader announces the correction without the
              // user having to go looking for why nothing happened.
              <AppText
                variant="caption"
                align="center"
                accessibilityRole="alert"
                style={{ color: colors.error }}
              >
                {error}
              </AppText>
            ) : null}
          </>
        ) : null}

        <AppText variant="caption" color="secondary" align="center">
          Type {confirm.phrase} to confirm.
        </AppText>
        <TextInput
          value={phraseText}
          onChangeText={onPhraseText}
          editable={!running}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={confirm.phrase}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={`Type ${confirm.phrase} to confirm: ${shown.title}`}
          style={[
            styles.input,
            styles.confirmField,
            styles.confirmPhrase,
            {
              color: colors.text,
              borderColor: armed ? colors.error : colors.divider,
              backgroundColor: colors.surfaceSunken,
            },
          ]}
        />

        <Button
          label={running ? "Working…" : confirm.cta}
          variant="danger"
          fullWidth
          loading={running}
          disabled={!armed}
          onPress={onConfirm}
          accessibilityHint="This cannot be undone"
          style={styles.dialogBtn}
        />
        <Button
          label="Cancel"
          variant="ghost"
          fullWidth
          disabled={running}
          onPress={onCancel}
        />
      </View>
    </Dialog>
  );
}

/** A titled group of fields inside the bio editor. */
function FormCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formCard}>
      <GroupLabel label={title} />
      <Card padding="lg">{children}</Card>
    </View>
  );
}

/** A labeled row of selectable chips — works for single- or multi-select. */
/**
 * One labelled block of the profile editor.
 *
 * The options are laid out by {@link ChipGrid}, not wrapped. Every group in
 * this form holds a different KIND of word — "3" and "4" in one, "Moderate —
 * active job or 3–4 sessions" in the next — and `flexWrap` gave each of them a
 * different ragged right edge, so the whole editor read as a stack of blocks
 * shoved to the left. The grid lets the words choose the column count (four
 * short ones, three medium, one long on its own line) and then justifies each
 * row to the card's full width, so the groups line up with each other and with
 * everything else on the sheet.
 *
 * `maxPerRow` is the one thing a caller still decides, because a chip's size is
 * also a hit target: a seven-option weekday row genuinely wants four across,
 * while a two-option row of long medical labels does not want to be squeezed.
 */
function ChipGroup<T extends string>({
  label,
  hint,
  options,
  selected,
  onToggle,
  maxPerRow,
}: {
  label: string;
  hint?: string;
  options: Opt<T>[];
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
  maxPerRow?: number;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="footnote" color="secondary" style={styles.fieldLabel}>
        {label}
      </AppText>
      {hint && (
        <AppText variant="caption" color="tertiary" style={styles.groupHintTight}>
          {hint}
        </AppText>
      )}
      <ChipGrid
        options={options}
        selected={selected}
        onToggle={onToggle}
        maxPerRow={maxPerRow}
        style={styles.optionGrid}
      />
    </View>
  );
}

/**
 * One of the three numeric bio fields. Text in, text out — the parsing and the
 * range check belong to the screen, which is the thing that has to decide
 * whether Save is allowed. The border turns red the moment the value can't be
 * used, rather than waiting for a failed save to say so.
 */
function NumberField({
  limits,
  value,
  invalid,
  onChangeText,
}: {
  limits: { label: string; unit: string; min: number; max: number; decimals: boolean };
  value: string;
  invalid: boolean;
  onChangeText: (text: string) => void;
}) {
  const { colors } = useColors();
  return (
    <View style={styles.numberField}>
      <AppText variant="footnote" color="secondary" style={styles.fieldLabel}>
        {limits.label}
      </AppText>
      <TextInput
        style={[
          styles.input,
          styles.numberInput,
          {
            backgroundColor: colors.surfaceSunken,
            color: colors.text,
            borderColor: invalid ? colors.error : colors.border,
          },
        ]}
        value={value}
        onChangeText={(t) =>
          // Strip anything the keypad can still produce (a pasted "72 kg", a
          // second decimal point) rather than letting it reach the parser.
          onChangeText(
            limits.decimals
              ? t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
              : t.replace(/[^0-9]/g, ""),
          )
        }
        keyboardType={limits.decimals ? "decimal-pad" : "number-pad"}
        placeholder="—"
        placeholderTextColor={colors.textTertiary}
        maxLength={limits.decimals ? 5 : 3}
        accessibilityLabel={`${limits.label} in ${limits.unit}`}
        accessibilityHint={`Between ${limits.min} and ${limits.max}`}
        maxFontSizeMultiplier={1.3}
      />
      <AppText variant="caption" color="tertiary" align="center" style={styles.numberUnit}>
        {limits.unit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  subtle: { marginTop: 2 },
  section: { marginTop: Spacing.xxl },
  /** Second and later cards within one section — a tighter gap than between
   *  sections, so a stack of cards still reads as ONE subject. */
  stacked: { marginTop: Spacing.md },

  // Header
  headerRow: { paddingTop: Spacing.md, marginBottom: Spacing.sm },

  // Group labels
  groupLabel: { marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  groupHint: { marginTop: 1 },
  groupHintTight: { marginBottom: Spacing.sm },

  // Masthead
  masthead: { flexDirection: "row", alignItems: "stretch" },
  mastStat: { flex: 1, alignItems: "center", gap: 5 },
  mastValue: { fontWeight: "700" },
  mastRule: { width: StyleSheet.hairlineWidth, marginHorizontal: Spacing.sm },

  // Focus tiles
  focusRow: { flexDirection: "row", gap: Spacing.sm },
  focusTile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  focusLabel: { fontWeight: "600" },
  focusNote: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  focusNoteLine: { marginTop: 3, lineHeight: 16 },

  // Goal tiles
  tileRow: { flexDirection: "row", gap: Spacing.md },
  goalTile: { flex: 1 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  tileControl: { marginTop: Spacing.lg },

  // Card head (icon + title above a control)
  cardRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },

  // Nutrition targets
  calorieRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  macroBlock: { marginTop: Spacing.lg },
  splitBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  splitLegend: { flexDirection: "row", marginTop: Spacing.md },
  legendItem: { flex: 1, alignItems: "center", gap: 2 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: Radius.pill },
  legendValue: { fontWeight: "700", fontVariant: ["tabular-nums"] },

  // Chips
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
  options: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  optionGrid: { marginTop: 2 },

  // Danger zone
  danger: { borderWidth: 1 },

  // Bio editor
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActionOff: { opacity: 0.4 },
  modalBody: { padding: Spacing.screen, paddingBottom: Spacing.huge },
  modalIntro: { marginBottom: Spacing.lg, lineHeight: 18 },
  formCard: { marginBottom: Spacing.xl },
  fieldLabel: { marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  numberRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  numberField: { flex: 1 },
  numberInput: {
    textAlign: "center",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    paddingHorizontal: Spacing.sm,
  },
  numberUnit: { marginTop: 4 },
  saveBtn: { marginTop: Spacing.sm },

  // Chip group (edit form)
  group: { marginBottom: Spacing.lg },

  // Dialogs
  dialogScroll: { flexGrow: 1 },
  dialogFill: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  dialogPanel: { width: "100%", maxWidth: 380 },
  dialogCard: {
    borderWidth: 1,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  dialogTitle: { marginTop: Spacing.md },
  dialogLines: { alignSelf: "stretch", gap: Spacing.sm, marginTop: Spacing.lg },
  dialogLine: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  dialogFootnote: { marginTop: Spacing.md, lineHeight: 16 },
  dialogBtn: { alignSelf: "stretch", marginTop: Spacing.xl },

  // Danger-confirmation inputs. Shared layout…
  confirmField: {
    alignSelf: "stretch",
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  // …but only the typed word gets the letter-spaced treatment, so it reads as a
  // deliberate act rather than an ordinary form field. Applying this to the
  // password too would space out the secure-entry dots into nonsense.
  confirmPhrase: {
    letterSpacing: 2,
    fontWeight: "700",
  },
});
