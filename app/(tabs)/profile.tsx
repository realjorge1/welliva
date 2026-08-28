/**
 * PROFILE / PROGRESS — identity, achievements, plan & history.
 *
 * A MENU DESTINATION inside the `(tabs)` shell, like every other screen the
 * swipe menu can reach — so the hamburger is the top-left control and there is
 * no back arrow, because there is nothing behind it. (It was briefly a pushed
 * route, and before that it lived in the tab array while being absent from the
 * bar, reachable only through `/(tabs)?tab=profile` — a link that went dead as
 * soon as the param stopped changing.)
 *
 * SETTINGS IS ONE DOOR, TWO HANDLES. The pencil on the identity card and the
 * "Edit" action on Your plan both open `/settings?edit=1` — the bio editor,
 * which is what every value in that section is set from. They are the same
 * destination on purpose: this screen SHOWS what you are, Settings is where you
 * change it, and a reader who wants to change what they're looking at
 * shouldn't have to go hunting for the one control that does it.
 *
 * NO STREAK CARD. The count, week strip and streak stats used to sit under the
 * identity card; they were removed deliberately. The streak still drives
 * achievements (the Consistency category), the coach's moment card, and Home —
 * it just doesn't get a monument here.
 *
 * ── WHAT THE 2026-08 PASS CHANGED ───────────────────────────────────────────
 *
 * "Your setup" and "Daily targets" were two sections holding ten
 * badge-label-value rows between them — a lot of screen spent saying very
 * little, and two headings for one subject. They're one `Your plan` card now: a
 * four-across target strip over a two-column setup grid. The level card grew a
 * gold Ring (it's a level, and a ring is how this app draws progress
 * everywhere else), and the seven history rows became one grouped card with a
 * way through to the full calendar.
 */

import {
  AppText,
  Button,
  Card,
  Divider,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Ring,
  Screen,
  SectionHeader,
  useColors,
  useKeyboardInset,
  type AppTextProps,
} from "@/components/ui";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { TrendCard, buildAdherenceTrend, type TrendSeries } from "@/components/charts";
import { GozlinMoment } from "@/components/gozlin";
import { ScreenTopBar, useAccountIdentity } from "@/components/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useProfile, useSystem } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { isHistoryRangeLocked } from "@/services/billing";
import { isImagePickerAvailable, pickAvatar } from "@/services/sync/pickAndUpload";
import { getAvatarUrl } from "@/services/sync/StorageSync";
import { Image } from "expo-image";
import { DietHistoryEntry } from "@/models/diet";
import type { UserBio } from "@/models/user";
import { getDietHistory } from "@/services/ScheduleService";
import { latestWeight, makeWeighIn } from "@/services/BodyLogService";
import {
  AchievementCategory,
  CATEGORY_META,
  EvaluatedAchievement,
  getAchievementSummary,
  getLatestUnlocked,
  TIER_META,
} from "@/services/AchievementService";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
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
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/** Order categories appear in the achievements list. */
const CATEGORY_ORDER: AchievementCategory[] = [
  "streak",
  "workout",
  "nutrition",
  "hydration",
  "body",
];

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** One decimal, trailing ".0" dropped — 78 kg, not 78.0 kg. */
const round1 = (n: number) => Math.round(n * 10) / 10;

/** "Jorge Obika" → "JO". Falls back to a single letter, never to nothing. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * The line under the latest achievement's name.
 *
 * Varied on purpose: the same word every time stops being praise and becomes
 * chrome by about the third unlock. Kept short — this is a cheer, not a
 * sentence, and it sits on one line inside a card.
 */
const CHEERS = [
  "Congratulations",
  "Bravo",
  "Keep it up",
  "Keep going",
  "Perfecto",
  "Well done",
  "Nice work",
  "Outstanding",
  "Take a bow",
  "That's the way",
  "Brilliant",
  "Superb",
];

/**
 * Pick a cheer for an achievement — random ACROSS achievements, fixed FOR one.
 *
 * Deriving it from the id rather than calling `Math.random()` at render is what
 * makes it stable: an unlock keeps the same word every time the screen mounts,
 * every re-render, and on the next launch. A fresh roll per render would have
 * the line flickering through the list as React re-renders the card, which
 * reads as a bug rather than as variety.
 */
function cheerFor(a: EvaluatedAchievement): string {
  let h = 0;
  for (let i = 0; i < a.def.id.length; i++) {
    h = (h * 31 + a.def.id.charCodeAt(i)) | 0;
  }
  return CHEERS[Math.abs(h) % CHEERS.length];
}

/* ── The gold ─────────────────────────────────────────────────────────────
 * Fixed hexes, not theme tokens. The trophy surfaces are pitch black in both
 * light and dark mode, so a theme-aware accent would be answering a question
 * nobody asked — and the whole point is that this metal looks the same every
 * time you see it. Three stops, because a single flat gold is paint; a light
 * edge and a deep shadow are what make it read as struck.
 */
const GOLD_LIGHT = "#FBE7A8";
const GOLD = "#E9C16B";
const GOLD_DEEP = "#B8862F";
/** A locked trophy: the same metal, unlit. */
const GOLD_DIM = "#8A7440";
const GOLD_GRADIENT = [GOLD_LIGHT, GOLD, GOLD_DEEP] as const;

/** Sparks around the detail medallion. Offsets are from its centre. */
const MEDAL_SPARKLES = [
  { x: -84, y: -50, size: 12, delay: 0 },
  { x: 70, y: -62, size: 9, delay: 260 },
  { x: 84, y: 34, size: 13, delay: 520 },
  { x: -74, y: 52, size: 10, delay: 180 },
  { x: 4, y: -84, size: 8, delay: 700 },
  { x: -92, y: 4, size: 7, delay: 420 },
  { x: 90, y: -8, size: 8, delay: 860 },
];

/** The same idea at row scale — three sparks, tight to the medal. */
const ROW_SPARKLES = [
  { x: -19, y: -16, size: 8, delay: 0 },
  { x: 12, y: -19, size: 6, delay: 380 },
  { x: 14, y: 10, size: 7, delay: 720 },
];

/** Which of the three body numbers a tap opened the editor on. */
type BodyField = "age" | "height" | "weight";

/** Sane bounds — a typo'd height re-fits the whole plan around a wrong TDEE. */
const BODY_LIMITS: Record<BodyField, { min: number; max: number; unit: string; label: string }> = {
  age: { min: 13, max: 100, unit: "yrs", label: "Age" },
  height: { min: 100, max: 250, unit: "cm", label: "Height" },
  weight: { min: 30, max: 300, unit: "kg", label: "Weight" },
};

/** Short, human label per equipment value for the setup summary. */
const EQUIPMENT_SHORT: Record<string, string> = {
  none: "Bodyweight",
  dumbbells: "Dumbbells",
  resistance_bands: "Bands",
  pull_up_bar: "Pull-up bar",
  bench: "Bench",
  kettlebell: "Kettlebell",
};

