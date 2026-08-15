/**
 * FOODS — the whole-foods catalog. Every single food in the dictionary
 * (fruits, vegetables, proteins, grains, legumes, dairy, Nigerian staples …)
 * with its typical per-serving macros. Search, filter by group, and tap a food
 * to log it as a consumed snack on today's plan.
 *
 * Data: constants/FoodDictionary (fetched from Supabase Storage at runtime).
 *
 * VIRTUALIZED. This screen renders the entire catalog (~200 foods, each row a
 * half-dozen nodes), which used to mount every row up front inside the Screen's
 * ScrollView. It's now a SectionList so only the visible window is mounted:
 *   • `Screen scroll={false}` — the list must own the scroll, or virtualization
 *     is silently disabled (a VirtualizedList nested in a ScrollView renders
 *     everything and warns).
 *   • `FoodRow` is memo'd and `renderItem`/`onLog` are stable, or the window
 *     re-renders on every parent render and virtualizing buys nothing.
 *   • Search is debounced, so a keystroke doesn't re-filter the whole catalog.
 */
import { Card } from "@/components/ui/Card";
import { NAV_CLEARANCE, Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import {
  FOOD_DICTIONARY,
  FOOD_GROUPS,
  ensureFoodDictionaryLoaded,
  searchFoods,
  type FoodItem,
} from "@/constants/FoodDictionary";
import { LightCard, Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

/** Where a row sits in its group — drives the continuous-card rounding. */
type RowPosition = "only" | "first" | "middle" | "last";

function positionOf(index: number, count: number): RowPosition {
  if (count === 1) return "only";
  if (index === 0) return "first";
  if (index === count - 1) return "last";
  return "middle";
}

export default function FoodsScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const { addFoodAsSnack } = useNutrition();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null); // null = All
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * `query` drives the TextInput (must stay instant); `search` drives the
   * filter. Debouncing the second means a fast typist re-scans the catalog once
   * when they stop, not once per keystroke — which is what actually caused the
   * jank here, more than the row count did.
   */
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 150);
    return () => clearTimeout(t);
  }, [query]);

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

  // Stable across renders so the memo'd rows aren't invalidated every time the
  // parent re-renders (a toast, a keystroke). Without this, `React.memo` on
  // FoodRow would never hit and virtualization would buy nothing.
  const onLog = useCallback(
    async (food: FoodItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const ok = await addFoodAsSnack(food);
      showToast(
        ok
          ? `Logged ${food.name} to today ✓`
          : "Start today's meal plan first, then log foods here",
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addFoodAsSnack],
  );

  // Filter by search + selected group, then bucket by group into SectionList's
  // `{ title, data }` shape.
  const sections = useMemo(() => {
    const base = searchFoods(search);
    const scoped = group ? base.filter((f) => f.group === group) : base;
    const order = group ? [group] : FOOD_GROUPS;
    return order
      .map((g) => ({ title: g, data: scoped.filter((f) => f.group === g) }))
      .filter((b) => b.data.length > 0);
    // `ready` is a dependency so the list recomputes once the catalog loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, group, ready]);

  const total = useMemo(
    () => sections.reduce((n, b) => n + b.data.length, 0),
    [sections],
  );

  const renderItem = useCallback(
    ({ item, index, section }: { item: FoodItem; index: number; section: { data: FoodItem[] } }) => (
      <FoodRow
        food={item}
        position={positionOf(index, section.data.length)}
        onLog={onLog}
      />
    ),
    [onLog],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; data: FoodItem[] } }) => (
      <AppText
        variant="caption"
        color="tertiary"
        uppercase
        style={styles.groupLabel}
      >
        {section.title} · {section.data.length}
      </AppText>
    ),
    [],
  );

  const keyExtractor = useCallback((item: FoodItem) => item.id, []);

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
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
          <Pressable
            hitSlop={10}
            onPress={() => setQuery("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
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

  const empty = (
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
  );

  return (
    // `scroll={false}`: the SectionList owns the scroll. Nesting it inside the
    // Screen's ScrollView would render every row and warn.
    <Screen header={header} scroll={false}>
      {total === 0 ? (
        empty
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: NAV_CLEARANCE }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Tuned for low-end Android: a small first paint, small batches, and a
          // modest retained window. `removeClippedSubviews` is deliberately NOT
          // set — it intermittently blanks rows on Android with layered children
          // like these, and the row count here doesn't need it.
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
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

/**
 * One food row. `React.memo` is load-bearing, not decorative: SectionList
 * re-renders its window whenever the parent renders, and without this every
 * visible row would rebuild on each keystroke and each toast tick.
 *
 * The rows used to live inside a single `<Card>` per group. A virtualized list
 * flattens sections, so the card surface moves onto the row itself and the
 * corners are rounded by the row's position within its group — visually
 * identical, one mounted view per row instead of one per group.
 */
const FoodRow = React.memo(function FoodRow({
  food,
  position,
  onLog,
}: {
  food: FoodItem;
  position: RowPosition;
  onLog: (food: FoodItem) => void;
}) {
  const { colors, isDark } = useColors();
  const top = position === "first" || position === "only";
  const bottom = position === "last" || position === "only";

  const surface = {
    backgroundColor: isDark ? alpha(colors.surface, 0.66) : LightCard.base,
    borderColor: isDark ? alpha(colors.borderStrong, 0.55) : LightCard.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: top ? 1 : 0,
    borderBottomWidth: bottom ? 1 : 0,
    borderTopLeftRadius: top ? Radius.xl : 0,
    borderTopRightRadius: top ? Radius.xl : 0,
    borderBottomLeftRadius: bottom ? Radius.xl : 0,
    borderBottomRightRadius: bottom ? Radius.xl : 0,
  };

  return (
    <Pressable
      onPress={() => onLog(food)}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${food.calories} calories per ${food.serving || "serving"}`}
      accessibilityHint="Logs this food as a snack on today's plan"
      style={({ pressed }) => [
        styles.row,
        surface,
        !top && { borderTopWidth: 1, borderTopColor: colors.divider },
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
});

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
