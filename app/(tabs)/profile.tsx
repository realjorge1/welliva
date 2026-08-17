/**
 * PROFILE / PROGRESS — identity, streak progress, achievements, targets &
 * history. Settings live on their own screen (`/settings`), reached from the
 * More tab only — this screen deliberately has no gear so there's exactly one
 * door to Settings. Rebuilt on the Welliva design system.
 *
 * A PUSHED ROUTE (`/profile`), not a tab. It used to sit in the tabs layout's
 * screen array while being absent from the nav bar, reachable only through
 * `/(tabs)?tab=profile` — which meant it stayed mounted alongside all four real
 * tabs, and the link went dead once the param stopped changing.
 */

import {
  AppText,
  Button,
  Card,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Screen,
  SectionHeader,
  Stat,
  useColors,
} from "@/components/ui";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { TrendCard, buildAdherenceTrend, type TrendSeries } from "@/components/charts";
import { GozlinMoment } from "@/components/gozlin";
import { ScreenTopBar } from "@/components/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useProfile, useSystem } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { isHistoryRangeLocked } from "@/services/billing";
import { pickAvatar } from "@/services/sync/pickAndUpload";
import { fetchAvatarUrl, getAvatarUrl } from "@/services/sync/StorageSync";
import { Image } from "expo-image";
import { DietHistoryEntry } from "@/models/diet";
import { getDietHistory } from "@/services/ScheduleService";
import { getMotivationalMessage } from "@/services/StreakService";
import {
  AchievementCategory,
  CATEGORY_META,
  EvaluatedAchievement,
  getAchievementSummary,
  getNextStreakMilestone,
  TIER_META,
} from "@/services/AchievementService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