export default function ProfileScreen() {
  const { colors } = useColors();
  const {
    userBio,
    nutritionTargets,
    bodyLogs,
    updateUserBio,
    logBodyMeasurement,
  } = useProfile();
  // The menu header already knows how to turn a session into a name and a
  // photo (uploaded avatar, else the OAuth provider's). Profile used to resolve
  // only the uploaded one, so a Google user saw their face in the drawer and a
  // grey person glyph here.
  const identity = useAccountIdentity();
  const {
    achievements,
    goalAchievedPending,
    journeyChapter,
  } = useGamification();
  const { currentDate } = useSystem();
  const { user } = useAuth();
  const { tier, openUpgrade } = useBilling();

  const summary = useMemo(() => getAchievementSummary(achievements), [achievements]);
  /** The last thing earned — shown on the identity card, above the grid. */
  const latestAchievement = useMemo(
    () => getLatestUnlocked(achievements),
    [achievements],
  );
  // Group achievements by category, earned-first within each group.
  const grouped = useMemo(() => {
    const map = new Map<AchievementCategory, EvaluatedAchievement[]>();
    for (const a of achievements) {
      const list = map.get(a.def.category) ?? [];
      list.push(a);
      map.set(a.def.category, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => {
        if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1;
        return y.progress - x.progress;
      });
    }
    return map;
  }, [achievements]);

  const [history, setHistory] = useState<DietHistoryEntry[]>([]);
  const [detail, setDetail] = useState<EvaluatedAchievement | null>(null);
  /** A photo just uploaded from this screen — wins over the resolved identity. */
  const [freshAvatar, setFreshAvatar] = useState<string | null>(null);
  /**
   * Signed storage URLs expire and provider photos 404. Without this the
   * <Image> just renders an empty circle and the screen looks broken; with it
   * we fall back to initials, which always render.
   */
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bodyEdit, setBodyEdit] = useState<BodyField | null>(null);

  const avatarUri = freshAvatar ?? identity.photo ?? null;
  const showAvatar = !!avatarUri && !avatarFailed;

  // A new URL deserves a fresh attempt — otherwise one failure (say, offline on
  // first load) would stick to initials for the rest of the session.
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getDietHistory());
    } catch (error) {
      console.error("Error loading history:", error);
    }
  }, []);

  /**
   * Reload on every RETURN to the screen, not once on mount.
   *
   * This is a `(tabs)` destination with `freezeOnBlur`, so it mounts once and
   * then stays mounted for the life of the session. A mount-only load meant
   * finishing a day on the Diet screen and swiping back here showed the history
   * as it was when you first opened Profile — sometimes hours stale, and
   * silently so, which is the worst kind.
   */
  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );


  /**
   * Pick + upload a new profile photo, then show it.
   *
   * Every "can't" here used to be a silent return, which is indistinguishable
   * from a broken button: signed out, no native picker in this build, or an
   * upload that failed all produced the same nothing. Cancelling is still
   * silent — that one the user meant.
   */
  const changeAvatar = async () => {
    if (uploadingAvatar) return;
    if (!user?.id) {
      Alert.alert(
        "Sign in to add a photo",
        "Your profile photo is stored with your account, so it comes back on a new phone.",
      );
      return;
    }
    if (!isImagePickerAvailable()) {
      Alert.alert(
        "Photos need the latest build",
        "Choosing a photo uses a native module that isn't in this build of the app yet. It'll work on the next install.",
      );
      return;
    }
    setUploadingAvatar(true);
    try {
      const path = await pickAvatar(user.id);
      if (!path) return; // cancelled or permission declined — their call
      const url = await getAvatarUrl(path);
      if (url) {
        setAvatarFailed(false);
        setFreshAvatar(url);
      } else {
        Alert.alert("Couldn't save that photo", "Please try again in a moment.");
      }
    } catch (error) {
      console.error("Error changing avatar:", error);
      Alert.alert("Couldn't save that photo", "Please try again in a moment.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  /**
   * WEIGHT IS TWO NUMBERS, and they used to drift apart. `userBio.weightKg` is
   * what nutrition targets are computed from; the body log is what the trend
   * and forecast read. A Gozlin weigh-in wrote only the log, so this card could
   * sit on the onboarding weight for months. Display follows the log (the
   * newest truth), and saving here writes both.
   */
  const currentWeightKg = latestWeight(bodyLogs) ?? userBio?.weightKg ?? null;

  const saveBody = async (next: { age: number; heightCm: number; weightKg: number }) => {
    if (!userBio) return;
    const weightChanged = Math.abs(next.weightKg - (currentWeightKg ?? 0)) > 0.05;
    // Log first: updateUserBio re-fits diet + workouts and can take a beat, and
    // a weigh-in the user typed shouldn't be lost if that leg throws.
    if (weightChanged) await logBodyMeasurement(makeWeighIn(next.weightKg));
    await updateUserBio({
      age: next.age,
      heightCm: next.heightCm,
      weightKg: next.weightKg,
    });
  };

  // A scrubbable "how closely am I following my plan" line across recent days.
  const adherenceTrend = useMemo<TrendSeries[]>(
    () => [
      { key: "2W", label: "2 wk", points: buildAdherenceTrend(history, currentDate, 14) },
      { key: "1M", label: "1 mo", points: buildAdherenceTrend(history, currentDate, 30) },
      {
        key: "3M",
        label: "3 mo",
        points: buildAdherenceTrend(history, currentDate, 90),
        locked: isHistoryRangeLocked(90, tier),
      },
    ],
    [history, currentDate, tier],
  );

  // Value and unit apart, so the strip can set the number in tabular figures
  // and drop the unit to a caption beside it — four columns of "2140 kcal" at
  // one weight is a wall, and the numbers are the part you came to read.
  const targets = nutritionTargets
    ? [
        {
          label: "Calories",
          value: nutritionTargets.calories.toLocaleString(),
          unit: "kcal",
          tone: colors.calories,
        },
        { label: "Protein", value: String(nutritionTargets.proteinG), unit: "g", tone: colors.protein },
        { label: "Carbs", value: String(nutritionTargets.carbsG), unit: "g", tone: colors.carbs },
        { label: "Fat", value: String(nutritionTargets.fatG), unit: "g", tone: colors.fat },
      ]
    : [];

  const equipmentSummary =
    userBio?.equipment && userBio.equipment.some((e) => e !== "none")
      ? userBio.equipment
          .filter((e) => e !== "none")
          .map((e) => EQUIPMENT_SHORT[e] ?? titleCase(e))
          .join(", ")
      : "Bodyweight";

  const setup = userBio
    ? [
        { label: "Goal", value: titleCase(userBio.primaryGoal), icon: "flag", tone: colors.primary },
        { label: "Experience", value: titleCase(userBio.exerciseLevel), icon: "barbell", tone: colors.fat },
        {
          label: "Training",
          value: userBio.workoutDaysPerWeek
            ? `${userBio.workoutDaysPerWeek} days / week`
            : "Goal-based",
          icon: "calendar",
          tone: colors.water,
        },
        { label: "Equipment", value: equipmentSummary, icon: "construct", tone: colors.carbs },
        { label: "Meals", value: `${userBio.mealsPerDay} / day`, icon: "restaurant", tone: colors.protein },
        {
          label: "Cuisine",
          value: titleCase(userBio.cuisinePreference ?? "mixed"),
          icon: "globe",
          tone: colors.primary,
        },
      ]
    : [];

  const header = (
    <Reveal index={0}>
      {/* A menu destination, not a pushed screen — there is nothing behind it
          to go back to, so the hamburger is the control here. */}
      <ScreenTopBar title="Profile" style={styles.headerRow} />
    </Reveal>
  );

  return (
    <>
      {/* NO `onRefresh` HERE, DELIBERATELY. `Screen` turns off the Android
          elastic pull whenever a RefreshControl is attached (they both own the
          drag-down-from-the-top gesture), and there is nothing here worth that
          trade: the history is local storage, and the focus effect above
          already reloads it every time you arrive. A pull-to-refresh would be
          theatre costing a real interaction. */}
      <Screen header={header}>
        {/* Identity — who this is, front and center */}
        <Reveal index={1}>
          <Card style={styles.block}>
            <View style={styles.identityRow}>
              <Pressable
                onPress={changeAvatar}
                disabled={uploadingAvatar}
                accessibilityRole="button"
                accessibilityLabel={showAvatar ? "Change profile photo" : "Add a profile photo"}
                style={styles.avatarWrap}
              >
                {showAvatar ? (
                  <Image
                    source={{ uri: avatarUri! }}
                    style={[styles.avatar, { borderColor: alpha(colors.primary, 0.35) }]}
                    contentFit="cover"
                    transition={200}
                    onError={() => setAvatarFailed(true)}
                  />
                ) : user ? (
                  // Initials, not a generic person glyph: it's personal even
                  // before a photo exists, and it can never fail to load.
                  // Only with an account, though — signed out, the "name" is
                  // the placeholder "Your profile", and "YP" means nothing.
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarInitials,
                      {
                        backgroundColor: alpha(colors.primary, 0.14),
                        borderColor: alpha(colors.primary, 0.35),
                      },
                    ]}
                  >
                    <AppText variant="title" style={{ color: colors.primary }}>
                      {initialsOf(identity.name)}
                    </AppText>
                  </View>
                ) : (
                  <IconBadge name="person" tone={colors.primary} size={56} />
                )}
                <View
                  style={[
                    styles.avatarEdit,
                    { backgroundColor: colors.primary, borderColor: colors.surface },
                  ]}
                >
                  <Ionicons name="camera" size={12} color={colors.onPrimary} />
                </View>
              </Pressable>
              <View style={styles.flex}>
                <AppText variant="title" numberOfLines={1}>
                  {identity.name}
                </AppText>
                <AppText variant="subhead" color="secondary" numberOfLines={1}>
                  {userBio?.primaryGoal ? titleCase(userBio.primaryGoal) : "Set your goals"}
                </AppText>
              </View>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/settings", params: { edit: "1" } })
                }
                style={[styles.editBtn, { borderColor: alpha(colors.primary, 0.4) }]}
                accessibilityRole="button"
                accessibilityLabel="Edit full profile"
              >
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </Pressable>
            </View>

            {/* The body row. These three numbers change more often than
                anything else on the screen, and they used to be read-only
                labels ("Height cm") pointing at a pencil that opened a
                fifteen-field modal on another screen. Each cell is now the
                control for its own number. */}
            {userBio && (
              <View style={styles.bioStats}>
                <BodyCell
                  field="age"
                  value={userBio.age}
                  unit="yrs"
                  label="Age"
                  colors={colors}
                  onPress={() => setBodyEdit("age")}
                />
                <BodyCell
                  field="height"
                  value={userBio.heightCm}
                  unit="cm"
                  label="Height"
                  colors={colors}
                  onPress={() => setBodyEdit("height")}
                />
                <BodyCell
                  field="weight"
                  value={currentWeightKg != null ? round1(currentWeightKg) : userBio.weightKg}
                  unit="kg"
                  label="Weight"
                  colors={colors}
                  onPress={() => setBodyEdit("weight")}
                />
              </View>
            )}

            {/* LATEST ACHIEVEMENT — the last thing this person earned, in the
                same card as who they are. It belongs with identity rather than
                down in the achievements grid: the grid answers "what is there
                to get", this answers "what did I just get". Gold regardless of
                the achievement's own tier — it's the prize shelf, not the
                catalogue, and the tier is on the card in the grid below.

                No eyebrow, no chevron. "Latest achievement" is a filing label
                on something that should read like a pat on the back, and a
                chevron turns a trophy into a settings row. The name carries it
                and the cheer underneath says what the label was trying to. */}
            {latestAchievement && (
              <LatestAchievementRow
                item={latestAchievement}
                onPress={() => setDetail(latestAchievement)}
              />
            )}
          </Card>
        </Reveal>

        {/* Gozlin's read of you. It lived under "YOU" on the More tab; when the
            menu replaced that tab, identity was the right place for it. */}
        <Reveal index={2}>
          <GozlinMoment surface="progress" style={styles.moment} />
        </Reveal>

        {/* Goal reached → re-consult banner */}
        {goalAchievedPending && (
          <Reveal index={3}>
            <Pressable
              onPress={() => router.push("/new-chapter")}
              accessibilityRole="button"
              accessibilityLabel={`Goal reached. Start chapter ${journeyChapter + 1}.`}
            >
              <Card style={[styles.block, styles.chapterBanner, { borderColor: alpha(colors.gold, 0.5) }]} padding="lg">
                <View style={styles.chapterRow}>
                  <IconBadge name="trophy" tone={colors.gold} size={48} solid />
                  <View style={styles.flex}>
                    <AppText variant="headline">Goal reached</AppText>
                    <AppText variant="footnote" color="secondary" numberOfLines={2}>
                      You did it. Start chapter {journeyChapter + 1} and set what&apos;s next.
                    </AppText>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={colors.gold} />
                </View>
              </Card>
            </Pressable>
          </Reveal>
        )}

        {/* YOUR PLAN — the numbers your body produced, over the answers that
            produced them. One subject, so one heading and one card: these were
            "Daily targets" and "Your setup", ten rows of badge-label-value
            stacked in two sections that looked identical and read as filler.

            The targets are read-only here by design — they're derived and
            safety-clamped in NutritionService, and the way to move them is to
            correct the facts underneath, which is exactly what "Edit" opens. */}
        {(setup.length > 0 || nutritionTargets) && (
          <Reveal index={4}>
            <View style={styles.section}>
              <SectionHeader
                title="Your plan"
                subtitle="From your coaching consultation"
                actionLabel="Edit"
                onAction={() =>
                  router.push({ pathname: "/settings", params: { edit: "1" } })
                }
              />
              <Card padding="lg">
                {nutritionTargets ? (
                  <>
                    <View style={styles.targetStrip}>
                      {targets.map((t) => (
                        <TargetStat key={t.label} {...t} />
                      ))}
                    </View>
                    {setup.length > 0 ? <Divider spacing={Spacing.lg} /> : null}
                  </>
                ) : null}
                {setup.length > 0 ? (
                  <View style={styles.setupGrid}>
                    {setup.map((s) => (
                      <SetupCell
                        key={s.label}
                        icon={s.icon as keyof typeof Ionicons.glyphMap}
                        label={s.label}
                        value={s.value}
                        tone={s.tone}
                      />
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          </Reveal>
        )}

        {/* Achievements */}
        <Reveal index={5}>
          <View style={styles.section}>
            <SectionHeader
              title="Achievements"
              subtitle={`${summary.earnedCount} of ${summary.total} unlocked`}
            />

            {/* LEVEL. A ring, not a bar: this app draws every other kind of
                progress as one, and the level number belongs inside the thing
                that's filling toward the next one rather than in a plate beside
                it. Gold because it's the trophy shelf's own metal — the same
                fixed hexes the medallions use, for the same reason. */}
            <Card style={styles.block} padding="lg">
              <View style={styles.levelTop}>
                <Ring
                  progress={summary.pointsIntoLevel / summary.pointsForLevel}
                  size={76}
                  strokeWidth={6}
                  gradient={GOLD_GRADIENT}
                  track={alpha(GOLD, 0.16)}
                >
                  <AppText variant="caption" style={[styles.levelKicker, { color: GOLD_DIM }]}>
                    LVL
                  </AppText>
                  <AppText variant="title" style={{ color: GOLD }}>
                    {summary.level}
                  </AppText>
                </Ring>
                <View style={styles.flex}>
                  <AppText variant="headline">{summary.levelTitle}</AppText>
                  <AppText variant="footnote" color="tertiary" style={styles.levelPoints}>
                    {summary.points} of {summary.maxPoints} points earned
                  </AppText>
                  {/* Once everything is earned there are no more points to go
                      and get, so "N pts to Level 6" would be pointing at a door
                      that isn't there. */}
                  <AppText variant="caption" color="tertiary" style={styles.levelHint}>
                    {summary.points >= summary.maxPoints
                      ? "Every achievement earned"
                      : `${summary.pointsForLevel - summary.pointsIntoLevel} pts to Level ${summary.level + 1}`}
                  </AppText>
                </View>
              </View>
            </Card>

            {/* Achievements by category */}
            {CATEGORY_ORDER.map((cat) => {
              const list = grouped.get(cat);
              if (!list || list.length === 0) return null;
              const meta = CATEGORY_META[cat];
              const earnedInCat = list.filter((a) => a.unlocked).length;
              return (
                <View key={cat} style={styles.catBlock}>
                  <View style={styles.catHeader}>
                    <Ionicons name={meta.icon} size={16} color={colors.textSecondary} />
                    <AppText variant="callout" style={styles.flex}>
                      {meta.label}
                    </AppText>
                    <AppText variant="caption" color="tertiary">
                      {earnedInCat}/{list.length}
                    </AppText>
                  </View>
                  <View style={styles.achGrid}>
                    {list.map((a) => (
                      <AchievementCard
                        key={a.def.id}
                        item={a}
                        colors={colors}
                        onPress={() => setDetail(a)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </Reveal>

        {/* History */}
        <Reveal index={6}>
          <View style={styles.section}>
            {/* The seven most recent days are a preview; the calendar behind
                "See all" is where a day can actually be inspected and (for
                yesterday) corrected. Without the link, seven was simply where
                the list stopped. */}
            <SectionHeader
              title="History"
              actionLabel={history.length > 0 ? "See all" : undefined}
              onAction={() => router.push("/diet/history")}
            />
            {history.length >= 2 && (
              <View style={styles.historyChart}>
                <TrendCard
                  title="Meal adherence"
                  icon="checkmark-done"
                  unit="%"
                  gradient={colors.brandGradient}
                  series={adherenceTrend}
                  initialRangeKey="1M"
                  format={(v) => `${Math.round(v)}`}
                  footnote="Share of your daily plan you completed — drag to inspect any day."
                  onLockedRangePress={() => openUpgrade("history")}
                />
              </View>
            )}
            {history.length > 0 ? (
              // ONE card with hairlines, not seven floating ones. Seven
              // separate cards each with their own border and margin read as
              // seven unrelated things; a week of days is one list.
              <Card padding="none" style={styles.historyCard}>
                {history.slice(0, 7).map((entry, index) => (
                  <React.Fragment key={entry.date ?? index}>
                    {index > 0 ? (
                      <View
                        style={[styles.historyDivider, { backgroundColor: colors.divider }]}
                      />
                    ) : null}
                    <HistoryItem entry={entry} colors={colors} />
                  </React.Fragment>
                ))}
              </Card>
            ) : (
              <Card padding="xl">
                <View style={styles.historyEmpty}>
                  <IconBadge name="time-outline" muted size={44} />
                  <AppText variant="callout" align="center" style={styles.historyEmptyTitle}>
                    No history yet
                  </AppText>
                  <AppText variant="subhead" color="tertiary" align="center">
                    Complete a day on your plan and it&apos;ll show up here.
                  </AppText>
                </View>
              </Card>
            )}
          </View>
        </Reveal>
      </Screen>

      {/* Achievement detail */}
      <AchievementDetailModal item={detail} onClose={() => setDetail(null)} />

      {/* Age / height / weight, opened on whichever number was tapped. */}
      <BodyEditSheet
        field={bodyEdit}
        bio={userBio}
        currentWeightKg={currentWeightKg}
        colors={colors}
        onClose={() => setBodyEdit(null)}
        onSave={saveBody}
      />

      <LoadingOverlay visible={uploadingAvatar} message="Uploading photo…" />
    </>
  );
}

/* ─────────────────────────── Glitter typography ────────────────────────── */

/**
 * GLITTER TEXT — a name that arrives instead of being there.
 *
 * Each letter rises, fades up and settles, one after the next, and each one
 * strikes WHITE-HOT at its peak before cooling to gold as it lands. That
 * colour beat is the whole trick: a plain staggered fade is a loading state,
 * but a letter that flares and cools reads as struck metal, and it's what
 * turns a row of text into something worth having earned.
 *
 * Per-character, so the row is a flex line of glyphs rather than one text node
 * — fine for a name on one line, which is all this is ever asked to render.
 * Spaces become non-breaking so they keep their width as separate views.
 */
const GLITTER_STAGGER_MS = 45;
const GLITTER_CHAR_MS = 420;
/** Struck-metal white. Every letter passes through this on its way to gold. */
const GLITTER_HOT = "#FFFFFF";

function GlitterText({
  text,
  color,
  variant = "callout",
  delay = 0,
  spread = 2,
}: {
  text: string;
  color: string;
  variant?: AppTextProps["variant"];
  delay?: number;
  /**
   * Points of air between letters. Set as a flex `gap` rather than as
   * `letterSpacing`, because every glyph is already its own view here — a gap
   * is exact and identical on both platforms, where `letterSpacing` on a
   * single-character node lands differently on iOS and Android.
   */
  spread?: number;
}) {
  const reduceMotion = useReducedMotion();
  const chars = useMemo(() => Array.from(text), [text]);
  const total = delay + chars.length * GLITTER_STAGGER_MS + GLITTER_CHAR_MS;

  // One clock for the whole word — see GozlinSuggestionBar for why a shared
  // sweep beats N independent timers whenever things must stay in step.
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withTiming(1, { duration: total, easing: Easing.linear });
    return () => cancelAnimation(t);
  }, [t, total, text, reduceMotion]);

  return (
    // The whole word is one label; the per-glyph views are decorative.
    <View style={[styles.glitterRow, { gap: spread }]} accessible accessibilityLabel={text}>
      {chars.map((c, i) => (
        <GlitterChar
          key={`${c}-${i}`}
          char={c}
          index={i}
          clock={t}
          total={total}
          delay={delay}
          color={color}
          variant={variant}
        />
      ))}
    </View>
  );
}

function GlitterChar({
  char,
  index,
  clock,
  total,
  delay,
  color,
  variant,
}: {
  char: string;
  index: number;
  clock: SharedValue<number>;
  total: number;
  delay: number;
  color: string;
  variant: AppTextProps["variant"];
}) {
  const start = delay + index * GLITTER_STAGGER_MS;

  /** 0 → 1 across this letter's own window, flat outside it. */
  const p = useDerivedValue(() => {
    const elapsed = clock.value * total;
    const l = (elapsed - start) / GLITTER_CHAR_MS;
    return Math.max(0, Math.min(1, l));
  });

  const style = useAnimatedStyle(() => {
    const v = p.value;
    // Eased out, so the letter decelerates into place rather than arriving at
    // constant speed — the difference between landing and stopping.
    const e = 1 - Math.pow(1 - v, 3);
    return {
      opacity: e,
      transform: [{ translateY: (1 - e) * 9 }, { scale: 0.86 + e * 0.14 }],
    };
  });

  /**
   * The flare, done as a WHITE COPY FADING OUT over the coloured glyph rather
   * than as an animated `color`.
   *
   * Animating the colour would mean wrapping AppText in
   * `createAnimatedComponent`, and AppText is a plain function component with
   * no forwarded ref — Reanimated would have nothing to write the property to,
   * so the colour would simply never move. Two stacked glyphs and an opacity
   * ride the transform pipeline instead, which needs no ref at all.
   */
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35, 1], [1, 0.85, 0], Extrapolation.CLAMP),
  }));

  const glyph = char === " " ? " " : char;

  return (
    <Animated.View style={style}>
      <AppText variant={variant} weight="800" style={{ color }}>
        {glyph}
      </AppText>
      {/* The strike. A decorative duplicate — the wrapper already labels the
          whole word, so this one is hidden from assistive tech. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, flashStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant={variant} weight="800" style={styles.glitterHot}>
          {glyph}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A twinkling speck. Placed absolutely around a medallion, each on its own
 * offset beat so the set never pulses in unison — which would read as one
 * flashing object rather than as glitter.
 */
function Sparkle({
  x,
  y,
  size,
  delay,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const v = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    v.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(v);
  }, [v, delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + v.value * 0.85,
    transform: [{ scale: 0.5 + v.value * 0.7 }, { rotate: `${v.value * 90}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sparkle, { left: "50%", top: "50%", marginLeft: x, marginTop: y }, style]}
    >
      <Ionicons name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

/**
 * The identity card's trophy shelf: the last thing this person earned.
 *
 * IT HAD TO STOP LOOKING LIKE A LIST ROW. An icon, a bold line and a caption
 * is the same shape as "Equipment · Dumbbells" two cards down — correct
 * information, no occasion. What separates them here is that this one ARRIVES:
 * a gold wash, sparks around the medal, and the name struck letter by letter
 * (see GlitterText), with the cheer coming in only once the name has landed.
 * You watch it happen, which is the entire difference between being told you
 * achieved something and being congratulated for it.
 */
function LatestAchievementRow({
  item,
  onPress,
}: {
  item: EvaluatedAchievement;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const reduceMotion = useReducedMotion();
  const cheer = cheerFor(item);
  // The cheer waits out the name rather than racing it — a beat of applause
  // after the reveal, not underneath it.
  const cheerDelay = Array.from(item.def.name).length * GLITTER_STAGGER_MS + 260;

  const cheerIn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cheerIn.value = 1;
      return;
    }
    cheerIn.value = 0;
    cheerIn.value = withDelay(cheerDelay, withTiming(1, { duration: 320 }));
    return () => cancelAnimation(cheerIn);
  }, [cheerIn, cheerDelay, item.def.id, reduceMotion]);

  const cheerStyle = useAnimatedStyle(() => ({
    opacity: cheerIn.value,
    transform: [{ translateX: (1 - cheerIn.value) * -6 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.def.name}. ${cheer}.`}
      accessibilityHint="See the details"
      style={({ pressed }) => [
        styles.latestRow,
        { borderColor: alpha(colors.gold, 0.38) },
        pressed && { opacity: 0.7 },
      ]}
    >
      {/* A wash rather than a flat tint: the gold pools behind the medal and
          fades out across the name, so the row has a light source. */}
      <LinearGradient
        colors={[alpha(colors.gold, 0.22), alpha(colors.gold, 0.04)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* The glyph alone — no disc behind it. A filled plate made this the
          same object as the IconBadge on every setup and target row; bare, it
          reads as a mark rather than as a list bullet, and the sparks have
          somewhere to go. */}
      <View style={styles.latestMedalWrap}>
        {ROW_SPARKLES.map((s, i) => (
          <Sparkle key={i} {...s} color={colors.gold} />
        ))}
        <Ionicons name={item.def.icon} size={26} color={colors.gold} />
      </View>

      <View style={styles.flex}>
        <GlitterText
          // Remount on a new unlock so the strike replays for the achievement
          // that actually earned it, instead of only on first mount.
          key={item.def.id}
          text={item.def.name}
          color={colors.text}
          variant="callout"
          spread={2.5}
        />
        <Animated.View style={cheerStyle}>
          <AppText
            variant="footnote"
            weight="600"
            numberOfLines={1}
            style={[styles.latestCheer, { color: colors.gold }]}
          >
            {cheer}
          </AppText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * One tappable body number.
 *
 * The old row was three `Stat`s: a big bold value and an all-caps label that
 * had to carry the unit ("HEIGHT CM"), separated by hairlines, and none of them
 * did anything. Here the unit sits with the number where it's read, the label
 * is just the label, and the recessed plate says the whole cell is a button.
 */
/**
 * One of the four daily targets, as a column in the plan card's strip.
 *
 * The tone lives in a dot rather than in the number: four differently-coloured
 * headline numbers side by side compete with each other, and calories aren't
 * more important than protein here — they're four facts of equal standing.
 */
function TargetStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <View
      style={styles.targetStat}
      accessible
      accessibilityLabel={`${label}: ${value} ${unit}`}
    >
      <View style={[styles.targetDot, { backgroundColor: tone }]} />
      <View style={styles.targetValueRow}>
        <AppText variant="headline" style={styles.targetValue} numberOfLines={1}>
          {value}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {unit}
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary" uppercase numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * One answer from the consultation, as a half-width cell.
 *
 * No `IconBadge`: six 36pt tinted squares in a grid is a lot of furniture for
 * six short strings. A 13pt glyph next to the label tints the row the same way
 * for a fraction of the space, which is what lets these sit two-up instead of
 * as six full-width rows.
 */
function SetupCell({
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
    <View style={styles.setupCell} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.setupHead}>
        <Ionicons name={icon} size={13} color={tone} />
        <AppText variant="caption" color="tertiary" uppercase numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant="callout" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function BodyCell({
  field,
  value,
  unit,
  label,
  colors,
  onPress,
}: {
  field: BodyField;
  value: string | number;
  unit: string;
  label: string;
  colors: ReturnType<typeof useColors>["colors"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} ${unit}`}
      accessibilityHint={`Change your ${label.toLowerCase()}`}
      style={({ pressed }) => [
        styles.bodyCell,
        { backgroundColor: colors.surfaceSunken },
        pressed && { opacity: 0.7 },
      ]}
      testID={`body-cell-${field}`}
    >
      <View style={styles.bodyValueRow}>
        <AppText variant="title" style={styles.bodyValue}>
          {value}
        </AppText>
        <AppText variant="footnote" color="tertiary" style={styles.bodyUnit}>
          {unit}
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary">
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * The body editor — all three numbers in one sheet, opened focused on the one
 * that was tapped.
 *
 * Deliberately not a jump to Settings' edit modal: that modal asks for sex,
 * activity level, goal, restrictions, allergies and injuries too, and updating
 * this morning's weight shouldn't require walking past all of it. Settings is
 * still the door for everything else — the pencil in the header goes there.
 */
function BodyEditSheet({
  field,
  bio,
  currentWeightKg,
  colors,
  onClose,
  onSave,
}: {
  field: BodyField | null;
  bio: UserBio | null;
  currentWeightKg: number | null;
  colors: ReturnType<typeof useColors>["colors"];
  onClose: () => void;
  onSave: (next: { age: number; heightCm: number; weightKg: number }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<BodyField, string>>({
    age: "",
    height: "",
    weight: "",
  });
  const [saving, setSaving] = useState(false);
  /**
   * THIS USED TO BE `KeyboardAvoidingView`, WHICH DOES NOTHING HERE.
   * `app.json` sets `android.edgeToEdgeEnabled`, so the window lays out behind
   * the IME and `adjustResize` is a no-op — a KeyboardAvoidingView with
   * `behavior={undefined}` (what Android was passed) has nothing to react to,
   * and the fields sat under the keyboard on the exact platform where you
   * cannot scroll them into view. See components/ui/useKeyboardInset.ts.
   */
  const keyboard = useKeyboardInset();
  const reduceMotion = useReducedMotion();
  // The sheet arrives rather than appearing. A modal that only cross-fades is
  // the loudest "this is an old app" signal there is.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = !field
      ? 0
      : reduceMotion
        ? 1
        : withSpring(1, { damping: 20, stiffness: 260, mass: 0.9 });
  }, [field, enter, reduceMotion]);
  const panelStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.93 + enter.value * 0.07 }],
  }));

  // Reseed from live values every time the sheet opens, so an abandoned edit
  // never resurfaces as a stale draft on the next open.
  useEffect(() => {
    if (!field || !bio) return;
    setDraft({
      age: String(bio.age),
      height: String(bio.heightCm),
      weight: String(round1(currentWeightKg ?? bio.weightKg)),
    });
  }, [field, bio, currentWeightKg]);

  if (!field || !bio) return null;

  const parsed: Record<BodyField, number> = {
    age: Number(draft.age),
    height: Number(draft.height),
    weight: Number(draft.weight),
  };

  const invalid = (Object.keys(BODY_LIMITS) as BodyField[]).filter((k) => {
    const { min, max } = BODY_LIMITS[k];
    return !Number.isFinite(parsed[k]) || parsed[k] < min || parsed[k] > max;
  });
  const canSave = invalid.length === 0 && !saving;

  const weightMoved = Math.abs(parsed.weight - (currentWeightKg ?? bio.weightKg)) > 0.05;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        age: Math.round(parsed.age),
        heightCm: Math.round(parsed.height),
        weightKg: round1(parsed.weight),
      });
      onClose();
    } catch (error) {
      console.error("Error saving body values:", error);
      Alert.alert("Couldn't save that", "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      {/* The scroll region fills the window and centres the sheet in it, so the
          fields stay reachable on a short screen with the keyboard up. */}
      <Animated.View style={[StyleSheet.absoluteFill, keyboard.containerStyle]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.bodySheetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.bodySheetFill}
            onPress={onClose}
            // Hidden from assistive tech, but only this node: the labelled
            // scrim behind already offers "Close", and a full-screen button
            // wrapping the sheet would swallow its fields into one
            // announcement.
            accessible={false}
            importantForAccessibility="no"
          >
          <Animated.View style={[styles.bodySheetWrap, panelStyle]}>
          {/* Claims the touch responder so a tap that lands on the sheet —
              missing an input, dismissing the keyboard — doesn't reach the
              scrim behind it and throw away what was being typed. */}
          <View
            onStartShouldSetResponder={() => true}
            style={[
              styles.bodySheet,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <AppText variant="headline" align="center">
              Your body
            </AppText>
            <AppText variant="footnote" color="secondary" align="center" style={styles.bodySheetIntro}>
              Change these and I&apos;ll re-fit your targets, meals and workouts
              right away.
            </AppText>

            <View style={styles.bodyFields}>
              {(Object.keys(BODY_LIMITS) as BodyField[]).map((k) => {
                const meta = BODY_LIMITS[k];
                const bad = invalid.includes(k);
                return (
                  <View key={k} style={styles.bodyField}>
                    <AppText variant="footnote" color="secondary">
                      {meta.label}
                    </AppText>
                    <View
                      style={[
                        styles.bodyInputWrap,
                        {
                          backgroundColor: colors.surfaceSunken,
                          // Only the field being edited gets the accent; a red
                          // ring on an untouched field would be an accusation.
                          borderColor: bad
                            ? colors.error
                            : k === field
                              ? colors.primary
                              : "transparent",
                        },
                      ]}
                    >
                      <TextInput
                        value={draft[k]}
                        onChangeText={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                        keyboardType={k === "weight" ? "decimal-pad" : "number-pad"}
                        // The tapped number is the one they came to change.
                        autoFocus={k === field}
                        selectTextOnFocus
                        maxLength={5}
                        style={[styles.bodyInput, { color: colors.text }]}
                        maxFontSizeMultiplier={1.3}
                        accessibilityLabel={meta.label}
                      />
                      <AppText variant="subhead" color="tertiary">
                        {meta.unit}
                      </AppText>
                    </View>
                    {bad ? (
                      <AppText variant="caption" style={{ color: colors.error }}>
                        Enter {meta.min}–{meta.max} {meta.unit}
                      </AppText>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {weightMoved ? (
              <View style={[styles.bodyNote, { backgroundColor: alpha(colors.primary, 0.1) }]}>
                <Ionicons name="trending-up" size={14} color={colors.primary} />
                <AppText variant="caption" color="secondary" style={styles.flex}>
                  Saved as a weigh-in too, so your trend and forecast see it.
                </AppText>
              </View>
            ) : null}

            <View style={styles.bodyActions}>
              <Button label="Cancel" variant="tonal" onPress={onClose} style={styles.flex} />
              <Button
                label={saving ? "Saving…" : "Save"}
                onPress={handleSave}
                disabled={!canSave}
                style={styles.flex}
              />
            </View>
          </View>
          </Animated.View>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function AchievementCard({
  item,
  colors,
  onPress,
}: {
  item: EvaluatedAchievement;
  colors: ReturnType<typeof useColors>["colors"];
  onPress: () => void;
}) {
  const { def, unlocked, value, target, progress } = item;
  const tier = TIER_META[def.tier];
  const tone = unlocked ? tier.color : colors.textTertiary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${def.name}. ${unlocked ? "Unlocked" : `${value} of ${target}${def.unit ? ` ${def.unit}` : ""}`}.`}
      style={[
        styles.achCard,
        {
          backgroundColor: colors.surface,
          borderColor: unlocked ? alpha(tier.color, 0.45) : colors.border,
        },
      ]}
    >
      <View style={styles.achTop}>
        <IconBadge name={def.icon} tone={tone} size={40} solid={unlocked} />
        {unlocked ? (
          <Ionicons name="checkmark-circle" size={18} color={tier.color} />
        ) : (
          <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
        )}
      </View>

      <AppText
        variant="callout"
        color={unlocked ? "primary" : "secondary"}
        numberOfLines={1}
        style={styles.achName}
      >
        {def.name}
      </AppText>
      <AppText variant="caption" color="tertiary" numberOfLines={2} style={styles.achDesc}>
        {def.description}
      </AppText>

      <View style={styles.achFooter}>
        {unlocked ? (
          <View style={[styles.achTierPill, { backgroundColor: alpha(tier.color, 0.16) }]}>
            <AppText variant="caption" style={[styles.achTierText, { color: tier.color }]}>
              {tier.label}
            </AppText>
          </View>
        ) : (
          <>
            <ProgressBar progress={progress} tone={tier.color} height={6} />
            <AppText variant="caption" color="tertiary" style={styles.achProgress}>
              {value}/{target}
              {def.unit ? ` ${def.unit}` : ""}
            </AppText>
          </>
        )}
      </View>
    </Pressable>
  );
}

/**
 * ACHIEVEMENT DETAIL.
 *
 * The old one was a tall white box: a flat badge, a name, a paragraph, a bar,
 * and a Close button — a dialog you dismiss, when the thing it's showing you is
 * a trophy. This is the same medallion language as the unlock celebration
 * (blurred ground, halo, gradient disc), so the moment you earned it and the
 * moment you go back to look at it feel like the same object.
 *
 * NO CLOSE BUTTON, AND THE CARD ITSELF DISMISSES. A button is a decision, and
 * there is no decision here — there's one way out and every pixel is it. The
 * quiet line at the bottom is what makes that discoverable without a control.
 *
 * The ring is load-bearing for locked achievements: it turns "62 / 100" from a
 * fact you read into a shape you see, and it's the same Ring the rest of the
 * app uses for hero metrics, so the meaning transfers.
 */
function AchievementDetailModal({
  item,
  onClose,
}: {
  item: EvaluatedAchievement | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while there IS one, so the entrance and the halo restart
          on every open instead of playing once for the life of the screen. */}
      {item ? <AchievementDetail item={item} onClose={onClose} /> : null}
    </Modal>
  );
}

function AchievementDetail({
  item,
  onClose,
}: {
  item: EvaluatedAchievement;
  onClose: () => void;
}) {
  const { colors, isDark } = useColors();
  const reduceMotion = useReducedMotion();
  const { def, unlocked, rawValue, target, progress, earnedAt } = item;
  const tier = TIER_META[def.tier];
  // ONE ACCENT, AND IT IS GOLD. The tier colours (a coppery bronze, a blue
  // platinum) each dragged their own hue onto this screen, and against black
  // the bronze in particular read as a dull orange rather than as a prize. The
  // tier is still named in the pill and still colours the grid card; here the
  // metal is always gold. Locked achievements get the same gold, dimmed —
  // it's the same trophy, not yet lit.
  const accent = unlocked ? GOLD : GOLD_DIM;
  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Entrance: the card arrives, it doesn't appear. Modal's own `fade` carries
  // the ground; this is the medallion coming to meet you.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = reduceMotion
      ? 1
      : withSpring(1, { damping: 15, stiffness: 180, mass: 0.9 });
  }, [enter, reduceMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [
      { scale: 0.92 + enter.value * 0.08 },
      { translateY: (1 - enter.value) * 14 },
    ],
  }));

  // The halo breathes only on something you actually earned. A locked
  // achievement glowing would be the screen congratulating you for nothing.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!unlocked || reduceMotion) return;
    glow.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(glow);
  }, [glow, unlocked, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.35,
    transform: [{ scale: 1 + glow.value * 0.1 }],
  }));

  return (
    <Pressable
      style={styles.detailScrim}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <BlurView
        intensity={36}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />

      {/* A CARD, AND IT IS PITCH BLACK. Not the theme's surface — black in both
          modes, because black is the only ground gold reads as metal on, and a
          light-grey panel turned the trophy into a dialog about a trophy. The
          card shape stays: this is one achievement, held, not a takeover of
          the screen. */}
      <Animated.View
        style={[styles.detailCard, { borderColor: alpha(GOLD, 0.35) }, cardStyle]}
      >
        {/* A warm pool behind the medallion so the black has a centre and the
            gold looks lit rather than painted on. Clipped by the card's own
            `overflow: hidden`, which is what keeps it a glow and not a halo
            leaking over the corners. */}
        <LinearGradient
          colors={[alpha(GOLD, unlocked ? 0.15 : 0.06), "#00000000"]}
          style={styles.detailVignette}
        />

        {/* Medallion — halo, sparks, ring, disc, glyph. */}
        <View style={styles.medallionWrap}>
          <Animated.View
            style={[styles.medallionHalo, { backgroundColor: alpha(GOLD, 0.18) }, haloStyle]}
          />
          {unlocked
            ? MEDAL_SPARKLES.map((s, i) => <Sparkle key={i} {...s} color={GOLD} />)
            : null}
          <Ring
            progress={unlocked ? 1 : progress}
            size={140}
            strokeWidth={7}
            gradient={GOLD_GRADIENT}
            track={alpha(GOLD, 0.16)}
          >
            <LinearGradient
              colors={
                unlocked
                  ? [GOLD_LIGHT, GOLD, GOLD_DEEP]
                  : [alpha(GOLD, 0.16), alpha(GOLD, 0.06)]
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.medallion}
            >
              <Ionicons
                name={def.icon}
                size={44}
                // Dark ink on bright metal — white on gold is mush.
                color={unlocked ? "#1A1206" : alpha(GOLD, 0.55)}
              />
            </LinearGradient>
          </Ring>
        </View>

        <View style={[styles.detailTier, { backgroundColor: alpha(GOLD, 0.14) }]}>
          <Ionicons name={unlocked ? "medal" : "lock-closed"} size={13} color={accent} />
          <AppText variant="caption" style={[styles.achTierText, { color: accent }]}>
            {tier.label} · {unlocked ? "+" : ""}
            {tier.points} pts
          </AppText>
        </View>

        {/* Struck letter by letter, cooling from white to gold. */}
        <View style={styles.detailNameWrap}>
          <GlitterText
            key={def.id}
            text={def.name}
            color={GOLD}
            variant="title"
            delay={160}
            spread={3}
          />
        </View>

        <AppText variant="subhead" align="center" style={styles.detailDesc}>
          {def.description}
        </AppText>

        {unlocked ? (
          <View style={[styles.detailStatus, { borderColor: alpha(GOLD, 0.3) }]}>
            <Ionicons name="checkmark-circle" size={17} color={GOLD} />
            <View>
              <AppText variant="footnote" weight="700" style={{ color: GOLD }}>
                Unlocked
              </AppText>
              {earnedDate ? (
                <AppText variant="caption" style={styles.detailMuted}>
                  {earnedDate}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.detailStatusCol}>
            <View style={styles.detailProgressRow}>
              <AppText variant="title" style={[styles.detailProgressValue, { color: GOLD }]}>
                {rawValue}
              </AppText>
              <AppText variant="subhead" style={styles.detailMuted}>
                / {target}
                {def.unit ? ` ${def.unit}` : ""}
              </AppText>
            </View>
            <AppText variant="footnote" style={styles.detailMuted}>
              {Math.max(0, target - rawValue)}
              {def.unit ? ` ${def.unit}` : ""} to go
            </AppText>
          </View>
        )}

        {/* The only exit instruction, and the only thing here that isn't the
            trophy. Deliberately the quietest thing on the screen. */}
        <AppText variant="caption" align="center" style={[styles.detailHint, styles.detailFaint]}>
          Tap anywhere to close
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

function HistoryItem({
  entry,
  colors,
}: {
  entry: DietHistoryEntry;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  const date = new Date(entry.date);
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const tone =
    entry.status === "completed"
      ? colors.success
      : entry.status === "partial"
        ? colors.warning
        : colors.textTertiary;

  return (
    <View style={styles.historyRow}>
      <View style={styles.flex}>
        <AppText variant="callout">{formatted}</AppText>
        <AppText variant="footnote" color="tertiary" style={styles.historyDiet}>
          {entry.dietName}
        </AppText>
      </View>
      <View style={styles.historyRight}>
        <Pill label={titleCase(entry.status)} tone={tone} size="sm" />
        <AppText variant="caption" color="tertiary">
          {entry.mealsConsumed}/{entry.totalMeals} meals
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  section: { marginTop: Spacing.xxl },

  headerRow: { paddingTop: Spacing.xs, marginBottom: Spacing.xl },
  moment: { marginBottom: Spacing.xl },

  // Latest achievement — the identity card's last row.
  latestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    // Keeps the gold wash inside the rounded corners.
    overflow: "hidden",
  },

  // Chapter banner
  chapterBanner: { borderWidth: 1 },
  chapterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  // Level card
  levelTop: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  levelKicker: { fontWeight: "800", letterSpacing: 1 },
  levelPoints: { marginTop: 2 },
  levelHint: { marginTop: Spacing.sm },

  // Identity
  identityRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatarWrap: { width: 56, height: 56 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  avatarInitials: { alignItems: "center", justifyContent: "center" },
  avatarEdit: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // Three equal plates, no hairlines: the gaps do the separating, so nothing
  // has to be drawn between them.
  bioStats: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  bodyCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
  },
  bodyValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  bodyValue: { fontWeight: "800" },
  bodyUnit: { fontWeight: "600" },

  // Body editor sheet
  bodySheetScroll: { flexGrow: 1 },
  bodySheetFill: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  bodySheetWrap: { width: "100%", maxWidth: 380 },
  bodySheet: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
  },
  bodySheetIntro: { marginTop: Spacing.xs, lineHeight: 18 },
  bodyFields: { marginTop: Spacing.lg },
  bodyField: { gap: 5, marginBottom: Spacing.md },
  bodyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  bodyInput: { flex: 1, fontSize: 20, fontWeight: "700", padding: 0 },
  bodyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  bodyActions: { flexDirection: "row", gap: Spacing.sm },

  // Your plan — targets strip over the setup grid
  targetStrip: { flexDirection: "row" },
  targetStat: { flex: 1, alignItems: "center", gap: 4 },
  targetDot: { width: 7, height: 7, borderRadius: Radius.pill },
  targetValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  targetValue: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  /**
   * Two per row. `47%` forces the wrap at two (two of them plus the gap can't
   * leave room for a third) and `flexGrow` spends the remainder, so the row
   * ends flush instead of trailing off wherever the last value happened to end.
   */
  setupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: Spacing.lg,
    columnGap: Spacing.md,
  },
  setupCell: { width: "47%", flexGrow: 1, gap: 3 },
  setupHead: { flexDirection: "row", alignItems: "center", gap: 5 },

  // Achievements
  catBlock: { marginTop: Spacing.lg },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  achGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  achCard: {
    width: "47.5%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  achTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  achName: { marginTop: Spacing.sm },
  achDesc: { marginTop: 2, minHeight: 30 },
  achFooter: { marginTop: Spacing.sm, gap: 4 },
  achProgress: { fontWeight: "600" },
  achTierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  achTierText: { fontWeight: "700" },

  // Achievement detail modal
  detailScrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  detailCard: {
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: "center",
    // Pitch black in BOTH themes — see the gold constants for why it's a
    // literal and not a token.
    backgroundColor: "#000000",
    // Clips the vignette to the rounded corners.
    overflow: "hidden",
  },
  /** The warm pool behind the medallion — a light source for the black. */
  detailVignette: {
    position: "absolute",
    top: -60,
    left: -60,
    right: -60,
    height: 320,
    borderRadius: 320,
  },
  /** Sized to the Ring so the halo can bloom past it without moving anything. */
  medallionWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  medallionHalo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  medallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.lg,
  },
  detailNameWrap: { marginTop: Spacing.md },
  detailDesc: {
    marginTop: Spacing.sm,
    lineHeight: 20,
    // On black, the theme's "secondary" is a mid-grey tuned for a light card.
    color: "rgba(255,255,255,0.62)",
  },
  detailMuted: { color: "rgba(255,255,255,0.55)" },
  detailFaint: { color: "rgba(255,255,255,0.34)" },
  detailStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  detailStatusCol: { alignItems: "center", marginTop: Spacing.xl },
  detailProgressRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  detailProgressValue: { fontWeight: "800" },
  detailHint: { marginTop: Spacing.xxxl },

  // Glitter typography + sparks
  glitterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  glitterHot: { color: GLITTER_HOT },
  sparkle: { position: "absolute" },

  // Latest achievement row
  latestMedalWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  latestCheer: { letterSpacing: 0.3 },

  // History
  historyChart: { marginBottom: Spacing.lg },
  /** Clips the rows' corners to the card's. */
  historyCard: { overflow: "hidden" },
  historyDivider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  historyDiet: { marginTop: 2 },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyEmpty: { alignItems: "center", gap: Spacing.xs },
  historyEmptyTitle: { marginTop: Spacing.sm },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="profile" />;
}
