/**
 * Log food by describing it — the Gozlin nutrition lookup.
 *
 * Type "2 slices of bread and a boiled egg" and get the real label. The screen
 * is built around one idea: the user sees exactly what we understood BEFORE
 * anything is logged, item by item, with each item's confidence and the option
 * to correct a bad match. Nothing is written until they confirm.
 *
 * That review step isn't friction for its own sake — it's what makes the
 * "unmatched" and "did you mean" paths usable. Without it, a mis-parsed food
 * would silently land in the day's totals and the user would have no idea why
 * their numbers looked wrong.
 */

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { NutrientPanel } from "@/components/nutrition/NutrientPanel";
import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useMealPlan } from "@/contexts/MealPlanContext";
import type { MealType } from "@/models/diet";
import {
  CONFIDENCE_LABEL,
  describeSource,
  type FoodAnalysis,
  type ResolvedFoodItem,
} from "@/models/nutrients";
import * as Haptics from "@/utils/haptics";

const SLOTS: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const EXAMPLES = [
  "2 slices of bread and a boiled egg",
  "a plate of jollof rice with chicken",
  "150g grilled salmon and a cup of brown rice",
  "moi moi and a glass of orange juice",
];

export default function LogFoodScreen() {
  const { colors } = useColors();
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const { analyzeFood, logFoodAnalysis, permissionFor } = useMealPlan();

  const [text, setText] = useState("");
  const [slot, setSlot] = useState<MealType | null>(
    SLOTS.some((s) => s.key === params.slot) ? (params.slot as MealType) : null,
  );
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [aiError, setAiError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const targetDate = params.date;
  const permission = targetDate ? permissionFor(targetDate) : "open";
  const locked = permission === "locked" || permission === "future";

  const run = useCallback(async () => {
    const input = text.trim();
    if (!input) return;
    setAnalyzing(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const result = await analyzeFood(input, slot);
      setAnalysis(result.analysis);
      setUsedAI(result.usedAI);
      setAiError(result.aiError);
    } finally {
      setAnalyzing(false);
    }
  }, [text, slot, analyzeFood]);

  const save = useCallback(async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const ok = await logFoodAnalysis(analysis, slot, targetDate);
      if (!ok) {
        Alert.alert(
          "Can't log that day",
          "You can only log today or yesterday. Older days are closed.",
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  }, [analysis, slot, targetDate, logFoodAnalysis]);

  const resolvedCount = useMemo(
    () => analysis?.items.filter((i) => i.confidence !== "unmatched").length ?? 0,
    [analysis],
  );

  return (
    <Screen scroll={false} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <AppText variant="headline" weight="700">
            What did you eat?
          </AppText>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {locked ? (
            <Card padding="lg">
              <AppText variant="body" weight="600">
                That day is closed
              </AppText>
              <AppText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                You can log today or yesterday. Anything older stays as it was
                recorded.
              </AppText>
            </Card>
          ) : null}

          <Card padding="lg">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. 2 slices of bread and a boiled egg"
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={!locked}
              style={[styles.input, { color: colors.text }]}
              onSubmitEditing={run}
              returnKeyType="go"
            />
            <View style={styles.slots}>
              {SLOTS.map((s) => {
                const active = slot === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSlot(active ? null : s.key)}
                    style={[
                      styles.slotChip,
                      {
                        backgroundColor: active ? colors.primary : "transparent",
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      weight="700"
                      style={{ color: active ? colors.background : colors.textSecondary }}
                    >
                      {s.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <Button
              label={analyzing ? "Reading…" : "Work it out"}
              icon={analyzing ? undefined : "sparkles"}
              onPress={run}
              loading={analyzing}
              disabled={!text.trim() || locked}
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />
          </Card>

          {!analysis ? (
            <View style={styles.examples}>
              <AppText variant="caption" color="secondary" weight="700" uppercase>
                Try
              </AppText>
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} onPress={() => setText(ex)} style={styles.exampleRow}>
                  <Ionicons name="arrow-forward" size={13} color={colors.textSecondary} />
                  <AppText variant="caption" color="secondary">
                    {ex}
                  </AppText>
                </Pressable>
              ))}
              <AppText variant="caption" color="secondary" style={styles.honesty}>
                {`Numbers come from USDA FoodData Central and the FAO West African food tables — not from a chatbot's guess. Anything we can't match is shown as unidentified rather than estimated.`}
              </AppText>
            </View>
          ) : null}

          {analysis ? (
            <>
              <View style={styles.itemsHeader}>
                <AppText variant="body" weight="700">
                  We read {analysis.items.length} item
                  {analysis.items.length === 1 ? "" : "s"}
                </AppText>
                {usedAI ? (
                  <View style={[styles.aiChip, { borderColor: colors.border }]}>
                    <Ionicons name="sparkles" size={11} color={colors.textSecondary} />
                    <AppText variant="caption" color="secondary" weight="600">
                      Gozlin parsed
                    </AppText>
                  </View>
                ) : null}
              </View>

              {aiError ? (
                <AppText variant="caption" color="secondary">
                  Gozlin was unreachable — read on-device instead.
                </AppText>
              ) : null}

              {analysis.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onPick={(foodId) => void correctPreview(item, foodId, setAnalysis)}
                />
              ))}

              {resolvedCount > 0 ? (
                <NutrientPanel
                  panel={analysis.totals}
                  partialKeys={analysis.partialKeys}
                  confidence={analysis.confidence}
                  sources={analysis.items.map((i) => i.source)}
                  title="Meal total"
                  subtitle={
                    analysis.unmatched.length > 0
                      ? `${analysis.unmatched.length} item${analysis.unmatched.length === 1 ? "" : "s"} not counted`
                      : undefined
                  }
                />
              ) : (
                <Card padding="lg">
                  <AppText variant="body" weight="600">
                    Nothing we could identify
                  </AppText>
                  <AppText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                    {`Try naming the foods more plainly — "rice", "chicken breast", "moi moi". We'd rather say we don't know than make numbers up.`}
                  </AppText>
                </Card>
              )}

              <Button
                label={saving ? "Saving…" : "Log this"}
                icon="checkmark"
                onPress={save}
                loading={saving}
                disabled={resolvedCount === 0 || locked}
                fullWidth
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Re-resolve one item against a chosen reference food, in the preview only. */
async function correctPreview(
  item: ResolvedFoodItem,
  foodId: string,
  setAnalysis: React.Dispatch<React.SetStateAction<FoodAnalysis | null>>,
) {
  const { resolveKnownFood } = await import("@/services/nutrition/NutrientResolver");
  const { sumPanels, weakestConfidence } = await import("@/models/nutrients");
  const replacement = resolveKnownFood(foodId, item.quantity, item.unit);
  if (!replacement) return;
  replacement.inputText = item.inputText;

  setAnalysis((prev) => {
    if (!prev) return prev;
    const items = prev.items.map((i) => (i.id === item.id ? replacement : i));
    const contributing = items.filter((i) => i.confidence !== "unmatched");
    const { totals, partialKeys } = sumPanels(contributing.map((i) => i.nutrients));
    return {
      ...prev,
      items,
      totals,
      partialKeys,
      confidence: weakestConfidence(items.map((i) => i.confidence)),
      unmatched: items.filter((i) => i.confidence === "unmatched").map((i) => i.inputText),
    };
  });
}

function ItemRow({
  item,
  onPick,
}: {
  item: ResolvedFoodItem;
  onPick: (foodId: string) => void;
}) {
  const { colors } = useColors();
  const unmatched = item.confidence === "unmatched";

  return (
    <Card padding="lg" elevated>
      <View style={styles.itemTop}>
        <View style={styles.flex}>
          <AppText variant="body" weight="700">
            {item.name}
          </AppText>
          <AppText variant="caption" color="secondary">
            {item.quantity} {item.unit}
            {item.grams > 0 ? ` · ${item.grams} g` : ""} · {CONFIDENCE_LABEL[item.confidence]}
          </AppText>
        </View>
        {!unmatched && item.nutrients.calories !== undefined ? (
          <AppText variant="title" weight="800">
            {Math.round(item.nutrients.calories)}
          </AppText>
        ) : (
          <Ionicons name="help-circle-outline" size={22} color={colors.error} />
        )}
      </View>

      {item.source ? (
        <AppText variant="caption" color="secondary" style={styles.src}>
          {describeSource(item.source)}
        </AppText>
      ) : null}

      {item.alternatives && item.alternatives.length > 0 ? (
        <View style={styles.alts}>
          <AppText variant="caption" color="secondary" weight="700">
            {unmatched ? "Did you mean" : "Not right?"}
          </AppText>
          <View style={styles.altRow}>
            {item.alternatives.map((alt) => (
              <Pressable
                key={alt.foodId}
                onPress={() => onPick(alt.foodId)}
                style={[styles.altChip, { borderColor: colors.border }]}
              >
                <AppText variant="caption" weight="600">
                  {alt.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },
  input: { minHeight: 72, fontSize: 17, lineHeight: 24, textAlignVertical: "top" },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.lg },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  examples: { gap: Spacing.sm },
  exampleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  honesty: { marginTop: Spacing.lg, lineHeight: 17 },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  src: { marginTop: 6 },
  alts: { marginTop: Spacing.md, gap: 6 },
  altRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  altChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
