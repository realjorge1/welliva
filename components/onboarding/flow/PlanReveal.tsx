/**
 * PlanReveal — the payoff.
 *
 * Everything before this screen was the user giving. This is the screen that
 * gives back, so it is the only place in the flow allowed to take its time. The
 * plan assembles over about three seconds, in the order a person reads a plan:
 * how much (the ring, then the split of it), WHAT THEY WILL EAT (today's actual
 * dishes, in the cuisine they chose), then how they will move (the week drawn
 * day by day), then the sign-off — and only once all of that has settled does
 * the action appear. A button present from the first frame would tell the user
 * the screen was a form with a plan on it.
 *
 * WHY THE MEALS LEAD. This screen used to headline a DIET NAME — "Your best
 * match: Mediterranean Diet" — to someone who had just said they eat African
 * food. The dishes were African underneath; the headline said otherwise, and
 * the headline is what a person believes. So the card now opens on the kitchen
 * they chose and today's dishes by name; the eating style (the clinical
 * framework the dishes are portioned by) is a quiet line under them.
 *
 * EVERY NUMBER HERE IS REAL. The targets come from `calculateNutritionTargets`,
 * the eating style from `recommendDiets`, today's meals from the generator (or
 * the menu the user just picked) and the week from `generateWorkoutPlan` — the
 * same calls, over the same bio, that the save makes; today's day is the exact
 * one saved. The reveal animates the PRESENTATION of those numbers and never
 * invents one: the ring fills to 100% because the target is the target, and the
 * count-ups start at zero and land on the computed value.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { DisclaimerNote } from "@/components/legal";
import { TargetGuidanceNote } from "@/components/nutrition/TargetGuidanceNote";
import {
  AnimatedNumber,
  AppText,
  Button,
  Mono,
  Ring,
  useColors,
} from "@/components/ui";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { AnimatedText } from "./AnimatedText";
import { Appear } from "./Appear";
import { OnboardingGlyph, type GlyphName } from "./OnboardingGlyph";
import { Dur, Ease, Travel, useMotion } from "./onboardingMotion";
import { HAIRLINE } from "./onboardingTheme";

/* The reveal's score. Every delay in this file comes from here, so the pacing
 * can be re-cut in one place rather than screen-wide. */
const T = {
  kicker: 0,
  title: 140,
  lede: 400,
  ring: 640,
  calories: 1000,
  split: 1150,
  meals: 1500,
  mealRows: 1680,
  style: 2150,
  training: 2380,
  week: 2520,
  signoff: 2800,
  notes: 2940,
  action: 3120,
} as const;

/** A number that counts up from zero once, on cue. Mounted at 0 and set to the
 *  real value on a delay — `AnimatedNumber` animates changes, not first paints. */
function RevealNumber({
  value,
  delay,
  variant = "metric",
  format,
}: {
  value: number;
  delay: number;
  variant?: "metric" | "title";
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    // The roll is decoration; a reader is told the destination, not the journey.
    <View accessible accessibilityLabel={format ? format(value) : String(value)}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AnimatedNumber value={shown} variant={variant} duration={900} format={format} />
      </View>
    </View>
  );
}

export interface RevealMeal {
  slot: "breakfast" | "lunch" | "dinner";
  name: string;
  kcal: number;
}

export interface PlanRevealPreview {
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterMl: number;
    guidance?: unknown;
  };
  /** The eating style — the framework the dishes are portioned by. */
  topDiet: { diet: { name: string }; score: number; reasons: string[] } | null;
  meals: {
    /** "African kitchen". */
    kitchen: string;
    /** Who plans the days: "Planned by Gozlin", "Your menu · 2 weeks". */
    source: string;
    /** True when the user picked the dishes themselves. */
    chosen: boolean;
    /** Today's main meals, exactly as saved. */
    today: RevealMeal[];
    snacks: number;
  };
  splitType: string;
  trainingDays: number;
  /** Monday = 0. */
  trainingWeekdays: number[];
  sessionMinutes: number | null;
  equipmentSummary: string;
}