/** Order categories appear in the achievements list. */
const CATEGORY_ORDER: AchievementCategory[] = [
  "streak",
  "workout",
  "nutrition",
  "hydration",
  "body",
];

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

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
  const { userBio, nutritionTargets } = useProfile();
  const {
    streakData,
    achievements,
    goalAchievedPending,
    journeyChapter,
  } = useGamification();
  const { currentDate } = useSystem();
  const { user } = useAuth();
  const { hasProAccess, openPaywall } = useBilling();

  const summary = useMemo(() => getAchievementSummary(achievements), [achievements]);
  const nextMilestone = useMemo(
    () => getNextStreakMilestone(streakData.currentStreak),
    [streakData.currentStreak],
  );
  const motivation = useMemo(
    () => getMotivationalMessage(streakData),
    [streakData],
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
  // Uploaded profile photo (resolved to a signed URL). Distinct from the OAuth
  // provider avatar shown on the More tab — this one the user sets here.
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  // Resolve the stored avatar (from users.avatar_url) when the account is known.
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setAvatarUri(null);
      return;
    }
    fetchAvatarUrl(user.id).then((url) => {
      if (alive) setAvatarUri(url);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const loadHistory = async () => {
    try {
      setHistory(await getDietHistory());
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  /** Pick + upload a new profile photo, then show it. Fail-soft (no-op on cancel). */
  const changeAvatar = async () => {
    if (!user?.id || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const path = await pickAvatar(user.id);
      if (path) {
        const url = await getAvatarUrl(path);
        if (url) setAvatarUri(url);
      }
    } finally {
      setUploadingAvatar(false);
    }
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
        locked: isHistoryRangeLocked(90, hasProAccess),
      },
    ],
    [history, currentDate, hasProAccess],
  );

  const targets = nutritionTargets
    ? [
        { label: "Calories", value: `${nutritionTargets.calories} kcal`, icon: "flame", tone: colors.calories },
        { label: "Protein", value: `${nutritionTargets.proteinG} g`, icon: "leaf", tone: colors.protein },
        { label: "Carbs", value: `${nutritionTargets.carbsG} g`, icon: "flash", tone: colors.carbs },
        { label: "Fat", value: `${nutritionTargets.fatG} g`, icon: "water", tone: colors.fat },
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
      <Screen header={header}>
        {/* Identity — who this is, front and center */}
        <Reveal index={1}>
          <Card style={styles.block}>
            <View style={styles.identityRow}>
              <Pressable
                onPress={changeAvatar}
                disabled={uploadingAvatar}
                accessibilityLabel="Change profile photo"
                style={styles.avatarWrap}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={[styles.avatar, { borderColor: alpha(colors.primary, 0.35) }]}
                    contentFit="cover"
                    transition={200}
                  />
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
                <AppText variant="title">Your profile</AppText>
                <AppText variant="subhead" color="secondary">
                  {userBio?.primaryGoal ? titleCase(userBio.primaryGoal) : "Set your goals"}
                </AppText>
              </View>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/settings", params: { edit: "1" } })
                }
                style={[styles.editBtn, { borderColor: alpha(colors.primary, 0.4) }]}
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </Pressable>
            </View>

            {userBio && (
              <View style={[styles.bioStats, { borderTopColor: colors.divider }]}>
                <Stat value={userBio.age} label="Age" />
                <View style={[styles.vline, { backgroundColor: colors.divider }]} />
                <Stat value={userBio.heightCm} label="Height cm" />
                <View style={[styles.vline, { backgroundColor: colors.divider }]} />
                <Stat value={userBio.weightKg} label="Weight kg" />
              </View>
            )}
          </Card>
        </Reveal>

        {/* Gozlin's read of you. It lived under "YOU" on the More tab; when the
            menu replaced that tab, identity was the right place for it. */}
        <Reveal index={2}>
          <GozlinMoment surface="progress" style={styles.moment} />
        </Reveal>

        {/* Streak hero */}
        <Reveal index={2}>
          <Card style={styles.block} padding="xxl">
            <View style={styles.heroTop}>
              <IconBadge name="flame" tone={colors.calories} size={52} />
              <View style={styles.flex}>
                <View style={styles.heroCountRow}>
                  <AppText variant="displayLg">{streakData.currentStreak}</AppText>
                  <AppText variant="headline" color="secondary" style={styles.heroUnit}>
                    day streak
                  </AppText>
                </View>
                <AppText variant="footnote" color="tertiary" numberOfLines={2}>
                  {motivation}
                </AppText>
              </View>
            </View>

            {/* Week activity dots */}
            <View style={styles.weekRow}>
              {WEEK_LABELS.map((day, i) => {
                const active = streakData.weekActivity[i];
                return (
                  <View key={i} style={styles.weekCol}>
                    <View
                      style={[
                        styles.weekDot,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceSunken,
                        },
                      ]}
                    >
                      {active && (
                        <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
                      )}
                    </View>
                    <AppText variant="caption" color="tertiary">
                      {day}
                    </AppText>
                  </View>
                );
              })}
            </View>

            {/* Next streak milestone */}
            {nextMilestone && (
              <View style={[styles.milestone, { borderTopColor: colors.divider }]}>
                <View style={styles.milestoneHead}>
                  <View style={styles.milestoneLeft}>
                    <Ionicons name={nextMilestone.def.icon} size={15} color={colors.calories} />
                    <AppText variant="footnote" color="secondary">
                      Next: {nextMilestone.def.name}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="tertiary">
                    {nextMilestone.remaining} day{nextMilestone.remaining === 1 ? "" : "s"} to go
                  </AppText>
                </View>
                <ProgressBar
                  progress={streakData.currentStreak / nextMilestone.def.target}
                  gradient={Gradients.calories}
                  height={8}
                  style={styles.milestoneBar}
                />
              </View>
            )}

            <View style={[styles.heroStats, { borderTopColor: colors.divider }]}>
              <Stat value={streakData.longestStreak} label="Best" />
              <View style={[styles.vline, { backgroundColor: colors.divider }]} />
              <Stat value={streakData.totalActiveDays} label="Active days" />
              <View style={[styles.vline, { backgroundColor: colors.divider }]} />
              <Stat
                value={`${summary.earnedCount}/${summary.total}`}
                label="Unlocked"
              />
            </View>
          </Card>
        </Reveal>

        {/* Goal reached → re-consult banner */}
        {goalAchievedPending && (
          <Reveal index={3}>
            <Pressable onPress={() => router.push("/new-chapter")}>
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

        {/* Your setup — the consultation captured this; show it back to them */}
        {setup.length > 0 && (
          <Reveal index={4}>
            <View style={styles.section}>
              <SectionHeader title="Your setup" subtitle="From your coaching consultation" />
              <Card padding="sm">
                {setup.map((s, i) => (
                  <View
                    key={s.label}
                    style={[
                      styles.targetRow,
                      i < setup.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                      },
                    ]}
                  >
                    <IconBadge name={s.icon as any} tone={s.tone} size={36} />
                    <AppText variant="body" style={styles.flex}>
                      {s.label}
                    </AppText>
                    <AppText variant="callout">{s.value}</AppText>
                  </View>
                ))}
              </Card>
            </View>
          </Reveal>
        )}

        {/* Daily targets */}
        {nutritionTargets && (
          <Reveal index={5}>
            <View style={styles.section}>
              <SectionHeader title="Daily targets" />
              <Card padding="sm">
                {targets.map((t, i) => (
                  <View
                    key={t.label}
                    style={[
                      styles.targetRow,
                      i < targets.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                      },
                    ]}
                  >
                    <IconBadge name={t.icon as any} tone={t.tone} size={36} />
                    <AppText variant="body" style={styles.flex}>
                      {t.label}
                    </AppText>
                    <AppText variant="callout">{t.value}</AppText>
                  </View>
                ))}
              </Card>
            </View>
          </Reveal>
        )}

        {/* Achievements */}
        <Reveal index={6}>
          <View style={styles.section}>
            <SectionHeader
              title="Achievements"
              subtitle={`${summary.earnedCount} of ${summary.total} unlocked`}
            />

            {/* Level / points card */}
            <Card style={styles.block} padding="lg">
              <View style={styles.levelTop}>
                <View style={[styles.levelBadge, { backgroundColor: alpha(colors.gold, 0.16) }]}>
                  <Ionicons name="trophy" size={22} color={colors.gold} />
                  <AppText variant="caption" style={[styles.levelNum, { color: colors.gold }]}>
                    LVL {summary.level}
                  </AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="headline">{summary.levelTitle}</AppText>
                  <AppText variant="footnote" color="tertiary">
                    {summary.points} of {summary.maxPoints} points earned
                  </AppText>
                </View>
              </View>
              <ProgressBar
                progress={summary.pointsIntoLevel / summary.pointsForLevel}
                gradient={colors.brandGradient}
                height={10}
                style={styles.levelBar}
              />
              <AppText variant="caption" color="tertiary" style={styles.levelHint}>
                {summary.pointsForLevel - summary.pointsIntoLevel} pts to Level {summary.level + 1}
              </AppText>
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
        <Reveal index={7}>
          <View style={styles.section}>
            <SectionHeader title="History" />
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
                  onLockedRangePress={() => openPaywall("history")}
                />
              </View>
            )}
            {history.length > 0 ? (
              history
                .slice(0, 7)
                .map((entry, index) => (
                  <HistoryItem key={index} entry={entry} colors={colors} />
                ))
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
      <AchievementDetailModal
        item={detail}
        onClose={() => setDetail(null)}
        colors={colors}
      />

      <LoadingOverlay visible={uploadingAvatar} message="Uploading photo…" />
    </>
  );
}

