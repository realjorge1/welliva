/**
 * FITNESS LIBRARY — searchable workout collection + the exercise browser.
 *
 * Two lenses on one screen:
 *   • Workouts — the authored Welliva sessions (search + stacked filters)
 *   • Exercises — the full exercise database with personal suitability
 *     (this is the former Fitness-tab "Browse" mode, preserved verbatim in
 *     behaviour: same suitability model, same detail routing)
 */

import { AmbientCanvas, AppText, Card, IconBadge, Pill, ThemedIcon, useColors } from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Radius, Spacing } from "@/constants/theme";
import { useProfile } from "@/contexts/AppContext";
import { ArtTile } from "@/fitness/components/ArtTile";
import { WorkoutCard } from "@/fitness/components/WorkoutCard";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import { filterWorkouts } from "@/fitness/services/WorkoutCatalog";
import type { ArtHue, ArtPattern, WorkoutFilter, WorkoutStyle } from "@/fitness/types";
import type { Difficulty } from "@/models/exercise";
import { exerciseSuitability } from "@/services/WorkoutGenerator";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ViewMode = "workouts" | "exercises";

const STYLE_CHIPS: { id: WorkoutStyle | "all"; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "grid-outline" },
  { id: "strength", label: "Strength", icon: "barbell-outline" },
  { id: "hiit", label: "HIIT", icon: "flash-outline" },
  { id: "cardio", label: "Cardio", icon: "heart-outline" },
  { id: "core", label: "Core", icon: "disc-outline" },
  { id: "endurance", label: "Endurance", icon: "pulse-outline" },
  { id: "power", label: "Power", icon: "rocket-outline" },
  { id: "mobility", label: "Mobility", icon: "leaf-outline" },
  { id: "recovery", label: "Recovery", icon: "moon-outline" },
];

const DURATION_CHIPS = [
  { id: 0, label: "Any length" },
  { id: 15, label: "≤ 15 min" },
  { id: 25, label: "≤ 25 min" },
  { id: 40, label: "≤ 40 min" },
];