export interface PlanRevealProps {
  preview: PlanRevealPreview;
  /** "Built around your goal to …" — already resolved by the step. */
  lede: string;
  trainingEnabled: boolean;
  loading: boolean;
  onStart: () => void;
}

/* ───────────────────────────── Card chrome ─────────────────────────────── */

function Panel({ children }: { children: React.ReactNode }) {
  const { colors } = useColors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: alpha(colors.surface, 0.78), borderColor: alpha(colors.border, 1) },
      ]}
    >
      {children}
    </View>
  );
}

function PanelHead({
  glyph,
  kicker,
  title,
  aside,
}: {
  glyph: GlyphName;
  kicker: string;
  title: string;
  aside?: React.ReactNode;
}) {
  const { colors } = useColors();
  return (
    <View style={styles.head}>
      <View style={[styles.headGlyph, { backgroundColor: alpha(colors.primary, 0.1), borderColor: alpha(colors.primary, 0.28) }]}>
        <OnboardingGlyph name={glyph} tone={colors.primary} size={20} />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption" color="tertiary" uppercase>
          {kicker}
        </AppText>
        <AppText variant="headline" numberOfLines={2}>
          {title}
        </AppText>
      </View>
      {aside}
    </View>
  );
}

/* ───────────────────────────── The energy card ─────────────────────────── */

/**
 * The day's calories split by where they come from — one bar, three segments,
 * each growing to its real share (protein and carbs at 4 kcal/g, fat at 9).
 */
function MacroSplit({
  proteinG,
  carbsG,
  fatG,
  delay,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
  delay: number;
}) {
  const { colors } = useColors();
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const kcal = [proteinG * 4, carbsG * 4, fatG * 9];
  const total = Math.max(1, kcal[0] + kcal[1] + kcal[2]);
  const shares = kcal.map((k) => k / total);
  const tones = [colors.protein, colors.carbs, colors.fat];
  const labels = ["Protein", "Carbs", "Fat"];
  const grams = [proteinG, carbsG, fatG];

  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  useEffect(() => {
    if (width === 0) return;
    [p0, p1, p2].forEach((sv, i) => {
      sv.value = withDelay(
        motion.delay(delay + i * 140),
        withTiming(1, { duration: motion.dur(Dur.content), easing: Ease.soft }),
      );
    });
  }, [width, delay, motion, p0, p1, p2]);

  // Two-pixel gaps between segments, paid out of the bar's own width. Hoisted
  // to plain numbers: a worklet may only close over plain values.
  const usable = Math.max(0, width - 4);
  const w0 = usable * (shares[0] ?? 0);
  const w1 = usable * (shares[1] ?? 0);
  const w2 = usable * (shares[2] ?? 0);
  const s0 = useAnimatedStyle(() => ({ width: w0 * p0.value }));
  const s1 = useAnimatedStyle(() => ({ width: w1 * p1.value }));
  const s2 = useAnimatedStyle(() => ({ width: w2 * p2.value }));
  const seg = [s0, s1, s2];

  return (
    <View style={styles.split}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, { backgroundColor: alpha(colors.surfaceSunken, 0.9) }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={labels
          .map((l, i) => `${l} ${grams[i]} grams, ${Math.round(shares[i]! * 100)} percent`)
          .join("; ")}
      >
        {seg.map((style, i) => (
          <Animated.View key={labels[i]} style={[styles.segment, { backgroundColor: tones[i] }, style]} />
        ))}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {labels.map((label, i) => (
          <Appear key={label} delay={delay + 200 + i * 90} duration={Dur.ui} distance={6} style={styles.legendItem}>
            <View style={styles.legendHead}>
              <View style={[styles.legendDot, { backgroundColor: tones[i] }]} />
              <AppText variant="caption" color="tertiary" uppercase>
                {label}
              </AppText>
            </View>
            <View style={styles.legendValue}>
              <AppText variant="headline">{grams[i]}g</AppText>
              <Mono size={11} color={colors.textTertiary}>
                {Math.round(shares[i]! * 100)}%
              </Mono>
            </View>
          </Appear>
        ))}
      </View>
    </View>
  );
}