/* ───────────────────────────── Sub-components ──────────────────────────── */

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

function AchievementDetailModal({
  item,
  onClose,
  colors,
}: {
  item: EvaluatedAchievement | null;
  onClose: () => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  if (!item) return null;
  const { def, unlocked, rawValue, target, progress, earnedAt } = item;
  const tier = TIER_META[def.tier];
  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.detailScrim, { backgroundColor: colors.scrim }]} onPress={onClose}>
        <Pressable
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: alpha(tier.color, 0.4) },
          ]}
        >
          <IconBadge name={def.icon} tone={unlocked ? tier.color : colors.textTertiary} size={72} solid={unlocked} />
          <AppText variant="title" align="center" style={styles.detailName}>
            {def.name}
          </AppText>
          <View style={[styles.achTierPill, { backgroundColor: alpha(tier.color, 0.16) }]}>
            <Ionicons name="medal" size={13} color={tier.color} />
            <AppText variant="caption" style={[styles.achTierText, { color: tier.color }]}>
              {tier.label} · +{tier.points} pts
            </AppText>
          </View>
          <AppText variant="subhead" color="secondary" align="center" style={styles.detailDesc}>
            {def.description}
          </AppText>

          {unlocked ? (
            <View style={[styles.detailUnlocked, { backgroundColor: alpha(colors.success, 0.14) }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="footnote" style={{ color: colors.success }}>
                Unlocked{earnedDate ? ` · ${earnedDate}` : ""}
              </AppText>
            </View>
          ) : (
            <View style={styles.detailProgressWrap}>
              <ProgressBar progress={progress} tone={tier.color} height={10} />
              <AppText variant="footnote" color="tertiary" align="center" style={styles.detailProgressText}>
                {rawValue} / {target}
                {def.unit ? ` ${def.unit}` : ""} · {Math.round(progress * 100)}%
              </AppText>
            </View>
          )}

          <Button label="Close" variant="tonal" onPress={onClose} style={styles.detailBtn} />
        </Pressable>
      </Pressable>
    </Modal>
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
    <Card style={styles.historyItem} padding="lg" elevation="xs">
      <View style={styles.historyRow}>
        <View style={styles.flex}>
          <AppText variant="callout">{formatted}</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.historyDiet}>
            {entry.dietName}
          </AppText>
        </View>
        <View style={styles.historyRight}>
          <Pill label={titleCase(entry.status)} tone={tone} size="sm" />
          <AppText variant="caption" color="tertiary" style={styles.historyMeals}>
            {entry.mealsConsumed}/{entry.totalMeals} meals
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  section: { marginTop: Spacing.xxl },
  vline: { width: 1, height: 34 },

  headerRow: { paddingTop: Spacing.xs, marginBottom: Spacing.xl },
  moment: { marginBottom: Spacing.xl },

  // Hero
  heroTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  heroCountRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  heroUnit: { fontWeight: "600" },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
  },
  weekCol: { alignItems: "center", gap: 6 },
  weekDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  milestone: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  milestoneHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  milestoneLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  milestoneBar: {},

  // Chapter banner
  chapterBanner: { borderWidth: 1 },
  chapterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  // Level card
  levelTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  levelNum: { fontWeight: "800", letterSpacing: 0.5 },
  levelBar: { marginTop: Spacing.lg },
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
  bioStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
  },

  // Targets
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },

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
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailName: { marginTop: Spacing.sm },
  detailDesc: { marginTop: Spacing.xs },
  detailUnlocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  detailProgressWrap: { alignSelf: "stretch", marginTop: Spacing.sm, gap: 6 },
  detailProgressText: {},
  detailBtn: { alignSelf: "stretch", marginTop: Spacing.md },

  // Trophy shelf
  trophyGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  trophyCard: {
    width: "47.5%",
    flexGrow: 1,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  trophyTitle: { marginTop: Spacing.sm },
  trophyPts: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
  trophyPtsText: { fontWeight: "800" },

  // History
  historyChart: { marginBottom: Spacing.lg },
  historyItem: { marginBottom: Spacing.sm },
  historyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  historyDiet: { marginTop: 2 },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyMeals: {},
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