const LEVEL_CHIPS: { id: Difficulty | "all"; label: string }[] = [
  { id: "all", label: "All levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

// ── Exercise browser (preserved from the former tab "Browse" mode) ──
const EX_CATEGORIES = [
  { id: "all", name: "All", icon: "grid-outline" },
  { id: "push", name: "Push", icon: "arrow-up" },
  { id: "pull", name: "Pull", icon: "arrow-down" },
  { id: "squat", name: "Legs", icon: "body-outline" },
  { id: "core", name: "Core", icon: "fitness-outline" },
  { id: "cardio", name: "Cardio", icon: "heart-outline" },
];

// ── Per-exercise art tiles ──
// Exercises don't carry authored art the way workouts do, so we derive a
// deterministic tile for each one: a category-signature hue + glyph, with the
// decorative pattern varied by a hash of the id so tiles feel individual.
const EX_HUE: Record<string, ArtHue> = {
  push: "ember",
  pull: "sky",
  squat: "violet",
  legs: "violet",
  hinge: "gold",
  core: "teal",
  cardio: "rose",
  flexibility: "forest",
};

const EX_GLYPH: Record<string, string> = {
  push: "arrow-up",
  pull: "arrow-down",
  squat: "body",
  legs: "body",
  hinge: "barbell",
  core: "fitness",
  cardio: "heart",
  flexibility: "leaf",
};

const EX_PATTERNS: ArtPattern[] = ["orbit", "rings", "dots", "beams"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function exerciseArt(id: string, pattern: string): {
  icon: string;
  hue: ArtHue;
  pattern: ArtPattern;
} {
  return {
    icon: EX_GLYPH[pattern] ?? "barbell",
    hue: EX_HUE[pattern] ?? "brand",
    pattern: EX_PATTERNS[hashString(id) % EX_PATTERNS.length],
  };
}

export default function FitnessLibraryScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; favorites?: string }>();
  const { userBio } = useProfile();
  const { profile, toggleFavorite, isFavorite } = useFitnessProfile();

  const [viewMode, setViewMode] = useState<ViewMode>(
    params.view === "exercises" ? "exercises" : "workouts",
  );
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<WorkoutStyle | "all">("all");
  const [maxMinutes, setMaxMinutes] = useState(0);
  const [level, setLevel] = useState<Difficulty | "all">("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(params.favorites === "1");

  // Exercise-browser filters (unchanged behaviour from the old Browse mode)
  const [exCategory, setExCategory] = useState("all");
  const [exLevel, setExLevel] = useState<Difficulty | "all">("all");

  const workouts = useMemo(() => {
    const filter: WorkoutFilter = {
      query,
      style,
      difficulty: level,
      maxMinutes: maxMinutes || undefined,
      equipment: ownedOnly ? (userBio?.equipment ?? ["none"]) : undefined,
      favoritesOnly,
    };
    return filterWorkouts(filter, profile.favorites);
  }, [query, style, level, maxMinutes, ownedOnly, favoritesOnly, userBio?.equipment, profile.favorites]);

  const exercises = useMemo(() => {
    let all = EXERCISE_DATABASE.map((e) => {
      const fit = userBio ? exerciseSuitability(e, userBio) : null;
      return {
        id: e.id,
        name: e.name,
        category: e.movementPattern,
        muscle: e.targetMuscles.join(", "),
        difficulty: e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1),
        difficultyRaw: e.difficulty,
        equipment: e.equipment.join(", ") || "None",
        art: exerciseArt(e.id, e.movementPattern),
        match: fit?.percent ?? null,
        caution: fit?.caution ?? null,
      };
    });
    if (exCategory !== "all") all = all.filter((e) => e.category === exCategory);
    if (exLevel !== "all") all = all.filter((e) => e.difficultyRaw === exLevel);
    return all;
  }, [exCategory, exLevel, userBio]);

  const openWorkout = useCallback(
    (id: string) => router.push(`/fitness/workout/${id}` as never),
    [router],
  );

  const difficultyTone = useCallback(
    (difficulty: string) => {
      switch (difficulty.toLowerCase()) {
        case "beginner":
          return colors.success;
        case "intermediate":
          return colors.warning;
        case "advanced":
          return colors.error;
        default:
          return colors.textTertiary;
      }
    },
    [colors],
  );

  const Chip = useCallback(
    ({
      active,
      label,
      icon,
      onPress,
      tone,
    }: {
      active: boolean;
      label: string;
      icon?: string;
      onPress: () => void;
      tone?: string;
    }) => {
      const activeTone = tone ?? colors.primary;
      return (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          style={[
            styles.chip,
            {
              backgroundColor: active ? activeTone : colors.surface,
              borderColor: active ? activeTone : colors.border,
            },
          ]}
        >
          {icon ? (
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={active ? colors.onPrimary : colors.textTertiary}
            />
          ) : null}
          <AppText
            variant="footnote"
            color={active ? colors.onPrimary : "secondary"}
            style={styles.chipText}
          >
            {label}
          </AppText>
        </Pressable>
      );
    },
    [colors],
  );

  const Header = (
    <View>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="display" style={styles.flex}>
          Library
        </AppText>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
          {(["workouts", "exercises"] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.segmentBtn, active && { backgroundColor: colors.surface }]}
              >
                <AppText
                  variant="callout"
                  color={active ? "brand" : "tertiary"}
                  style={styles.segmentText}
                >
                  {mode === "workouts" ? "Workouts" : "Exercises"}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (viewMode === "exercises") {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <AmbientCanvas />
        <SafeAreaView style={styles.flex} edges={["top"]}>
          {Header}
          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {EX_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.id}
                  active={exCategory === cat.id}
                  label={cat.name}
                  icon={cat.icon}
                  onPress={() => setExCategory(cat.id)}
                />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {LEVEL_CHIPS.map((df) => (
                <Chip
                  key={df.id}
                  active={exLevel === df.id}
                  label={df.label}
                  tone={df.id === "all" ? undefined : difficultyTone(df.id)}
                  onPress={() => setExLevel(df.id)}
                />
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const tone = difficultyTone(item.difficulty);
              return (
                <Card
                  onPress={() => router.push(`/exercise/${item.id}` as never)}
                  style={styles.exerciseCard}
                  padding="md"
                  elevation="xs"
                >
                  <View style={styles.exerciseCardRow}>
                    <ArtTile
                      icon={item.art.icon}
                      hue={item.art.hue}
                      pattern={item.art.pattern}
                      size={52}
                      radius={Radius.md}
                    />
                    <View style={styles.flex}>
                      <AppText variant="callout" numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.exMuscle}>
                        {item.muscle}
                      </AppText>
                      <View style={styles.exMeta}>
                        <Pill label={item.difficulty} tone={tone} size="sm" />
                        {item.match != null && !item.caution && (
                          <Pill label={`${item.match}% match`} tone={colors.success} size="sm" />
                        )}
                        <AppText variant="caption" color="tertiary" numberOfLines={1} style={styles.flex}>
                          {item.equipment}
                        </AppText>
                      </View>
                      {item.caution && (
                        <View style={styles.cautionRow}>
                          <Ionicons name="warning" size={13} color={colors.warning} />
                          <AppText variant="caption" color="warning" numberOfLines={1} style={styles.flex}>
                            {item.caution}
                          </AppText>
                        </View>
                      )}
                    </View>
                    <ThemedIcon name="chevron-forward" size={18} role="textTertiary" />
                  </View>
                </Card>
              );
            }}
            ListFooterComponent={<View style={styles.footerPad} />}
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <IconBadge name="search-outline" tone={colors.textTertiary} size={56} />
                <AppText variant="body" color="secondary" align="center" style={styles.listEmptyText}>
                  No exercises match your filters. Try a different category or level.
                </AppText>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    );
  }

  // ── Workouts view ──
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {Header}

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search workouts, muscles, coaches…"
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
              returnKeyType="search"
              accessibilityLabel="Search workouts"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STYLE_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={style === c.id}
                label={c.label}
                icon={c.icon}
                onPress={() => setStyle(c.id)}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DURATION_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={maxMinutes === c.id}
                label={c.label}
                onPress={() => setMaxMinutes(c.id)}
              />
            ))}
            {LEVEL_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={level === c.id}
                label={c.label}
                tone={c.id === "all" ? undefined : difficultyTone(c.id)}
                onPress={() => setLevel(c.id)}
              />
            ))}
            <Chip
              active={ownedOnly}
              label="My equipment"
              icon="cube-outline"
              onPress={() => setOwnedOnly((v) => !v)}
            />
            <Chip
              active={favoritesOnly}
              label="Favorites"
              icon="heart-outline"
              onPress={() => setFavoritesOnly((v) => !v)}
            />
          </ScrollView>
        </View>

        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          windowSize={7}
          ListHeaderComponent={
            <AppText variant="footnote" color="tertiary" style={styles.count}>
              {workouts.length} workout{workouts.length === 1 ? "" : "s"}
            </AppText>
          }
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onPress={openWorkout}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={toggleFavorite}
            />
          )}
          ListFooterComponent={<View style={styles.footerPad} />}
          ListEmptyComponent={
            <View style={styles.listEmpty}>
              <IconBadge name="search-outline" tone={colors.textTertiary} size={56} />
              <AppText variant="body" color="secondary" align="center" style={styles.listEmptyText}>
                Nothing matches those filters yet. Loosen one and try again.
              </AppText>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", borderRadius: Radius.pill, padding: 3 },
  segmentBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill },
  segmentText: { fontWeight: "700" },

  searchWrap: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  filters: { gap: Spacing.sm, paddingBottom: Spacing.md },
  chipRow: { paddingHorizontal: Spacing.screen, gap: Spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontWeight: "600" },

  listContent: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.xs },
  count: { marginBottom: Spacing.sm },
  footerPad: { height: 40 },

  // exercise browser
  exerciseCard: { marginBottom: Spacing.md },
  exerciseCardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  exMuscle: { marginTop: 2 },
  exMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 6 },
  cautionRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },

  listEmpty: { alignItems: "center", paddingTop: Spacing.huge, paddingHorizontal: Spacing.xl },
  listEmptyText: { marginTop: Spacing.lg },
});
