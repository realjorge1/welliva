/**
 * TrainingNudgeSheet — the gentle, human offer to turn a few ad-hoc workouts
 * into a real plan, for users who skipped training at onboarding.
 *
 * Two calm phases, never a redirect back to onboarding:
 *   1. Offer  — "I've noticed you moving a few times… want a proper plan?"
 *   2. Setup  — just the three things a plan needs (experience, kit, days),
 *               then `updateUserBio({ trainingEnabled: true, … })`, which
 *               regenerates the workout plan around those answers.
 *
 * Declining snoozes the offer (see utils/trainingNudge) so it stays a nudge.
 * Fully self-contained: owns its own state, reads only `updateUserBio`.
 */
import { AppText, Button, useColors } from "@/components/ui";
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { Radius, Spacing } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import type { ExerciseLevel } from "@/models/user";
import type { Equipment } from "@/models/workout";
import { snoozeTrainingNudge } from "@/utils/trainingNudge";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXERCISE_LEVELS: { value: ExerciseLevel; label: string }[] = [
  { value: "beginner", label: "New to it" },
  { value: "intermediate", label: "Regular" },
  { value: "advanced", label: "Experienced" },
];

const EQUIPMENT: { value: Equipment; label: string; icon: string }[] = [
  { value: "none", label: "Bodyweight & mat", icon: "body-outline" },
  { value: "dumbbells", label: "Dumbbells", icon: "barbell-outline" },
  { value: "resistance_bands", label: "Bands", icon: "git-compare-outline" },
  { value: "kettlebell", label: "Kettlebell", icon: "fitness-outline" },
  { value: "pull_up_bar", label: "Pull-up bar", icon: "reorder-four-outline" },
  { value: "bench", label: "Bench", icon: "tablet-landscape-outline" },
];

const DAYS = [2, 3, 4, 5, 6];

const tap = () => Haptics.selectionAsync().catch(() => {});

export function TrainingNudgeSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useColors();
  const { updateUserBio } = useProfile();

  const [phase, setPhase] = useState<"offer" | "setup">("offer");
  const [level, setLevel] = useState<ExerciseLevel>("beginner");
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [days, setDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const toggleEquip = (value: Equipment) => {
    tap();
    setEquipment((prev) => {
      if (value === "none") return ["none"];
      const withoutNone = prev.filter((e) => e !== "none");
      const next = withoutNone.includes(value)
        ? withoutNone.filter((e) => e !== value)
        : [...withoutNone, value];
      return next.length ? next : ["none"];
    });
  };

  const dismiss = async () => {
    await snoozeTrainingNudge();
    onClose();
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await updateUserBio({
        trainingEnabled: true,
        exerciseLevel: level,
        equipment,
        workoutDaysPerWeek: days,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.flex} onPress={phase === "offer" ? dismiss : undefined} />
        <SafeAreaView edges={["bottom"]}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {phase === "offer" ? (
              <View style={styles.offer}>
                <AILogoBadge size={52} />
                <AppText variant="title" align="center" style={styles.offerTitle}>
                  Ready to make it a plan?
                </AppText>
                <AppText variant="body" color="secondary" align="center" style={styles.offerBody}>
                  I&apos;ve noticed you back at it a few times now — nice work. Want me to turn
                  these into a real training plan that schedules your week and adapts as you
                  go? Takes about 20 seconds to set up.
                </AppText>
                <View style={styles.offerActions}>
                  <Button
                    label="Yes, set it up"
                    icon="sparkles"
                    onPress={() => {
                      tap();
                      setPhase("setup");
                    }}
                  />
                  <Button label="Maybe later" variant="ghost" onPress={dismiss} />
                </View>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.setup}>
                <AppText variant="title" style={styles.setupTitle}>
                  Let&apos;s tune it to you
                </AppText>

                <Section icon="ribbon-outline" text="Your experience" colors={colors} />
                <View style={styles.wrapRow}>
                  {EXERCISE_LEVELS.map((l) => (
                    <Chip
                      key={l.value}
                      label={l.label}
                      selected={level === l.value}
                      onPress={() => {
                        tap();
                        setLevel(l.value);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>

                <Section icon="construct-outline" text="What can you train with?" colors={colors} />
                <View style={styles.equipGrid}>
                  {EQUIPMENT.map((e) => {
                    const selected = equipment.includes(e.value);
                    return (
                      <Pressable
                        key={e.value}
                        onPress={() => toggleEquip(e.value)}
                        style={[
                          styles.equipCard,
                          {
                            backgroundColor: selected ? colors.primarySoft : colors.surface,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={e.icon as any}
                          size={20}
                          color={selected ? colors.primary : colors.textTertiary}
                        />
                        <AppText variant="footnote" color={selected ? "brand" : "secondary"} style={styles.flex}>
                          {e.label}
                        </AppText>
                        {selected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>

                <Section icon="calendar-outline" text="Days per week" colors={colors} />
                <View style={styles.wrapRow}>
                  {DAYS.map((d) => (
                    <Chip
                      key={d}
                      label={`${d}`}
                      selected={days === d}
                      onPress={() => {
                        tap();
                        setDays(d);
                      }}
                      colors={colors}
                    />
                  ))}
                </View>

                <Button
                  label={saving ? "Building your plan…" : "Create my plan"}
                  icon="arrow-forward"
                  iconRight
                  loading={saving}
                  disabled={saving}
                  onPress={confirm}
                  style={styles.confirmBtn}
                />
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Section({
  icon,
  text,
  colors,
}: {
  icon: string;
  text: string;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <View style={styles.section}>
      <Ionicons name={icon as any} size={16} color={colors.primary} />
      <AppText variant="callout">{text}</AppText>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="subhead" color={selected ? colors.onPrimary : "secondary"} weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: "88%",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.lg,
  },

  offer: { alignItems: "center", gap: Spacing.md, paddingBottom: Spacing.sm },
  offerTitle: { marginTop: Spacing.xs },
  offerBody: { paddingHorizontal: Spacing.sm },
  offerActions: { alignSelf: "stretch", gap: Spacing.sm, marginTop: Spacing.md },

  setup: { gap: Spacing.md, paddingBottom: Spacing.sm },
  setupTitle: { marginBottom: Spacing.xs },
  section: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 44,
    alignItems: "center",
  },
  equipGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  equipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "48%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  confirmBtn: { marginTop: Spacing.lg },
});
