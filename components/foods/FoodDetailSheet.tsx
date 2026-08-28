/**
 * FoodDetailSheet — what a catalog food actually is, and logging it on purpose.
 *
 * WHY THIS EXISTS AT ALL
 * The Foods screen used to log on tap: one press wrote a serving into the day
 * and there was no quantity control, no meal slot, and no way to take it back.
 * A mis-scroll silently changed the user's record. Everything here follows from
 * fixing that — the write moved behind a review step, and once there's a review
 * step there's finally somewhere to put the portion, the slot, and the full
 * nutrition label the app already had but never showed on this path.
 *
 * TWO GRADES OF DATA, STATED PLAINLY
 * A catalog food may or may not have a measured reference entry behind it (see
 * NutrientResolver.linkCatalogFood). When it does, the portion picker offers
 * that entry's real household portions and the panel carries micronutrients and
 * a citation. When it doesn't, there is exactly one portion — the catalog's own
 * serving — and the panel says "macros only". The user is never left guessing
 * which of the two they're looking at, because NutrientPanel always renders the
 * confidence chip and the source line.
 *
 * The numbers update live as the portion changes, and they are recomputed by the
 * resolver rather than scaled here. Nothing in this file does nutrition
 * arithmetic; that rule is what keeps a display component from inventing facts.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NutrientPanel } from "@/components/nutrition/NutrientPanel";
import { AppText, Button, Card, useColors } from "@/components/ui";
import type { FoodItem } from "@/constants/FoodDictionary";
import { Radius, Spacing, alpha } from "@/constants/theme";
import type { MealType } from "@/models/diet";
import {
  CATALOG_SERVING_UNIT,
  linkCatalogFood,
  resolveCatalogFood,
} from "@/services/nutrition/NutrientResolver";
import * as Haptics from "@/utils/haptics";

/** Portion steps. Halves matter — "half an avocado" is a real portion. */
const STEP = 0.5;
const MIN_QTY = 0.5;
const MAX_QTY = 20;

const SLOTS: { key: MealType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "partly-sunny-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
  { key: "snack", label: "Snack", icon: "cafe-outline" },
];

export interface FoodDetailSheetProps {
  food: FoodItem | null;
  visible: boolean;
  onClose: () => void;
  /** Resolves once the entry is written; the screen owns the toast + undo. */
  onLog: (args: { food: FoodItem; quantity: number; unit: string; slot: MealType }) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (food: FoodItem) => void;
  /** Disables logging with a reason, e.g. a closed back-log day. */
  lockedReason?: string;
}

