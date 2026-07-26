/**
 * FOODS — the whole-foods catalog. Every single food in the dictionary
 * (fruits, vegetables, proteins, grains, legumes, dairy, Nigerian staples …)
 * with its typical per-serving macros. Search, filter by group, and tap a food
 * to log it as a consumed snack on today's plan.
 *
 * Data: constants/FoodDictionary (generated from /diet_dictionary).
 */
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import {
  FOOD_DICTIONARY,
  FOOD_GROUPS,
  ensureFoodDictionaryLoaded,
  searchFoods,
  type FoodItem,
} from "@/constants/FoodDictionary";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export default function FoodsScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { addFoodAsSnack } = useNutrition();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null); // null = All
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The whole-foods catalog is lazy-loaded (Phase D — bundle trim), so it can be
  // empty on first mount. Load it, then flip `ready` to recompute the list.
  const [ready, setReady] = useState(FOOD_DICTIONARY.length > 0);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    ensureFoodDictionaryLoaded().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const onLog = async (food: FoodItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const ok = await addFoodAsSnack(food);
    showToast(
      ok
        ? `Logged ${food.name} to today ✓`
        : "Start today's meal plan first, then log foods here",
    );
  };

  // Filter by search + selected group, then bucket by group for display.
  const grouped = useMemo(() => {
    const base = searchFoods(query);
    const scoped = group ? base.filter((f) => f.group === group) : base;
    const order = group ? [group] : FOOD_GROUPS;
    return order
      .map((g) => ({ group: g, items: scoped.filter((f) => f.group === g) }))
      .filter((b) => b.items.length > 0);
    // `ready` is a dependency so the list recomputes once the catalog loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, group, ready]);

  const total = useMemo(
    () => grouped.reduce((n, b) => n + b.items.length, 0),
    [grouped],
  );

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <AppText variant="displayLg">Foods</AppText>
          <AppText variant="footnote" color="tertiary">
            {FOOD_DICTIONARY.length} whole foods · tap to log a snack
          </AppText>
        </View>
      </View>

      {/* Search */}
      <View
        style={[
          styles.search,
          { backgroundColor: alpha(colors.text, 0.06), borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search fruits, vegetables, foods…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable hitSlop={10} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Group chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip label="All" active={group === null} onPress={() => setGroup(null)} />
        {FOOD_GROUPS.map((g) => (
          <Chip
            key={g}
            label={g}
            active={group === g}
            onPress={() => setGroup(group === g ? null : g)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen header={header}>
      {total === 0 ? (
        <Card padding="xxl" style={{ marginTop: Spacing.xl }}>
          {!ready ? (
            <AppText variant="subhead" color="secondary">
              Loading foods…
            </AppText>
          ) : (
            <>
              <AppText variant="headline">No matches</AppText>
              <AppText variant="subhead" color="secondary" style={{ marginTop: Spacing.xs }}>
                Nothing here matches “{query}”. Try a different food or clear the search.
              </AppText>
            </>
          )}
        </Card>
      ) : (
        grouped.map((bucket) => (
          <View key={bucket.group} style={{ marginTop: Spacing.lg }}>
            <AppText
              variant="caption"
              color="tertiary"
              uppercase
              style={styles.groupLabel}
            >
              {bucket.group} · {bucket.items.length}
            </AppText>
            <Card padding="sm">
              {bucket.items.map((food, i) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  first={i === 0}
                  onLog={() => onLog(food)}
                />
              ))}
            </Card>
          </View>
        ))
      )}

      {toast && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { backgroundColor: colors.text }]}>
            <AppText variant="callout" style={{ color: colors.background }}>
              {toast}
            </AppText>
          </View>
        </View>
      )}
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
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
        {label}
      </AppText>
    </Pressable>
  );
}

function FoodRow({
  food,
  first,
  onLog,
}: {
  food: FoodItem;
  first: boolean;
  onLog: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onLog}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: colors.divider },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <AppText variant="callout" numberOfLines={1} style={{ flexShrink: 1 }}>
            {food.name}
          </AppText>
          {food.isNigerian && (
            <View style={[styles.tag, { backgroundColor: alpha(colors.primary, 0.16) }]}>
              <AppText variant="caption" style={{ color: colors.primary }}>
                NG
              </AppText>
            </View>
          )}
        </View>
        <AppText variant="footnote" color="tertiary" numberOfLines={1}>
          {food.serving ? `${food.serving} · ` : ""}P {food.protein}g · C{" "}
          {food.carbs}g · F {food.fat}g
        </AppText>
      </View>

      <View style={[styles.kcalPill, { backgroundColor: alpha(colors.calories, 0.14) }]}>
        <AppText variant="footnote" weight="700" style={{ color: colors.calories }}>
          {food.calories}
        </AppText>
        <AppText variant="caption" style={{ color: colors.calories }}>
          kcal
        </AppText>
      </View>

      <Ionicons name="add-circle" size={26} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerTitle: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  chipsRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groupLabel: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.xs,
  },
  kcalPill: {
    minWidth: 52,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Spacing.giant,
    alignItems: "center",
  },
  toast: {
    maxWidth: "88%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
});
