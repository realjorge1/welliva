/**
 * FOODS — the whole-foods catalog. Every food in the dictionary (fruits,
 * vegetables, proteins, grains, legumes, dairy, Nigerian staples …) with its
 * typical per-serving macros. Search it, filter it, and open a food to log it
 * at a real portion against a real meal slot.
 *
 * Data: constants/FoodDictionary (fetched from Supabase Storage at runtime).
 *
 * ── WHERE LOGGING GOES ──────────────────────────────────────────────────────
 * Through MealPlanContext's food log (services/nutrition/FoodLogService), the
 * same store /diet/log-food writes to. It used to write the other way: a tap
 * pushed a fake "snack" into the day's SCHEDULE, which meant this screen
 * required an active meal plan to work at all, carried four macros with no
 * citation, and produced a row the user could not edit or remove. It also
 * corrupted adherence — eating a banana is not evidence you ate the planned
 * lunch (see FoodLogService's header, which is explicit about why the two
 * stores are separate).
 *
 * Moving to the food log means portions, meal slots, micronutrients where the
 * reference table has them, undo, and no plan requirement — all of which
 * already existed on the other path and none of which this screen could reach.
 *
 * ── VIRTUALIZED ─────────────────────────────────────────────────────────────
 * The screen renders the whole catalog (~200 foods, each row a half-dozen
 * nodes), so it's a SectionList and only the visible window is mounted:
 *   • `Screen scroll={false}` — the list must own the scroll, or virtualization
 *     is silently disabled (a VirtualizedList nested in a ScrollView renders
 *     everything and warns).
 *   • `FoodRow` is memo'd and `renderItem`/`onOpen` are stable, or the window
 *     re-renders on every parent render and virtualizing buys nothing.
 *   • Search is debounced, so a keystroke doesn't re-filter the whole catalog.
 */
