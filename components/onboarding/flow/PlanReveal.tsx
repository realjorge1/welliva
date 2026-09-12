/**
 * PlanReveal — the payoff.
 *
 * Everything before this screen was the user giving. This is the screen that
 * gives back, so it is the only place in the flow allowed to take its time. The
 * plan assembles over roughly two and a half seconds: the statement, then the
 * ring drawing the calorie target, then the macros, then the diet match with
 * its score counting up and its reasons arriving one at a time, then training,
 * then the sign-off — and only once all of that has settled does the action
 * appear. A button present from the first frame would tell the user the screen
 * was a form with a plan on it.
 *
 * EVERY NUMBER HERE IS REAL. The targets come from `calculateNutritionTargets`,
 * the match from `recommendDiets` and the split from `generateWorkoutPlan`, all
 * over the same `buildBio()` that is about to be saved. The reveal animates the
 * PRESENTATION of those numbers and never invents one: the ring fills to 100%
 * because the target is the target, not because a progress value was faked, and
 * the count-ups start at zero and land on the computed value.
 */
import AILogoBadge from "@/components/gozlin/AILogoBadge";
import { DisclaimerNote } from "@/components/legal";
import { TargetGuidanceNote } from "@/components/nutrition/TargetGuidanceNote";
import {
  AnimatedNumber,
  AppText,
  Button,
  Card,
  Ring,
  Stat,
  useColors,
} from "@/components/ui";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AnimatedText } from "./AnimatedText";
import { Appear } from "./Appear";
import { OnboardingGlyph } from "./OnboardingGlyph";
import { Dur, Travel } from "./onboardingMotion";

/* The reveal's score. Every delay in this file comes from here, so the pacing
 * can be re-cut in one place rather than screen-wide. */
const T = {
  kicker: 0,
  title: 140,
  lede: 400,
  ring: 640,
  calories: 1000,
  macros: 1180,
  diet: 1520,
  score: 1700,
  reasons: 1780,
  training: 2180,
  signoff: 2380,
  notes: 2520,
  action: 2720,
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

export interface PlanRevealPreview {
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterMl: number;
    guidance?: unknown;
  };
  topDiet: { diet: { name: string }; score: number; reasons: string[] } | null;
  splitType: string;
  trainingDays: number;
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

export function PlanReveal({
  preview,
  lede,
  trainingEnabled,
  loading,
  onStart,
}: PlanRevealProps) {
  const { colors } = useColors();
  const { targets, topDiet, splitType, trainingDays, equipmentSummary } = preview;

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
        <AnimatedText
          variant="kicker"
          color="brand"
          uppercase
          align="center"
          delay={T.kicker}
          duration={Dur.ui}
        >
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

      {/* Calories + macros */}
      <Appear delay={T.ring - 200} duration={Dur.content} distance={Travel.card}>
        <Card style={styles.card}>
          <View style={styles.ringWrap}>
            <Ring
              progress={ringProgress}
              size={158}
              strokeWidth={13}
              gradient={Gradients.calories}
              duration={1300}
            >
              <RevealNumber value={targets.calories} delay={T.calories} />
              <AppText variant="caption" color="tertiary" uppercase>
                kcal / day
              </AppText>
            </Ring>
          </View>
          <View style={styles.macros}>
            {[
              { value: `${targets.proteinG}g`, label: "Protein", tone: colors.protein },
              { value: `${targets.carbsG}g`, label: "Carbs", tone: colors.carbs },
              { value: `${targets.fatG}g`, label: "Fat", tone: colors.fat },
              {
                value: `${(targets.waterMl / 1000).toFixed(1)}L`,
                label: "Water",
                tone: colors.water,
              },
            ].map((m, i) => (
              <Appear key={m.label} delay={T.macros + i * 90} duration={Dur.ui} distance={8}>
                <Stat value={m.value} label={m.label} tone={m.tone} />
              </Appear>
            ))}
          </View>
        </Card>
      </Appear>

      {/* Best-match diet */}
      {topDiet && (
        <Appear delay={T.diet} duration={Dur.content} distance={Travel.card}>
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <OnboardingGlyph name="plate" tone={colors.primary} size={30} />
              <View style={styles.flex}>
                <AppText variant="caption" color="tertiary" uppercase>
                  Your best match
                </AppText>
                <AppText variant="headline">{topDiet.diet.name}</AppText>
              </View>
              <View style={[styles.score, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                <RevealNumber
                  value={topDiet.score}
                  delay={T.score}
                  variant="title"
                  format={(n) => `${Math.round(n)}%`}
                />
              </View>
            </View>
            <View style={styles.reasons}>
              {topDiet.reasons.slice(0, 3).map((reason, i) => (
                <Appear key={reason} delay={T.reasons + i * 130} duration={Dur.ui} distance={8}>
                  <View style={styles.reason}>
                    <View style={[styles.bullet, { backgroundColor: alpha(colors.primary, 0.8) }]} />
                    <AppText variant="subhead" color="secondary" style={styles.flex}>
                      {reason}
                    </AppText>
                  </View>
                </Appear>
              ))}
            </View>
          </Card>
        </Appear>
      )}

      {/* Training — or, for someone who chose no movement goal, an open door. */}
      <Appear delay={T.training} duration={Dur.content} distance={Travel.card}>
        {trainingEnabled ? (
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <OnboardingGlyph name="strength" tone={colors.primary} size={30} />
              <View style={styles.flex}>
                <AppText variant="caption" color="tertiary" uppercase>
                  Your training
                </AppText>
                <AppText variant="headline">{splitType}</AppText>
              </View>
            </View>
            <View style={styles.pills}>
              <Pill text={`${trainingDays} days / week`} />
              <Pill text={equipmentSummary} />
            </View>
          </Card>
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
            This is your starting point — I&apos;ll adjust it as I learn how you eat and move.
            Let&apos;s get going.
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

function Pill({ text }: { text: string }) {
  const { colors } = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: alpha(colors.primary, 0.1) }]}>
      <AppText variant="subhead" color="secondary">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: Spacing.lg },
  hero: { alignItems: "center", gap: Spacing.sm, paddingBottom: Spacing.sm },
  lede: { maxWidth: 420 },

  card: { gap: Spacing.xl },
  ringWrap: { alignItems: "center" },
  macros: { flexDirection: "row", justifyContent: "space-between" },

  cardHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  score: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  reasons: { gap: Spacing.md },
  reason: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  bullet: { width: 5, height: 5, borderRadius: 3 },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
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
