/**
 * FITNESS PROGRESS — the training story in numbers.
 *
 * Weekly goal ring, streak, lifetime totals, 8-week consistency bars,
 * personal bests and the optional body-weight trend. All figures derive from
 * the app's SSOT collections via the pure ProgressService.
 */

import {
  TrendCard,
  buildSessionVolume,
  buildWeeklyMinutes,
  buildWeightTrend,
  type TrendSeries,
} from "@/components/charts";
import { AppText, Card, IconBadge, ProgressGauge, Screen, useColors } from "@/components/ui";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useApp } from "@/contexts/AppContext";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import { buildProgressSnapshot } from "@/fitness/services/ProgressService";
import { pickProgressPhoto } from "@/services/sync/pickAndUpload";
import { getSignedUrl, listObjects } from "@/services/sync/StorageSync";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function FitnessProgressScreen() {
  const { colors } = useColors();
  const app = useApp();
  const { profile } = useFitnessProfile();

  const snapshot = useMemo(
    () =>
      buildProgressSnapshot({
        workoutLog: app.workoutLog,
        sessionHistory: app.sessionHistory,
        today: app.currentDate,
        weeklyTargetDays: profile.daysAvailable.length || 3,
      }),
    [app.workoutLog, app.sessionHistory, app.currentDate, profile.daysAvailable.length],
  );

  const today = app.currentDate;

  // Scrubbable trend series — the training story you can drag through.
  const minuteSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "8W", label: "8 wk", points: buildWeeklyMinutes(app.workoutLog, today, 8) },
      { key: "16W", label: "16 wk", points: buildWeeklyMinutes(app.workoutLog, today, 16) },
      { key: "6M", label: "6 mo", points: buildWeeklyMinutes(app.workoutLog, today, 26) },
    ],
    [app.workoutLog, today],
  );

  const volumeSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "10", label: "Last 10", points: buildSessionVolume(app.sessionHistory, 10) },
      { key: "25", label: "Last 25", points: buildSessionVolume(app.sessionHistory, 25) },
    ],
    [app.sessionHistory],
  );

  const weightSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "1M", label: "1 mo", points: buildWeightTrend(app.bodyLogs, today, 30) },
      { key: "3M", label: "3 mo", points: buildWeightTrend(app.bodyLogs, today, 90) },
      { key: "1Y", label: "1 yr", points: buildWeightTrend(app.bodyLogs, today, 365) },
    ],
    [app.bodyLogs, today],
  );

  const latestWeight = app.bodyLogs.length > 0 ? app.bodyLogs[app.bodyLogs.length - 1] : null;
  const firstWeight = app.bodyLogs.length > 1 ? app.bodyLogs[0] : null;
  const weightDelta =
    latestWeight && firstWeight ? latestWeight.weightKg - firstWeight.weightKg : null;

  const target = profile.daysAvailable.length || 3;

  const stats = [
    { icon: "barbell", label: "Total workouts", value: `${snapshot.totalWorkouts}` },
    { icon: "time", label: "This week", value: `${snapshot.thisWeekMinutes} min` },
    { icon: "calendar", label: "This month", value: `${snapshot.thisMonthMinutes} min` },
    { icon: "flame", label: "Calories (est.)", value: `${snapshot.totalCalories}` },
  ];

  const bests = [
    { icon: "hourglass-outline", label: "Longest session", value: `${snapshot.personalBests.longestSessionMin} min` },
    { icon: "repeat-outline", label: "Most reps in a session", value: `${snapshot.personalBests.mostRepsInSession}` },
    { icon: "podium-outline", label: "Best week", value: `${snapshot.personalBests.bestWeekWorkouts} workouts` },
    { icon: "flame-outline", label: "Longest streak", value: `${snapshot.personalBests.longestStreakDays} days` },
  ];

  return (
    <Screen
      header={
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <AppText variant="display">Progress</AppText>
        </View>
      }
    >
      {/* Weekly goal hero — the training tachometer */}
      <Card style={[styles.block, styles.heroCard]} padding="xxl">
        <AppText variant="caption" color="tertiary" uppercase style={styles.heroEyebrow}>
          This week
        </AppText>
        <ProgressGauge
          value={snapshot.thisWeekWorkouts}
          max={target}
          unit={`of ${target}`}
          size={244}
          mini={{ icon: "flame", text: `${snapshot.currentStreakDays}-day streak` }}
        />
        <AppText variant="subhead" color="secondary" align="center" style={styles.heroSub}>
          {snapshot.thisWeekWorkouts >= target
            ? "Weekly goal complete — outstanding."
            : `${target - snapshot.thisWeekWorkouts} more ${
                target - snapshot.thisWeekWorkouts === 1 ? "workout" : "workouts"
              } to redline your goal.`}
        </AppText>
      </Card>

      {/* Stat grid */}
      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.statCard} padding="lg">
            <IconBadge name={s.icon as never} tone={colors.primary} size={34} />
            <AppText variant="headline" style={styles.statValue}>
              {s.value}
            </AppText>
            <AppText variant="caption" color="tertiary" uppercase>
              {s.label}
            </AppText>
          </Card>
        ))}
      </View>

      {/* Training load — scrub any week of active minutes */}
      <View style={styles.block}>
        <TrendCard
          title="Training load"
          icon="pulse"
          unit="min"
          gradient={colors.brandGradient}
          series={minuteSeries}
          initialRangeKey="8W"
          footnote="Active minutes per week — drag across to inspect any week."
        />
      </View>

      {/* Personal bests */}
      <Card style={styles.block}>
        <AppText variant="headline" style={styles.sectionTitle}>
          Personal bests
        </AppText>
        {bests.map((b, i) => (
          <View
            key={b.label}
            style={[
              styles.bestRow,
              i < bests.length - 1 && {
                borderBottomColor: colors.divider,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Ionicons name={b.icon as never} size={18} color={colors.primary} />
            <AppText variant="body" style={styles.flex}>
              {b.label}
            </AppText>
            <AppText variant="callout" color="brand">
              {b.value}
            </AppText>
          </View>
        ))}
      </Card>

      {/* Session volume — reps completed per session */}
      <View style={styles.block}>
        <TrendCard
          title="Session volume"
          icon="repeat"
          unit="reps"
          gradient={Gradients.protein}
          series={volumeSeries}
          initialRangeKey="10"
          footnote="Total reps per session — your effort, session over session."
          emptyHint="Finish a few sessions and your volume trend appears here."
        />
      </View>

      {/* Body trend — a scrubbable weight line once there are enough weigh-ins */}
      {app.bodyLogs.length >= 2 ? (
        <View style={styles.block}>
          <TrendCard
            title="Body weight"
            icon="scale-outline"
            unit="kg"
            gradient={Gradients.water}
            series={weightSeries}
            initialRangeKey="3M"
            format={(v) => v.toFixed(1)}
            neutralDelta
            footnote="Every logged weigh-in. The trend beats any single number."
          />
        </View>
      ) : latestWeight ? (
        <Card style={styles.block} padding="lg">
          <View style={styles.weightRow}>
            <IconBadge name="scale-outline" tone={colors.water} size={40} />
            <View style={styles.flex}>
              <AppText variant="callout">Body weight</AppText>
              <AppText variant="footnote" color="tertiary">
                Last logged {latestWeight.date}
              </AppText>
            </View>
            <View style={styles.weightNums}>
              <AppText variant="headline">{latestWeight.weightKg.toFixed(1)} kg</AppText>
              {weightDelta !== null && Math.abs(weightDelta) >= 0.1 && (
                <AppText
                  variant="footnote"
                  color={weightDelta < 0 ? "success" : "secondary"}
                >
                  {weightDelta > 0 ? "+" : ""}
                  {weightDelta.toFixed(1)} kg overall
                </AppText>
              )}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Progress photos — the change the numbers can't show */}
      <ProgressPhotosCard />
    </Screen>
  );
}

/**
 * Progress-photo gallery — the user's private body/progress shots, uploaded to
 * the `progress-photos` bucket and read back through short-lived signed URLs.
 * Self-contained (owns its own fetch/upload state) and fail-soft: an unconfigured
 * backend or a cancelled picker simply leaves the empty state in place.
 */
function ProgressPhotosCard() {
  const { colors } = useColors();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setPhotos([]);
      return;
    }
    const paths = await listObjects("progress-photos", user.id);
    const resolved = await Promise.all(
      paths.map(async (path) => ({
        path,
        url: (await getSignedUrl("progress-photos", path)) ?? "",
      })),
    );
    setPhotos(resolved.filter((p) => p.url));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!user?.id || uploading) return;
    setUploading(true);
    try {
      const path = await pickProgressPhoto(user.id);
      if (path) await load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card style={styles.block}>
      <View style={styles.photosHeader}>
        <AppText variant="headline" style={styles.flex}>
          Progress photos
        </AppText>
        <Pressable
          onPress={add}
          disabled={uploading}
          accessibilityLabel="Add progress photo"
          hitSlop={8}
          style={[styles.addPhotoBtn, { backgroundColor: alpha(colors.primary, 0.14) }]}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {photos.length > 0 ? (
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <Image
              key={p.path}
              source={{ uri: p.url }}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          ))}
        </View>
      ) : (
        <AppText variant="footnote" color="tertiary">
          Add a photo now and again — seeing the change is the best motivation.
        </AppText>
      )}

      <LoadingOverlay visible={uploading} message="Uploading photo…" />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  heroCard: { alignItems: "center" },
  heroEyebrow: { alignSelf: "center", marginBottom: Spacing.lg },
  heroSub: { marginTop: Spacing.lg, maxWidth: 280 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  statValue: { marginTop: Spacing.sm },

  sectionTitle: { marginBottom: 4 },

  bestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },

  weightRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  weightNums: { alignItems: "flex-end" },

  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  addPhotoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  photo: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
  },
});
