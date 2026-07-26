/**
 * NEW CHAPTER — the re-consultation.
 *
 * Reached when a user hits a goal (via the celebration CTA or the Profile
 * banner). A focused mini-consultation that turns "I'm done" into "what's next":
 * pick a new goal, set a new target, optionally tell the coach the new "why".
 * Starting a chapter restarts the whole motivation curve — fresh targets, fresh
 * achievements to chase, fresh challenges — so a years-long user never runs out
 * of journey. The heavy lifting is in AppContext.startNewChapter.
 */

import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useProfile } from "@/contexts/AppContext";
import type { PrimaryGoal } from "@/models/user";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

const GOALS: { id: PrimaryGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "lose_weight", label: "Lose weight", icon: "trending-down" },
  { id: "build_muscle", label: "Build muscle", icon: "barbell" },
  { id: "improve_fitness", label: "Improve fitness", icon: "fitness" },
  { id: "increase_energy", label: "More energy", icon: "flash" },
  { id: "better_health", label: "Better health", icon: "heart" },
  { id: "athletic_performance", label: "Performance", icon: "trophy" },
];

export default function NewChapterScreen() {
  const { colors } = useColors();
  const { userBio, userGoals } = useProfile();
  const { journeyChapter, startNewChapter } = useGamification();

  const [goal, setGoal] = useState<PrimaryGoal>(userBio?.primaryGoal ?? "better_health");
  const [target, setTarget] = useState(
    userGoals.targetWeightKg ? String(userGoals.targetWeightKg) : "",
  );
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);

  const nextChapter = journeyChapter + 1;

  const onContinue = async () => {
    setSaving(true);
    try {
      const parsed = parseFloat(target);
      await startNewChapter({
        primaryGoal: goal,
        targetWeightKg: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        motivation: why.trim() || undefined,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={[styles.badge, { backgroundColor: alpha(colors.gold, 0.16) }]}>
        <Ionicons name="sparkles" size={16} color={colors.gold} />
        <AppText variant="caption" style={[styles.badgeText, { color: colors.gold }]}>
          CHAPTER {nextChapter}
        </AppText>
      </View>
      <AppText variant="display" style={styles.title}>
        A new chapter
      </AppText>
      <AppText variant="subhead" color="secondary">
        You reached your goal — that&apos;s rare air. The journey doesn&apos;t end
        here. Let&apos;s set what comes next.
      </AppText>
    </View>
  );

  return (
    <Screen header={header}>
      {/* Goal */}
      <View style={styles.section}>
        <AppText variant="footnote" color="secondary" style={styles.label}>
          YOUR NEXT GOAL
        </AppText>
        <View style={styles.grid}>
          {GOALS.map((g) => {
            const active = goal === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => setGoal(g.id)}
                style={[
                  styles.goalChip,
                  {
                    backgroundColor: active ? alpha(colors.primary, 0.14) : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={g.icon}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <AppText
                  variant="footnote"
                  color={active ? "brand" : "secondary"}
                  style={styles.goalText}
                >
                  {g.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Target weight */}
      <View style={styles.section}>
        <AppText variant="footnote" color="secondary" style={styles.label}>
          NEW TARGET WEIGHT (OPTIONAL)
        </AppText>
        <Card padding="sm">
          <View style={styles.targetRow}>
            <Ionicons name="body" size={20} color={colors.water} />
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              placeholder="e.g. 72"
              placeholderTextColor={colors.textTertiary}
              maxFontSizeMultiplier={1.3}
              style={[styles.input, { color: colors.text }]}
            />
            <AppText variant="callout" color="tertiary">
              kg
            </AppText>
          </View>
        </Card>
      </View>

      {/* Why */}
      <View style={styles.section}>
        <AppText variant="footnote" color="secondary" style={styles.label}>
          WHAT&apos;S DRIVING YOU NOW? (OPTIONAL)
        </AppText>
        <Card padding="sm">
          <TextInput
            value={why}
            onChangeText={setWhy}
            placeholder="Gozlin will remember this."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxFontSizeMultiplier={1.3}
            style={[styles.whyInput, { color: colors.text }]}
          />
        </Card>
      </View>

      <Button
        label={`Begin chapter ${nextChapter}`}
        icon="arrow-forward"
        onPress={onContinue}
        loading={saving}
        style={styles.cta}
      />
      <Button label="Maybe later" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.md, gap: Spacing.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  badgeText: { fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: Spacing.xs },
  section: { marginTop: Spacing.xxl },
  label: { fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  goalChip: {
    width: "47.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  goalText: { flex: 1 },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  input: { flex: 1, fontSize: 22, fontWeight: "700", paddingVertical: Spacing.md },
  whyInput: {
    minHeight: 72,
    fontSize: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    textAlignVertical: "top",
  },
  cta: { marginTop: Spacing.xxl },
});
