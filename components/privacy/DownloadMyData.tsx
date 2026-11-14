/**
 * "DOWNLOAD MY DATA" — on Trust, one tap to a Word document of everything.
 *
 * Tap → (if "Lock my cycle" is on, the phone asks to unlock, so the cycle log
 * can be included) → the document is built on the phone → the phone's own
 * folder picker opens → the file is written where they chose. Nothing is
 * uploaded, shared or kept anywhere else, and nothing is counted.
 *
 * What goes in the document is services/export/myData; the Word file is
 * services/export/docx; the folder picker and the write are
 * services/export/saveFile. A cancelled unlock still saves the file, without
 * the cycle log, and the document says why it isn't there.
 */
import { AppText, Card, IconBadge, useColors } from "@/components/ui";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Spacing } from "@/constants/theme";
import { useNutrition, useProfile, useWorkout } from "@/contexts/AppContext";
import { useCycleOptional } from "@/contexts/CycleContext";
import { useCycleLockOptional } from "@/contexts/CycleLockContext";
import { useHabits } from "@/contexts/HabitsContext";
import { cycleCsv } from "@/services/cycle/exportData";
import { DOCX_MIME, buildDocx } from "@/services/export/docx";
import { gatherStoredData } from "@/services/export/gather";
import { buildMyDataBlocks, type ExportCycle } from "@/services/export/myData";
import { exportFileName } from "@/services/export/names";
import { saveToChosenFolder } from "@/services/export/saveFile";
import { todayDate } from "@/services/OfflineStorage";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Result = { tone: "ok" | "info" | "error"; text: string } | null;

export function DownloadMyData({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const { user } = useAuth();
  const { userBio, userGoals, bodyLogs } = useProfile();
  const { dietHistory } = useNutrition();
  const { workoutLog } = useWorkout();
  const { views, retired } = useHabits();
  const cycle = useCycleOptional();
  const lock = useCycleLockOptional();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  /** The cycle log, if tracking is on and the lock lets them in. */
  const cycleSection = async (): Promise<ExportCycle> => {
    if (!cycle?.settings.enabled) return { status: "off" };
    // Locked right now: the phone asks, exactly as opening the cycle screen
    // would. Already unlocked this session: nothing more to ask.
    if (lock?.enabled && lock.hidden) {
      const outcome = await lock.unlock();
      if (outcome !== "ok") return { status: "locked" };
    }
    return { status: "included", csv: cycleCsv(cycle.data) };
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const today = todayDate();
      const cycleData = await cycleSection();
      const stored = await gatherStoredData();
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
      const blocks = buildMyDataBlocks({
        exportedAt: new Date(),
        name,
        email: user?.email ?? null,
        bio: userBio,
        goals: userGoals ?? null,
        bodyLogs: bodyLogs ?? [],
        dietHistory,
        meals: stored.meals,
        water: stored.water,
        workouts: workoutLog,
        effort: stored.effort,
        pain: stored.pain,
        habits: [
          ...views.map((v) => ({ name: v.habit.name, createdAt: v.habit.createdAt, done: [...v.done] })),
          ...retired.map((r) => ({
            name: r.habit.name,
            createdAt: r.habit.createdAt,
            done: r.done,
            retiredAt: r.retiredAt,
          })),
        ],
        moods: stored.moods,
        cycle: cycleData,
        coach: stored.coach,
      });
      const bytes = buildDocx("Your welliva data", blocks);
      const saved = await saveToChosenFolder(exportFileName(today), DOCX_MIME, bytes);
      switch (saved.outcome) {
        case "saved":
          setResult({
            tone: "ok",
            text: saved.folder
              ? `Saved "${saved.name}" in ${saved.folder}.${cycleData.status === "locked" ? " Your cycle log isn't in it, because it stayed locked." : ""}`
              : `Saved "${saved.name}".`,
          });
          break;
        case "cancelled":
          setResult({ tone: "info", text: "Nothing was saved." });
          break;
        case "unavailable":
          setResult({
            tone: "error",
            text: "This version of the app can't save files yet. Update welliva and try again.",
          });
          break;
        default:
          setResult({ tone: "error", text: "That folder couldn't be saved to. Try again and pick another one." });
      }
    } catch (e) {
      console.log("[export] download failed", e);
      setResult({ tone: "error", text: "Something went wrong making your file. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const resultColor =
    result?.tone === "ok" ? colors.success : result?.tone === "error" ? colors.error : colors.textSecondary;

  return (
    <Card style={style} padding="none">
      <Pressable
        onPress={() => void download()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Download my data"
        accessibilityHint="Makes a Word document of everything you've logged and asks where to save it"
        accessibilityState={{ busy, disabled: busy }}
        style={styles.row}
      >
        <IconBadge name="download-outline" tone={colors.primary} size={38} />
        <View style={styles.flex}>
          <AppText variant="callout">Download my data</AppText>
          <AppText variant="caption" color="tertiary" style={styles.blurb}>
            {busy
              ? "Making your file…"
              : "A Word document of everything you've logged. You choose where it's saved, and it goes nowhere else."}
          </AppText>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        )}
      </Pressable>
      {result ? (
        <AppText variant="footnote" style={[styles.result, { color: resultColor }]}>
          {result.text}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  blurb: { marginTop: 2 },
  result: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, marginTop: -Spacing.xs },
});