import {
  FilterButton,
  FoodDetailSheet,
  FoodFilterSheet,
  FoodLookupSheet,
} from "@/components/foods";
import { ScreenTopBar } from "@/components/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { NAV_CLEARANCE, Screen } from "@/components/ui/Screen";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { useElasticScroll } from "@/components/ui/useElasticScroll";
import {
  FOOD_DICTIONARY,
  FOOD_GROUPS,
  ensureFoodDictionaryLoaded,
  searchFoods,
  type FoodItem,
} from "@/constants/FoodDictionary";
import {
  QUICK_FILTER_KEYS,
  applyFoodFilters,
  getFilter,
} from "@/constants/foodFilters";
import {
  excludedTagsFor,
  excludedTermsFor,
  fitsDiet,
  hasDietConstraints,
} from "@/constants/foodTags";
import { LightCard, Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import { useMealPlan } from "@/contexts/MealPlanContext";
import type { MealType } from "@/models/diet";
import {
  addCustomFood,
  listCustomFoods,
  type CustomFood,
} from "@/services/nutrition/CustomFoodService";
import {
  CUSTOM_FOOD_GROUP,
  lookupFood,
  shouldOfferLookup,
  type LookupCandidate,
} from "@/services/nutrition/FoodLookupService";
import {
  loadShortlist,
  recordRecent,
  resolveIds,
  toggleFavorite,
} from "@/services/nutrition/FoodShortlist";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

/**
 * A row, carrying its own list key.
 *
 * Foods pinned into Favourites/Recent also appear in their group section below,
 * so the food's id is NOT unique within the list and `id + index` isn't either
 * (the same food can land on the same index in two sections). The key is
 * therefore built from the section it's in, at the point the sections are.
 */
interface FoodRowItem {
  key: string;
  food: FoodItem;
}

interface FoodSection {
  title: string;
  data: FoodRowItem[];
  /** Favourites/Recent — rendered with a leading icon, above the catalog. */
  pinned?: boolean;
}

/** Where a row sits in its section — drives the continuous-card rounding. */
type RowPosition = "only" | "first" | "middle" | "last";

function positionOf(index: number, count: number): RowPosition {
  if (count === 1) return "only";
  if (index === 0) return "first";
  if (index === count - 1) return "last";
  return "middle";
}

interface Toast {
  message: string;
  /** Set when the toast can undo a write — the entry it would remove. */
  entryId?: string;
}

/** How long an undo stays offered. Long enough to notice, short enough to pass. */
const TOAST_MS = 5000;

export default function FoodsScreen() {
  const { colors } = useColors();
  const { logCatalogFood, removeLoggedFood } = useMealPlan();
  const { userBio } = useProfile();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null); // null = All
  const [filters, setFilters] = useState<Set<string>>(() => new Set());
  const [filterSheet, setFilterSheet] = useState(false);
  const [dietOnly, setDietOnly] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The opened food. `sheetOpen` is separate from `selected` so the food stays
  // mounted through the dismiss animation instead of blanking mid-slide.
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  /** Foods the user added themselves. Searched alongside the bundled catalog. */
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);

  // The remote lookup, which only ever runs on a total local miss.
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [lookupResults, setLookupResults] = useState<LookupCandidate[]>([]);
  const [lookupError, setLookupError] = useState<string | undefined>();

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

  useEffect(() => {
    let alive = true;
    loadShortlist().then((s) => {
      if (!alive) return;
      setFavorites(s.favorites);
      setRecents(s.recents);
    });
    listCustomFoods().then((f) => {
      if (alive) setCustomFoods(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // ── The user's own diet, as an exclusion set ──────────────────────────────
  // Computed once from the bio rather than per-food, since it's the same answer
  // for all 205 rows.
  const dietProfile = useMemo(
    () => ({
      dietaryRestriction: userBio?.dietaryRestriction,
      allergies: userBio?.allergies,
      foodDislikes: userBio?.foodDislikes,
    }),
    [userBio?.dietaryRestriction, userBio?.allergies, userBio?.foodDislikes],
  );
  const canFilterByDiet = useMemo(
    () => hasDietConstraints(dietProfile),
    [dietProfile],
  );
  const excludedTags = useMemo(() => excludedTagsFor(dietProfile), [dietProfile]);
  const excludedTerms = useMemo(() => excludedTermsFor(dietProfile), [dietProfile]);

  // A user with no restrictions must never be left with a stuck-on chip they
  // can no longer see to turn off.
  useEffect(() => {
    if (!canFilterByDiet && dietOnly) setDietOnly(false);
  }, [canFilterByDiet, dietOnly]);

  /** Every active predicate applied in one pass. */
  const applyFilters = useCallback(
    (list: FoodItem[]) => {
      const filtered = applyFoodFilters(list, filters);
      if (!dietOnly) return filtered;
      return filtered.filter((f) => fitsDiet(f, excludedTags, excludedTerms));
    },
    [filters, dietOnly, excludedTags, excludedTerms],
  );

  // Filter by search + group + chips, then bucket by group into SectionList's
  // `{ title, data }` shape. Favourites and Recents are pinned above as their
  // own sections — but only when the user is browsing, since once they've typed
  // a query or narrowed to a group, a pinned list they didn't ask for is noise.
  /**
   * The user's own foods, matched against the same query.
   *
   * Searched separately from the bundled catalog because `searchFoods` reads
   * FOOD_DICTIONARY directly, but merged into ONE result set before anything
   * decides whether a remote lookup is warranted. That merge is what makes the
   * local-first rule true rather than aspirational: a food the user already
   * added must never trigger a second lookup for the same thing.
   */
  const customMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customFoods;
    return customFoods.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.group.toLowerCase().includes(q) ||
        (f.query ?? "").toLowerCase().includes(q),
    );
  }, [customFoods, search]);

  const sections = useMemo<FoodSection[]>(() => {
    const rows = (title: string, list: FoodItem[]): FoodRowItem[] =>
      list.map((food) => ({ key: `${title}:${food.id}`, food }));

    const base = applyFilters([...searchFoods(search), ...customMatches]);
    const scoped = group ? base.filter((f) => f.group === group) : base;

    const browsing = !search.trim() && !group;
    const pinned: FoodSection[] = [];
    if (browsing) {
      const fav = applyFilters(resolveIds(favorites, FOOD_DICTIONARY));
      const rec = applyFilters(
        // A favourite is already one tap away; repeating it under Recent wastes
        // the most valuable rows on the screen.
        resolveIds(recents, FOOD_DICTIONARY).filter((f) => !favorites.includes(f.id)),
      );
      if (fav.length > 0) {
        pinned.push({ title: "Favourites", data: rows("fav", fav), pinned: true });
      }
      if (rec.length > 0) {
        pinned.push({ title: "Recent", data: rows("recent", rec), pinned: true });
      }
    }

    // "Your foods" first among the group sections — they're the user's own, and
    // a food you had to go and find should be easy to find again.
    const order = group ? [group] : [CUSTOM_FOOD_GROUP, ...FOOD_GROUPS];
    const groups = order
      .map((g) => ({ title: g, data: rows(g, scoped.filter((f) => f.group === g)) }))
      .filter((b) => b.data.length > 0);

    return [...pinned, ...groups];
    // `ready` is a dependency so the list recomputes once the catalog loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, group, ready, applyFilters, favorites, recents, customMatches]);

  const total = useMemo(
    () => sections.reduce((n, b) => n + b.data.length, 0),
    [sections],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  // Stable across renders so the memo'd rows aren't invalidated every time the
  // parent re-renders (a toast, a keystroke). Without this, `React.memo` on
  // FoodRow would never hit and virtualization would buy nothing.
  const onOpen = useCallback((food: FoodItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelected(food);
    setSheetOpen(true);
  }, []);

  const onToggleFavorite = useCallback((food: FoodItem) => {
    setFavorites((current) => {
      const next = current.includes(food.id)
        ? current.filter((id) => id !== food.id)
        : [food.id, ...current];
      // Persist from the same values we just rendered, so the write can't race
      // a second tap into a stale list.
      void toggleFavorite(food.id, current);
      return next;
    });
  }, []);

  const onLog = useCallback(
    async (args: {
      food: FoodItem;
      quantity: number;
      unit: string;
      slot: MealType;
    }) => {
      const entry = await logCatalogFood({
        food: args.food,
        quantity: args.quantity,
        unit: args.unit,
        slot: args.slot,
      });

      setSheetOpen(false);

      if (!entry) {
        showToast({ message: "Couldn't log that — today's log is closed." });
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setRecents((current) => {
        void recordRecent(args.food.id, current);
        return [args.food.id, ...current.filter((id) => id !== args.food.id)].slice(0, 12);
      });

      const kcal = entry.totals.calories;
      showToast({
        message: `${entry.label}${kcal !== undefined ? ` · ${Math.round(kcal)} kcal` : ""}`,
        entryId: entry.id,
      });
    },
    [logCatalogFood, showToast],
  );

  // ── Remote lookup ─────────────────────────────────────────────────────────
  /**
   * Whether to offer "search the web for this".
   *
   * `total` is the count AFTER search, filters and group scoping across BOTH
   * the catalog and the user's own foods — so the offer appears only on a real
   * miss. Deliberately gated on the unfiltered miss too: a food hidden by an
   * active "low carb" chip is a food we HAVE, and offering to go find it would
   * be both wasteful and confusing.
   */
  const localHitCount = useMemo(
    () => searchFoods(search).length + customMatches.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, customMatches, ready],
  );

  const canLookup = useMemo(
    () => shouldOfferLookup({ query: search, localHitCount }),
    [search, localHitCount],
  );

  const runLookup = useCallback(async () => {
    const q = search.trim();
    if (!q) return;
    setLookupOpen(true);
    setLookupState("loading");
    setLookupError(undefined);
    try {
      const outcome = await lookupFood({
        query: q,
        ...(userBio?.region ? { region: userBio.region } : {}),
      });
      setLookupResults(outcome.candidates);
      setLookupState("done");
    } catch (e) {
      setLookupResults([]);
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
      setLookupState("error");
    }
  }, [search, userBio?.region]);

  /** Save a looked-up food to the user's list, then open it for logging. */
  const onPickCandidate = useCallback(
    async (candidate: LookupCandidate) => {
      const saved = await addCustomFood(candidate);
      setCustomFoods(await listCustomFoods());
      setLookupOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Straight into the detail sheet: the user came here to log this, and
      // making them find it again in the list would be a pointless extra step.
      setSelected(saved);
      setSheetOpen(true);
      showToast({ message: `${saved.name} added to your foods` });
    },
    [showToast],
  );

  const onUndo = useCallback(async () => {
    if (!toast?.entryId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await removeLoggedFood(toast.entryId);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: "Removed" });
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, [toast, removeLoggedFood]);

  // ── List plumbing ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: FoodRowItem;
      index: number;
      section: FoodSection;
    }) => (
      <FoodRow
        food={item.food}
        position={positionOf(index, section.data.length)}
        onOpen={onOpen}
        isFavorite={favorites.includes(item.food.id)}
      />
    ),
    [onOpen, favorites],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: FoodSection }) => (
      <View style={styles.groupLabelRow}>
        {section.pinned ? (
          <Ionicons
            name={section.title === "Favourites" ? "star" : "time-outline"}
            size={12}
            color={colors.textTertiary}
          />
        ) : null}
        <AppText variant="caption" color="tertiary" uppercase>
          {section.title} · {section.data.length}
        </AppText>
      </View>
    ),
    [colors.textTertiary],
  );

  const keyExtractor = useCallback((item: FoodRowItem) => item.key, []);

  // The SectionList owns the scroll here rather than Screen's ScrollView, so it
  // has to ask for the elastic ends itself.
  const elastic = useElasticScroll();

  // Chip and FilterRow supply their own selection haptic; this only owns state.
  const toggleFilter = useCallback((key: string) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setFilters(new Set()), []);

  /**
   * How many foods the current filters leave, ignoring the search box and group
   * chip. The filter sheet's button counts what the FILTERS do — folding a
   * half-typed query into that number would make it jump around for reasons the
   * sheet isn't showing.
   */
  const filteredTotal = useMemo(
    () => applyFilters(FOOD_DICTIONARY).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyFilters, ready],
  );

  const header = (
    <View>
      <ScreenTopBar
        style={styles.headerRow}
        title={
          <>
            <AppText variant="title">Foods</AppText>
            <AppText variant="footnote" color="tertiary">
              {FOOD_DICTIONARY.length} whole foods · tap for the full label
            </AppText>
          </>
        }
      />

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

      {/* Macro + diet filters. Separate row from the groups because they compose
          with them rather than replacing them: "Vegetables" ∩ "High protein". */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {/* The door to everything else, first so its count is the first thing
            read when filters are on. */}
        <FilterButton count={filters.size} onPress={() => setFilterSheet(true)} />

        {canFilterByDiet && (
          <Chip
            label="Fits my diet"
            icon="shield-checkmark"
            size="sm"
            hint="Hides foods your dietary restriction, allergies or dislikes rule out"
            active={dietOnly}
            onPress={() => setDietOnly((d) => !d)}
          />
        )}

        {/* A handful of quick chips. The other fifteen live in the sheet. */}
        {QUICK_FILTER_KEYS.map((key) => {
          const f = getFilter(key);
          if (!f) return null;
          return (
            <Chip
              key={f.key}
              label={f.label}
              hint={f.description}
              size="sm"
              active={filters.has(f.key)}
              onPress={() => toggleFilter(f.key)}
            />
          );
        })}
      </ScrollView>

      {/* Group chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groupChipsRow}
      >
        <Chip label="All" size="sm" active={group === null} onPress={() => setGroup(null)} />
        {FOOD_GROUPS.map((g) => (
          <Chip
            key={g}
            label={g}
            size="sm"
            active={group === g}
            onPress={() => setGroup(group === g ? null : g)}
          />
        ))}
      </ScrollView>

      {dietOnly && (
        <AppText variant="caption" color="tertiary" style={styles.dietNote}>
          Hiding foods your profile rules out. A browse filter, not an ingredient
          check — always read the label on anything packaged.
        </AppText>
      )}
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
          <AppText variant="headline">
            {canLookup ? "We don't have that yet" : "No matches"}
          </AppText>
          <AppText variant="subhead" color="secondary" style={{ marginTop: Spacing.xs }}>
            {!query.trim()
              ? "No foods match these filters. Try turning one off."
              : canLookup
                ? `“${query}” isn't in our catalog or your own foods. We can look it up and add it to your list.`
                : `Nothing here matches “${query}”. Try a different food or clear the search.`}
          </AppText>

          {/* The remote rung, offered only on a genuine miss. */}
          {canLookup ? (
            <Button
              label={`Find “${query.trim()}”`}
              icon="search"
              size="md"
              fullWidth
              style={{ marginTop: Spacing.lg }}
              onPress={runLookup}
              accessibilityHint="Searches USDA's food database, then Gozlin, and adds what it finds to your foods"
            />
          ) : null}
        </>
      )}
    </Card>
  );

  return (
    // `scroll={false}`: the SectionList owns the scroll. Nesting it inside the
    // Screen's ScrollView would render every row and warn.
    <Screen header={header} scroll={false}>
      {total === 0
        ? empty
        : elastic.wrap(
            <SectionList
              sections={sections}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              {...elastic.scrollProps}
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
            />,
          )}

      <FoodDetailSheet
        food={selected}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLog={onLog}
        isFavorite={selected ? favorites.includes(selected.id) : false}
        onToggleFavorite={onToggleFavorite}
      />

      <FoodFilterSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        active={filters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        resultCount={filteredTotal}
      />

      <FoodLookupSheet
        visible={lookupOpen}
        query={query.trim()}
        state={lookupState}
        candidates={lookupResults}
        error={lookupError}
        onClose={() => setLookupOpen(false)}
        onRetry={runLookup}
        onPick={onPickCandidate}
      />

      {toast && (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <View style={[styles.toast, { backgroundColor: colors.text }]}>
            <AppText
              variant="callout"
              numberOfLines={2}
              style={[styles.toastText, { color: colors.background }]}
            >
              {toast.message}
            </AppText>
            {toast.entryId && (
              <Pressable
                onPress={onUndo}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Undo, remove this from today's log"
              >
                <AppText variant="callout" weight="700" style={{ color: colors.primary }}>
                  Undo
                </AppText>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

/**
 * One food row. `React.memo` is load-bearing, not decorative: SectionList
 * re-renders its window whenever the parent renders, and without this every
 * visible row would rebuild on each keystroke and each toast tick.
 *
 * The rows used to live inside a single `<Card>` per group. A virtualized list
 * flattens sections, so the card surface moves onto the row itself and the
 * corners are rounded by the row's position within its section — visually
 * identical, one mounted view per row instead of one per group.
 *
 * Tapping OPENS the food; it no longer logs it. That's the point of the rewrite:
 * a row this easy to hit while scrolling must not be able to write to the user's
 * day on its own.
 */
const FoodRow = React.memo(function FoodRow({
  food,
  position,
  onOpen,
  isFavorite,
}: {
  food: FoodItem;
  position: RowPosition;
  onOpen: (food: FoodItem) => void;
  isFavorite: boolean;
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
      onPress={() => onOpen(food)}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${food.calories} calories per ${food.serving || "serving"}${
        isFavorite ? ", favourite" : ""
      }`}
      accessibilityHint="Opens the full label, where you choose a portion and log it"
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
          {isFavorite && <Ionicons name="star" size={12} color={colors.warning} />}
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

      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  headerRow: { paddingTop: Spacing.xs, paddingBottom: Spacing.md },
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingRight: Spacing.md,
  },
  groupChipsRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingRight: Spacing.md,
  },
  dietNote: { marginBottom: Spacing.md, lineHeight: 15 },
  groupLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    maxWidth: "92%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  toastText: { flexShrink: 1 },
});
