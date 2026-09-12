/**
 * AnimatedQuestion — how the flow asks for something.
 *
 * A question arrives in three layers with a real gap between them: the kicker
 * naming where we are, then the question itself, then the supporting line. The
 * options follow only after a further ~300ms pause (`OPTIONS_DELAY`), which is
 * the single most important number in this file — it is the beat where the
 * screen is holding still and the user is reading. Remove it and the whole
 * flow reverts to feeling like a form that rendered.
 *
 * The order is deliberate: the SUPPORTING line lands before the options but
 * after the question, so the caveat ("not your workouts", "all optional") is
 * read as part of the question rather than discovered underneath the answers.
 */
import { AppText } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AnimatedText } from "./AnimatedText";
import { Appear } from "./Appear";
import { Dur, Stagger, Travel } from "./onboardingMotion";
import { Rhythm } from "./onboardingTheme";

/** When the question's own layers have finished arriving. */
const KICKER = 0;
const TITLE = 90;
const SUPPORT = 210;

/**
 * When a screen's options should begin revealing. Callers add their own
 * per-item stagger on top of this.
 */
export const OPTIONS_DELAY = SUPPORT + Stagger.question;

export interface AnimatedQuestionProps {
  /** Small label above the question. */
  kicker?: string;
  title: string;
  /** The supporting line. Kept to one sentence — two reads as instructions. */
  support?: string;
  /** A motif rendered above the kicker (see AmbientWellnessVisual). */
  motif?: React.ReactNode;
  /** Shifts the whole block later — used when a motif draws first. */
  delay?: number;
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
}

export function AnimatedQuestion({
  kicker,
  title,
  support,
  motif,
  delay = 0,
  align = "left",
  style,
}: AnimatedQuestionProps) {
  const centred = align === "center";
  return (
    <View style={[styles.block, centred && styles.centred, style]}>
      {motif ? (
        <Appear delay={delay} duration={Dur.content} distance={0} exitOrder={1} style={styles.motif}>
          {motif}
        </Appear>
      ) : null}

      {kicker ? (
        <AnimatedText
          variant="kicker"
          color="brand"
          uppercase
          align={centred ? "center" : undefined}
          delay={delay + KICKER}
          distance={Travel.rise * 0.6}
          duration={Dur.ui}
          exitOrder={1}
        >
          {kicker}
        </AnimatedText>
      ) : null}

      <AnimatedText
        variant="question"
        align={centred ? "center" : undefined}
        delay={delay + TITLE}
        duration={Dur.content}
        exitOrder={2}
      >
        {title}
      </AnimatedText>

      {support ? (
        <AnimatedText
          variant="support"
          color="secondary"
          align={centred ? "center" : undefined}
          delay={delay + SUPPORT}
          duration={Dur.content}
          exitOrder={1}
          style={styles.support}
        >
          {support}
        </AnimatedText>
      ) : null}
    </View>
  );
}

/**
 * A quiet line that reacts to what the user just chose. The flow's way of
 * saying "heard you" without a toast, a checkmark tally or a progress claim.
 * It re-animates whenever its text changes, so a changed selection is felt.
 */
export function MicroReaction({
  text,
  align = "left",
  style,
}: {
  text: string | null;
  align?: "left" | "center";
  style?: StyleProp<ViewStyle>;
}) {
  if (!text) return null;
  return (
    // Keyed on the text so a new reaction is a new element and replays the
    // entrance rather than silently swapping words in place.
    <Appear key={text} delay={120} duration={Dur.content} distance={Travel.rise * 0.7} style={style}>
      <AppText
        variant="subhead"
        color="secondary"
        align={align === "center" ? "center" : undefined}
        accessibilityLiveRegion="polite"
      >
        {text}
      </AppText>
    </Appear>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.sm },
  centred: { alignItems: "center" },
  motif: { marginBottom: Rhythm.crown - Spacing.sm },
  support: { maxWidth: 520 },
});