export function FoodDetailSheet({
  food,
  visible,
  onClose,
  onLog,
  isFavorite,
  onToggleFavorite,
  lockedReason,
}: FoodDetailSheetProps) {
  const { colors } = useColors();
  /*
   * A Modal renders OUTSIDE the Screen's SafeAreaView, so it gets none of the
   * app's usual top inset — the title ended up under the status bar / notch.
   * `pageSheet` on iOS insets itself, so the raw inset would double up there;
   * clamping to a small floor keeps the header clear on Android full-screen
   * modals without shoving it down the page on iOS.
   */
  const insets = useSafeAreaInsets();
  const headerTop = Math.max(Spacing.lg, Math.min(insets.top, 24) + Spacing.sm);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<string | null>(null);
  const [slot, setSlot] = useState<MealType>("snack");
  const [saving, setSaving] = useState(false);

  // Which portions this food can be measured in, and whether measured data
  // backs it at all. Cached inside the resolver, so this is cheap per open.
  const link = useMemo(() => (food ? linkCatalogFood(food) : null), [food]);
  const activeUnit = unit ?? link?.defaultUnit ?? CATALOG_SERVING_UNIT;

  // The live label. Recomputed on every portion change, always by the resolver.
  const resolved = useMemo(
    () => (food ? resolveCatalogFood(food, quantity, activeUnit) : null),
    [food, quantity, activeUnit],
  );

  // A fresh open must not inherit the last food's portion — 3 cups of rice
  // silently becoming 3 cups of oil is exactly the kind of quiet wrongness the
  // sheet exists to prevent.
  const reset = useCallback(() => {
    setQuantity(1);
    setUnit(null);
    setSlot("snack");
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const bump = useCallback((delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setQuantity((q) => {
      const next = Math.round((q + delta) * 100) / 100;
      return Math.min(MAX_QTY, Math.max(MIN_QTY, next));
    });
  }, []);

  const submit = useCallback(async () => {
    if (!food || saving) return;
    setSaving(true);
    try {
      await onLog({ food, quantity, unit: activeUnit, slot });
      reset();
    } finally {
      setSaving(false);
    }
  }, [food, saving, onLog, quantity, activeUnit, slot, reset]);

  if (!food || !link || !resolved) {
    // Modal still mounts so the dismiss animation can run out on close.
    return <Modal visible={false} transparent onRequestClose={close} />;
  }

  const measured = link.canonical !== null;
  const calories = resolved.nutrients.calories;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View
          style={[styles.header, { borderBottomColor: colors.border, paddingTop: headerTop }]}
        >
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <AppText variant="headline" weight="700" numberOfLines={2} style={styles.flex}>
                {food.name}
              </AppText>
              {food.isNigerian ? (
                <View style={[styles.tag, { backgroundColor: alpha(colors.primary, 0.16) }]}>
                  <AppText variant="caption" style={{ color: colors.primary }}>
                    NG
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="footnote" color="tertiary">
              {food.group}
              {measured ? " · measured reference data" : " · macros only"}
            </AppText>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onToggleFavorite(food);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remove from favourites" : "Add to favourites"}
            accessibilityState={{ selected: isFavorite }}
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={24}
              color={isFavorite ? colors.warning : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Portion ──────────────────────────────────────────────────── */}
          <Card padding="lg">
            <AppText variant="caption" color="tertiary" uppercase>
              How much
            </AppText>

            <View style={styles.stepperRow}>
              <StepButton
                icon="remove"
                onPress={() => bump(-STEP)}
                disabled={quantity <= MIN_QTY}
                label="Decrease amount"
              />
              <View style={styles.qtyBox}>
                <AppText variant="title" weight="800">
                  {formatQty(quantity)}
                </AppText>
                <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                  {activeUnit === CATALOG_SERVING_UNIT
                    ? food.serving || "serving"
                    : activeUnit}
                </AppText>
              </View>
              <StepButton
                icon="add"
                onPress={() => bump(STEP)}
                disabled={quantity >= MAX_QTY}
                label="Increase amount"
              />
            </View>

            {/* Unit choice only exists when a reference entry defines real
                household portions. One option isn't a choice, so we don't
                render a picker that can't be used. */}
            {link.portions.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitRow}
              >
                {link.portions.map((p) => {
                  const active = p.unit === activeUnit;
                  return (
                    <Pressable
                      key={p.unit}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setUnit(p.unit);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={p.unit}
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.unitChip,
                        {
                          backgroundColor: active ? colors.primary : alpha(colors.text, 0.06),
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="footnote"
                        weight="700"
                        style={{ color: active ? colors.onPrimary : colors.textSecondary }}
                      >
                        {p.unit}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <AppText variant="caption" color="tertiary" style={styles.servingNote}>
                {food.serving
                  ? `Measured per ${food.serving.toLowerCase()}.`
                  : "Measured per serving."}
              </AppText>
            )}

            {/* The headline number, so the portion's effect is visible without
                reading the label below. */}
            <View style={[styles.calorieStrip, { borderTopColor: colors.border }]}>
              <AppText variant="subhead" color="secondary">
                Calories
              </AppText>
              <AppText variant="title" weight="800" style={{ color: colors.calories }}>
                {calories !== undefined ? Math.round(calories) : "—"}
              </AppText>
            </View>
          </Card>

          {/* ── Slot ───────────────────────────────────────────────────────
              Deliberately NOT in a card. The three day meals are one choice
              across the screen's full width, and boxing them inside a card
              squeezed four uneven pills onto a wrapping line. Snack sits on its
              own full-width row below because it isn't a time of day like the
              others — it's the catch-all, and it's the default. */}
          <View style={styles.block}>
            <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
              Log it as
            </AppText>
            <View style={styles.slotRow}>
              {SLOTS.filter((s) => s.key !== "snack").map((s) => (
                <SlotButton
                  key={s.key}
                  option={s}
                  active={slot === s.key}
                  onPress={() => setSlot(s.key)}
                  style={styles.slotThird}
                />
              ))}
            </View>
            <SlotButton
              option={SLOTS.find((s) => s.key === "snack")!}
              active={slot === "snack"}
              onPress={() => setSlot("snack")}
              style={styles.slotWide}
            />
          </View>

          {/* ── The label ──────────────────────────────────────────────────
              Bare, like the slot picker above it. It's the last and by far the
              longest thing on the sheet — a card around it would have boxed in
              most of the screen, indented every label row and %DV bar by the
              card's padding, and drawn a frame whose only content is the frame
              it already sits in. "NUTRITION" is a heading on the page now, not
              a card's title. */}
          <View style={styles.block}>
            <NutrientPanel
              surface="bare"
              panel={resolved.nutrients}
              confidence={resolved.confidence}
              source={resolved.source}
              title="Nutrition"
              subtitle={`${formatQty(quantity)} ${
                activeUnit === CATALOG_SERVING_UNIT
                  ? food.serving || "serving"
                  : activeUnit
              }`}
            />
          </View>
        </ScrollView>

        {/* ── Commit ───────────────────────────────────────────────────────
            Pinned rather than inline: the label above is long, and a Log button
            that scrolls off is a Log button people hunt for. */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {lockedReason ? (
            <AppText variant="footnote" color="tertiary" style={styles.lockNote}>
              {lockedReason}
            </AppText>
          ) : null}
          <Button
            label={saving ? "Logging…" : "Log this"}
            icon="checkmark-circle"
            fullWidth
            size="md"
            onPress={submit}
            disabled={saving || Boolean(lockedReason)}
            loading={saving}
            accessibilityLabel={`Log ${formatQty(quantity)} ${activeUnit} of ${food.name} as ${slot}`}
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * One meal-slot button. Shared by the three-across row and the wide snack row,
 * so the two never drift apart in height, hue or hit target — they're the same
 * control at two widths, not two controls that happen to look alike.
 */
function SlotButton({
  option,
  active,
  onPress,
  style,
}: {
  option: (typeof SLOTS)[number];
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.slotBtn,
        {
          backgroundColor: active ? alpha(colors.primary, 0.14) : colors.surfaceSunken,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons
        name={option.icon}
        size={17}
        color={active ? colors.primary : colors.textTertiary}
      />
      <AppText
        variant="footnote"
        weight="700"
        numberOfLines={1}
        style={{ color: active ? colors.primary : colors.textSecondary }}
      >
        {option.label}
      </AppText>
    </Pressable>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.stepBtn,
        {
          backgroundColor: alpha(colors.text, 0.06),
          borderColor: colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/** "1", "1.5" — never "1.50". */
function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.xs },
  body: {
    padding: Spacing.lg,
    paddingBottom: Spacing.giant,
  },
  block: { marginTop: Spacing.lg },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBox: { flex: 1, alignItems: "center", gap: 2 },
  unitRow: { gap: Spacing.sm, paddingTop: Spacing.lg, paddingRight: Spacing.md },
  unitChip: {
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  servingNote: { marginTop: Spacing.md },
  calorieStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: { marginBottom: Spacing.md, marginLeft: Spacing.xs },
  slotRow: { flexDirection: "row", gap: Spacing.sm },
  slotBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  /** Equal thirds, wall to wall. */
  slotThird: { flex: 1 },
  /** The catch-all, on its own line under the three day meals. */
  slotWide: { marginTop: Spacing.sm },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  lockNote: { textAlign: "center" },
});
