/**
 * FoodPreferenceSelector — three food questions in one place, one at a time.
 *
 * Unlike the training step (where the answered questions stay on screen), food
 * asks its three questions in the SAME region, crossfading between them. That
 * is deliberate: the three sets are visually similar blocks of options, so
 * stacking them would read as one long undifferentiated list, whereas replacing
 * them in place makes each one feel like a separate thing being asked.
 *
 * Nothing is lost by replacing them. A rail of answered questions sits above
 * the region; tapping any of them returns to it, and the answer is still there.
 * So the sequence is browsable in both directions without touching the step's
 * own back navigation.
 *
 * The region chip is INFORMATIONAL and appears once, above everything. It is
 * detected silently from the device time zone — the user is never asked where
 * they are, and the chip only says what that detection did.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AnimatedText } from "./AnimatedText";
import { Appear } from "./Appear";
import { CrossFade } from "./CrossFade";
import { MultiSelectGrid, OptionRail, type GridOption } from "./MultiSelectGrid";
import { IngredientMotif } from "./AmbientWellnessVisual";
import { DayRhythm } from "./DayRhythm";
import { Dur, Pace, Stagger } from "./onboardingMotion";
import { HIT, MIN_TOUCH, Rhythm } from "./onboardingTheme";

export const FOOD_QUESTIONS = [
  "What kind of food feels right to you?",
  "What cuisine do you enjoy most?",
  "How many meals feel natural?",
] as const;

/* ─────────────────────────── The answered rail ─────────────────────────── */

/** A breadcrumb of what has been answered so far — and the way back to it. */
function AnsweredRail({
  answers,
  current,
  onJump,
}: {
  answers: (string | null)[];
  current: number;
  onJump: (index: number) => void;
}) {
  const { colors } = useColors();
  const shown = answers
    .map((label, index) => ({ label, index }))
    .filter((a) => a.label !== null && a.index !== current);
  if (shown.length === 0) return null;

  return (
    <View style={styles.rail}>
      {shown.map(({ label, index }) => (
        <Appear key={index} delay={index * Stagger.item} duration={Dur.ui} distance={6}>
          <Pressable
            onPress={() => onJump(index)}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Change this answer.`}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: alpha(colors.primary, pressed ? 0.16 : 0.08),
                borderColor: alpha(colors.primary, 0.3),
              },
            ]}
          >
            <AppText variant="footnote" color="brand">
              {label}
            </AppText>
          </Pressable>
        </Appear>
      ))}
    </View>
  );
}

/* ─────────────────────────────── The step ──────────────────────────────── */

export interface FoodPreferenceSelectorProps<D extends string, C extends string> {
  dietOptions: GridOption<D>[];
  diet: D;
  onDiet: (v: D) => void;

  cuisineOptions: GridOption<C>[];
  cuisine: C;
  onCuisine: (v: C) => void;

  mealOptions: GridOption<string>[];
  meals: number;
  onMeals: (v: number) => void;

  /** 0, 1 or 2 — which question is on screen. Owned by the step. */
  question: number;
  onJump: (index: number) => void;
  /** Advance to the next question; the step decides what happens after the last. */
  onAnswered: () => void;

  /** Silently-detected region, or null. Shown as a chip, never asked. */
  detectedRegion: string | null;
  width: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FoodPreferenceSelector<D extends string, C extends string>({
  dietOptions,
  diet,
  onDiet,
  cuisineOptions,
  cuisine,
  onCuisine,
  mealOptions,
  meals,
  onMeals,
  question,
  onJump,
  onAnswered,
  detectedRegion,
  width,
  delay = 0,
  style,
}: FoodPreferenceSelectorProps<D, C>) {
  const { colors } = useColors();

  const answered: (string | null)[] = [
    question > 0 ? (dietOptions.find((o) => o.value === diet)?.label ?? null) : null,
    question > 1 ? (cuisineOptions.find((o) => o.value === cuisine)?.label ?? null) : null,
    null,
  ];

  const body = () => {
    switch (question) {
      case 0:
        return (
          <MultiSelectGrid
            key="diet"
            options={dietOptions}
            selected={[diet]}
            onToggle={(v) => {
              onDiet(v);
              setTimeout(onAnswered, Pace.handover);
            }}
            width={width}
            columns={2}
            role="radio"
            recedeUnselected
          />
        );
      case 1:
        return (
          <OptionRail
            key="cuisine"
            options={cuisineOptions}
            selected={[cuisine]}
            onToggle={(v) => {
              onCuisine(v);
              setTimeout(onAnswered, Pace.handover);
            }}
            role="radio"
            recedeUnselected
          />
        );
      default:
        return (
          // The day the answer describes sits above the two answers, and
          // redraws itself as the choice changes.
          <View key="meals" style={styles.meals}>
            <DayRhythm meals={meals} delay={Stagger.layer} />
            <MultiSelectGrid
              options={mealOptions}
              selected={[String(meals)]}
              onToggle={(v) => onMeals(Number(v))}
              width={width}
              columns={2}
              role="radio"
              recedeUnselected
            />
          </View>
        );
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      {detectedRegion ? (
        <Appear delay={delay} duration={Dur.content} distance={8}>
          <View
            style={[
              styles.region,
              { backgroundColor: alpha(colors.primary, 0.07), borderColor: alpha(colors.primary, 0.22) },
            ]}
          >
            <AppText variant="footnote" color="secondary">
              Meals tuned for {detectedRegion}
            </AppText>
          </View>
        </Appear>
      ) : null}

      <Appear delay={delay + Stagger.item} duration={Dur.content} distance={0} style={styles.motif}>
        <IngredientMotif tone={colors.primary} width={168} />
      </Appear>

      <AnsweredRail answers={answered} current={question} onJump={onJump} />

      {/* One region, three questions. The heading crossfades with its options
          so the pair always reads as a single thing changing. */}
      <CrossFade contentKey={question} style={styles.stage}>
        <View style={styles.question}>
          <AnimatedText variant="question" duration={Dur.content}>
            {FOOD_QUESTIONS[question]}
          </AnimatedText>
          {body()}
        </View>
      </CrossFade>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  motif: { alignItems: "center" },
  stage: { alignSelf: "stretch" },
  question: { gap: Rhythm.layer },
  meals: { gap: Spacing.xl },

  region: {
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  rail: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minHeight: MIN_TOUCH - 12,
    justifyContent: "center",
  },
});