/* ───────────────────────────── The meals card ──────────────────────────── */

const SLOT_LABEL: Record<RevealMeal["slot"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
const SLOT_GLYPH: Record<RevealMeal["slot"], GlyphName> = {
  breakfast: "sunrise",
  lunch: "spark",
  dinner: "moon",
};

/** Today's meals on a thread — each one lights its node as it arrives. */
function MealThread({ meals, snacks, delay }: { meals: RevealMeal[]; snacks: number; delay: number }) {
  const { colors } = useColors();
  return (
    <View style={styles.thread}>
      <View style={[styles.threadLine, { backgroundColor: alpha(colors.border, 1) }]} />
      {meals.map((meal, i) => (
        <Appear key={meal.slot} delay={delay + i * 150} duration={Dur.content} distance={8}>
          <View style={styles.threadRow} accessible accessibilityLabel={`${SLOT_LABEL[meal.slot]}: ${meal.name}, about ${meal.kcal} calories.`}>
            <View style={[styles.node, { backgroundColor: colors.background, borderColor: alpha(colors.primary, 0.7) }]}>
              <OnboardingGlyph name={SLOT_GLYPH[meal.slot]} tone={colors.primary} size={14} weight={1.7} />
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" color="tertiary" uppercase>
                {SLOT_LABEL[meal.slot]}
              </AppText>
              <AppText variant="callout" numberOfLines={2}>
                {meal.name}
              </AppText>
            </View>
            <Mono size={12} color={colors.textSecondary}>
              {meal.kcal} kcal
            </Mono>
          </View>
        </Appear>
      ))}
      {snacks > 0 ? (
        <Appear delay={delay + meals.length * 150} duration={Dur.ui} distance={6}>
          <View style={styles.threadRow}>
            <View style={[styles.node, styles.nodeSmall, { backgroundColor: colors.background, borderColor: alpha(colors.primary, 0.4) }]} />
            <AppText variant="footnote" color="tertiary">
              {snacks === 1 ? "Plus a snack between meals" : `Plus ${snacks} snacks between meals`}
            </AppText>
          </View>
        </Appear>
      ) : null}
    </View>
  );
}

/* ──────────────────────────── The training week ────────────────────────── */

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function TrainingWeek({ days, delay }: { days: number[]; delay: number }) {
  const { colors } = useColors();
  return (
    <View
      style={styles.week}
      accessible
      accessibilityLabel={`Training on ${days.map((d) => DAY_FULL[d]).join(", ")}.`}
    >
      {LETTERS.map((letter, i) => {
        const on = days.includes(i);
        return (
          <Appear key={i} delay={delay + i * 60} duration={Dur.ui} distance={6} scaleFrom={0.8} style={styles.weekCell}>
            <View
              style={[
                styles.weekDisc,
                on
                  ? { backgroundColor: alpha(colors.primary, 0.18), borderColor: alpha(colors.primary, 0.75) }
                  : { backgroundColor: "transparent", borderColor: alpha(colors.border, 1) },
              ]}
            >
              <AppText variant="caption" color={on ? "brand" : "tertiary"}>
                {letter}
              </AppText>
            </View>
            <View style={[styles.weekTick, { backgroundColor: on ? colors.primary : "transparent" }]} />
          </Appear>
        );
      })}
    </View>
  );
}

function Pill({ text }: { text: string }) {
  const { colors } = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: alpha(colors.surfaceSunken, 0.85), borderColor: alpha(colors.border, 1) }]}>
      <AppText variant="footnote" color="secondary">
        {text}
      </AppText>
    </View>
  );
}

/* ──────────────────────────────── The screen ───────────────────────────── */

