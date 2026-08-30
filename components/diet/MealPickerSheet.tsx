/**
 * MealPickerSheet — "choose a meal", for one slot on one day.
 *
 * ── THE SCREEN THIS REPLACES ────────────────────────────────────────────────
 * The old picker rendered a search box and nothing else. It only ever queried
 * the *reference* table, and only once you typed, so opening it showed a title
 * over an empty page. Browsing was impossible; you had to already know the name
 * of the thing you wanted, which is the one situation where you don't need a
 * picker at all.
 *
 * This one opens FULL. Every breakfast the app knows, grouped and filterable,
 * before a single keystroke.
 *
 * ── THE LADDER, AND WHY IT RUNS ITSELF ──────────────────────────────────────
 *   1. the meal dictionary + whole foods, on device, instant
 *   2. the user's own saved meals
 *   3. USDA FoodData Central, when 1 and 2 found literally nothing
 *   4. a Gozlin estimate, when USDA doesn't have it either
 *   5. the plain name, added honestly with no nutrition
 *
 * Rungs 3 and 4 fire AUTOMATICALLY on a total local miss rather than behind a
 * "search online?" button. The old flow made the user ask twice for the same
 * thing, and the local-first rule (FoodLookupService) already guarantees the
 * network is only touched on a genuine miss — so the button was protecting
 * nothing and costing a tap on exactly the queries that were already failing.
 * The status line says which rung is running while it runs; a lookup that
 * happens silently is a lookup the user can't trust.
 *
 * Rung 5 is what makes the promise "anything you search for gets a result"
 * literally true. It is never silent about being empty: the confirm step says
 * the meal will carry no nutrition, because a zero that looks like a measurement
 * is worse than an admitted gap.
 *
 * ── PICK THEN CONFIRM ───────────────────────────────────────────────────────
 * Tapping a row does NOT add it. It opens a confirm view with the full label,
 * the source badge, and a servings dial. Planning a month means hundreds of
 * these taps, and a picker that commits on the first one turns a mis-tap into a
 * silent wrong meal on a day the user won't look at again for three weeks.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button, Chip, useColors } from "@/components/ui";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type { MealCuisine } from "@/constants/DietDatabase";
import { getFoodById } from "@/constants/FoodDictionary";
import { hasEnergy } from "@/constants/NutrientDatabase";
import type { MealType, ScheduledMeal } from "@/models/diet";
import type { SavedMeal } from "@/models/mealPlan";
import type { FoodAnalysis, NutrientPanel } from "@/models/nutrients";
import { analyzeFoodText } from "@/services/gozlin/GozlinFoodAnalyst";
import {
  lookupFood,
  shouldOfferLookup,
  type LookupCandidate,
} from "@/services/nutrition/FoodLookupService";
import {
  cuisinesForSlot,
  ensureMealCatalogLoaded,
  foodIdeas,
  formatRange,
  hasMealCatalog,
  mealsForSlot,
  midpoint,
  popularForSlot,
  scaleRange,
  searchMeals,
  type MealIdea,
  type Range,
} from "@/services/nutrition/MealCatalog";
import {
  linkCatalogFood,
  resolveCatalogFood,
} from "@/services/nutrition/NutrientResolver";
import * as Haptics from "@/utils/haptics";

// ============================================================================
// PUBLIC SHAPE
// ============================================================================

export interface MealPickResult {
  meal: Omit<ScheduledMeal, "id" | "isConsumed" | "consumedAt">;
  nutrients?: NutrientPanel;
  /** Also add it to the user's reusable meals. */
  saveForReuse: boolean;
}

export interface MealPickerSheetProps {
  visible: boolean;
  /** Null while the sheet animates out — the last slot stays rendered until then. */
  slot: MealType | null;
  /** The day being planned, for the header. YYYY-MM-DD. */
  date: string;
  savedMeals: SavedMeal[];
  /** Sharpens a remote lookup toward the user's cuisine. */
  region?: string;
  onClose: () => void;
  onPick: (result: MealPickResult) => void | Promise<void>;
}

const SLOT_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const SLOT_PLURAL: Record<MealType, string> = {
  breakfast: "breakfasts",
  lunch: "lunches",
  dinner: "dinners",
  snack: "snacks",
};

// ============================================================================
// INTERNAL SHAPES
// ============================================================================

