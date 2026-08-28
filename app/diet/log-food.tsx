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
 *
 * PHOTO LOGGING LIVES HERE TOO, AND DELIBERATELY SO
 *
 * The camera does not open a second logging flow. It fills in this screen's text
 * box — the vision endpoint returns food names and portions only, never numbers
 * (services/nutrition/MealPhotoCapture.ts explains why), and everything after
 * that is the path above, unchanged: same resolver, same confidence rungs, same
 * corrections, same commit.
 *
 * Two things fall out of that, both of them the point:
 *   • A photo log and a typed log are the same entry. There is no second-class
 *     "scanned" record with different provenance sitting in the day's totals.
 *   • Every way the photo path can fail — no camera in this build, permission
 *     refused, endpoint down, plate unreadable — lands the user on a screen
 *     where they can simply type it instead. The fallback is the host.
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
import { useProfile } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { useMealPlan } from "@/contexts/MealPlanContext";
import type { MealType } from "@/models/diet";
import { checkPhotoScanQuota, spendPhotoScan } from "@/services/billing";
import {
  captureMealPhoto,
  isMealPhotoAvailable,
} from "@/services/nutrition/MealPhotoCapture";
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
  const { userBio } = useProfile();
  const { openUpgrade } = useBilling();

  const [text, setText] = useState("");
  const [slot, setSlot] = useState<MealType | null>(
    SLOTS.some((s) => s.key === params.slot) ? (params.slot as MealType) : null,
  );
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [aiError, setAiError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  /** Which capture is in flight, so only that button spins. */
  const [capturing, setCapturing] = useState<"camera" | "library" | null>(null);
  /** What the photo path wants to say — a remark, or why it couldn't help. */
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /**
   * Whether the camera can open in THIS build. expo-image-picker is native, so a
   * dev client made before it was added has no module — the buttons hide rather
   * than pretending, because a tap that silently does nothing is the one thing
   * worse than no button.
   */
  const photoAvailable = useMemo(() => isMealPhotoAvailable(), []);

  const targetDate = params.date;
  const permission = targetDate ? permissionFor(targetDate) : "open";
  const locked = permission === "locked" || permission === "future";

  /**
   * Analyse what's in the box.
   *
   * Takes explicit overrides because the photo path needs to analyse the line it
   * just produced in the same tick it sets it — reading `text`/`slot` from state
   * there would analyse the PREVIOUS value, which is the classic version of this
   * bug and shows up as "the first photo logs the meal before it".
   */
  const run = useCallback(
    async (override?: { text?: string; slot?: MealType | null }) => {
      const input = (override?.text ?? text).trim();
      if (!input) return;
      const useSlot = override?.slot !== undefined ? override.slot : slot;
      setAnalyzing(true);
      Haptics.selectionAsync().catch(() => {});
      try {
        const result = await analyzeFood(input, useSlot);
        setAnalysis(result.analysis);
        setUsedAI(result.usedAI);
        setAiError(result.aiError);
      } finally {
        setAnalyzing(false);
      }
    },
    [text, slot, analyzeFood],
  );

  /**
   * Shoot or pick a meal photo, then hand the result to the text pipeline.
   *
   * QUOTA ORDER MATTERS. The check happens before the camera opens, so someone
   * out of scans is told BEFORE framing a shot rather than after. The spend
   * happens only once the endpoint has actually returned food — a cancelled
   * pick, a refused permission, a dead endpoint or an unreadable plate must
   * never cost a scan, exactly as a failed coach turn never costs a message.
   */
  const capture = useCallback(
    async (camera: boolean) => {
      if (capturing || locked) return;
      setPhotoError(null);
      setPhotoNote(null);

      const quota = await checkPhotoScanQuota();
      if (!quota.allowed) {
        openUpgrade("photo-log");
        return;
      }

      setCapturing(camera ? "camera" : "library");
      try {
        const outcome = await captureMealPhoto({
          camera,
          ...(userBio?.region ? { region: userBio.region } : {}),
        });

        switch (outcome.status) {
          case "ok": {
            await spendPhotoScan();
            Haptics.selectionAsync().catch(() => {});
            setText(outcome.text);
            if (outcome.slot) setSlot(outcome.slot);
            setPhotoNote(
              outcome.note ??
                "Read from your photo — check it below and fix anything that's off.",
            );
            // Analyse immediately: the user has already confirmed intent twice
            // (opened the camera, took the shot). Making them press a third
            // button to see numbers would be ceremony.
            await run({ text: outcome.text, slot: outcome.slot ?? slot });
            break;
          }
          case "cancelled":
            break; // a normal outcome — say nothing
          case "unavailable":
            setPhotoError(
              "Photo logging needs the app from the store. You can describe the meal instead.",
            );
            break;
          case "denied":
            setPhotoError(
              camera
                ? "Camera access is off, so nothing was taken. You can turn it on in Settings, or just describe the meal."
                : "Photo access is off. You can turn it on in Settings, or just describe the meal.",
            );
            break;
          case "unreadable":
            setPhotoError(
              "Gozlin couldn't make out any food in that one. Try a clearer shot of the plate, or describe it below — that didn't use one of your scans.",
            );
            break;
          case "failed":
            setPhotoError(
              "Couldn't read that photo just now. Describe the meal below and it'll log the same way — that didn't use one of your scans.",
            );
            break;
        }
      } finally {
        setCapturing(null);
      }
    },
    [capturing, locked, openUpgrade, userBio?.region, run, slot],
  );

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

          {photoAvailable ? (
            <View style={styles.photoRow}>
              <Button
                label="Take a photo"
                icon="camera"
                variant="tonal"
                onPress={() => void capture(true)}
                loading={capturing === "camera"}
                disabled={locked || capturing !== null || analyzing}
                style={styles.flex}
              />
              <Button
                label="From library"
                icon="images-outline"
                variant="tonal"
                onPress={() => void capture(false)}
                loading={capturing === "library"}
                disabled={locked || capturing !== null || analyzing}
                style={styles.flex}
              />
            </View>
          ) : null}

          {photoError ? (
            <AppText variant="caption" color="secondary">
              {photoError}
            </AppText>
          ) : null}

          <Card padding="lg">
            {photoNote ? (
              <View style={styles.photoNote}>
                <Ionicons name="camera" size={13} color={colors.textSecondary} />
                <AppText variant="caption" color="secondary" style={styles.flex}>
                  {photoNote}
                </AppText>
              </View>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. 2 slices of bread and a boiled egg"
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={!locked}
              style={[styles.input, { color: colors.text }]}
              onSubmitEditing={() => void run()}
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
              onPress={() => void run()}
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
  photoRow: { flexDirection: "row", gap: Spacing.sm },
  photoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