export function PlanReveal({
  preview,
  lede,
  trainingEnabled,
  loading,
  onStart,
}: PlanRevealProps) {
  const { colors } = useColors();
  const { targets, topDiet, meals, splitType, trainingDays, equipmentSummary } = preview;

  // The ring draws itself: mounted empty, filled one frame later so the sweep
  // is a value CHANGE (which always animates) rather than a first paint.
  const [ringProgress, setRingProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRingProgress(1), T.ring);
    return () => clearTimeout(t);
  }, []);

  return (
    // The frame keeps the (invisible) action bar mounted on this step, so the
    // safe area and the tail are already paid for above this component.
    <View style={styles.body}>
      <View style={styles.hero}>
        <AnimatedText variant="kicker" color="brand" uppercase align="center" delay={T.kicker} duration={Dur.ui}>
          Your personalized plan
        </AnimatedText>
        <AnimatedText variant="statement" align="center" delay={T.title} duration={Dur.content}>
          Here&apos;s where we start
        </AnimatedText>
        <AnimatedText
          variant="support"
          color="secondary"
          align="center"
          delay={T.lede}
          duration={Dur.content}
          style={styles.lede}
        >
          {lede}
        </AnimatedText>
      </View>

      {/* Energy: the target, then where it comes from. */}
      <Appear delay={T.ring - 200} duration={Dur.content} distance={Travel.card}>
        <Panel>
          <View style={styles.energy}>
            <Ring progress={ringProgress} size={148} strokeWidth={12} gradient={Gradients.calories} duration={1300}>
              <RevealNumber value={targets.calories} delay={T.calories} />
              <AppText variant="caption" color="tertiary" uppercase>
                kcal / day
              </AppText>
            </Ring>
          </View>
          <MacroSplit proteinG={targets.proteinG} carbsG={targets.carbsG} fatG={targets.fatG} delay={T.split} />
          <Appear delay={T.split + 480} duration={Dur.ui} distance={6}>
            <View style={[styles.water, { backgroundColor: alpha(colors.water, 0.08), borderColor: alpha(colors.water, 0.25) }]}>
              <View style={[styles.legendDot, { backgroundColor: colors.water }]} />
              <AppText variant="footnote" color="secondary">
                {(targets.waterMl / 1000).toFixed(1)} L of water a day
              </AppText>
            </View>
          </Appear>
        </Panel>
      </Appear>

      {/* Meals: the kitchen they chose, and today's actual dishes. */}
      <Appear delay={T.meals} duration={Dur.content} distance={Travel.card}>
        <Panel>
          <PanelHead
            glyph="leaf"
            kicker="Your meals"
            title={meals.kitchen}
            aside={
              <View style={[styles.source, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                {meals.chosen ? null : <AILogoBadge size={16} animated={false} />}
                <AppText variant="caption" color="brand">
                  {meals.source}
                </AppText>
              </View>
            }
          />
          {meals.today.length > 0 ? (
            <View style={styles.todayBlock}>
              <AppText variant="caption" color="tertiary" uppercase>
                Today
              </AppText>
              <MealThread meals={meals.today} snacks={meals.snacks} delay={T.mealRows} />
            </View>
          ) : null}

          {topDiet ? (
            <Appear delay={T.style} duration={Dur.content} distance={8}>
              <View style={[styles.style, { borderTopColor: alpha(colors.border, 1) }]}>
                <View style={styles.styleRow}>
                  <View style={styles.flex}>
                    <AppText variant="caption" color="tertiary" uppercase>
                      Eating style
                    </AppText>
                    <AppText variant="callout">{topDiet.diet.name}</AppText>
                  </View>
                  <View style={[styles.score, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                    <RevealNumber
                      value={topDiet.score}
                      delay={T.style + 120}
                      variant="title"
                      format={(n) => `${Math.round(n)}%`}
                    />
                  </View>
                </View>
                <View style={styles.reasons}>
                  {topDiet.reasons.slice(0, 3).map((reason, i) => (
                    <Appear key={reason} delay={T.style + 200 + i * 110} duration={Dur.ui} distance={6}>
                      <View style={styles.reason}>
                        <View style={[styles.bullet, { backgroundColor: alpha(colors.primary, 0.8) }]} />
                        <AppText variant="footnote" color="secondary" style={styles.flex}>
                          {reason}
                        </AppText>
                      </View>
                    </Appear>
                  ))}
                </View>
              </View>
            </Appear>
          ) : null}
        </Panel>
      </Appear>

      {/* Training — or, for someone who chose no movement goal, an open door. */}
      <Appear delay={T.training} duration={Dur.content} distance={Travel.card}>
        {trainingEnabled ? (
          <Panel>
            <PanelHead glyph="strength" kicker="Your training" title={splitType} />
            <TrainingWeek days={preview.trainingWeekdays} delay={T.week} />
            <View style={styles.pills}>
              <Pill text={`${trainingDays} days a week`} />
              <Pill text={equipmentSummary} />
              {preview.sessionMinutes ? <Pill text={`~${preview.sessionMinutes} min`} /> : null}
            </View>
          </Panel>
        ) : (
          <View style={[styles.note, { backgroundColor: alpha(colors.surface, 0.6), borderColor: alpha(colors.border, 0.85) }]}>
            <OnboardingGlyph name="motion" tone={colors.primary} size={26} />
            <AppText variant="subhead" color="secondary" style={styles.flex}>
              Whenever you feel like moving, I&apos;ve got workouts ready — no pressure.
            </AppText>
          </View>
        )}
      </Appear>

      {/* Coach sign-off */}
      <Appear delay={T.signoff} duration={Dur.content} distance={Travel.card}>
        <View style={[styles.note, { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.2) }]}>
          <AILogoBadge size={34} />
          <AppText variant="body" color="secondary" style={styles.flex}>
            {meals.chosen
              ? "Your dishes, sized to your targets. I’ll fill the gaps and adjust as I learn how you eat and move."
              : "This is your starting point — I’ll adjust it as I learn how you eat and move. Let’s get going."}
          </AppText>
        </View>
      </Appear>

      {/* If a condition they just told us about CONSTRAINED these numbers, say
          so at the first sight of the target — before it can read as a
          prescription. Silent for everyone else. */}
      <Appear delay={T.notes} duration={Dur.content}>
        <TargetGuidanceNote guidance={targets.guidance as never} />
      </Appear>

      <Appear delay={T.notes + 80} duration={Dur.content}>
        <DisclaimerNote variant="card" />
      </Appear>

      <Appear delay={T.action} duration={Dur.content} distance={Travel.card}>
        <Button
          label={loading ? "Setting up…" : "Start my journey"}
          icon="arrow-forward"
          iconRight
          loading={loading}
          disabled={loading}
          onPress={onStart}
          size="lg"
        />
      </Appear>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: Spacing.lg },
  hero: { alignItems: "center", gap: Spacing.sm, paddingBottom: Spacing.sm },
  lede: { maxWidth: 420 },

  panel: {
    borderRadius: Radius.xxl,
    borderWidth: HAIRLINE,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  headGlyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  energy: { alignItems: "center" },
  split: { gap: Spacing.lg },
  bar: { height: 10, borderRadius: 5, flexDirection: "row", gap: 2, overflow: "hidden" },
  segment: { height: "100%", borderRadius: 5 },
  legend: { flexDirection: "row", justifyContent: "space-between" },
  legendItem: { gap: 2 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendValue: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  water: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    maxWidth: 150,
  },
  todayBlock: { gap: Spacing.md },
  thread: { gap: Spacing.lg },
  threadLine: { position: "absolute", left: 13, top: 14, bottom: 14, width: HAIRLINE },
  threadRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeSmall: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 8 },

  style: { gap: Spacing.md, borderTopWidth: HAIRLINE, paddingTop: Spacing.lg },
  styleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  score: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  reasons: { gap: Spacing.sm },
  reason: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  bullet: { width: 5, height: 5, borderRadius: 3 },

  week: { flexDirection: "row", justifyContent: "space-between" },
  weekCell: { alignItems: "center", gap: 6 },
  // 30pt: seven of them must fit a 320pt screen inside the panel's padding.
  weekDisc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekTick: { width: 4, height: 4, borderRadius: 2 },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
});