/** How much we're willing to claim about a meal's numbers. Drives the badge. */
type Provenance = "catalog" | "verified" | "estimate" | "logged" | "none";

/** A pick, normalised out of whichever rung produced it. */
interface Staged {
  name: string;
  calories: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
  isNigerian?: boolean;
  cuisine?: MealCuisine;
  nutrients?: NutrientPanel;
  provenance: Provenance;
  /** The specific claim — "USDA · FDC 173410", "In 6 diets", "1 medium". */
  detail?: string;
}

type RemotePhase = "idle" | "usda" | "gozlin" | "done" | "error";

interface RemoteState {
  /** The query this state describes — stale results can never paint. */
  query: string;
  phase: RemotePhase;
  candidates: LookupCandidate[];
  estimate: FoodAnalysis | null;
  error?: string;
}

const IDLE_REMOTE: RemoteState = {
  query: "",
  phase: "idle",
  candidates: [],
  estimate: null,
};

/** One row of the virtualised list. */
type Row =
  | { kind: "header"; key: string; title: string; note?: string; tone?: string }
  | { kind: "status"; key: string; text: string; busy: boolean }
  | { kind: "idea"; key: string; idea: MealIdea }
  | { kind: "saved"; key: string; saved: SavedMeal }
  | { kind: "candidate"; key: string; candidate: LookupCandidate }
  | { kind: "estimate"; key: string; analysis: FoodAnalysis; query: string }
  | { kind: "freeform"; key: string; query: string }
  | { kind: "note"; key: string; text: string };

// ============================================================================
// COMPONENT
// ============================================================================

export function MealPickerSheet({
  visible,
  slot,
  date,
  savedMeals,
  region,
  onClose,
  onPick,
}: MealPickerSheetProps) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState<MealCuisine | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [remote, setRemote] = useState<RemoteState>(IDLE_REMOTE);

  /*
   * The catalogs fill their arrays IN PLACE after a remote fetch, so a screen
   * that reads them once at mount shows the bundled subset forever. `catalogTick`
   * is the re-render that swaps the partial library for the full one — the
   * bundled base diets mean the list is already populated in the meantime, which
   * is the whole reason this can be a quiet upgrade rather than a spinner.
   */
  const [catalogTick, setCatalogTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void ensureMealCatalogLoaded().then(() => {
      if (alive) setCatalogTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  // A fresh open is a fresh question: nobody wants yesterday's search term.
  useEffect(() => {
    if (visible) return;
    setQuery("");
    setSearch("");
    setCuisine(null);
    setStaged(null);
    setRemote(IDLE_REMOTE);
  }, [visible]);

  // Scanning the whole dictionary per keystroke is the only real cost here, so
  // the scan is debounced while the input itself stays instant.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 160);
    return () => clearTimeout(t);
  }, [query]);

  const activeSlot: MealType = slot ?? "snack";
  const trimmed = search.trim();

  // ── Local results ────────────────────────────────────────────────────────
  const local = useMemo(
    () => searchMeals(activeSlot, trimmed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSlot, trimmed, catalogTick],
  );

  const savedForSlot = useMemo(() => {
    const matches = (m: SavedMeal) =>
      !trimmed || m.name.toLowerCase().includes(trimmed.toLowerCase());
    return [...savedMeals]
      .filter(matches)
      .sort(
        (a, b) =>
          Number(b.defaultSlot === activeSlot) - Number(a.defaultSlot === activeSlot) ||
          b.useCount - a.useCount ||
          a.name.localeCompare(b.name),
      );
  }, [savedMeals, activeSlot, trimmed]);

  /** A total local miss — the only thing that licenses the network. */
  const localMiss = trimmed.length > 0 && local.total === 0 && savedForSlot.length === 0;

  // ── The remote ladder ────────────────────────────────────────────────────
  /*
   * Fires itself on a total miss.
   *
   * `alive` guards against a slow lookup for "chick" landing after the user has
   * typed "chicken". It's a plain closure flag rather than a shared counter
   * because each run owns exactly one: the cleanup that clears it belongs to the
   * same effect run that set it, which is the only version of this that can't
   * race itself. The in-flight request is deliberately NOT cancelled — it's
   * already paid for — it simply loses the right to paint.
   */
  useEffect(() => {
    if (!visible || !localMiss || trimmed.length < 2) {
      setRemote((r) => (r.phase === "idle" ? r : IDLE_REMOTE));
      return;
    }

    let running = true;
    const alive = () => running;

    void (async () => {
      setRemote({ query: trimmed, phase: "usda", candidates: [], estimate: null });

      let candidates: LookupCandidate[] = [];
      let failure: string | undefined;

      if (shouldOfferLookup({ query: trimmed, localHitCount: 0 })) {
        try {
          const outcome = await lookupFood({
            query: trimmed,
            ...(region ? { region } : {}),
          });
          candidates = outcome.candidates;
        } catch (e) {
          failure = e instanceof Error ? e.message : "Lookup failed";
        }
      }
      if (!alive()) return;

      if (candidates.length > 0) {
        setRemote({ query: trimmed, phase: "done", candidates, estimate: null });
        return;
      }

      // Nothing measured. Ask Gozlin to read the phrase itself — this is also
      // the rung that handles "2 boiled eggs and toast", which is a sentence
      // rather than a food and was never going to be in anybody's catalog.
      setRemote({ query: trimmed, phase: "gozlin", candidates: [], estimate: null });
      try {
        const { analysis } = await analyzeFoodText(trimmed, { slot: activeSlot });
        if (!alive()) return;
        setRemote({
          query: trimmed,
          phase: "done",
          candidates: [],
          estimate: hasEnergy(analysis.totals) ? analysis : null,
          ...(failure ? { error: failure } : {}),
        });
      } catch (e) {
        if (!alive()) return;
        setRemote({
          query: trimmed,
          phase: "error",
          candidates: [],
          estimate: null,
          error: failure ?? (e instanceof Error ? e.message : "Could not look that up"),
        });
      }
    })();

    return () => {
      running = false;
    };
  }, [visible, localMiss, trimmed, region, activeSlot]);

  // ── Rows ─────────────────────────────────────────────────────────────────
  const cuisines = useMemo(
    () => cuisinesForSlot(activeSlot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSlot, catalogTick],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const byCuisine = (list: MealIdea[]) =>
      cuisine ? list.filter((m) => m.cuisine === cuisine) : list;

    if (trimmed) {
      if (remote.query === trimmed && remote.phase !== "idle" && remote.phase !== "done") {
        out.push({
          kind: "status",
          key: "status",
          busy: true,
          text:
            remote.phase === "usda"
              ? "Not in your library — checking USDA…"
              : "USDA doesn't have it. Asking Gozlin…",
        });
      }

      if (savedForSlot.length > 0) {
        out.push({ kind: "header", key: "h-saved", title: "Your meals" });
        for (const m of savedForSlot) out.push({ kind: "saved", key: `s-${m.id}`, saved: m });
      }
      if (local.inSlot.length > 0) {
        out.push({
          kind: "header",
          key: "h-slot",
          title: SLOT_LABEL[activeSlot],
          note: `${local.inSlot.length}`,
        });
        for (const m of local.inSlot) out.push({ kind: "idea", key: m.key, idea: m });
      }
      if (local.otherSlots.length > 0) {
        out.push({
          kind: "header",
          key: "h-other",
          title: "From other meals",
          note: `fine for ${SLOT_LABEL[activeSlot].toLowerCase()} too`,
        });
        for (const m of local.otherSlots) out.push({ kind: "idea", key: m.key, idea: m });
      }
      if (local.foods.length > 0) {
        out.push({ kind: "header", key: "h-foods", title: "Single foods" });
        for (const m of local.foods) out.push({ kind: "idea", key: m.key, idea: m });
      }

      if (remote.query === trimmed) {
        const measured = remote.candidates.filter((c) => c.source.kind === "usda");
        const estimated = remote.candidates.filter((c) => c.source.kind !== "usda");
        if (measured.length > 0) {
          out.push({
            kind: "header",
            key: "h-usda",
            title: "USDA food database",
            note: "measured",
            tone: "success",
          });
          for (const c of measured) {
            out.push({ kind: "candidate", key: `c-${c.key}`, candidate: c });
          }
        }
        if (estimated.length > 0) {
          out.push({
            kind: "header",
            key: "h-est",
            title: "Gozlin estimate",
            note: "not measured",
            tone: "warning",
          });
          for (const c of estimated) {
            out.push({ kind: "candidate", key: `c-${c.key}`, candidate: c });
          }
        }
        if (remote.estimate) {
          out.push({
            kind: "header",
            key: "h-gozlin",
            title: "Gozlin estimate",
            note: "not measured",
            tone: "warning",
          });
          out.push({
            kind: "estimate",
            key: "gozlin-estimate",
            analysis: remote.estimate,
            query: trimmed,
          });
        }
        if (remote.error && remote.phase !== "usda" && remote.phase !== "gozlin") {
          out.push({
            kind: "note",
            key: "err",
            text: `Couldn't reach the food databases (${remote.error}). You can still plan it by name.`,
          });
        }
      }

      // Always last, always available. This is the row that makes "every meal
      // you search for gives you something to add" true rather than aspirational.
      out.push({ kind: "freeform", key: "freeform", query: trimmed });
      return out;
    }

    // ── Browsing ──
    if (savedForSlot.length > 0) {
      out.push({
        kind: "header",
        key: "h-saved",
        title: "Your meals",
        note: "one tap to reuse",
      });
      for (const m of savedForSlot.slice(0, 8)) {
        out.push({ kind: "saved", key: `s-${m.id}`, saved: m });
      }
    }

    const all = byCuisine(mealsForSlot(activeSlot));

    if (!cuisine) {
      const popular = popularForSlot(activeSlot, 6);
      if (popular.length > 0) {
        out.push({
          kind: "header",
          key: "h-pop",
          title: "Most widely recommended",
          note: "appears in the most plans",
        });
        for (const m of popular) out.push({ kind: "idea", key: `pop-${m.key}`, idea: m });
      }
    }

    if (all.length > 0) {
      out.push({
        kind: "header",
        key: "h-all",
        title: cuisine ? `${cuisine} ${SLOT_PLURAL[activeSlot]}` : `All ${SLOT_PLURAL[activeSlot]}`,
        note: `${all.length}`,
      });
      for (const m of all) out.push({ kind: "idea", key: m.key, idea: m });
    }

    const foods = byCuisine(foodIdeas(activeSlot));
    if (foods.length > 0) {
      out.push({
        kind: "header",
        key: "h-foods",
        title: "Single foods",
        note: "when the answer is just one thing",
      });
      for (const m of foods) out.push({ kind: "idea", key: m.key, idea: m });
    }

    if (out.length === 0) {
      out.push({
        kind: "note",
        key: "loading",
        text: hasMealCatalog()
          ? "Nothing in this cuisine for this meal yet."
          : "Loading the meal library…",
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, cuisine, activeSlot, local, savedForSlot, remote, catalogTick]);

  // ── Staging ──────────────────────────────────────────────────────────────
  const stage = useCallback((next: Staged) => {
    Haptics.selectionAsync().catch(() => {});
    setStaged(next);
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      switch (item.kind) {
        case "header":
          return (
            <View style={styles.sectionHeader}>
              <AppText variant="caption" color="secondary" weight="700" uppercase>
                {item.title}
              </AppText>
              {item.note ? (
                <AppText
                  variant="caption"
                  weight="600"
                  style={{
                    color:
                      item.tone === "success"
                        ? colors.success
                        : item.tone === "warning"
                          ? colors.warning
                          : colors.textTertiary,
                  }}
                >
                  {item.note}
                </AppText>
              ) : null}
            </View>
          );

        case "status":
          return (
            <View style={[styles.status, { backgroundColor: alpha(colors.primary, 0.1) }]}>
              {item.busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <AppText variant="footnote" color="secondary" style={styles.flex}>
                {item.text}
              </AppText>
            </View>
          );

        case "note":
          return (
            <AppText variant="footnote" color="tertiary" style={styles.note}>
              {item.text}
            </AppText>
          );

        case "idea":
          return <IdeaRow idea={item.idea} onPress={() => stage(fromIdea(item.idea))} />;

        case "saved":
          return <SavedRow saved={item.saved} onPress={() => stage(fromSaved(item.saved))} />;

        case "candidate":
          return (
            <CandidateRow
              candidate={item.candidate}
              onPress={() => stage(fromCandidate(item.candidate))}
            />
          );

        case "estimate":
          return (
            <EstimateRow
              analysis={item.analysis}
              query={item.query}
              onPress={() => stage(fromAnalysis(item.analysis, item.query))}
            />
          );

        case "freeform":
          return (
            <FreeformRow
              query={item.query}
              onPress={() => stage(fromFreeform(item.query))}
            />
          );
      }
    },
    [colors, stage],
  );

  const confirm = useCallback(
    async (result: MealPickResult) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStaged(null);
      await onPick(result);
    },
    [onPick],
  );

  const headerTop = Math.max(Spacing.lg, Math.min(insets.top, 24) + Spacing.sm);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => (staged ? setStaged(null) : onClose())}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        {staged ? (
          <ConfirmView
            staged={staged}
            slot={activeSlot}
            date={date}
            topInset={headerTop}
            onBack={() => setStaged(null)}
            onConfirm={confirm}
          />
        ) : (
          <>
            <View style={[styles.header, { paddingTop: headerTop }]}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <AppText variant="title" weight="700">
                    Choose a {SLOT_LABEL[activeSlot].toLowerCase()}
                  </AppText>
                  <AppText variant="footnote" color="tertiary">
                    {dayLabel(date)}
                  </AppText>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Ionicons name="search" size={17} color={colors.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${SLOT_PLURAL[activeSlot]}, foods, or anything`}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel={`Search ${SLOT_PLURAL[activeSlot]}`}
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery("")}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>

              {!trimmed && cuisines.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <Chip
                    label="All"
                    size="sm"
                    active={cuisine === null}
                    onPress={() => setCuisine(null)}
                  />
                  {cuisines.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      size="sm"
                      active={cuisine === c}
                      onPress={() => setCuisine(cuisine === c ? null : c)}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>

            <FlatList
              data={rows}
              keyExtractor={(r) => r.key}
              renderItem={renderRow}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={14}
              windowSize={9}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.list,
                { paddingBottom: insets.bottom + Spacing.huge },
              ]}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

// ============================================================================
// ROWS
// ============================================================================

function PickerRow({
  title,
  subtitle,
  trailing,
  badge,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  badge?: { icon: keyof typeof Ionicons.glyphMap; tone: string };
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
        },
      ]}
    >
      <View style={styles.flex}>
        <View style={styles.rowTitle}>
          <AppText variant="body" weight="600" numberOfLines={2} style={styles.flexShrink}>
            {title}
          </AppText>
          {badge ? <Ionicons name={badge.icon} size={13} color={badge.tone} /> : null}
        </View>
        {subtitle ? (
          <AppText variant="footnote" color="tertiary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <AppText variant="footnote" weight="700" color="secondary">
          {trailing}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
    </Pressable>
  );
}

function IdeaRow({ idea, onPress }: { idea: MealIdea; onPress: () => void }) {
  const { colors } = useColors();
  const subtitle =
    idea.origin === "food"
      ? [idea.serving, "single food"].filter(Boolean).join(" · ")
      : idea.diets.length > 0
        ? idea.diets.length > 2
          ? `In ${idea.diets.length} plans · ${idea.diets.slice(0, 2).join(", ")}`
          : `In ${idea.diets.join(", ")}`
        : undefined;

  return (
    <PickerRow
      title={idea.name}
      {...(subtitle ? { subtitle } : {})}
      trailing={formatRange(idea.calories, "kcal")}
      {...(idea.isNigerian
        ? { badge: { icon: "location" as const, tone: colors.primary } }
        : {})}
      onPress={onPress}
      accessibilityLabel={`${idea.name}, ${formatRange(idea.calories, "kilocalories")}`}
    />
  );
}

function SavedRow({ saved, onPress }: { saved: SavedMeal; onPress: () => void }) {
  const { colors } = useColors();
  return (
    <PickerRow
      title={saved.name}
      subtitle={
        saved.useCount > 0
          ? `Planned ${saved.useCount} time${saved.useCount === 1 ? "" : "s"}`
          : "Saved by you"
      }
      trailing={formatRange(saved.meal.calories, "kcal")}
      badge={{ icon: "bookmark", tone: colors.primary }}
      onPress={onPress}
      accessibilityLabel={`${saved.name}, your saved meal`}
    />
  );
}

function CandidateRow({
  candidate,
  onPress,
}: {
  candidate: LookupCandidate;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const measured = candidate.source.kind === "usda";
  return (
    <PickerRow
      title={candidate.name}
      subtitle={`${candidate.serving}${measured ? " · USDA measured" : " · estimated"}`}
      trailing={`${Math.round(candidate.nutrients.calories ?? 0)} kcal`}
      badge={{
        icon: measured ? "checkmark-circle" : "sparkles",
        tone: measured ? colors.success : colors.warning,
      }}
      onPress={onPress}
      accessibilityLabel={`${candidate.name}, ${measured ? "USDA measured" : "AI estimate"}`}
    />
  );
}

function EstimateRow({
  analysis,
  query,
  onPress,
}: {
  analysis: FoodAnalysis;
  query: string;
  onPress: () => void;
}) {
  const { colors } = useColors();
  const resolved = analysis.items.filter((i) => i.confidence !== "unmatched").length;
  return (
    <PickerRow
      title={query}
      subtitle={
        resolved > 1
          ? `Read as ${resolved} items · ${analysis.confidence.replace("-", " ")}`
          : `Estimated · ${analysis.confidence.replace("-", " ")}`
      }
      trailing={`${Math.round(analysis.totals.calories ?? 0)} kcal`}
      badge={{ icon: "sparkles", tone: colors.warning }}
      onPress={onPress}
      accessibilityLabel={`Gozlin estimate for ${query}`}
    />
  );
}

function FreeformRow({ query, onPress }: { query: string; onPress: () => void }) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Plan ${query} by name, without nutrition`}
      style={({ pressed }) => [
        styles.freeform,
        {
          borderColor: colors.borderStrong,
          backgroundColor: pressed ? colors.surfaceMuted : "transparent",
        },
      ]}
    >
      <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
      <View style={styles.flex}>
        <AppText variant="body" weight="600" numberOfLines={2}>
          {`Plan "${query}" anyway`}
        </AppText>
        <AppText variant="footnote" color="tertiary">
          Your own words, no nutrition attached
        </AppText>
      </View>
    </Pressable>
  );
}

// ============================================================================
// CONFIRM
// ============================================================================

/** Servings a single planned slot can plausibly hold. */
const SERVING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3];

function ConfirmView({
  staged,
  slot,
  date,
  topInset,
  onBack,
  onConfirm,
}: {
  staged: Staged;
  slot: MealType;
  date: string;
  topInset: number;
  onBack: () => void;
  onConfirm: (result: MealPickResult) => void | Promise<void>;
}) {
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(1);
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);

  const servings = SERVING_STEPS[stepIndex] ?? 1;
  const calories = scaleRange(staged.calories, servings);
  const protein = scaleRange(staged.protein, servings);
  const carbs = scaleRange(staged.carbs, servings);
  const fat = scaleRange(staged.fat, servings);

  const badge = PROVENANCE[staged.provenance];
  const tone =
    badge.tone === "success"
      ? colors.success
      : badge.tone === "warning"
        ? colors.warning
        : badge.tone === "muted"
          ? colors.textTertiary
          : colors.primary;

  const kcal = midpoint(calories);
  const known = kcal > 0;

  /*
   * The macro bars are scaled against the biggest macro ON THIS MEAL, not against
   * a daily target. A single meal has no target, and drawing one breakfast
   * against a whole day's protein would make every meal look like a failure.
   */
  const peak = Math.max(midpoint(protein), midpoint(carbs), midpoint(fat), 1);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm({
        meal: {
          mealType: slot,
          name: staged.name,
          calories,
          proteinG: protein,
          carbsG: carbs,
          fatG: fat,
          ...(staged.isNigerian ? { isNigerian: true } : {}),
          ...(staged.cuisine ? { cuisine: staged.cuisine } : {}),
        },
        ...(staged.nutrients ? { nutrients: scalePanelBy(staged.nutrients, servings) } : {}),
        saveForReuse: save,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to the list"
            style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <AppText variant="caption" color="tertiary" weight="700" uppercase style={styles.flex}>
            {SLOT_LABEL[slot]} · {dayLabel(date)}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.confirmBody, { paddingBottom: Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" weight="700">
          {staged.name}
        </AppText>

        <View style={[styles.badge, { backgroundColor: alpha(tone, 0.12) }]}>
          <Ionicons name={badge.icon} size={13} color={tone} />
          <AppText variant="footnote" weight="700" style={{ color: tone }}>
            {badge.label}
          </AppText>
          {staged.detail ? (
            <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.flexShrink}>
              {staged.detail}
            </AppText>
          ) : null}
        </View>

        {known ? (
          <View
            style={[
              styles.nutritionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.calRow}>
              <View>
                <AppText variant="metric" weight="700" style={{ color: colors.calories }}>
                  {kcal}
                </AppText>
                <AppText variant="caption" color="tertiary" weight="700" uppercase>
                  kcal{calories.min !== calories.max ? ` · ${formatRange(calories)}` : ""}
                </AppText>
              </View>
              <View style={styles.macros}>
                <MacroBar label="Protein" range={protein} tone={colors.protein} peak={peak} />
                <MacroBar label="Carbs" range={carbs} tone={colors.carbs} peak={peak} />
                <MacroBar label="Fat" range={fat} tone={colors.fat} peak={peak} />
              </View>
            </View>
            {staged.provenance === "estimate" ? (
              <AppText variant="footnote" color="tertiary" style={styles.disclaimer}>
                Nobody measured this one. It is a model reading a typical recipe, and
                it stays labelled that way wherever it appears.
              </AppText>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.nutritionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AppText variant="body" weight="600">
              No nutrition for this one
            </AppText>
            <AppText variant="footnote" color="tertiary" style={styles.disclaimer}>
              {`It'll sit on your plan by name so you know what you meant to eat, and it simply won't count toward your day's totals. An honest gap beats an invented number.`}
            </AppText>
          </View>
        )}

        {known ? (
          <View
            style={[
              styles.servingRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.flex}>
              <AppText variant="body" weight="600">
                Servings
              </AppText>
              <AppText variant="footnote" color="tertiary">
                Scales everything above
              </AppText>
            </View>
            <View style={styles.stepper}>
              <StepButton
                icon="remove"
                disabled={stepIndex === 0}
                onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
                label="Fewer servings"
              />
              <AppText variant="body" weight="700" style={styles.stepValue}>
                {servings % 1 === 0 ? servings : servings.toFixed(1)}
              </AppText>
              <StepButton
                icon="add"
                disabled={stepIndex === SERVING_STEPS.length - 1}
                onPress={() => setStepIndex((i) => Math.min(SERVING_STEPS.length - 1, i + 1))}
                label="More servings"
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => setSave((s) => !s)}
          accessibilityRole="switch"
          accessibilityState={{ checked: save }}
          accessibilityLabel="Save to my meals for one-tap reuse"
          style={[
            styles.servingRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex}>
            <AppText variant="body" weight="600">
              Save to my meals
            </AppText>
            <AppText variant="footnote" color="tertiary">
              One tap next time you plan it
            </AppText>
          </View>
          <Ionicons
            name={save ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={save ? colors.primary : colors.textTertiary}
          />
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Button
          label={`Add to ${SLOT_LABEL[slot].toLowerCase()}`}
          icon="checkmark"
          fullWidth
          loading={busy}
          onPress={submit}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.stepBtn,
        { backgroundColor: colors.surfaceMuted, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Ionicons name={icon} size={17} color={colors.text} />
    </Pressable>
  );
}

/** One macro as a bar, proportional to `peak` (the meal's biggest macro). */
function MacroBar({
  label,
  range,
  tone,
  peak,
}: {
  label: string;
  range: Range;
  tone: string;
  peak: number;
}) {
  const { colors } = useColors();
  const value = midpoint(range);
  const max = Math.max(peak, 1);
  return (
    <View style={styles.macroRow}>
      <AppText variant="caption" color="tertiary" weight="700" style={styles.macroLabel}>
        {label}
      </AppText>
      <View style={[styles.macroTrack, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.macroFill,
            { backgroundColor: tone, width: `${Math.min(100, (value / max) * 100)}%` },
          ]}
        />
      </View>
      <AppText variant="footnote" weight="700" style={styles.macroValue}>
        {value}g
      </AppText>
    </View>
  );
}

const PROVENANCE: Record<
  Provenance,
  { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string }
> = {
  catalog: { icon: "book", label: "From the meal library", tone: "brand" },
  verified: { icon: "checkmark-circle", label: "USDA measured", tone: "success" },
  estimate: { icon: "sparkles", label: "Gozlin estimate", tone: "warning" },
  logged: { icon: "bookmark", label: "Your saved meal", tone: "brand" },
  none: { icon: "help-circle", label: "No nutrition data", tone: "muted" },
};

// ============================================================================
// NORMALISERS — every rung of the ladder ends up as one Staged
// ============================================================================

const flat = (n: number): Range => ({ min: Math.round(n), max: Math.round(n) });

function fromIdea(idea: MealIdea): Staged {
  /*
   * A whole food gets its FULL panel where the reference table has one — the
   * catalog carries four macros, the reference carries thirty-odd nutrients plus
   * a citation. Planning "Greek yogurt" should record what a lab measured, not a
   * four-number shadow of it.
   *
   * The climb has to go through resolveCatalogFood: the catalog and the reference
   * table use DIFFERENT id spaces (see linkCatalogFood), so a catalog id handed
   * straight to resolveKnownFood always misses. A food with no reference match
   * resolves to its own four macros labelled `macros-only`, which is the honest
   * answer rather than a near-miss food's measured panel.
   */
  const food = idea.foodId ? getFoodById(idea.foodId) : undefined;
  const resolved = food
    ? resolveCatalogFood(food, 1, linkCatalogFood(food).defaultUnit)
    : null;

  return {
    name: idea.name,
    calories: idea.calories,
    protein: idea.protein,
    carbs: idea.carbs,
    fat: idea.fat,
    ...(idea.isNigerian ? { isNigerian: true } : {}),
    ...(idea.cuisine ? { cuisine: idea.cuisine } : {}),
    ...(resolved ? { nutrients: resolved.nutrients } : {}),
    provenance: "catalog",
    ...(idea.origin === "food"
      ? { detail: idea.serving ?? "1 serving" }
      : idea.diets.length > 0
        ? { detail: idea.diets.slice(0, 2).join(", ") }
        : {}),
  };
}

function fromSaved(saved: SavedMeal): Staged {
  return {
    name: saved.name,
    calories: saved.meal.calories,
    protein: saved.meal.proteinG,
    carbs: saved.meal.carbsG,
    fat: saved.meal.fatG,
    ...(saved.meal.isNigerian ? { isNigerian: true } : {}),
    ...(saved.meal.cuisine ? { cuisine: saved.meal.cuisine } : {}),
    ...(saved.nutrients ? { nutrients: saved.nutrients } : {}),
    provenance: "logged",
    detail: `Planned ${saved.useCount} time${saved.useCount === 1 ? "" : "s"}`,
  };
}

function fromCandidate(c: LookupCandidate): Staged {
  const measured = c.source.kind === "usda";
  return {
    name: c.name,
    calories: flat(c.nutrients.calories ?? 0),
    protein: flat(c.nutrients.protein ?? 0),
    carbs: flat(c.nutrients.carbs ?? 0),
    fat: flat(c.nutrients.fat ?? 0),
    nutrients: c.nutrients,
    provenance: measured ? "verified" : "estimate",
    detail:
      measured && c.source.kind === "usda"
        ? `${c.serving} · FDC ${c.source.fdcId}`
        : c.serving,
  };
}

function fromAnalysis(analysis: FoodAnalysis, query: string): Staged {
  const t = analysis.totals;
  return {
    name: query,
    calories: flat(t.calories ?? 0),
    protein: flat(t.protein ?? 0),
    carbs: flat(t.carbs ?? 0),
    fat: flat(t.fat ?? 0),
    nutrients: t,
    provenance: analysis.confidence === "measured" ? "verified" : "estimate",
    detail: analysis.confidence.replace("-", " "),
  };
}

function fromFreeform(query: string): Staged {
  return {
    name: query,
    calories: flat(0),
    protein: flat(0),
    carbs: flat(0),
    fat: flat(0),
    provenance: "none",
  };
}

/** Scale a full nutrient panel with the servings dial. Preserves sparseness. */
function scalePanelBy(panel: NutrientPanel, servings: number): NutrientPanel {
  if (servings === 1) return panel;
  const out: NutrientPanel = {};
  for (const [k, v] of Object.entries(panel)) {
    if (typeof v === "number") {
      out[k as keyof NutrientPanel] = Math.round(v * servings * 10) / 10;
    }
  }
  return out;
}

// ============================================================================

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  sheet: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  chips: { flexDirection: "row", gap: Spacing.sm, paddingRight: Spacing.xl },

  list: { paddingHorizontal: Spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  note: { paddingVertical: Spacing.lg, lineHeight: 18 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    borderRadius: Radius.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  freeform: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },

  confirmBody: { paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  nutritionCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  calRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  macros: { flex: 1, gap: Spacing.sm },
  macroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  macroLabel: { width: 52 },
  macroTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  macroFill: { height: 6, borderRadius: 3 },
  macroValue: { width: 42, textAlign: "right" },
  disclaimer: { lineHeight: 17 },

  servingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 28, textAlign: "center" },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
